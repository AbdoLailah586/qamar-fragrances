import { neonDb, mapRowToOrder, logAudit } from '../server/store.js';
import { database, currentUser, issueSession, endSession, sameOrigin, passwordHash, passwordMatches, pendingSecondFactor } from '../lib/session.js';
import { generateTotpSecret, totpAuthUrl, verifyTotpCode } from '../lib/totp.js';
import { randomBytes, createHash } from 'node:crypto';
import { canAccessSection, isFullAdmin, normalizePermissions, publicUser, OWNER_EMAIL } from '../lib/access.js';
import { normalizePhone } from '../src/utils/deliveryAddress.js';
import { saveOrder, cancelOrder as cancelStoredOrder } from '../server/orderWrites.js';
import { buildServerOrderWhatsAppMessage, dispatchWhatsAppViaCrm, resolveCrmConfig } from '../server/whatsappCrm.js';
import {
  enforceRateLimitOr429,
  getRateLimitSecurityReport,
  verifyBotIdIfActive
} from '../lib/rateLimit.js';
import {
  stripPaymentSecrets,
  toPublicPaymentGatewayState,
  shouldRouteOrderToGateway,
  createGatewayCheckoutSession,
  resolveRequestOrigin,
  normalizeGatewayMethod
} from '../server/paymentGateway.js';

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const forbidden = () => fail(403, 'هذا الإجراء غير متاح ضمن صلاحيات حسابك.');
const hasAny = (user: any, sections: string[]) => sections.some(section => canAccessSection(user, section));

const productSections = ['products', 'inventory', 'quality', 'stocktake', 'reorder', 'labels', 'suppliers'];
const orderSections = ['overview', 'analytics', 'orders', 'crm'];

const policies: Record<string, string[]> = {
  toggleProductVisibility: ['products'],
  updateProduct: ['products'],
  bulkInsertProducts: ['products'],
  deleteProduct: ['products'],
  getAllUsers: ['users'],
  getUserInsights: ['users'],
  getGuestVisitors: ['users', 'crm'],
  getGuestInsights: ['users', 'crm'],
  getActiveCarts: ['crm'],
  updateOrderState: ['orders'],
  getOilReserves: ['oils', 'inventory', 'products'],
  upsertOilReserve: ['oils'],
  deleteOilReserve: ['oils'],
  getBottleSupplies: ['oils', 'inventory', 'reorder'],
  updateBottleSupply: ['oils', 'inventory'],
  upsertFragranceNotes: ['notes_finder', 'products'],
  getAuditLog: ['security'],
  getPickingList: ['fulfillment'],
  getDeliveryBoard: ['fulfillment'],
  updateOrderStatus: ['orders', 'fulfillment'],
  confirmPacking: ['fulfillment'],
  recordDeliveryRefusal: ['fulfillment'],
  getRefusalHistory: ['fulfillment'],
  getAllRefusals: ['fulfillment'],
  addSupplierQuote: ['suppliers'],
  getSupplierQuotes: ['suppliers'],
  listSupportTickets: ['support'],
  escalateSupportTicket: ['support'],
  closeSupportTicket: ['support'],
  getWishlistGap: ['overview', 'analytics'],
  updateStoreSettings: ['overview', 'products', 'settings'],
  getAllProductReviews: ['overview', 'products'],
  updateProductReviewStatus: ['overview', 'products'],
  deleteProductReview: ['overview', 'products'],
  getWhatsAppAdminConfig: ['whatsapp', 'settings'],
  saveWhatsAppAdminConfig: ['whatsapp', 'settings'],
  testWhatsAppConnection: ['whatsapp', 'settings'],
  getWhatsAppNotifications: ['whatsapp', 'orders'],
  sendOrderWhatsApp: ['whatsapp', 'orders', 'fulfillment'],
  sendTestWhatsApp: ['whatsapp', 'settings'],
  getPaymentGatewayAdminConfig: ['settings'],
  savePaymentGatewayConfig: ['settings'],
  testPaymentGatewayConfig: ['settings'],
  getSecurityShieldReport: ['security'],
  getMetaFeedConfig: ['overview', 'products', 'settings'],
  rotateMetaFeedToken: ['security', 'settings']
};

function safeSettings(settings: any) {
  if (!settings || typeof settings !== 'object') return settings;
  const copy = stripPaymentSecrets(settings);
  delete copy.whatsapp_automation_url;
  delete copy.whatsapp_automation_email;
  delete copy.whatsapp_automation_pass;
  delete copy.meta_feed_token;
  copy.payment_gateway_public = toPublicPaymentGatewayState(settings);
  return copy;
}

function safeProduct(product: any, privileged: boolean) {
  if (privileged) return product;
  const p = { ...product };
  delete p.cost_price;
  if (Array.isArray(p.variants)) {
    p.variants = p.variants.map((v: any) => {
      const copy = { ...v };
      delete copy.costPrice;
      return copy;
    });
  }
  return p;
}

const PUBLIC_GET_METHODS = new Set(['getProducts', 'getCollections', 'getStoreSettings', 'getFragranceNotes']);
const PUBLIC_CACHE_HEADER = 'public, max-age=0, s-maxage=30, stale-while-revalidate=120';

