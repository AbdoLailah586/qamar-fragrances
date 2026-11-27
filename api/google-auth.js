import { neon } from '@neondatabase/serverless';
import { verifyGoogleCredential, DEFAULT_GOOGLE_CLIENT_ID } from '../lib/googleCredential.js';
import { issueSession, sameOrigin } from '../lib/session.js';
import { publicUser, OWNER_EMAIL } from '../lib/access.js';
import { enforceRateLimitOr429, verifyBotIdIfActive } from '../lib/rateLimit.js';

export default async function handler(req, res, deps) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    if (!sameOrigin(req)) return res.status(403).json({ success: false, error: 'مصدر الطلب غير مسموح.' });
    if (!deps?.skipBotId) {
      const botCheck = await verifyBotIdIfActive(req, 'basic', deps);
      if (botCheck.blocked) return res.status(403).json({ success: false, error: 'تم حظر الطلب الآلي بواسطة نظام الحماية.' });
    }
    const sql = deps?.sql || neon(process.env.DATABASE_URL || '');
    if (!deps?.skipRateLimit) {
      const rl = await enforceRateLimitOr429(req, res, sql, {
        bucket: 'google_auth_ip',
        maxHits: 15,
        windowSeconds: 600,
        blockSeconds: 600,
        path: '/api/google-auth',
        message: 'تم تجاوز حد محاولات الدخول عبر Google. انتظر عدة دقائق ثم أعد المحاولة.'
      });
      if (rl.limited) return res.status(429).json({ success: false, error: rl.error });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const audience = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
    const verify = deps?.verifyGoogleCredential || verifyGoogleCredential;
    let identity;
    try {
      identity = await verify(body?.credential, audience);
    } catch {
      return res.status(401).json({ success: false, error: 'تعذّر التحقق من حساب Google.' });
    }
    const cleanEmail = identity.email.trim().toLowerCase();
    const userId = identity.googleId ? `usr-google-${identity.googleId}` : `usr-${Date.now()}`;
    const defaultRole = cleanEmail === OWNER_EMAIL ? 'admin' : 'customer';
    const userRows = await sql`
      INSERT INTO users (id, name, email, avatar, phone, role, provider, email_verified)
      VALUES (${userId}, ${identity.name || 'عميل قمر للعطور'}, ${cleanEmail}, ${identity.avatar || ''}, '', ${defaultRole}, 'google', true)
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
        avatar = COALESCE(NULLIF(EXCLUDED.avatar, ''), users.avatar),
        email_verified = true,
        updated_at = NOW()
      RETURNING id, name, email, phone, avatar, role, provider, email_verified, addresses, created_at, updated_at, admin_permissions, totp_enabled;
    `;
    const user = userRows[0];
    const startSession = deps?.issueSession || issueSession;
    await startSession(req, res, user.id, sql, !user.totp_enabled);
    if (user.totp_enabled) return res.status(200).json({ success: false, requiresTotp: true, code: 'TOTP_REQUIRED', error: 'أدخل كود تطبيق المصادقة.' });
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (err) {
    console.error('[google-auth]', err?.message);
    return res.status(500).json({ success: false, error: 'حدث خطأ في الخادم أثناء تسجيل الدخول.' });
  }
}
