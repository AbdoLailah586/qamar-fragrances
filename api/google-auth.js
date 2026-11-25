import { neon } from '@neondatabase/serverless';
import { verifyGoogleCredential } from '../lib/googleCredential.js';
import { issueSession, sameOrigin } from '../lib/session.js';
import { publicUser } from '../lib/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    if (!sameOrigin(req)) return res.status(403).json({ success: false, error: 'مصدر الطلب غير مسموح.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const audience = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
    let identity;
    try {
      identity = await verifyGoogleCredential(body?.credential, audience);
    } catch {
      return res.status(401).json({ success: false, error: 'تعذّر التحقق من حساب Google.' });
    }
    const cleanEmail = identity.email.trim().toLowerCase();
    const userId = identity.googleId ? `usr-google-${identity.googleId}` : `usr-${Date.now()}`;
    const sql = neon(process.env.DATABASE_URL || '');
    const userRows = await sql`
      INSERT INTO users (id, name, email, avatar, phone, role, provider, email_verified)
      VALUES (${userId}, ${identity.name || 'عميل قمر للعطور'}, ${cleanEmail}, ${identity.avatar || ''}, '', 'customer', 'google', true)
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, users.name),
        avatar = COALESCE(EXCLUDED.avatar, users.avatar),
        email_verified = true,
        updated_at = NOW()
      RETURNING id, name, email, phone, avatar, role, provider, email_verified, addresses, created_at, admin_permissions, totp_enabled;
    `;
    const user = userRows[0];
    await issueSession(req, res, user.id, sql, !user.totp_enabled);
    if (user.totp_enabled) return res.status(200).json({ success: false, requiresTotp: true, code: 'TOTP_REQUIRED', error: 'أدخل كود تطبيق المصادقة.' });
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (err) {
    console.error('[google-auth]', err?.message);
    return res.status(500).json({ success: false, error: 'حدث خطأ في الخادم أثناء تسجيل الدخول.' });
  }
}
