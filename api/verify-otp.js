import { neon } from '@neondatabase/serverless';
import { issueSession, sameOrigin, passwordHash } from '../lib/session.js';
import { publicUser, OWNER_EMAIL } from '../lib/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    if (!sameOrigin(req)) return res.status(403).json({ success: false, error: 'مصدر الطلب غير مسموح.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, code, name, phone, password } = body || {};
    if (!email || !code) return res.status(400).json({ success: false, error: 'البريد الإلكتروني وكود التأكيد مطلوبان.' });

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const sql = neon(process.env.DATABASE_URL || '');

    const rows = await sql`
      UPDATE email_verifications SET attempts=attempts+1
      WHERE id=(SELECT id FROM email_verifications WHERE email=${cleanEmail} AND verified=false AND expires_at>NOW() ORDER BY id DESC LIMIT 1)
        AND attempts<8
      RETURNING id, code
    `;
    if (!rows?.length || rows[0].code !== cleanCode) {
      return res.status(400).json({ success: false, error: 'كود التأكيد غير صحيح أو انتهت صلاحيته.' });
    }
    await sql`UPDATE email_verifications SET verified=true WHERE id=${rows[0].id}`;

    const defaultRole = cleanEmail === OWNER_EMAIL ? 'admin' : 'customer';
    const userRows = await sql`
      INSERT INTO users (id, name, email, phone, password_hash, role, provider, email_verified)
      VALUES (${`usr-${Date.now()}`}, ${name || 'عميل قمر للعطور'}, ${cleanEmail}, ${phone || ''}, ${password ? passwordHash(password) : ''}, ${defaultRole}, 'email', true)
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, users.name),
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
        password_hash = COALESCE(NULLIF(EXCLUDED.password_hash, ''), users.password_hash),
        email_verified = true,
        updated_at = NOW()
      RETURNING id, name, email, phone, role, provider, email_verified, addresses, created_at, updated_at, admin_permissions, totp_enabled;
    `;
    const user = userRows[0];
    await issueSession(req, res, user.id, sql, !user.totp_enabled);
    if (user.totp_enabled) return res.status(200).json({ success: false, requiresTotp: true, code: 'TOTP_REQUIRED' });
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (err) {
    console.error('[verify-otp]', err);
    return res.status(500).json({ success: false, error: 'حدث خطأ أثناء التحقق من الكود.' });
  }
}
