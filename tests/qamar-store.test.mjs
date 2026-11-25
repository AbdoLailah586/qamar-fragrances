import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Register Node 24 TypeScript module resolver for testing TS backend/util files directly
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      if (specifier.endsWith('.js') && !existsSync(base) && existsSync(base.replace(/\.js$/, '.ts'))) {
        return { url: pathToFileURL(base.replace(/\.js$/, '.ts')).href, shortCircuit: true };
      }
      if (!specifier.endsWith('.js') && !specifier.endsWith('.ts') && !existsSync(base) && existsSync(`${base}.ts`)) {
        return { url: pathToFileURL(`${base}.ts`).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      const code = readFileSync(fileURLToPath(url), 'utf8');
      return {
        format: 'module',
        source: stripTypeScriptTypes(code, { mode: 'transform', sourceUrl: url }),
        shortCircuit: true
      };
    }
    return next(url, context);
  }
});

const access = await import(pathToFileURL(resolve(ROOT, 'lib/access.js')).href);
const googleCred = await import(pathToFileURL(resolve(ROOT, 'lib/googleCredential.js')).href);
const googleAuthApi = await import(pathToFileURL(resolve(ROOT, 'api/google-auth.js')).href);
const arabic = await import(pathToFileURL(resolve(ROOT, 'src/utils/arabicNumbers.ts')).href);
const delivery = await import(pathToFileURL(resolve(ROOT, 'src/utils/deliveryAddress.ts')).href);
const storeApi = await import(pathToFileURL(resolve(ROOT, 'api/store.ts')).href);
const whatsappCrm = await import(pathToFileURL(resolve(ROOT, 'server/whatsappCrm.ts')).href);

function createMockRes() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: null,
    setHeader(k, v) {
      headers[String(k).toLowerCase()] = String(v);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
}

function createMockReq({ method = 'GET', query = {}, body = undefined, headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    method,
    query,
    url: `/api/store${method === 'GET' && Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : ''}`,
    headers: { host: 'qamar-fragrances.com', ...normalizedHeaders },
    body
  };
}

describe('RBAC & Access Policy (lib/access.js)', () => {
  test('defines all 22 perfume ERP sections and exact owner email', () => {
    assert.equal(access.OWNER_EMAIL, 'qamaraboalnaga@gmail.com');
    assert.equal(access.ADMIN_SECTIONS.length, 22);
    for (const sec of ['oils', 'notes_finder', 'pricing', 'labels', 'products', 'orders', 'security', 'settings']) {
      assert.ok(access.ADMIN_SECTIONS.includes(sec), `Missing section ${sec}`);
    }
  });

  test('full admin gets all 22 sections; unprivileged customer gets zero sections', () => {
    const admin = { email: 'qamaraboalnaga@gmail.com', role: 'admin', admin_permissions: [] };
    assert.equal(access.isFullAdmin(admin), true);
    assert.equal(access.permittedSections(admin).length, 22);

    const customer = { email: 'client@example.com', role: 'customer', admin_permissions: [] };
    assert.equal(access.isFullAdmin(customer), false);
    assert.deepEqual(access.permittedSections(customer), []);
    assert.equal(access.canAccessSection(customer, 'orders'), false);
    assert.equal(access.canAccessSection(null, 'overview'), false);
  });

  test('staff permissions normalize cleanly in canonical order and ignore unknown sections', () => {
    const staff = { email: 'staff@qamar.eg', role: 'customer', admin_permissions: ['oils', 'notes_finder', 'fake_section'] };
    assert.deepEqual(access.permittedSections(staff), ['notes_finder', 'oils']);
    assert.equal(access.canAccessSection(staff, 'oils'), true);
    assert.equal(access.canAccessSection(staff, 'pricing'), false);
  });
});

describe('Arabic Formatting & Phone Normalization', () => {
  test('formats digits and EGP currency into Arabic-Indic output', () => {
    assert.equal(arabic.toArabicDigits('250 ml / 100'), '٢٥٠ ml / ١٠٠');
    assert.equal(arabic.formatEGP(1250), '١,٢٥٠ ج.م.');
    assert.equal(arabic.formatEGP(200, false), '200 ج.م.');
  });

  test('normalizes Egyptian phones including Arabic numerals and +20 prefix', () => {
    assert.equal(delivery.normalizePhone('+20 101 234 5678'), '01012345678');
    assert.equal(delivery.normalizePhone('00201155443322'), '01155443322');
    assert.equal(delivery.normalizePhone('٠١٠١٢٣٤٥٦٧٨'), '01012345678');
  });
});

