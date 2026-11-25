import { neon } from '@neondatabase/serverless';
import { currentUser, sameOrigin } from '../lib/session.js';
import { canAccessSection } from '../lib/access.js';
import nodemailer from 'nodemailer';
import { randomInt } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, name = 'عميلنا العزيز', customTemplate } = body || {};
    if (!sameOrigin(req)) return res.status(403).json({ success: false, error: 'الطلب يجب أن يأتي من المتجر نفسه.' });
    if (customTemplate && !canAccessSection(await currentUser(req), 'emails')) {
      return res.status(403).json({ success: false, error: 'تجربة القوالب تحتاج صلاحية البريد.' });
    }
    if (!email || !email.includes('@')) return res.status(400).json({ success: false, error: 'يرجى إدخال بريد إلكتروني صالح.' });

    const DB_URL = process.env.DATABASE_URL || '';
    if (!DB_URL) return res.status(500).json({ success: false, error: 'إعدادات DATABASE_URL غير متوفرة.' });

    const cleanEmail = email.trim().toLowerCase();
    const otpCode = randomInt(100000, 1000000).toString();
    const sql = neon(DB_URL);

    const recent = await sql`SELECT COUNT(*)::int AS count FROM email_verifications WHERE email=${cleanEmail} AND created_at>NOW()-INTERVAL '1 hour'`;
    if (recent[0]?.count >= 5) return res.status(429).json({ success: false, error: 'تم طلب أكواد كثيرة. انتظر قليلاً.' });

    await sql`INSERT INTO email_verifications (email, code, expires_at) VALUES (${cleanEmail}, ${otpCode}, NOW() + INTERVAL '10 minutes')`;

    const SMTP_USER = process.env.SMTP_USER?.trim() || '';
    const SMTP_PASS = process.env.SMTP_PASS?.replace(/\s+/g, '') || '';
    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        service: SMTP_USER.endsWith('@gmail.com') ? 'gmail' : undefined,
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Qamar Fragrances" <${SMTP_USER}>`,
        to: cleanEmail,
        subject: `رمز تأكيد حسابك في قمر للعطور (${otpCode})`,
        text: `مرحباً ${name}، رمز التحقق الخاص بك في قمر للعطور هو: ${otpCode} (صالح لمدة 10 دقائق).`,
        html: `<div dir="rtl" style="font-family:Cairo,Tahoma,sans-serif;padding:24px;background:#fcfcfd;color:#4f4335;"><h2 style="color:#fe9931;">قمر للعطور | Qamar Fragrances</h2><p>مرحباً ${name}، رمز التحقق الخاص بك هو:</p><div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#fe9931;padding:12px 20px;border:2px dashed #fe9931;display:inline-block;border-radius:12px;">${otpCode}</div><p style="font-size:12px;color:#585757;">صالح لمدة 10 دقائق.</p></div>`
      });
      return res.status(200).json({ success: true, provider: 'SMTP', message: 'تم إرسال كود التأكيد إلى بريدك الإلكتروني.' });
    }

    return res.status(400).json({ success: false, error: 'يرجى ضبط SMTP_USER و SMTP_PASS أو التسجيل بكلمة مرور مباشرة.' });
  } catch (err) {
    console.error('[send-otp]', err);
    return res.status(500).json({ success: false, error: 'حدث خطأ أثناء إرسال كود التحقق.' });
  }
}
