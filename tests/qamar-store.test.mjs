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
const egyptLocation = await import(pathToFileURL(resolve(ROOT, 'src/utils/egyptLocation.ts')).href);
const attribution = await import(pathToFileURL(resolve(ROOT, 'src/utils/visitorAttribution.ts')).href);
const seo = await import(pathToFileURL(resolve(ROOT, 'src/utils/seo.ts')).href);
const sitemapApi = await import(pathToFileURL(resolve(ROOT, 'api/sitemap.js')).href);
const metaFeedApi = await import(pathToFileURL(resolve(ROOT, 'api/meta-feed.js')).href);
const ogProductApi = await import(pathToFileURL(resolve(ROOT, 'api/og-product.js')).href);
const adLinks = await import(pathToFileURL(resolve(ROOT, 'src/utils/adLinks.ts')).href);
const metaPixel = await import(pathToFileURL(resolve(ROOT, 'src/utils/metaPixel.ts')).href);
const storeApi = await import(pathToFileURL(resolve(ROOT, 'api/store.ts')).href);
const whatsappCrm = await import(pathToFileURL(resolve(ROOT, 'server/whatsappCrm.ts')).href);
const paymentGateway = await import(pathToFileURL(resolve(ROOT, 'server/paymentGateway.ts')).href);
const paymentCallbackApi = await import(pathToFileURL(resolve(ROOT, 'api/payment-callback.ts')).href);

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

describe('Checkout GPS & Manual Map Location Picker', () => {
  test('validates safe Google Maps URLs and persists coordinates cleanly via delivery notes', () => {
    assert.equal(delivery.isGoogleMapsUrl(''), true);
    assert.equal(delivery.isGoogleMapsUrl('https://www.google.com/maps?q=31.0409,31.3785'), true);
    assert.equal(delivery.isGoogleMapsUrl('https://maps.app.goo.gl/abc123'), true);
    assert.equal(delivery.isGoogleMapsUrl('javascript:alert(1)'), false);
    assert.equal(delivery.isGoogleMapsUrl('https://evil.example.com/maps?q=1,2'), false);

    const url = delivery.coordsToGoogleMapsUrl(31.0409123, 31.3785123);
    assert.equal(url, 'https://www.google.com/maps?q=31.040912,31.378512');

    const encoded = delivery.encodeDeliveryNotes({
      city: 'المنصورة',
      address_details: 'شارع الجمهورية',
      notes: 'تغليف هدية',
      customer_whatsapp: '01003732029',
      google_maps_url: url,
      latitude: 31.0409123,
      longitude: 31.3785123
    });
    const decoded = delivery.decodeDeliveryNotes(encoded);
    assert.equal(decoded.google_maps_url, url);
    assert.equal(decoded.latitude, 31.040912);
    assert.equal(decoded.longitude, 31.378512);

    const unsafeDecoded = delivery.decodeDeliveryNotes(JSON.stringify({
      city: 'القاهرة',
      google_maps_url: 'javascript:alert(1)'
    }));
    assert.equal(unsafeDecoded.google_maps_url, undefined);
  });

  test('matches Arabic/English reverse-geocoded governorate names accurately', () => {
    assert.equal(egyptLocation.matchGovernorateFromText('محافظة الدقهلية، المنصورة'), 'الدقهلية - المنصورة');
    assert.equal(egyptLocation.matchGovernorateFromText('Cairo Governorate, Egypt'), 'القاهرة');
    assert.equal(egyptLocation.matchGovernorateFromText('Alexandria, Egypt'), 'الإسكندرية');
  });

  test('includes delivery map URL in WhatsApp confirmation when provided and permits geolocation on Vercel', () => {
    const mapUrl = 'https://www.google.com/maps?q=31.040900,31.378500';
    const withMap = whatsappCrm.buildServerOrderWhatsAppMessage('order_confirmed', {
      order_number: 'QMR-2026-999111',
      customer_name: 'عميل الخريطة',
      governorate: 'الدقهلية - المنصورة',
      shipping_fee: 45,
      total: 495,
      payment_method: 'cod',
      google_maps_url: mapUrl,
      items: []
    });
    assert.match(withMap, /https:\/\/www\.google\.com\/maps\?q=31\.040900,31\.378500/);

    const vercelCfg = readFileSync(resolve(ROOT, 'vercel.json'), 'utf8');
    const checkoutSrc = readFileSync(resolve(ROOT, 'src/pages/Checkout.tsx'), 'utf8');
    const adminOrdersSrc = readFileSync(resolve(ROOT, 'src/pages/admin/OrdersCrmSupportPanel.tsx'), 'utf8');
    assert.match(vercelCfg, /geolocation=\(self\)/);
    assert.doesNotMatch(vercelCfg, /geolocation=\(\)/);
    assert.match(checkoutSrc, /navigator\.geolocation\.getCurrentPosition/);
    assert.match(checkoutSrc, /LocationPickerMap/);
    assert.match(adminOrdersSrc, /google_maps_url/);
  });
});