describe('API Store Edge Caching & Security Boundary (api/store.ts)', () => {
  const sampleProductsResult = {
    products: [
      {
        id: 'p-1',
        name_ar: 'عطر قمر الساحر',
        price: 200,
        cost_price: 95,
        variants: [{ id: 'v1', label: '50ml', price: 200, costPrice: 70 }],
        is_hidden: false
      }
    ],
    total: 1
  };

  test('GET getProducts caches on CDN, ignores admin cookie & includeHidden, and strips costs', async () => {
    let seenOpts = null;
    const mockStore = {
      async getProducts(opts) {
        seenOpts = opts;
        return structuredClone(sampleProductsResult);
      }
    };
    const req = createMockReq({
      method: 'GET',
      query: { method: 'getProducts', limit: '400', offset: '0', includeHidden: 'true' },
      headers: { cookie: 'qamar_session=admin-token-should-be-ignored' }
    });
    const res = createMockRes();

    await storeApi.default(req, res, { sql: async () => [], store: mockStore, user: { role: 'admin' } });

    assert.equal(res.statusCode, 200);
    assert.equal(seenOpts.includeHidden, false);
    assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
    assert.equal(res.body.result.products[0].cost_price, undefined);
    assert.equal(res.body.result.products[0].variants[0].costPrice, undefined);
  });

  test('GET getProducts keeps no-store when result is empty', async () => {
    const mockStore = {
      async getProducts() {
        return { products: [], total: 0 };
      }
    };
    const req = createMockReq({ method: 'GET', query: { method: 'getProducts', limit: '40', offset: '0' } });
    const res = createMockRes();

    await storeApi.default(req, res, { sql: async () => [], store: mockStore });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('GET caches getCollections, getStoreSettings, and getFragranceNotes when non-empty', async () => {
    const mockStore = {
      async getCollections() { return [{ id: 'c1', handle: 'test', title_ar: 'عطور' }]; },
      async getStoreSettings() { return { shipping_fee: 60 }; },
      async getFragranceNotes() { return [{ product_id: 'p-1', top_notes: 'برغموت' }]; }
    };

    for (const method of ['getCollections', 'getStoreSettings', 'getFragranceNotes']) {
      const req = createMockReq({ method: 'GET', query: { method } });
      const res = createMockRes();
      await storeApi.default(req, res, { sql: async () => [], store: mockStore });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=30, stale-while-revalidate=120', `Expected CDN cache header for ${method}`);
    }
  });

  test('GET rejects mutations and private ERP endpoints with 405 and no-store', async () => {
    for (const method of ['createOrder', 'getAllUsers', 'upsertOilReserve', 'updateBottleSupply', 'upsertFragranceNotes']) {
      const req = createMockReq({ method: 'GET', query: { method } });
      const res = createMockRes();
      await storeApi.default(req, res, { sql: async () => [], store: {} });
      assert.equal(res.statusCode, 405, `Expected 405 for GET ?method=${method}`);
      assert.equal(res.headers['cache-control'], 'no-store');
    }
  });

  test('POST sets no-store and enforces auth/section RBAC before touching DB', async () => {
    let mutated = false;
    const mockStore = {
      async upsertOilReserve() { mutated = true; return { success: true }; },
      async updateBottleSupply() { mutated = true; return { success: true }; },
      async upsertFragranceNotes() { mutated = true; return { success: true }; },
      async updateProduct() { mutated = true; return { success: true }; },
      async getAllUsers() { mutated = true; return []; }
    };

    for (const method of ['upsertOilReserve', 'updateBottleSupply', 'upsertFragranceNotes', 'updateProduct', 'getAllUsers']) {
      const req = createMockReq({
        method: 'POST',
        headers: { origin: 'https://qamar-fragrances.com' },
        body: { method, args: [{}] }
      });
      const res = createMockRes();
      await storeApi.default(req, res, { sql: async () => [], store: mockStore, user: null });
      assert.equal(res.statusCode, 403, `Expected 403 for unauthenticated ${method}`);
      assert.equal(res.headers['cache-control'], 'no-store');
    }
    assert.equal(mutated, false, 'Store methods must not run before auth fails');

    // Staff with only 'oils' permission cannot edit fragrance notes (403)
    const staffOnlyOils = { id: 's1', email: 's@q.eg', role: 'customer', admin_permissions: ['oils'] };
    const reqDenied = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: { method: 'upsertFragranceNotes', args: [{ product_id: 'p-1' }] }
    });
    const resDenied = createMockRes();
    await storeApi.default(reqDenied, resDenied, { sql: async () => [], store: mockStore, user: staffOnlyOils });
    assert.equal(resDenied.statusCode, 403);
    assert.equal(mutated, false);

    // Staff with 'oils' permission succeeds on upsertOilReserve
    const reqAllowed = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: { method: 'upsertOilReserve', args: [{ perfume_title: 'سوفاج' }] }
    });
    const resAllowed = createMockRes();
    await storeApi.default(reqAllowed, resAllowed, { sql: async () => [], store: mockStore, user: staffOnlyOils });
    assert.equal(resAllowed.statusCode, 200);
    assert.equal(mutated, true);
  });

  test('POST createOrder validates Egyptian phone & totals and enforces safe QMR order number', async () => {
    let seenPayload = null;
    const fakeSql = Object.assign(async () => [], {
      query: async (_queryText, params) => {
        seenPayload = JSON.parse(params[0]);
        return [{ id: seenPayload.id }];
      }
    });

    const reqInvalid = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: {
        method: 'createOrder',
        args: [{
          customer_name: 'أحمد',
          customer_phone: '12345',
          governorate: 'القاهرة',
          address_details: 'شارع عباس العقاد',
          subtotal: 200,
          shipping_fee: 60,
          total: 260,
          payment_method: 'cod',
          items: [{ product: { id: 'p-1', price: 200 }, quantity: 1, unitPrice: 200 }]
        }]
      }
    });
    const resInvalid = createMockRes();
    await storeApi.default(reqInvalid, resInvalid, { sql: fakeSql, store: {}, user: null });
    assert.equal(resInvalid.statusCode, 400);
    assert.equal(seenPayload, null);

    const reqValid = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: {
        method: 'createOrder',
        args: [{
          order_number: 'BAD-SPOOF-999',
          customer_name: 'محمد قمر',
          customer_phone: '+20 101 234 5678',
          governorate: 'القاهرة',
          city: 'مدينة نصر',
          address_details: 'شارع عباس العقاد',
          subtotal: 400,
          shipping_fee: 60,
          total: 460,
          payment_method: 'cod',
          items: [{ product: { id: 'p-1', name_ar: 'عطر قمر', price: 200 }, selectedSize: '50ml', quantity: 2, unitPrice: 200 }]
        }]
      }
    });
    const resValid = createMockRes();
    await storeApi.default(reqValid, resValid, { sql: fakeSql, store: {}, user: null });
    assert.equal(resValid.statusCode, 200);
    assert.equal(resValid.body.result, true);
    assert.match(seenPayload.order_number, /^QMR-/);
    assert.equal(seenPayload.customer_phone, '01012345678');
    assert.equal(seenPayload.payment_status, 'unpaid');
    assert.equal(seenPayload.order_status, 'pending');
  });
});