function parsePublicGetRequest(rawUrl: string) {
  const url = new URL(rawUrl || '/api/store', 'http://localhost');
  const method = url.searchParams.get('method') || '';
  if (!PUBLIC_GET_METHODS.has(method)) return null;
  if (method !== 'getProducts') return { method, args: [] as any[] };

  const params: Record<string, any> = { includeHidden: false };
  for (const key of ['limit', 'offset', 'minPrice', 'maxPrice']) {
    const val = url.searchParams.get(key);
    if (val !== null && val !== '') {
      const n = Number(val);
      if (Number.isFinite(n)) params[key] = n;
    }
  }
  for (const key of ['category', 'search', 'size', 'sort']) {
    const val = url.searchParams.get(key);
    if (val) params[key] = val;
  }
  return { method, args: [params] };
}

export async function execute(req: any, res: any, body: any, deps?: any) {
  const sql = deps?.sql || database();
  const store = deps?.store || neonDb;
  const method = body?.method;
  const args = Array.isArray(body?.args) ? body.args : [];
  if (typeof method !== 'string') throw fail(400, 'طلب غير صالح.');

  const user = deps && 'user' in deps ? deps.user : await currentUser(req, sql);

  if (method === 'getSession') return { success: true, user };
  if (method === 'logout') { await endSession(req, res, sql); return true; }

  if (method === 'completeSecondFactor') {
    if (!deps?.skipRateLimit) {
      const rl = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'auth_2fa_ip',
        maxHits: 10,
        windowSeconds: 900,
        blockSeconds: 900,
        path: '/api/store:completeSecondFactor',
        message: 'تم تجاوز محاولات التحقق الثنائي. انتظر 15 دقيقة ثم أعد المحاولة.'
      });
      if (rl.limited) throw Object.assign(fail(429, rl.error), { code: 'RATE_LIMITED' });
    }
    const pending = await pendingSecondFactor(req, sql);
    if (!pending || !pending.totp_enabled || !verifyTotpCode(pending.totp_secret, args[0])) {
      throw Object.assign(fail(401, 'كود المصادقة غير صحيح أو انتهت جلسة التحقق.'), { code: 'TOTP_INVALID' });
    }
    const claimed = await sql`DELETE FROM app_sessions WHERE token_hash=${pending.token_hash} AND two_factor_verified=false RETURNING user_id`;
    if (!claimed.length) throw forbidden();
    await issueSession(req, res, pending.id, sql);
    return { success: true, user: publicUser(pending) };
  }

  if (method === 'authenticateUser') {
    const [email, password] = args;
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 512) throw fail(400, 'بيانات الدخول غير صالحة.');
    const cleanEmail = email.trim().toLowerCase();
    if (!deps?.skipBotId) {
      const botCheck = await verifyBotIdIfActive(req, 'basic', deps);
      if (botCheck.blocked) throw Object.assign(fail(403, 'تم رصد طلب آلي غير مصرح به في تسجيل الدخول.'), { code: 'BOT_BLOCKED' });
    }
    if (!deps?.skipRateLimit) {
      const rlIp = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'signin_ip',
        maxHits: 10,
        windowSeconds: 900,
        blockSeconds: 900,
        path: '/api/store:authenticateUser',
        message: 'تم تجاوز الحد المسموح لمحاولات تسجيل الدخول من هذا الجهاز. انتظر 15 دقيقة ثم حاول مجدداً.'
      });
      if (rlIp.limited) throw Object.assign(fail(429, rlIp.error), { code: 'RATE_LIMITED' });
      const rlEmail = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'signin_email',
        scopeKey: cleanEmail,
        maxHits: 8,
        windowSeconds: 900,
        blockSeconds: 900,
        path: '/api/store:authenticateUser',
        message: 'تم تقييد محاولات الدخول لهذا الحساب مؤقتاً لحمايته. انتظر 15 دقيقة.'
      });
      if (rlEmail.limited) throw Object.assign(fail(429, rlEmail.error), { code: 'RATE_LIMITED' });
    }
    const rows = await sql`SELECT * FROM users WHERE lower(email)=${cleanEmail} LIMIT 1`;
    const row = rows[0];
    if (!row || !passwordMatches(password, row.password_hash)) {
      throw fail(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
    if (!row.password_hash.startsWith('scrypt$')) {
      await sql`UPDATE users SET password_hash=${passwordHash(password)} WHERE id=${row.id}`;
    }
    await issueSession(req, res, row.id, sql, !row.totp_enabled);
    if (row.totp_enabled) return { success: false, requiresTotp: true, code: 'TOTP_REQUIRED', error: 'أدخل كود تطبيق المصادقة لإكمال الدخول.' };
    return { success: true, user: publicUser(row) };
  }

  if (method === 'registerCustomer') {
    const [name, email, phone, password] = args;
    if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 6 || password.length > 512) {
      throw fail(400, 'أدخل اسم وبريد إلكتروني وكلمة مرور صالحة (6 أحرف على الأقل).');
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!deps?.skipBotId) {
      const botCheck = await verifyBotIdIfActive(req, 'basic', deps);
      if (botCheck.blocked) throw Object.assign(fail(403, 'تم حظر التسجيل الآلي بواسطة نظام الحماية.'), { code: 'BOT_BLOCKED' });
    }
    if (!deps?.skipRateLimit) {
      const rl = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'register_ip',
        maxHits: 6,
        windowSeconds: 1800,
        blockSeconds: 1800,
        path: '/api/store:registerCustomer',
        message: 'تم تجاوز حد إنشاء الحسابات المسموح به. انتظر 30 دقيقة ثم حاول مجدداً.'
      });
      if (rl.limited) throw Object.assign(fail(429, rl.error), { code: 'RATE_LIMITED' });
    }
    const existing = await sql`SELECT id FROM users WHERE lower(email)=${cleanEmail} LIMIT 1`;
    if (existing.length) throw fail(409, 'هذا البريد الإلكتروني مسجل بالفعل. قم بتسجيل الدخول.');
    const userId = `usr-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const rows = await sql`
      INSERT INTO users (id, name, email, phone, password_hash, role, admin_permissions, provider, email_verified)
      VALUES (${userId}, ${String(name || 'عميل قمر للعطور').trim().slice(0, 150)}, ${cleanEmail}, ${normalizePhone(String(phone || ''))}, ${passwordHash(password)}, 'customer', '[]'::jsonb, 'email', false)
      RETURNING id, name, email, phone, avatar, role, provider, email_verified, addresses, created_at, admin_permissions
    `;
    await issueSession(req, res, rows[0].id, sql, true);
    return { success: true, user: publicUser(rows[0]) };
  }

  if (method === 'getUserAccess') {
    if (!user || user.id !== args[0]) return { success: true, exists: false };
    return { success: true, exists: true, role: user.role, admin_permissions: user.admin_permissions };
  }

  if (method === 'updateUserAccess' || method === 'updateUserRole') {
    if (!isFullAdmin(user)) throw forbidden();
    const [id, input] = args;
    const access = method === 'updateUserRole' ? { role: input, permissions: [] } : input;
    if (typeof id !== 'string' || !access || !['admin', 'customer'].includes(access.role) || !Array.isArray(access.permissions)) {
      throw fail(400, 'حدد نوع الحساب والأقسام المسموح بها.');
    }
    if (id === user.id) throw fail(400, 'لا يمكنك تغيير صلاحيات حسابك الحالي.');
    const permissions = normalizePermissions(access.permissions);
    if (permissions.length !== new Set(access.permissions).size) throw fail(400, 'قائمة الصلاحيات تحتوي على قسم غير معروف.');
    const rows = await sql`
      UPDATE users SET role=${access.role}, admin_permissions=${JSON.stringify(access.role === 'admin' ? [] : permissions)}::jsonb, updated_at=NOW()
      WHERE id=${id} AND lower(email)<>${OWNER_EMAIL} RETURNING *
    `;
    if (!rows[0]) throw fail(400, 'الحساب غير موجود أو هو حساب المالك المحمي.');
    if (!deps) await logAudit({ actorId: user.id, actorName: user.name, action: 'USER_ACCESS_CHANGED', entity: 'user', entityId: id, after: { role: access.role, permissions } });
    return { success: true, user: publicUser(rows[0]) };
  }

  if (policies[method] && !hasAny(user, policies[method])) throw forbidden();

  if (['setupTotp', 'confirmTotp', 'disableTotp'].includes(method)) {
    if (!user || user.id !== args[0] || (!isFullAdmin(user) && !canAccessSection(user, 'security'))) throw forbidden();
    const rows = await sql`SELECT totp_enabled, totp_secret, totp_pending_secret FROM users WHERE id=${user.id}`;
    const row = rows[0];
    if (method === 'setupTotp') {
      if (row.totp_enabled) throw fail(400, 'عطّل المصادقة الحالية أولاً.');
      const secret = generateTotpSecret();
      await sql`UPDATE users SET totp_pending_secret=${secret} WHERE id=${user.id}`;
      return { success: true, secret, otpauthUrl: totpAuthUrl(secret, user.email) };
    }
    if (method === 'confirmTotp') {
      if (!verifyTotpCode(row.totp_pending_secret, args[1])) throw fail(400, 'كود التفعيل غير صحيح.');
      await sql`UPDATE users SET totp_secret=totp_pending_secret, totp_pending_secret=NULL, totp_enabled=true WHERE id=${user.id}`;
      await sql`DELETE FROM app_sessions WHERE user_id=${user.id}`;
      await issueSession(req, res, user.id, sql);
    } else {
      if (!verifyTotpCode(row.totp_secret, args[1])) throw fail(400, 'كود المصادقة غير صحيح.');
      await sql`UPDATE users SET totp_secret=NULL, totp_pending_secret=NULL, totp_enabled=false WHERE id=${user.id}`;
    }
    return { success: true };
  }

  if (method === 'getProducts') {
    const params = { ...(args[0] || {}) };
    const privileged = hasAny(user, productSections);
    params.includeHidden = privileged && params.includeHidden === true;
    const maxAllowed = privileged ? 500 : 100;
    params.limit = Math.max(1, Math.min(maxAllowed, Number(params.limit) || 50));
    params.offset = Math.max(0, Number(params.offset) || 0);
    const result = await store.getProducts(params);
    return { ...result, products: result.products.map((p: any) => safeProduct(p, privileged)) };
  }

  if (method === 'getCollections') return store.getCollections();
  if (method === 'getStoreSettings') return safeSettings(await store.getStoreSettings());
  if (method === 'getFragranceNotes') return store.getFragranceNotes();

  if (method === 'getOrders') {
    if (hasAny(user, orderSections)) return store.getOrders();
    if (!user) return [];
    const rows = await sql`SELECT * FROM orders WHERE lower(customer_email)=${user.email.toLowerCase()} ORDER BY created_at DESC LIMIT 100`;
    return rows.map(mapRowToOrder);
  }

  if (method === 'updateStoreSettings') {
    const current = (await store.getStoreSettings().catch(() => null)) || {};
    const incoming = args[0] && typeof args[0] === 'object' ? { ...args[0] } : {};
    delete incoming.payment_gateway_public;
    // Keep server-side CRM and payment gateway secrets intact unless updated via their dedicated admin actions
    const merged = {
      ...incoming,
      whatsapp_auto_triggers: incoming.whatsapp_auto_triggers ?? current.whatsapp_auto_triggers,
      policy_pages: incoming.policy_pages ?? current.policy_pages,
      meta_feed_token: current.meta_feed_token,
      whatsapp_automation_url: current.whatsapp_automation_url,
      whatsapp_automation_email: current.whatsapp_automation_email,
      whatsapp_automation_pass: current.whatsapp_automation_pass,
      payment_gateway_provider: current.payment_gateway_provider,
      payment_gateway_mode: current.payment_gateway_mode,
      payment_gateway_merchant_id: current.payment_gateway_merchant_id,
      payment_gateway_api_key: current.payment_gateway_api_key,
      payment_gateway_secret_key: current.payment_gateway_secret_key,
      payment_gateway_public_key: current.payment_gateway_public_key,
      payment_gateway_hmac_secret: current.payment_gateway_hmac_secret,
      payment_gateway_card_integration_id: current.payment_gateway_card_integration_id,
      payment_gateway_wallet_integration_id: current.payment_gateway_wallet_integration_id,
      payment_gateway_instapay_integration_id: current.payment_gateway_instapay_integration_id,
      payment_gateway_enable_card: current.payment_gateway_enable_card,
      payment_gateway_enable_wallet: current.payment_gateway_enable_wallet,
      payment_gateway_enable_instapay: current.payment_gateway_enable_instapay
    };
    return store.updateStoreSettings(merged);
  }

  if (method === 'getAllUsers') {
    const rows = await store.getAllUsers();
    return rows.map((u: any) => ({
      ...publicUser(u),
      last_seen_at: u.last_seen_at || null,
      last_activity_at: u.last_activity_at || u.last_seen_at || u.updated_at || u.created_at,
      orders_count: Number(u.orders_count || 0),
      completed_orders_count: Number(u.completed_orders_count || 0),
      total_spent: Number(u.total_spent || 0),
      cart_items_count: Number(u.cart_items_count || 0),
      cart_subtotal: Number(u.cart_subtotal || 0),
      views_count: Number(u.views_count || 0),
      source_channel: u.source_channel || null,
      source_label: u.source_label || null,
      utm_campaign: u.utm_campaign || null,
      device_type: u.device_type || null
    }));
  }

  if (method === 'getUserInsights') {
    const userId = String(args[0] || '').trim();
    if (!userId) throw fail(400, 'معرف الحساب مطلوب.');
    return store.getUserInsights(userId);
  }

  if (method === 'getGuestVisitors') {
    return store.getGuestVisitors(args[0]);
  }

  if (method === 'getGuestInsights') {
    const sid = String(args[0] || '').trim();
    if (!sid) throw fail(400, 'معرف الجلسة مطلوب.');
    return store.getGuestInsights(sid);
  }

  if (method === 'deleteGuestVisitor') {
    if (!isFullAdmin(user)) throw forbidden();
    const sid = String(args[0] || '').trim();
    if (!sid) throw fail(400, 'معرف الجلسة مطلوب.');
    return store.deleteGuestVisitor(sid);
  }

  if (method === 'getRecentlyViewedProductIds') {
    return store.getRecentlyViewedProductIds(String(args[0] || ''), user?.id);
  }

  if (method === 'adminCreateUser') {
    if (!isFullAdmin(user)) throw forbidden();
    const input = args[0] || {};
    const name = String(input.name || '').trim().slice(0, 150);
    const cleanEmail = String(input.email || '').trim().toLowerCase();
    const phone = normalizePhone(String(input.phone || ''));
    const password = String(input.password || '');
    const role = input.role === 'admin' ? 'admin' : 'customer';
    const permissions = role === 'admin' ? [] : normalizePermissions(input.permissions);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || password.length < 6 || password.length > 512) {
      throw fail(400, 'أدخل الاسم وبريد إلكتروني صحيح وكلمة مرور لا تقل عن 6 أحرف.');
    }
    const existing = await sql`SELECT id FROM users WHERE lower(email)=${cleanEmail} LIMIT 1`;
    if (existing.length) throw fail(409, 'هذا البريد الإلكتروني مسجل بالفعل.');
    const newId = `usr-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const rows = await sql`
      INSERT INTO users (id, name, email, phone, password_hash, role, admin_permissions, provider, email_verified)
      VALUES (${newId}, ${name}, ${cleanEmail}, ${phone}, ${passwordHash(password)}, ${role}, ${JSON.stringify(permissions)}::jsonb, 'email', true)
      RETURNING id, name, email, phone, avatar, role, provider, email_verified, addresses, created_at, updated_at, admin_permissions
    `;
    if (!deps) {
      await logAudit({ actorId: user.id, actorName: user.name, action: 'USER_CREATED', entity: 'user', entityId: newId, after: { email: cleanEmail, role, permissions } });
    }
    return { success: true, user: publicUser(rows[0]) };
  }

  if (method === 'logWishlistEvent') {
    if (!user) throw forbidden();
    return store.logWishlistEvent(user.id, String(args[1] || '').slice(0, 120));
  }

  if (['findOrCreateSupportTicket', 'createSupportTicket', 'getSupportTicket', 'replySupportTicket', 'rateSupportTicket'].includes(method)) {
    const staff = canAccessSection(user, 'support');
    let token = (req.headers?.cookie || '').split(';').map((x: string) => x.trim()).find((x: string) => x.startsWith('qamar_support='))?.slice(14);
    if (!/^[a-f0-9]{64}$/.test(token || '')) {
      token = randomBytes(32).toString('hex');
      const secure = process.env.NODE_ENV === 'production' || req.headers?.['x-forwarded-proto'] === 'https';
      res.setHeader('Set-Cookie', `qamar_support=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure ? '; Secure' : ''}`);
    }
    const accessHash = createHash('sha256').update(token).digest('hex');
    if (method === 'findOrCreateSupportTicket' || method === 'createSupportTicket') {
      if (!deps?.skipRateLimit) {
        const rlSup = await enforceRateLimitOr429(req, res, sql, {
          bucket: 'support_ticket_ip',
          maxHits: 10,
          windowSeconds: 900,
          blockSeconds: 900,
          path: '/api/store:supportTicket'
        });
        if (rlSup.limited) throw Object.assign(fail(429, rlSup.error), { code: 'RATE_LIMITED' });
      }
      const phone = normalizePhone(String(args[0] || ''));
      if (phone.length !== 11) throw fail(400, 'أدخل رقم هاتف مصري صحيح.');
      const existing = await sql`SELECT * FROM support_tickets WHERE access_hash=${accessHash} AND customer_phone=${phone} AND status IN ('open','pending','escalated') ORDER BY created_at DESC LIMIT 1`;
      let ticket = existing[0];
      if (!ticket) {
        const id = 'ticket-' + randomBytes(16).toString('hex');
        const rows = await sql`INSERT INTO support_tickets(id,customer_phone,customer_name,subject,access_hash) VALUES(${id},${phone},${String(user?.name || args[2] || '').slice(0, 150)},${String(args[3] || 'استفسار عميل').slice(0, 200)},${accessHash}) RETURNING *`;
        ticket = rows[0];
      }
      if (method === 'createSupportTicket' && typeof args[1] === 'string' && args[1].trim()) {
        await store.replySupportTicket(ticket.id, 'customer', args[1].slice(0, 5000), user ? { id: user.id, name: user.name } : undefined);
      }
      return method === 'createSupportTicket' ? { success: true, ticket } : ticket;
    }
    if (!staff || method === 'rateSupportTicket' || (method === 'replySupportTicket' && args[1] !== 'staff')) {
      const rows = await sql`SELECT id FROM support_tickets WHERE id=${args[0]} AND access_hash=${accessHash}`;
      if (!rows.length) throw forbidden();
    }
    if (method === 'replySupportTicket') return store.replySupportTicket(args[0], staff && args[1] === 'staff' ? 'staff' : 'customer', String(args[2] || '').slice(0, 5000), user ? { id: user.id, name: user.name } : undefined);
    if (method === 'rateSupportTicket') return store.rateSupportTicket(args[0], args[1], String(args[2] || '').slice(0, 2000));
    const result = await store.getSupportTicket(args[0]);
    if (result && !staff) { delete result.ticket.access_hash; delete result.ticket.assigned_to; delete result.ticket.escalation_reason; }
    return result;
  }

  if (method === 'updateUserProfile') {
    if (!user || user.id !== args[0]) throw forbidden();
    const data = { ...(args[1] || {}) };
    if (data.email && data.email.trim().toLowerCase() !== user.email.toLowerCase()) throw fail(400, 'لا يمكن تغيير البريد الإلكتروني مباشرة.');
    if (data.phone !== undefined) data.phone = normalizePhone(String(data.phone || ''));
    if (data.name !== undefined && !String(data.name || '').trim()) throw fail(400, 'الاسم مطلوب.');
    delete data.email; delete data.role; delete data.admin_permissions;
    const result = await store.updateUserProfile(user.id, data);
    return { ...result, user: result.user ? { ...publicUser(result.user), admin_permissions: user.admin_permissions } : undefined };
  }

  if (method === 'updateUserEmail') {
    if (!user || user.id !== args[0]) throw forbidden();
    if (user.email.toLowerCase() === OWNER_EMAIL) throw fail(400, 'لا يمكن تغيير بريد المالك المحمي من هنا.');
    const nextEmail = String(args[1] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw fail(400, 'أدخل بريداً إلكترونياً صالحاً.');
    if (nextEmail === user.email.toLowerCase()) return { success: true, user };
    const conflict = await sql`SELECT id FROM users WHERE lower(email)=${nextEmail} AND id<>${user.id} LIMIT 1`;
    if (conflict.length) throw fail(409, 'هذا البريد الإلكتروني مستخدم لحساب آخر بالفعل.');
    const rows = await sql`
      UPDATE users SET email=${nextEmail}, email_verified=false, updated_at=NOW()
      WHERE id=${user.id} AND lower(email)<>${OWNER_EMAIL}
      RETURNING id, name, email, phone, avatar, role, provider, email_verified, addresses, created_at, admin_permissions;
    `;
    return rows[0] ? { success: true, user: publicUser(rows[0]) } : { success: false, error: 'تعذر تحديث البريد.' };
  }

  if (method === 'changePassword') {
    if (!user || user.id !== args[0]) throw forbidden();
    const [, oldPass, newPass] = args;
    if (typeof newPass !== 'string' || newPass.length < 6 || newPass.length > 512) throw fail(400, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
    const rows = await sql`SELECT password_hash FROM users WHERE id=${user.id}`;
    const existingHash = rows[0]?.password_hash || '';
    if (existingHash && !passwordMatches(oldPass, existingHash)) throw fail(400, 'كلمة المرور الحالية غير صحيحة.');
    await sql`UPDATE users SET password_hash=${passwordHash(newPass)}, updated_at=NOW() WHERE id=${user.id}`;
    return { success: true };
  }

  if (method === 'deleteUser') {
    if (!user || (!isFullAdmin(user) && user.id !== args[0])) throw forbidden();
    const rows = await sql`DELETE FROM users WHERE id=${args[0]} AND lower(email)<>${OWNER_EMAIL} RETURNING id, email, name`;
    if (!rows.length) return { success: false, error: 'لا يمكن حذف حساب المالك المحمي أو الحساب غير موجود.' };
    if (user.id === args[0]) {
      await endSession(req, res, sql).catch(() => {});
    } else if (!deps) {
      await logAudit({ actorId: user.id, actorName: user.name, action: 'USER_DELETED', entity: 'user', entityId: args[0], before: { email: rows[0]?.email, name: rows[0]?.name } });
    }
    return { success: true };
  }

  if (method === 'cancelOrder') {
    if (!user) throw forbidden();
    if (!canAccessSection(user, 'orders')) {
      const rows = await sql`SELECT customer_email, status FROM orders WHERE id=${args[0]} OR order_number=${args[0]} LIMIT 1`;
      if (!rows[0] || rows[0].customer_email?.toLowerCase() !== user.email.toLowerCase() || !['pending', 'confirmed'].includes(rows[0].status)) throw forbidden();
    }
    return cancelStoredOrder(sql, args[0], String(args[1] || '').slice(0, 1000), canAccessSection(user, 'orders') ? 'admin' : 'customer_whatsapp');
  }

  if (method === 'updateOrderState') {
    const changes = args[1] || {};
    const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (changes.order_status && !statuses.includes(changes.order_status)) throw fail(400, 'حالة الطلب غير صالحة.');
    if (changes.payment_status && !['unpaid', 'paid', 'verified'].includes(changes.payment_status)) throw fail(400, 'حالة الدفع غير صالحة.');
    if (changes.order_status === 'cancelled') return cancelStoredOrder(sql, args[0], 'إلغاء من لوحة الإدارة', 'admin');
    await sql`UPDATE orders SET status=COALESCE(${changes.order_status || null},status), payment_status=COALESCE(${changes.payment_status || null},payment_status), updated_at=NOW() WHERE id=${args[0]}`;
    if (!deps || deps.dispatchWhatsApp) {
      try {
        const typeMap: Record<string, any> = {
          confirmed: 'order_confirmed',
          processing: 'processing',
          shipped: 'shipped',
          out_for_delivery: 'out_for_delivery',
          delivered: 'delivered',
          cancelled: 'cancelled'
        };
        const waType = changes.payment_status === 'verified' ? 'payment_verified' : typeMap[changes.order_status];
        if (waType) {
          const rows = await sql`SELECT * FROM orders WHERE id=${args[0]} LIMIT 1`;
          if (rows[0]) {
            const ord = mapRowToOrder(rows[0]);
            const settings = await store.getStoreSettings().catch(() => ({}));
            const crm = resolveCrmConfig(settings);
            if (crm.configured && crm.shouldAutoSend(waType as any) && (ord.customer_whatsapp || ord.customer_phone)) {
              const text = buildServerOrderWhatsAppMessage(waType, ord, settings);
              const dispatch = deps?.dispatchWhatsApp || dispatchWhatsAppViaCrm;
              await dispatch(sql, {
                recipient: ord.customer_whatsapp || ord.customer_phone,
                text,
                type: waType,
                orderId: ord.id,
                orderNumber: ord.order_number,
                settings
              });
            }
          }
        }
      } catch {}
    }
    return true;
  }

  if (method === 'getSecurityShieldReport') {
    return getRateLimitSecurityReport(sql);
  }

  if (method === 'getMetaFeedConfig') {
    const current = (await store.getStoreSettings().catch(() => null)) || {};
    let token = String(current.meta_feed_token || process.env.META_FEED_SECRET || '').trim();
    if (!token && typeof store.updateStoreSettings === 'function') {
      token = randomBytes(24).toString('hex');
      await store.updateStoreSettings({ ...current, meta_feed_token: token }).catch(() => {});
    }
    return { token, hasToken: Boolean(token) };
  }

  if (method === 'rotateMetaFeedToken') {
    const current = (await store.getStoreSettings().catch(() => null)) || {};
    const token = randomBytes(24).toString('hex');
    if (typeof store.updateStoreSettings === 'function') {
      await store.updateStoreSettings({ ...current, meta_feed_token: token });
    }
    if (!deps) {
      await logAudit({ actorId: user?.id, actorName: user?.name, action: 'META_FEED_TOKEN_ROTATED', entity: 'settings', entityId: 'main' });
    }
    return { success: true, token };
  }

  if (method === 'trackOrder') {
    if (!deps?.skipRateLimit) {
      const rl = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'track_order_ip',
        maxHits: 15,
        windowSeconds: 600,
        blockSeconds: 600,
        path: '/api/store:trackOrder',
        message: 'تم تجاوز محاولات تتبع الطلبات مؤقتاً. انتظر قليلاً ثم أعد المحاولة.'
      });
      if (rl.limited) throw Object.assign(fail(429, rl.error), { code: 'RATE_LIMITED' });
    }
    const number = String(args[0] || '').trim().replace(/^#/, '').toUpperCase();
    const phone = normalizePhone(String(args[1] || ''));
    if (!/^QMR-[A-Z0-9-]{4,80}$/.test(number) || phone.length !== 11) throw fail(400, 'اكتب رقم الطلب ورقم الهاتف المسجل معًا.');
    const rows = await sql`SELECT * FROM orders WHERE upper(order_number)=${number} AND customer_phone=${phone} LIMIT 1`;
    return rows[0] ? mapRowToOrder(rows[0]) : null;
  }

  if (method === 'createOrder') {
    if (!deps?.skipBotId) {
      const botCheck = await verifyBotIdIfActive(req, 'basic', deps);
      if (botCheck.blocked) throw Object.assign(fail(403, 'تم حظر محاولة الطلب الآلي بواسطة نظام الحماية.'), { code: 'BOT_BLOCKED' });
    }
    if (!deps?.skipRateLimit) {
      const rl = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'create_order_ip',
        maxHits: 12,
        windowSeconds: 600,
        blockSeconds: 600,
        path: '/api/store:createOrder',
        message: 'تم إرسال عدد كبير من الطلبات خلال دقائق. يرجى الانتظار قليلاً أو التواصل عبر واتساب.'
      });
      if (rl.limited) throw Object.assign(fail(429, rl.error), { code: 'RATE_LIMITED' });
    }
    const order = args[0];
    if (!order || !Array.isArray(order.items) || !order.items.length || order.items.length > 100) throw fail(400, 'الطلب غير صالح.');
    if (!Number.isFinite(order.shipping_fee) || order.shipping_fee < 0 || !Number.isFinite(order.subtotal) || !Number.isFinite(order.total) || Math.abs(order.total - order.subtotal - order.shipping_fee) > 0.011) {
      throw fail(400, 'إجمالي الطلب غير صالح.');
    }
    if (order.items.some((i: any) => {
      const price = Number(i.unitPrice ?? i.product?.price);
      return !i.product?.id || !Number.isInteger(i.quantity) || i.quantity <= 0 || i.quantity > 1000 || !Number.isFinite(price) || price <= 0;
    })) {
      throw fail(400, 'كميات أو أسعار الطلب غير صالحة.');
    }
    const subtotal = order.items.reduce((sum: number, i: any) => sum + Number(i.unitPrice ?? i.product.price) * i.quantity, 0);
    if (Math.abs(subtotal - order.subtotal) > 0.011) throw fail(400, 'راجع إجمالي المنتجات في السلة.');
    const phone = normalizePhone(String(order.customer_phone || ''));
    if (phone.length !== 11 || !order.customer_name?.trim() || !order.address_details?.trim() || !['cod', 'instapay', 'vodafone_cash', 'card', 'credit_card'].includes(order.payment_method)) {
      throw fail(400, 'راجع اسم العميل والهاتف والعنوان وطريقة الدفع.');
    }
    const orderSettings = (typeof store?.getStoreSettings === 'function' ? await store.getStoreSettings().catch(() => ({})) : {}) || {};
    const useGateway = shouldRouteOrderToGateway(order.payment_method, orderSettings);
    if (normalizeGatewayMethod(order.payment_method) === 'card' && !useGateway && !deps?.allowUnconfiguredCard) {
      throw fail(400, 'الدفع بالبطاقة الإلكترونية غير مفعّل بعد من إعدادات بوابة الدفع.');
    }
    const safeOrderNumber = /^QMR-[A-Z0-9-]{4,80}$/.test(String(order.order_number || '').trim())
      ? String(order.order_number).trim()
      : `QMR-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const safeOrderId = typeof order.id === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(order.id)
      ? order.id
      : `ord-${randomBytes(8).toString('hex')}`;
    const saved = await saveOrder(sql, {
      ...order,
      id: safeOrderId,
      order_number: safeOrderNumber,
      customer_phone: phone,
      customer_email: user?.email || order.customer_email || null,
      payment_status: 'unpaid',
      order_status: 'pending'
    });
    if (saved && order.session_id) {
      store
        .trackActivity({
          sessionId: String(order.session_id),
          customerId: user?.id,
          customerName: order.customer_name,
          customerPhone: phone,
          customerEmail: user?.email || order.customer_email,
          actionType: 'order_placed',
          targetId: safeOrderNumber,
          metadata: { total: order.total, payment_method: order.payment_method }
        })
        .catch(() => {});
    }
    const fullOrder = {
      ...order,
      id: safeOrderId,
      order_number: safeOrderNumber,
      customer_phone: phone,
      customer_email: user?.email || order.customer_email || undefined,
      payment_status: 'unpaid',
      order_status: 'pending'
    };
    if (saved && (!deps || deps.dispatchWhatsApp)) {
      try {
        const crm = resolveCrmConfig(orderSettings);
        const dispatch = deps?.dispatchWhatsApp || dispatchWhatsAppViaCrm;
        const customerRecipient = order.customer_whatsapp || phone;
        const adminRecipients = crm.shouldAutoSend('admin_new_order') ? crm.adminAlertRecipients : [];

        const jobs: Promise<any>[] = [];
        if (crm.configured && crm.shouldAutoSend('order_confirmed') && customerRecipient) {
          jobs.push(
            dispatch(sql, {
              recipient: customerRecipient,
              text: buildServerOrderWhatsAppMessage('order_confirmed', fullOrder, orderSettings),
              type: 'order_confirmed',
              orderId: safeOrderId,
              orderNumber: safeOrderNumber,
              settings: orderSettings
            })
          );
        }
        if (crm.configured && adminRecipients.length > 0) {
          const adminText = buildServerOrderWhatsAppMessage('admin_new_order', fullOrder, orderSettings);
          for (const adminPhone of adminRecipients) {
            jobs.push(
              dispatch(sql, {
                recipient: adminPhone,
                text: adminText,
                type: 'admin_new_order',
                orderId: safeOrderId,
                orderNumber: safeOrderNumber,
                settings: orderSettings
              })
            );
          }
        }
        if (jobs.length > 0) await Promise.allSettled(jobs);
      } catch {}
    }
    if (saved && useGateway && !deps?.skipGatewayCheckout) {
      const gatewaySession = await createGatewayCheckoutSession(sql, {
        order: fullOrder,
        baseUrl: resolveRequestOrigin(req),
        settings: orderSettings,
        fetchFn: deps?.fetch
      });
      return {
        success: true,
        id: safeOrderId,
        order_number: safeOrderNumber,
        payment: gatewaySession
      };
    }
    return saved;
  }

  if (method === 'submitProductReview') {
    if (!deps?.skipRateLimit) {
      const rl = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'review_submit_ip',
        maxHits: 10,
        windowSeconds: 900,
        blockSeconds: 900,
        path: '/api/store:submitProductReview'
      });
      if (rl.limited) throw Object.assign(fail(429, rl.error), { code: 'RATE_LIMITED' });
    }
    const data = args[0] || {};
    return store.submitProductReview({ ...data, user_id: user?.id || data.user_id });
  }

  if (method === 'getProductReviews') {
    const [productId, sessionId] = args;
    if (!productId || typeof productId !== 'string') return [];
    return store.getProductReviews(productId, sessionId, user?.id);
  }

  if (policies[method] || ['trackActivity', 'syncActiveCart', 'getPersonalizedRecommendations'].includes(method)) {
    if (typeof (store as any)[method] !== 'function') throw fail(400, 'الإجراء غير مدعوم.');
    const actor = user ? { id: user.id, name: user.name } : undefined;
    if (method === 'updateProduct') args[2] = actor;
    if (method === 'deleteProduct') args[1] = actor;
    if (method === 'updateProductReviewStatus') args[2] = actor;
    if (method === 'deleteProductReview') args[1] = actor;
    if (method === 'upsertOilReserve') args[1] = actor;
    if (method === 'upsertFragranceNotes') args[1] = actor;
    if (['updateOrderStatus', 'confirmPacking'].includes(method)) {
      const options = { ...(args[2] || {}), actor };
      if (options.override && !isFullAdmin(user)) throw forbidden();
      args[2] = options;
    }
    if (method === 'recordDeliveryRefusal') args[3] = actor;
    if (method === 'addSupplierQuote') args[3] = actor;
    if (method === 'escalateSupportTicket') args[2] = actor;
    if (method === 'closeSupportTicket') args[1] = actor;
    return (store as any)[method](...args);
  }

  throw fail(400, 'الإجراء غير مدعوم.');
}

export default async function handler(req: any, res: any, deps?: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sameOrigin(req)) return res.status(403).json({ error: 'الطلب يجب أن يأتي من المتجر نفسه.' });

  const reqSql = deps?.sql || database();

  if (req.method === 'GET') {
    if (!deps?.skipRateLimit) {
      const rlGet = await enforceRateLimitOr429(req, res, reqSql, {
        bucket: 'api_get_ip',
        maxHits: 75,
        windowSeconds: 60,
        blockSeconds: 120,
        path: '/api/store[GET]'
      });
      if (rlGet.limited) return res.status(429).json({ error: rlGet.error, code: 'RATE_LIMITED' });
    }
    const parsed = parsePublicGetRequest(req.url);
    if (!parsed) return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const result = await execute(req, res, parsed, { ...(deps || {}), user: null });
      const cacheable =
        parsed.method === 'getProducts'
          ? Boolean(result && typeof result.total === 'number' && result.total > 0)
          : parsed.method === 'getCollections' || parsed.method === 'getFragranceNotes'
            ? Array.isArray(result) && result.length > 0
            : Boolean(result && typeof result === 'object');
      if (cacheable) res.setHeader('Cache-Control', PUBLIC_CACHE_HEADER);
      return res.status(200).json({ result: result ?? null });
    } catch (error: any) {
      res.setHeader('Cache-Control', 'no-store');
      console.error('[store]', error.status || 500, error.message?.slice(0, 100));
      return res.status(error.status || 500).json({ error: error.status ? error.message : 'تعذر تنفيذ الطلب.' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!deps?.skipRateLimit) {
    const rlPost = await enforceRateLimitOr429(req, res, reqSql, {
      bucket: 'api_post_ip',
      maxHits: 80,
      windowSeconds: 60,
      blockSeconds: 120,
      path: '/api/store[POST]'
    });
    if (rlPost.limited) return res.status(429).json({ error: rlPost.error, code: 'RATE_LIMITED' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(body).length > 3_000_000) return res.status(413).json({ error: 'حجم الطلب أكبر من المسموح.' });
    return res.status(200).json({ result: (await execute(req, res, body, deps)) ?? null });
  } catch (error: any) {
    console.error('[store]', error.status || 500, error.code || error.message?.slice(0, 100));
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'تعذر تنفيذ الطلب في الخادم. حاول مرة أخرى.',
      code: error.status ? error.code : undefined
    });
  }
}