describe('Admin Users CRM, Insights & Legal Policy Pages', () => {
  test('adminCreateUser enforces Full Admin RBAC, hashes passwords, and strips secrets', async () => {
    const insertedRows = [];
    const mockSql = async (strings, ...vals) => {
      const q = strings.join('?');
      if (q.includes('SELECT id FROM users WHERE lower(email)')) {
        return vals[0] === 'existing@qamar.com' ? [{ id: 'usr-old' }] : [];
      }
      if (q.includes('INSERT INTO users')) {
        const row = {
          id: vals[0],
          name: vals[1],
          email: vals[2],
          phone: vals[3],
          password_hash: vals[4],
          role: vals[5],
          admin_permissions: JSON.parse(vals[6] || '[]'),
          provider: 'email',
          email_verified: true,
          addresses: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        insertedRows.push(row);
        return [row];
      }
      return [];
    };

    const staffOnly = { id: 'usr-staff', email: 'staff@qamar.com', role: 'customer', admin_permissions: ['users'] };
    const reqDenied = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: { method: 'adminCreateUser', args: [{ name: 'موظف', email: 'new@qamar.com', password: 'Password123', role: 'customer', permissions: ['orders'] }] }
    });
    const resDenied = createMockRes();
    await storeApi.default(reqDenied, resDenied, { sql: mockSql, store: {}, user: staffOnly });
    assert.equal(resDenied.statusCode, 403);

    const admin = { id: 'usr-owner', email: 'qamaraboalnaga@gmail.com', role: 'admin', admin_permissions: [] };
    const reqOk = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: { method: 'adminCreateUser', args: [{ name: 'أحمد مبيعات', email: 'Ahmed@Qamar.com', phone: '01012345678', password: 'Password123', role: 'customer', permissions: ['orders', 'crm'] }] }
    });
    const resOk = createMockRes();
    await storeApi.default(reqOk, resOk, { sql: mockSql, store: {}, user: admin });
    assert.equal(resOk.statusCode, 200);
    assert.equal(resOk.body.result.success, true);
    assert.equal(resOk.body.result.user.email, 'ahmed@qamar.com');
    assert.equal(resOk.body.result.user.password_hash, undefined);
    assert.deepEqual(resOk.body.result.user.admin_permissions, ['orders', 'crm']);
    assert.match(insertedRows[0].password_hash, /^scrypt\$/);

    const reqDup = createMockReq({
      method: 'POST',
      headers: { origin: 'https://qamar-fragrances.com' },
      body: { method: 'adminCreateUser', args: [{ name: 'مكرر', email: 'existing@qamar.com', password: 'Password123', role: 'customer' }] }
    });
    const resDup = createMockRes();
    await storeApi.default(reqDup, resDup, { sql: mockSql, store: {}, user: admin });
    assert.equal(resDup.statusCode, 409);
  });

  test('getAllUsers and getUserInsights require users section and preserve CRM telemetry', async () => {
    const customer = { id: 'usr-1', email: 'c@qamar.com', role: 'customer', admin_permissions: [] };
    const staffWithUsers = { id: 'usr-2', email: 'u@qamar.com', role: 'customer', admin_permissions: ['users'] };
    const fakeStore = {
      async getAllUsers() {
        return [{
          id: 'usr-9',
          name: 'سارة',
          email: 'sara@example.com',
          phone: '01001112223',
          role: 'customer',
          provider: 'google',
          email_verified: true,
          created_at: '2026-11-20T10:00:00Z',
          last_seen_at: '2026-11-25T14:00:00Z',
          last_activity_at: '2026-11-25T14:05:00Z',
          orders_count: 3,
          completed_orders_count: 2,
          total_spent: 1850,
          cart_items_count: 2,
          cart_subtotal: 700,
          views_count: 15,
          password_hash: 'secret-should-strip'
        }];
      },
      async getUserInsights(id) {
        return { success: true, user: { id }, recentViews: [{ product_id: 'p1', view_count: 2 }], activeCarts: [{ items: [{}], subtotal: 400 }], orders: [] };
      }
    };

    const res403 = createMockRes();
    await storeApi.default(createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method: 'getUserInsights', args: ['usr-9'] } }), res403, { sql: async () => [], store: fakeStore, user: customer });
    assert.equal(res403.statusCode, 403);

    const resList = createMockRes();
    await storeApi.default(createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method: 'getAllUsers', args: [] } }), resList, { sql: async () => [], store: fakeStore, user: staffWithUsers });
    assert.equal(resList.statusCode, 200);
    assert.equal(resList.body.result[0].views_count, 15);
    assert.equal(resList.body.result[0].cart_items_count, 2);
    assert.equal(resList.body.result[0].completed_orders_count, 2);
    assert.equal(resList.body.result[0].password_hash, undefined);

    const resIns = createMockRes();
    await storeApi.default(createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method: 'getUserInsights', args: ['usr-9'] } }), resIns, { sql: async () => [], store: fakeStore, user: staffWithUsers });
    assert.equal(resIns.statusCode, 200);
    assert.equal(resIns.body.result.recentViews.length, 1);
  });

  test('UsersCrmPanel, PolicyPage, Footer, and StoreContext expose full user CRM and policy routes', () => {
    const crmSrc = readFileSync(resolve(ROOT, 'src/pages/admin/UsersCrmPanel.tsx'), 'utf8');
    const policySrc = readFileSync(resolve(ROOT, 'src/pages/PolicyPage.tsx'), 'utf8');
    const policyDefaultsSrc = readFileSync(resolve(ROOT, 'src/utils/policyDefaults.ts'), 'utf8');
    const policyEditorSrc = readFileSync(resolve(ROOT, 'src/pages/admin/PolicyPagesEditorCard.tsx'), 'utf8');
    const footerSrc = readFileSync(resolve(ROOT, 'src/components/Footer.tsx'), 'utf8');
    const ctxSrc = readFileSync(resolve(ROOT, 'src/context/StoreContext.tsx'), 'utf8');
    const appSrc = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');

    assert.match(crmSrc, /إضافة حساب جديد/);
    assert.match(crmSrc, /حذف الحساب/);
    assert.match(crmSrc, /آخر 15 منتج زارهم/);
    assert.match(crmSrc, /في السلة الآن/);
    assert.match(crmSrc, /الأوردرات المنفذة/);
    assert.match(crmSrc, /آخر ترافيك/);

    assert.match(policySrc, /getDefaultPolicyDoc/);
    assert.match(policySrc, /policy_pages/);
    assert.match(policyDefaultsSrc, /شروط وأحكام استخدام المتجر/);
    assert.match(policyDefaultsSrc, /سياسة الخصوصية وحماية البيانات/);
    assert.match(policyDefaultsSrc, /سياسة الاستبدال والاسترجاع/);
    assert.match(policyDefaultsSrc, /سياسة الشحن والتوصيل/);
    assert.match(policyEditorSrc, /تعديل محتوى صفحات السياسات والشروط والأحكام/);
    assert.match(footerSrc, /navigate\('terms'\)/);
    assert.match(footerSrc, /navigate\('privacy'\)/);
    assert.match(footerSrc, /navigate\('refund'\)/);
    assert.match(footerSrc, /navigate\('shipping'\)/);
    assert.match(ctxSrc, /\/ar\/privacy-policy/);
    assert.match(ctxSrc, /\/ar\/return-policy/);
    assert.match(ctxSrc, /\/ar\/shipping-policy/);
    assert.match(appSrc, /PolicyPage/);
  });
});