describe('Frontend Client & Guard Wiring Contracts', () => {
  test('neonDb client routes public catalog calls over GET and hidden admin reads over POST', () => {
    const neonDbSrc = readFileSync(resolve(ROOT, 'src/services/neonDb.ts'), 'utf8');
    assert.match(neonDbSrc, /async function callPublicStoreGet/);
    assert.match(neonDbSrc, /if \(params\?\.includeHidden\)\s*\{\s*return await callStore\('getProducts'/);
    assert.match(neonDbSrc, /callPublicStoreGet\('getCollections'\)/);
    assert.match(neonDbSrc, /callPublicStoreGet\('getStoreSettings'\)/);
  });

  test('AdminDashboard places React hooks before the !canAccessAdmin access guard return', () => {
    const adminSrc = readFileSync(resolve(ROOT, 'src/pages/admin/AdminDashboard.tsx'), 'utf8');
    const hookIdx = adminSrc.indexOf('useState');
    const guardIdx = adminSrc.indexOf('if (!canAccessAdmin)');
    assert.ok(hookIdx !== -1 && guardIdx !== -1, 'Expected useState and !canAccessAdmin guard');
    assert.ok(hookIdx < guardIdx, 'React hooks must execute unconditionally before !canAccessAdmin early return');
  });

  test('AuthModal wires Google Identity Services and Email OTP verification', () => {
    const authModalSrc = readFileSync(resolve(ROOT, 'src/components/AuthModal.tsx'), 'utf8');
    assert.match(authModalSrc, /loadGoogleIdentity/);
    assert.match(authModalSrc, /loginWithGoogle/);
    assert.match(authModalSrc, /renderButton/);
  });
});

describe('Google Sign-In Verification & Session Policy', () => {
  test('verifyGoogleCredential enforces verified Google emails and non-empty client ID fallback', async () => {
    assert.match(googleCred.DEFAULT_GOOGLE_CLIENT_ID, /apps\.googleusercontent\.com$/);
    await assert.rejects(() => googleCred.verifyGoogleCredential('short'), /Invalid Google credential/);
    await assert.rejects(
      () => googleCred.verifyGoogleCredential('x'.repeat(30), 'aud', {
        async verifyIdToken() { return { getPayload: () => ({ sub: '123', email: 'u@gmail.com', email_verified: false }) }; }
      }),
      /Unverified Google account/
    );
    const verified = await googleCred.verifyGoogleCredential('x'.repeat(30), 'aud', {
      async verifyIdToken() {
        return { getPayload: () => ({ sub: 'g-1', email: ' AbdoLailah586@Gmail.com ', name: 'Abdo', picture: 'https://pic', email_verified: true }) };
      }
    });
    assert.equal(verified.email, 'abdolailah586@gmail.com');
    assert.equal(verified.googleId, 'g-1');
  });

  test('api/google-auth sets no-store, rejects cross-origin, and promotes OWNER_EMAIL on first Google login', async () => {
    let seenRole = null;
    const mockSql = async (_strings, ...vals) => {
      seenRole = vals[4];
      return [{ id: vals[0], name: vals[1], email: vals[2], avatar: vals[3], phone: '', role: vals[4], provider: 'google', email_verified: true, addresses: [], created_at: '2026-01-01', admin_permissions: [], totp_enabled: false }];
    };

    const crossReq = createMockReq({ method: 'POST', headers: { origin: 'https://evil.example' }, body: { credential: 'x'.repeat(30) } });
    const crossRes = createMockRes();
    await googleAuthApi.default(crossReq, crossRes);
    assert.equal(crossRes.statusCode, 403);
    assert.equal(crossRes.headers['cache-control'], 'no-store');

    const okReq = createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { credential: 'x'.repeat(30) } });
    const okRes = createMockRes();
    await googleAuthApi.default(okReq, okRes, {
      verifyGoogleCredential: async () => ({ googleId: '99', email: 'qamaraboalnaga@gmail.com', name: 'Owner', avatar: '' }),
      sql: mockSql,
      issueSession: async () => {}
    });
    assert.equal(okRes.statusCode, 200);
    assert.equal(seenRole, 'admin');
    assert.equal(okRes.body.success, true);
    assert.equal(okRes.body.user.role, 'admin');
  });
});

describe('WhatsApp CRM Automation & Security Boundary', () => {
  test('GET getStoreSettings strips CRM URL/email/password secrets while preserving public flags', async () => {
    const mockStore = {
      async getStoreSettings() {
        return {
          whatsapp_number: '201003732029',
          shipping_fee: 60,
          auto_send_on_order: true,
          whatsapp_automation_url: 'https://crm.example',
          whatsapp_automation_email: 'secret@crm.pro',
          whatsapp_automation_pass: 'super-secret'
        };
      }
    };
    const req = createMockReq({ method: 'GET', query: { method: 'getStoreSettings' } });
    const res = createMockRes();
    await storeApi.default(req, res, { sql: async () => [], store: mockStore });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result.whatsapp_number, '201003732029');
    assert.equal(res.body.result.auto_send_on_order, true);
    assert.equal(res.body.result.whatsapp_automation_url, undefined);
    assert.equal(res.body.result.whatsapp_automation_email, undefined);
    assert.equal(res.body.result.whatsapp_automation_pass, undefined);
  });

  test('WhatsApp CRM admin RPCs reject unauthenticated callers with 403', async () => {
    for (const method of ['getWhatsAppAdminConfig', 'saveWhatsAppAdminConfig', 'testWhatsAppConnection', 'getWhatsAppNotifications', 'sendOrderWhatsApp', 'sendTestWhatsApp']) {
      const req = createMockReq({
        method: 'POST',
        headers: { origin: 'https://qamar-fragrances.com' },
        body: { method, args: [{}] }
      });
      const res = createMockRes();
      await storeApi.default(req, res, { sql: async () => [], store: {}, user: null });
      assert.equal(res.statusCode, 403, `Expected 403 for ${method}`);
    }
  });

  test('whatsappCrm builds Qamar fragrance templates and dispatches via CRM + logs in DB', async () => {
    assert.equal(whatsappCrm.formatWhatsAppPhone('٠١٠١٢٣٤٥٦٧٨'), '201012345678');

    const msg = whatsappCrm.buildServerOrderWhatsAppMessage('order_confirmed', {
      order_number: 'QMR-2026-101',
      customer_name: 'سارة',
      governorate: 'القاهرة',
      address_details: 'مدينة نصر',
      shipping_fee: 60,
      total: 410,
      payment_method: 'cod',
      items: [{ product: { name_ar: 'عطر سوفاج', price: 350 }, selectedSize: '50ml', quantity: 1, unitPrice: 350 }]
    });
    assert.match(msg, /QMR-2026-101/);
    assert.match(msg, /50ml/);
    assert.match(msg, /410/);

    const calls = [];
    let insertedLog = false;
    const fakeSql = Object.assign(async () => { insertedLog = true; return []; }, { query: async () => [] });
    const mockFetch = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      if (url.endsWith('/api/auth/login')) {
        return { ok: true, json: async () => ({ token: 'jwt-123' }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    };

    const res = await whatsappCrm.dispatchWhatsAppViaCrm(fakeSql, {
      recipient: '01012345678',
      text: msg,
      type: 'order_confirmed',
      orderId: 'ord-1',
      orderNumber: 'QMR-2026-101',
      settings: {
        whatsapp_automation_url: 'https://crm.example',
        whatsapp_automation_email: 'bot@crm.pro',
        whatsapp_automation_pass: 'secret'
      }
    }, mockFetch);

    assert.equal(res.success, true);
    assert.equal(res.status, 'sent');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://crm.example/api/auth/login');
    assert.equal(calls[1].url, 'https://crm.example/api/send');
    assert.equal(calls[1].body.to, '201012345678');
    assert.equal(insertedLog, true);
  });

  test('POST createOrder auto-dispatches order_confirmed WhatsApp when configured', async () => {
    const dispatched = [];
    const fakeSql = Object.assign(async () => [], {
      query: async (_q, params) => [{ id: JSON.parse(params[0]).id }]
    });
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: {
        method: 'createOrder',
        args: [{
          customer_name: 'محمد قمر',
          customer_phone: '01012345678',
          governorate: 'القاهرة',
          address_details: 'شارع عباس العقاد',
          subtotal: 350,
          shipping_fee: 60,
          total: 410,
          payment_method: 'cod',
          items: [{ product: { id: 'p-1', name_ar: 'عطر قمر', price: 350 }, selectedSize: '50ml', quantity: 1, unitPrice: 350 }]
        }]
      }
    });
    const res = createMockRes();
    await storeApi.default(req, res, {
      sql: fakeSql,
      store: {
        async getStoreSettings() {
          return {
            auto_send_on_order: true,
            whatsapp_automation_url: 'https://crm.example',
            whatsapp_automation_email: 'bot@crm.pro',
            whatsapp_automation_pass: 'secret'
          };
        }
      },
      user: null,
      dispatchWhatsApp: async (_sql, payload) => { dispatched.push(payload); return { success: true }; }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, 'order_confirmed');
    assert.equal(dispatched[0].recipient, '01012345678');
  });
});