describe('Admin WhatsApp Alert on New Orders', () => {
  test('POST createOrder dispatches instant admin_new_order WhatsApp with customer details, payment method, and direct chat link', async () => {
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
          customer_name: 'أحمد قمر',
          customer_phone: '01098765432',
          customer_whatsapp: '01098765432',
          governorate: 'الدقهلية - المنصورة',
          city: 'المنصورة',
          address_details: 'شارع الجمهورية برج النيل',
          google_maps_url: 'https://www.google.com/maps?q=31.040900,31.378500',
          subtotal: 350,
          shipping_fee: 45,
          total: 395,
          payment_method: 'instapay',
          payment_reference: 'IP-9988',
          notes: 'الاتصال قبل الوصول',
          items: [{ product: { id: 'p-1', name_ar: 'عطر ميجامير', price: 350 }, selectedSize: '50ml', quantity: 1, unitPrice: 350 }]
        }]
      }
    });
    const res = createMockRes();
    await storeApi.default(req, res, {
      sql: fakeSql,
      store: {
        async getStoreSettings() {
          return {
            whatsapp_number: '201003732029',
            admin_alert_whatsapp_number: '01003732029, 01554826209',
            auto_send_on_order: true,
            auto_alert_admin_on_order: true,
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
    assert.equal(dispatched.length, 3);
    assert.equal(dispatched[0].type, 'order_confirmed');
    assert.equal(dispatched[0].recipient, '01098765432');

    const adminAlerts = dispatched.filter(d => d.type === 'admin_new_order');
    assert.equal(adminAlerts.length, 2);
    assert.deepEqual(adminAlerts.map(a => a.recipient), ['201003732029', '201554826209']);

    const body = adminAlerts[0].text;
    assert.match(body, /أحمد قمر/);
    assert.match(body, /01098765432/);
    assert.match(body, /عطر ميجامير/);
    assert.match(body, /395/);
    assert.match(body, /إنستاباي InstaPay/);
    assert.match(body, /IP-9988/);
    assert.match(body, /https:\/\/wa\.me\/201098765432\?text=/);
    assert.match(body, /https:\/\/www\.google\.com\/maps\?q=31\.040900,31\.378500/);
  });

  test('SystemAdminPanel exposes admin order alert toggle, recipient phone input, and admin_new_order template', () => {
    const sysSrc = readFileSync(resolve(ROOT, 'src/pages/admin/SystemAdminPanel.tsx'), 'utf8');
    assert.match(sysSrc, /admin_new_order/);
    assert.match(sysSrc, /auto_alert_admin_on_order/);
    assert.match(sysSrc, /admin_alert_whatsapp_number/);
    assert.match(sysSrc, /تنبيه فوري للأدمن على الواتساب عند وصول أي طلب جديد/);
  });
});

describe('Guest Tracking, Ad Attribution, SEO & Home Recently Viewed', () => {
  test('detectVisitorAttribution accurately classifies Facebook, Instagram, TikTok, Google Ads/Search, and device type', () => {
    const fb = attribution.detectVisitorAttribution({
      search: '?utm_source=facebook&utm_medium=cpc&utm_campaign=ramadan_oud&fbclid=IwAR123',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
      pathname: '/ar/shop'
    });
    assert.equal(fb.source_channel, 'facebook_ads');
    assert.match(fb.source_label, /إعلان فيسبوك/);
    assert.equal(fb.utm_campaign, 'ramadan_oud');
    assert.match(fb.device_type, /موبايل/);

    const ig = attribution.detectVisitorAttribution({
      referrer: 'https://l.instagram.com/',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      pathname: '/ar'
    });
    assert.equal(ig.source_channel, 'instagram');
    assert.match(ig.source_label, /إنستجرام/);
    assert.match(ig.device_type, /Desktop/);

    const tt = attribution.detectVisitorAttribution({
      search: '?ttclid=abc999&utm_campaign=megamare_video',
      pathname: '/ar/product/all/megamare'
    });
    assert.equal(tt.source_channel, 'tiktok_ads');
    assert.match(tt.source_label, /إعلان تيك توك/);

    const gSearch = attribution.detectVisitorAttribution({
      referrer: 'https://www.google.com/',
      pathname: '/ar'
    });
    assert.equal(gSearch.source_channel, 'google_search');
    assert.match(gSearch.source_label, /بحث جوجل/);

    const gAds = attribution.detectVisitorAttribution({
      search: '?gclid=CjwKCAiA',
      pathname: '/ar'
    });
    assert.equal(gAds.source_channel, 'google_ads');
    assert.match(gAds.source_label, /إعلان جوجل/);
  });

  test('getGuestVisitors, getGuestInsights, and deleteGuestVisitor enforce RBAC safely', async () => {
    const customer = { id: 'usr-c', email: 'c@qamar.com', role: 'customer', admin_permissions: [] };
    const crmStaff = { id: 'usr-s', email: 'crm@qamar.com', role: 'customer', admin_permissions: ['crm'] };
    const fullAdmin = { id: 'usr-a', email: 'admin@qamar.com', role: 'admin', admin_permissions: [] };
    const fakeStore = {
      async getGuestVisitors() { return [{ session_id: 'qmr_123', source_channel: 'tiktok_ads', views_count: 4 }]; },
      async getGuestInsights(sid) { return { success: true, guest: { session_id: sid }, recentViews: [], orders: [] }; },
      async deleteGuestVisitor(sid) { return { success: true, sid }; }
    };

    const r403 = createMockRes();
    await storeApi.default(createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method: 'getGuestVisitors', args: [] } }), r403, { sql: async () => [], store: fakeStore, user: customer });
    assert.equal(r403.statusCode, 403);

    const rGuests = createMockRes();
    await storeApi.default(createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method: 'getGuestVisitors', args: [] } }), rGuests, { sql: async () => [], store: fakeStore, user: crmStaff });
    assert.equal(rGuests.statusCode, 200);
    assert.equal(rGuests.body.result[0].source_channel, 'tiktok_ads');

    const rDelDenied = createMockRes();
    await storeApi.default(createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method: 'deleteGuestVisitor', args: ['qmr_123'] } }), rDelDenied, { sql: async () => [], store: fakeStore, user: crmStaff });
    assert.equal(rDelDenied.statusCode, 403);

    const rDelOk = createMockRes();
    await storeApi.default(createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method: 'deleteGuestVisitor', args: ['qmr_123'] } }), rDelOk, { sql: async () => [], store: fakeStore, user: fullAdmin });
    assert.equal(rDelOk.statusCode, 200);
  });

  test('SEO JSON-LD Product/Store schemas, sitemap.xml, robots.txt, and Home Recently Viewed section work cleanly', async () => {
    const productSchemas = seo.buildProductJsonLd('https://qamar-fragrances.com', {
      id: 'p1',
      handle: 'sauvage-elixir',
      sku: 'QMR-01',
      name_ar: 'سوفاج اليكسير',
      name_en: 'Sauvage Elixir',
      category: 'عطور-رجالى-ديزاينر',
      brand: 'Dior / Qamar',
      price: 350,
      in_stock: true,
      variants: [{ label: '30ml', price: 250 }, { label: '50ml', price: 350 }],
      images: ['/qamar-images/test.webp']
    }, { store_name_ar: 'قمر للعطور' }, [{ rating: 5, status: 'approved' }]);
    assert.equal(productSchemas[0]['@type'], 'Product');
    assert.equal(productSchemas[0].offers['@type'], 'AggregateOffer');
    assert.equal(productSchemas[0].offers.priceCurrency, 'EGP');
    assert.equal(productSchemas[0].aggregateRating.ratingValue, 5);
    assert.equal(productSchemas[1]['@type'], 'BreadcrumbList');

    let xmlBody = '';
    const sRes = {
      setHeader() {},
      status() { return this; },
      send(body) { xmlBody = body; return this; }
    };
    await sitemapApi.default({ headers: { host: 'qamar-fragrances.com', 'x-forwarded-proto': 'https' } }, sRes);
    assert.match(xmlBody, /<urlset/);
    assert.match(xmlBody, /https:\/\/qamar-fragrances\.com\/ar\/shop/);
    assert.match(xmlBody, /https:\/\/qamar-fragrances\.com\/ar\/privacy-policy/);

    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf8');
    const vercelCfg = readFileSync(resolve(ROOT, 'vercel.json'), 'utf8');
    const homeSrc = readFileSync(resolve(ROOT, 'src/pages/Home.tsx'), 'utf8');
    const crmSrc = readFileSync(resolve(ROOT, 'src/pages/admin/UsersCrmPanel.tsx'), 'utf8');

    assert.match(robots, /Sitemap: https:\/\/qamar-fragrances\.com\/sitemap\.xml/);
    assert.match(vercelCfg, /\/sitemap\.xml/);
    assert.match(homeSrc, /عطور زرتها مؤخراً/);
    assert.match(homeSrc, /home-recently-viewed/);
    assert.match(crmSrc, /الزوار بدون حساب/);
  });
});