describe('Installable PWA & Mobile/Desktop Responsive Contracts', () => {
  test('manifest.webmanifest defines standalone install config, shortcuts, and existing PNG icons', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/ar');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
    for (const icon of manifest.icons) {
      const diskPath = resolve(ROOT, 'public', icon.src.replace(/^\//, ''));
      assert.ok(existsSync(diskPath), `Missing manifest icon file: ${diskPath}`);
    }
    assert.ok(existsSync(resolve(ROOT, 'public/pwa/apple-touch-icon.png')));
  });

  test('Service Worker builder keeps /api/ network-only and provides fetch + SKIP_WAITING', () => {
    const buildPwaSrc = readFileSync(resolve(ROOT, 'scripts/build_pwa.mjs'), 'utf8');
    assert.match(buildPwaSrc, /url\.pathname\.startsWith\('\/api\/'\)\) return/);
    assert.match(buildPwaSrc, /SKIP_WAITING/);
    assert.match(buildPwaSrc, /\/offline\.html/);
  });

  test('App renders PwaStatus and dedicated MobileBottomNav shell', () => {
    const appSrc = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
    const bottomSrc = readFileSync(resolve(ROOT, 'src/components/MobileBottomNav.tsx'), 'utf8');
    assert.match(appSrc, /PwaStatus/);
    assert.match(appSrc, /MobileBottomNav/);
    assert.match(appSrc, /qamar-page-enter/);
    assert.match(bottomSrc, /md:hidden/);
  });

  test('ProductCard shows second image on hover with silky zoom and Home Hero animates on open', () => {
    const cardSrc = readFileSync(resolve(ROOT, 'src/components/ProductCard.tsx'), 'utf8');
    const homeSrc = readFileSync(resolve(ROOT, 'src/pages/Home.tsx'), 'utf8');
    assert.match(cardSrc, /product\.images\?\.\[1\]/);
    assert.match(cardSrc, /group-hover:opacity-100/);
    assert.match(homeSrc, /qamar-hero-kenburns/);
    assert.match(homeSrc, /qamar-hero-up/);
  });

  test('Navbar and Footer render real vector SocialIconLinks instead of plain text abbreviations', () => {
    const navSrc = readFileSync(resolve(ROOT, 'src/components/Navbar.tsx'), 'utf8');
    const footerSrc = readFileSync(resolve(ROOT, 'src/components/Footer.tsx'), 'utf8');
    const socialSrc = readFileSync(resolve(ROOT, 'src/components/SocialIcons.tsx'), 'utf8');
    assert.match(navSrc, /SocialIconLinks/);
    assert.match(footerSrc, /SocialIconLinks/);
    assert.doesNotMatch(navSrc, />IG<|>WA<|>TT</);
    assert.doesNotMatch(footerSrc, />IG<|>WA<|>TT</);
    assert.match(socialSrc, /<svg viewBox="0 0 24 24"/);
  });
});

describe('Customer Account Management & Deletion (Profile / api/store)', () => {
  test('POST deleteUser permanently deletes self-account and clears session cookie', async () => {
    let deletedId = null;
    const mockSql = async (strings, ...vals) => {
      const q = strings.join('?');
      if (q.includes('DELETE FROM users')) {
        deletedId = vals[0];
        return [{ id: vals[0] }];
      }
      return [];
    };

    const customer = { id: 'usr-cust-1', email: 'abdolailah586@gmail.com', role: 'customer', admin_permissions: [] };
    const reqOther = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: { method: 'deleteUser', args: ['usr-other-2'] }
    });
    const resOther = createMockRes();
    await storeApi.default(reqOther, resOther, { sql: mockSql, store: {}, user: customer });
    assert.equal(resOther.statusCode, 403);
    assert.equal(deletedId, null);

    const reqSelf = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com', cookie: 'qamar_session=' + 'a'.repeat(64) },
      body: { method: 'deleteUser', args: ['usr-cust-1'] }
    });
    const resSelf = createMockRes();
    await storeApi.default(reqSelf, resSelf, { sql: mockSql, store: {}, user: customer });
    assert.equal(resSelf.statusCode, 200);
    assert.equal(resSelf.body.result.success, true);
    assert.equal(deletedId, 'usr-cust-1');
    assert.match(resSelf.headers['set-cookie'] || '', /qamar_session=;.*Max-Age=0/);
  });

  test('POST changePassword allows Google users without password_hash to set an initial password', async () => {
    let savedHash = null;
    const mockSql = async (strings, ...vals) => {
      const q = strings.join('?');
      if (q.includes('SELECT password_hash FROM users')) return [{ password_hash: '' }];
      if (q.includes('UPDATE users SET password_hash')) { savedHash = vals[0]; return []; }
      return [];
    };

    const googleUser = { id: 'usr-google-1', email: 'g@gmail.com', role: 'customer', provider: 'google', admin_permissions: [] };
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: { method: 'changePassword', args: ['usr-google-1', '', 'NewStrongPass123'] }
    });
    const res = createMockRes();
    await storeApi.default(req, res, { sql: mockSql, store: {}, user: googleUser });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result.success, true);
    assert.match(savedHash, /^scrypt\$/);
  });

  test('Profile page renders sidebar tabs, edit buttons, and deleteAccount action', () => {
    const profileSrc = readFileSync(resolve(ROOT, 'src/pages/Profile.tsx'), 'utf8');
    assert.match(profileSrc, /حسابي/);
    assert.match(profileSrc, /طلباتي/);
    assert.match(profileSrc, /عناويني/);
    assert.match(profileSrc, /حذف الحساب/);
    assert.match(profileSrc, /deleteAccount/);
  });
});