describe('Meta Ads Tools: Social Crawler OG, Catalog Feed CSV/XML, Pixel & Encoded Links', () => {
  test('encodes Arabic/space product handles for Meta Carousel URLs and validates Meta Pixel IDs strictly', () => {
    const adUrl = adLinks.buildProductAdUrl({
      origin: 'https://qamarfragrances.com',
      handle: 'Timber Amouage تيمبر امواج',
      source: 'facebook',
      medium: 'cpc',
      campaign: 'winter_ads'
    });
    assert.match(adUrl, /^https:\/\/qamarfragrances\.com\/ar\/product\/all\/Timber%20Amouage/);
    assert.doesNotMatch(adUrl, /\s/);
    assert.match(adUrl, /utm_source=facebook/);
    assert.match(adUrl, /utm_campaign=winter_ads/);

    assert.equal(metaPixel.normalizeMetaPixelId('123456789012345'), '123456789012345');
    assert.equal(metaPixel.normalizeMetaPixelId('  9876543210  '), '9876543210');
    assert.equal(metaPixel.normalizeMetaPixelId('alert(1)'), '');
    assert.equal(metaPixel.normalizeMetaPixelId('123'), '');
  });

  test('meta-feed.js generates valid Meta Commerce CSV and XML feeds with EGP prices and encoded links', async () => {
    const sampleProducts = [{
      id: 'Product_1',
      handle: 'Gris Charnel BDK Parfums',
      name_ar: 'جريس تشارنيل BDK',
      brand: 'BDK Parfums',
      price: 175,
      stock_quantity: 20,
      images: ['/qamar-images/img1.webp', '/qamar-images/img2.webp'],
      specs: {}
    }];

    let csvOut = '';
    await metaFeedApi.default(
      { url: '/api/meta-feed?format=csv', headers: { host: 'qamarfragrances.com', 'x-forwarded-proto': 'https' } },
      { setHeader() {}, status() { return this; }, send(b) { csvOut = b; return this; } },
      { products: sampleProducts }
    );
    assert.match(csvOut, /id,title,description,availability,condition,price,link,image_link/);
    assert.match(csvOut, /"175\.00 EGP"/);
    assert.match(csvOut, /https:\/\/qamarfragrances\.com\/ar\/product\/all\/Gris%20Charnel%20BDK%20Parfums/);
    assert.match(csvOut, /https:\/\/qamarfragrances\.com\/qamar-images\/img1\.webp/);

    let xmlOut = '';
    await metaFeedApi.default(
      { url: '/api/meta-feed?format=xml', headers: { host: 'qamarfragrances.com', 'x-forwarded-proto': 'https' } },
      { setHeader() {}, status() { return this; }, send(b) { xmlOut = b; return this; } },
      { products: sampleProducts }
    );
    assert.match(xmlOut, /<g:id>Product_1<\/g:id>/);
    assert.match(xmlOut, /<g:price>175\.00 EGP<\/g:price>/);
    assert.match(xmlOut, /<g:image_link>https:\/\/qamarfragrances\.com\/qamar-images\/img1\.webp<\/g:image_link>/);
  });

  test('og-product.js and vercel.json serve product OpenGraph metadata to Facebook/Instagram/WhatsApp bots', async () => {
    let htmlOut = '';
    await ogProductApi.default(
      { query: { id: 'Gris%20Charnel%20BDK%20Parfums' }, headers: { host: 'qamarfragrances.com', 'x-forwarded-proto': 'https' } },
      { setHeader() {}, status() { return this; }, send(b) { htmlOut = b; return this; } },
      {
        product: {
          id: 'Product_1',
          handle: 'Gris Charnel BDK Parfums',
          name_ar: 'Gris Charnel BDK Parfums',
          brand: 'BDK Parfums',
          price: 175,
          stock_quantity: 10,
          images: ['/qamar-images/img1.webp']
        }
      }
    );
    assert.match(htmlOut, /property="og:image" content="https:\/\/qamarfragrances\.com\/qamar-images\/img1\.webp"/);
    assert.match(htmlOut, /property="product:price:amount" content="175"/);
    assert.match(htmlOut, /property="product:price:currency" content="EGP"/);
    assert.match(htmlOut, /application\/ld\+json/);

    const vercelCfg = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
    const botRewrites = (vercelCfg.rewrites || []).filter(r => String(r.destination || '').includes('/api/og-product'));
    assert.ok(botRewrites.length >= 2);
    assert.match(botRewrites[0].has[0].value, /facebookexternalhit/);
    assert.match(botRewrites[0].has[0].value, /WhatsApp/);
    assert.ok(vercelCfg.rewrites.some(r => r.source === '/meta-feed.csv'));
    assert.ok(vercelCfg.rewrites.some(r => r.source === '/meta-feed.xml'));

    const marketingSrc = readFileSync(resolve(ROOT, 'src/pages/admin/MarketingAdToolsCard.tsx'), 'utf8');
    assert.match(marketingSrc, /meta-feed\.csv/);
    assert.match(marketingSrc, /meta_pixel_id/);
  });
});

describe('Online Payment Gateway Infrastructure (Kashier / Paymob) & Liquid Glass Dock', () => {
  test('GET getStoreSettings strips payment secrets while exposing safe payment_gateway_public capabilities', async () => {
    const mockStore = {
      async getStoreSettings() {
        return {
          whatsapp_number: '201003732029',
          payment_gateway_provider: 'kashier',
          payment_gateway_mode: 'test',
          payment_gateway_merchant_id: 'MID-12345',
          payment_gateway_api_key: 'super-secret-api-key',
          payment_gateway_secret_key: 'super-secret-key',
          payment_gateway_hmac_secret: 'super-hmac',
          payment_gateway_enable_card: true,
          payment_gateway_enable_wallet: true,
          payment_gateway_enable_instapay: false
        };
      }
    };
    const req = createMockReq({ method: 'GET', query: { method: 'getStoreSettings' } });
    const res = createMockRes();
    await storeApi.default(req, res, { sql: async () => [], store: mockStore });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result.payment_gateway_api_key, undefined);
    assert.equal(res.body.result.payment_gateway_secret_key, undefined);
    assert.equal(res.body.result.payment_gateway_hmac_secret, undefined);
    assert.equal(res.body.result.payment_gateway_public.configured, true);
    assert.equal(res.body.result.payment_gateway_public.provider, 'kashier');
    assert.deepEqual(res.body.result.payment_gateway_public.methods, { card: true, wallet: true, instapay: false });
  });

  test('Payment gateway admin RPCs enforce RBAC and unconfigured card checkout is rejected cleanly', async () => {
    for (const method of ['getPaymentGatewayAdminConfig', 'savePaymentGatewayConfig', 'testPaymentGatewayConfig']) {
      const res = createMockRes();
      await storeApi.default(
        createMockReq({ method: 'POST', headers: { origin: 'https://qamar-fragrances.com' }, body: { method, args: [{}] } }),
        res,
        { sql: async () => [], store: {}, user: null }
      );
      assert.equal(res.statusCode, 403);
    }

    const resUnconf = createMockRes();
    await storeApi.default(
      createMockReq({
        method: 'POST',
        headers: { origin: 'https://qamar-fragrances.com' },
        body: {
          method: 'createOrder',
          args: [{
            customer_name: 'أحمد قمر',
            customer_phone: '01012345678',
            governorate: 'القاهرة',
            address_details: 'شارع عباس العقاد',
            subtotal: 300,
            shipping_fee: 50,
            total: 350,
            payment_method: 'card',
            items: [{ product: { id: 'p-1', name_ar: 'عطر قمر', price: 300 }, selectedSize: '50ml', quantity: 1, unitPrice: 300 }]
          }]
        }
      }),
      resUnconf,
      { sql: Object.assign(async () => [], { query: async () => [] }), store: { async getStoreSettings() { return {}; } }, user: null }
    );
    assert.equal(resUnconf.statusCode, 400);
  });

  test('Kashier createOrder returns signed checkoutUrl and /api/payment-callback verifies HMAC before marking paid', async () => {
    const updates = [];
    const fakeSql = Object.assign(
      async (strings, ...vals) => {
        const q = strings.join('?');
        if (q.includes('UPDATE orders')) {
          updates.push({ q, vals });
          return [{
            id: 'ord-k1',
            order_number: 'QMR-2026-KASH1',
            customer_name: 'عميل كاشير',
            customer_phone: '01012345678',
            governorate: 'القاهرة',
            address: 'المعادي',
            items: [{ product: { name_ar: 'عطر قمر', price: 300 }, quantity: 1, unitPrice: 300 }],
            subtotal: 300,
            shipping_fee: 50,
            total: 350,
            payment_method: 'card',
            payment_status: 'paid'
          }];
        }
        return [];
      },
      { query: async (_q, params) => [{ id: JSON.parse(params[0]).id }] }
    );
    const kashierSettings = {
      payment_gateway_provider: 'kashier',
      payment_gateway_mode: 'test',
      payment_gateway_merchant_id: 'MID-TEST-99',
      payment_gateway_api_key: 'test-kashier-api-key',
      payment_gateway_enable_card: true,
      payment_gateway_enable_wallet: true,
      payment_gateway_enable_instapay: true
    };

    const resCreate = createMockRes();
    await storeApi.default(
      createMockReq({
        method: 'POST',
        headers: { origin: 'https://qamar-fragrances.com', host: 'qamar-fragrances.com', 'x-forwarded-proto': 'https' },
        body: {
          method: 'createOrder',
          args: [{
            id: 'ord-k1',
            order_number: 'QMR-2026-KASH1',
            customer_name: 'عميل كاشير',
            customer_phone: '01012345678',
            governorate: 'القاهرة',
            address_details: 'المعادي',
            subtotal: 300,
            shipping_fee: 50,
            total: 350,
            payment_method: 'card',
            items: [{ product: { id: 'p-1', name_ar: 'عطر قمر', price: 300 }, selectedSize: '50ml', quantity: 1, unitPrice: 300 }]
          }]
        }
      }),
      resCreate,
      { sql: fakeSql, store: { async getStoreSettings() { return kashierSettings; } }, user: null }
    );
    assert.equal(resCreate.statusCode, 200);
    assert.equal(resCreate.body.result.payment.provider, 'kashier');
    assert.match(resCreate.body.result.payment.checkoutUrl, /^https:\/\/checkout\.kashier\.io\/\?/);
    assert.match(resCreate.body.result.payment.checkoutUrl, /merchantId=MID-TEST-99/);
    assert.match(resCreate.body.result.payment.checkoutUrl, /currency=EGP/);

    const badWebhookRes = createMockRes();
    await paymentCallbackApi.default(
      {
        method: 'POST',
        url: '/api/payment-callback?provider=kashier',
        headers: { 'x-kashier-signature': '00'.repeat(32) },
        body: { data: { merchantOrderId: 'QMR-2026-KASH1', status: 'SUCCESS', signatureKeys: ['status', 'merchantOrderId'] } }
      },
      badWebhookRes,
      { sql: fakeSql, store: { async getStoreSettings() { return kashierSettings; } } }
    );
    assert.equal(badWebhookRes.statusCode, 400);
    assert.equal(updates.length, 0);

    const { createHmac } = await import('node:crypto');
    const payloadData = { merchantOrderId: 'QMR-2026-KASH1', status: 'SUCCESS', transactionId: 'TXN-88', signatureKeys: ['merchantOrderId', 'status'] };
    const sig = createHmac('sha256', kashierSettings.payment_gateway_api_key).update('merchantOrderId=QMR-2026-KASH1&status=SUCCESS').digest('hex');

    const goodWebhookRes = createMockRes();
    await paymentCallbackApi.default(
      {
        method: 'POST',
        url: '/api/payment-callback?provider=kashier',
        headers: { 'x-kashier-signature': sig },
        body: { data: payloadData }
      },
      goodWebhookRes,
      { sql: fakeSql, store: { async getStoreSettings() { return kashierSettings; } } }
    );
    assert.equal(goodWebhookRes.statusCode, 200);
    assert.equal(goodWebhookRes.body.verified, true);
    assert.equal(goodWebhookRes.body.paid, true);
    assert.equal(updates.length, 1);
  });

  test('MobileBottomNav renders floating iPhone Liquid Glass pill detached from bottom edge', () => {
    const bottomSrc = readFileSync(resolve(ROOT, 'src/components/MobileBottomNav.tsx'), 'utf8');
    const cssSrc = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8');
    const cardSrc = readFileSync(resolve(ROOT, 'src/pages/admin/PaymentGatewaySettingsCard.tsx'), 'utf8');
    assert.match(bottomSrc, /bottom-\[max\(14px,env\(safe-area-inset-bottom\)\)\]/);
    assert.match(bottomSrc, /qamar-liquid-glass-dock/);
    assert.match(bottomSrc, /rounded-full/);
    assert.match(cssSrc, /backdrop-filter:\s*blur\(26px\)/);
    assert.match(cardSrc, /Kashier/);
    assert.match(cardSrc, /Paymob/);
    assert.ok(typeof paymentGateway.verifyPaymobHmac === 'function');
  });

  test('WhatsApp per-event checkboxes default to disabled and gate createOrder & updateOrderState individually', async () => {
    const defaultCfg = whatsappCrm.resolveCrmConfig({
      whatsapp_automation_url: 'https://crm.example',
      whatsapp_automation_email: 'bot@crm.pro',
      whatsapp_automation_pass: 'secret'
    });
    for (const key of ['admin_new_order', 'order_confirmed', 'payment_verified', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']) {
      assert.equal(defaultCfg.shouldAutoSend(key), false, `Expected ${key} to default to false`);
    }

    const dispatched = [];
    const sampleOrder = {
      id: 'ord-qmr-chk-1',
      order_number: 'QMR-2026-CHK1',
      customer_name: 'سلمى قمر',
      customer_phone: '01011223344',
      customer_whatsapp: '01011223344',
      governorate: 'القاهرة',
      address_details: 'مدينة نصر',
      subtotal: 400,
      shipping_fee: 60,
      total: 460,
      payment_method: 'cod',
      items: [{ product: { id: 'p-1', name_ar: 'عطر قمر', price: 400 }, selectedSize: '50ml', quantity: 1, unitPrice: 400 }]
    };
    const fakeSql = Object.assign(
      async (strings) => (/SELECT \* FROM orders/i.test(strings.join('?')) ? [sampleOrder] : []),
      { query: async (_q, params) => [{ id: JSON.parse(params[0]).id }] }
    );
    const adminUser = { id: 'adm-qmr', role: 'admin', admin_permissions: ['orders', 'whatsapp'] };
    const selectiveSettings = {
      whatsapp_automation_url: 'https://crm.example',
      whatsapp_automation_email: 'bot@crm.pro',
      whatsapp_automation_pass: 'secret',
      admin_alert_whatsapp_number: '01003732029',
      whatsapp_auto_triggers: {
        admin_new_order: false,
        order_confirmed: true,
        payment_verified: false,
        processing: false,
        shipped: true,
        out_for_delivery: false,
        delivered: false,
        cancelled: false
      }
    };

    const runRpc = async (method, args, user) => {
      const req = createMockReq({
        method: 'POST',
        headers: { origin: 'https://qamar-fragrances.com' },
        body: { method, args }
      });
      const res = createMockRes();
      await storeApi.default(req, res, {
        sql: fakeSql,
        store: { async getStoreSettings() { return selectiveSettings; } },
        user,
        dispatchWhatsApp: async (_sql, payload) => { dispatched.push(payload.type); return { success: true }; }
      });
      return res;
    };

    await runRpc('createOrder', [sampleOrder], null);
    await runRpc('updateOrderState', [sampleOrder.id, { payment_status: 'verified' }], adminUser);
    await runRpc('updateOrderState', [sampleOrder.id, { order_status: 'processing' }], adminUser);
    await runRpc('updateOrderState', [sampleOrder.id, { order_status: 'shipped' }], adminUser);
    await runRpc('updateOrderState', [sampleOrder.id, { order_status: 'delivered' }], adminUser);

    assert.deepEqual(dispatched, ['order_confirmed', 'shipped']);
  });

  test('AuthModal and Checkout require explicit acceptance of Store Policies, Terms, Privacy, and Cookies', () => {
    const authSrc = readFileSync(resolve(ROOT, 'src/components/AuthModal.tsx'), 'utf8');
    assert.match(authSrc, /auth-policy-checkbox/);
    assert.match(authSrc, /Cookies/);
    assert.match(authSrc, /!acceptedPolicies/);

    const checkoutSrc = readFileSync(resolve(ROOT, 'src/pages/Checkout.tsx'), 'utf8');
    assert.match(checkoutSrc, /checkout-policy-checkbox/);
    assert.match(checkoutSrc, /Cookies/);
    assert.match(checkoutSrc, /if \(!acceptedPolicies\)/);
    assert.match(checkoutSrc, /navigate\('terms'\)/);
    assert.match(checkoutSrc, /navigate\('privacy'\)/);
  });

  test('CookieBanner shows only on first visit per device and persists consent across subsequent visits', async () => {
    const ts = (await import('typescript')).default;
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const React = req('react');
    const iconsMod = new Proxy({}, { get: (_, name) => name === '__esModule' ? true : () => React.createElement('svg') });
    const storeMap = new Map();
    const mocks = {
      react: React,
      'lucide-react': iconsMod,
      '../context/StoreContext': { useStore: () => ({ navigate: () => {} }) },
      '../utils/browserStorage': {
        readStorage: (k) => storeMap.get(k) ?? null,
        writeStorage: (k, v) => { storeMap.set(k, v); return true; }
      }
    };
    const src = readFileSync(resolve(ROOT, 'src/components/CookieBanner.tsx'), 'utf8');
    const code = ts.transpileModule(src, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', code)(id => mocks[id] || req(id), mod, mod.exports);
    const cookieMod = mod.exports;

    assert.equal(cookieMod.hasCookieConsent(), false);
    assert.equal(cookieMod.saveCookieConsent('essential'), true);
    assert.equal(cookieMod.hasCookieConsent(), true);

    const appSrc = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
    assert.match(appSrc, /CookieBanner/);
  });
});
