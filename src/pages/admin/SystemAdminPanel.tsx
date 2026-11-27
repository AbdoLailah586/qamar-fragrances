import React, { useState, useEffect } from 'react';
import {
  Shield, Settings, MessageCircle, Mail, KeyRound,
  Send, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, PlugZap
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { neonDb } from '../../services/neonDb';
import { whatsappUrl } from '../../utils/whatsappService';
import { UsersCrmPanel } from './UsersCrmPanel';
import { MarketingAdToolsCard } from './MarketingAdToolsCard';
import { PaymentGatewaySettingsCard } from './PaymentGatewaySettingsCard';
import { PolicyPagesEditorCard } from './PolicyPagesEditorCard';
import type { PolicyPagesConfig, WhatsAppAutoTriggers, WhatsAppNotificationLog, WhatsAppTemplates } from '../../types';

const AUTO_TRIGGER_OPTIONS: Array<{
  key: keyof WhatsAppAutoTriggers;
  title: string;
  desc: string;
}> = [
  {
    key: 'admin_new_order',
    title: 'تنبيه فوري للأدمن على الواتساب عند وصول أي طلب جديد',
    desc: 'يرسل رسالة فورية لأرقام الإدارة فور تسجيل طلب جديد.'
  },
  {
    key: 'order_confirmed',
    title: 'تأكيد الأوردر للعميل (Confirm Order)',
    desc: 'يرسل للعميل رسالة تأكيد استلام/اعتماد الطلب.'
  },
  {
    key: 'payment_verified',
    title: 'تأكيد الدفع للعميل (Payment Confirmed)',
    desc: 'يرسل للعميل رسالة تأكيد الدفع عند مراجعته أو سداده.'
  },
  {
    key: 'processing',
    title: 'تسليم الطلب لشركة الشحن (Processing)',
    desc: 'يرسل للعميل عند تجهيز المحل للطلب وتحويله لشركة الشحن.'
  },
  {
    key: 'shipped',
    title: 'تم شحن الطلب مع الشركة (Shipped)',
    desc: 'يرسل للعميل عند تأكيد شحن الأوردر مع شركة الشحن.'
  },
  {
    key: 'out_for_delivery',
    title: 'خرج للتوصيل اليوم (Out for Delivery)',
    desc: 'يرسل للعميل عند خروج الشحنة مع المندوب اليوم.'
  },
  {
    key: 'delivered',
    title: 'تم التوصيل بنجاح (Delivered)',
    desc: 'يرسل للعميل رسالة التهنئة بعد تسليم الطلب.'
  },
  {
    key: 'cancelled',
    title: 'إلغاء الطلب (Cancelled)',
    desc: 'يرسل للعميل إشعاراً عند إلغاء الطلب.'
  }
];

const DEFAULT_TRIGGERS_STATE: WhatsAppAutoTriggers = {
  admin_new_order: false,
  order_confirmed: false,
  payment_verified: false,
  processing: false,
  shipped: false,
  out_for_delivery: false,
  delivered: false,
  cancelled: false,
};

const TEMPLATE_LABELS: { key: keyof WhatsAppTemplates; title: string; desc: string }[] = [
  { key: 'admin_new_order', title: '١. تنبيه الأدمن الفوري عند طلب جديد (يُرسل للإدارة)', desc: 'يُرسل لرقم/أرقام الأدمن بكل بيانات العميل والطلب وطريقة الدفع ورابط الشات المباشر لتأكيد الطلب مع العميل.' },
  { key: 'order_confirmed', title: '٢. تأكيد استلام الطلب (يُرسل للعميل)', desc: 'رسالة تأكيد استلام أو اعتماد الطلب للعميل.' },
  { key: 'payment_verified', title: '٣. تأكيد الدفع الإلكتروني', desc: 'رسالة تأكيد مراجعة أو سداد قيمة الطلب.' },
  { key: 'processing', title: '٤. تجهيز الطلب وتسليمه لشركة الشحن', desc: 'يُرسل عند تحويل الحالة إلى processing (تسليم لشركة الشحن).' },
  { key: 'shipped', title: '٥. تم شحن الطلب مع المندوب', desc: 'يُرسل عند التغليف أو تحويل الحالة إلى shipped.' },
  { key: 'out_for_delivery', title: '٦. الشحنة في طريقها للتسليم اليوم', desc: 'يُرسل عند تحويل الحالة إلى out_for_delivery.' },
  { key: 'delivered', title: '٧. تم تسليم الطلب بنجاح', desc: 'رسالة تهنئة بعد التسليم.' },
  { key: 'cancelled', title: '٨. إلغاء الطلب', desc: 'إشعار مهذب عند إلغاء الطلب.' },
  { key: 'review_request', title: '٩. طلب تقييم العطر ⭐', desc: 'إشعار سريع بعد التسليم لطلب رأي العميل.' }
];

export const SystemAdminPanel: React.FC<{ section: 'users' | 'security' | 'settings' | 'whatsapp' | 'emails' }> = ({ section }) => {
  const { settings, updateSettings } = useStore();
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [formSettings, setFormSettings] = useState(settings);
  const [msg, setMsg] = useState('');

  // WhatsApp Pro CRM State
  const [waUrl, setWaUrl] = useState('');
  const [waEmail, setWaEmail] = useState('');
  const [waPass, setWaPass] = useState('');
  const [hasSavedPass, setHasSavedPass] = useState(false);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [triggers, setTriggers] = useState<WhatsAppAutoTriggers>(DEFAULT_TRIGGERS_STATE);
  const [adminAlertNumber, setAdminAlertNumber] = useState('201003732029');
  const [templates, setTemplates] = useState<WhatsAppTemplates>({});
  const [waLogs, setWaLogs] = useState<WhatsAppNotificationLog[]>([]);
  const [waStatusBanner, setWaStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [testPhone, setTestPhone] = useState('01554826209');
  const [testText, setTestText] = useState('✨ رسالة تجربة من لوحة تحكم قمر للعطور (Qamar Fragrances)');
  const [busyWa, setBusyWa] = useState(false);

  const loadWhatsAppData = async () => {
    try {
      const [cfg, notifRows] = await Promise.all([
        neonDb.getWhatsAppAdminConfig(),
        neonDb.getWhatsAppNotifications(60)
      ]);
      if (cfg) {
        setWaUrl(cfg.whatsapp_automation_url || '');
        setWaEmail(cfg.whatsapp_automation_email || '');
        setHasSavedPass(Boolean(cfg.has_saved_password));
        setEnvConfigured(Boolean(cfg.env_configured));
        if (cfg.whatsapp_auto_triggers && typeof cfg.whatsapp_auto_triggers === 'object') {
          setTriggers({ ...DEFAULT_TRIGGERS_STATE, ...cfg.whatsapp_auto_triggers });
        } else {
          setTriggers({
            admin_new_order: cfg.auto_alert_admin_on_order === true,
            order_confirmed: cfg.auto_send_on_order === true,
            payment_verified: cfg.auto_send_on_status_change === true,
            processing: cfg.auto_send_on_status_change === true,
            shipped: cfg.auto_send_on_status_change === true,
            out_for_delivery: cfg.auto_send_on_status_change === true,
            delivered: cfg.auto_send_on_status_change === true,
            cancelled: cfg.auto_send_on_status_change === true,
          });
        }
        setAdminAlertNumber(cfg.admin_alert_whatsapp_number || cfg.whatsapp_number || '201003732029');
        setTemplates(cfg.whatsapp_templates || {});
      }
      setWaLogs(Array.isArray(notifRows) ? notifRows : []);
    } catch {}
  };

  const setAllTriggers = (enabled: boolean) => {
    setTriggers({
      admin_new_order: enabled,
      order_confirmed: enabled,
      payment_verified: enabled,
      processing: enabled,
      shipped: enabled,
      out_for_delivery: enabled,
      delivered: enabled,
      cancelled: enabled,
    });
  };

  useEffect(() => {
    if (section === 'security') neonDb.getAuditLog(100).then(setLogs).catch(() => {});
    if (section === 'settings') setFormSettings(settings);
    if (section === 'whatsapp') void loadWhatsAppData();
  }, [section, settings]);

  if (section === 'users') {
    return <UsersCrmPanel />;
  }

  if (section === 'security') {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><Shield className="w-5 h-5 text-[#fe9931]" /><span>الأمان والمصادقة الثنائية 2FA وسجل التدقيق</span></h1>
        <div className="bg-white border rounded-2xl p-5 space-y-3 text-xs">
          <p className="font-bold text-sm flex items-center gap-2"><KeyRound className="w-4 h-4 text-[#fe9931]" /> تفعيل TOTP 2FA لحسابك</p>
          {!totpSecret ? (
            <button type="button" onClick={async () => {
              if (!user) return;
              const res = await neonDb.setupTotp(user.id);
              if (res.secret) setTotpSecret(res.secret); else setMsg(res.error || '');
            }} className="px-4 py-2 rounded-full bg-[#fe9931] text-white font-bold">توليد مفتاح 2FA</button>
          ) : (
            <div className="space-y-2">
              <p>المفتاح السري: <code className="bg-gray-100 px-2 py-1 rounded font-mono">{totpSecret}</code></p>
              <div className="flex gap-2">
                <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="كود التطبيق 6 أرقام" className="px-3 py-1.5 border rounded-xl" />
                <button type="button" onClick={async () => {
                  if (!user) return;
                  const r = await neonDb.confirmTotp(user.id, totpCode);
                  setMsg(r.success ? 'تم تفعيل 2FA بنجاح!' : r.error || 'خطأ');
                }} className="px-4 py-1.5 rounded-full bg-green-600 text-white font-bold">تأكيد</button>
              </div>
            </div>
          )}
          {msg && <p className="font-bold text-[#fe9931]">{msg}</p>}
        </div>

        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="w-full text-xs text-right">
            <thead className="bg-gray-50 font-bold text-gray-500"><tr><th className="p-3">الإجراء</th><th className="p-3">المسؤول</th><th className="p-3">الكيان</th><th className="p-3">التاريخ</th></tr></thead>
            <tbody className="divide-y">
              {logs.map(l => (
                <tr key={l.id}><td className="p-3 font-bold">{l.action}</td><td className="p-3">{l.actor_name || l.actor_id || 'System'}</td><td className="p-3">{l.entity} ({l.entity_id})</td><td className="p-3">{new Date(l.created_at).toLocaleString('ar-EG')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'whatsapp') {
    const saveWaConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      setBusyWa(true);
      setWaStatusBanner(null);
      try {
        const res = await neonDb.saveWhatsAppAdminConfig({
          whatsapp_automation_url: waUrl,
          whatsapp_automation_email: waEmail,
          whatsapp_automation_pass: waPass || undefined,
          whatsapp_auto_triggers: triggers,
          auto_send_on_order: triggers.order_confirmed,
          auto_send_on_status_change: Boolean(
            triggers.payment_verified ||
            triggers.processing ||
            triggers.shipped ||
            triggers.out_for_delivery ||
            triggers.delivered ||
            triggers.cancelled
          ),
          auto_alert_admin_on_order: triggers.admin_new_order,
          admin_alert_whatsapp_number: adminAlertNumber,
          whatsapp_templates: templates
        });
        if (res?.success) {
          setWaStatusBanner({ ok: true, text: 'تم حفظ إعدادات WhatsApp Pro CRM والقوالب في قاعدة البيانات بنجاح.' });
          setWaPass('');
          await loadWhatsAppData();
        } else {
          setWaStatusBanner({ ok: false, text: res?.error || 'تعذر حفظ الإعدادات.' });
        }
      } finally {
        setBusyWa(false);
      }
    };

    const runTestConnection = async () => {
      setBusyWa(true);
      setWaStatusBanner(null);
      try {
        const res = await neonDb.testWhatsAppConnection();
        setWaStatusBanner({
          ok: Boolean(res?.success),
          text: res?.success ? (res.message || 'تم الاتصال بمنصة WhatsApp Pro CRM بنجاح!') : (res?.error || 'تعذر الاتصال.')
        });
      } finally {
        setBusyWa(false);
      }
    };

    const runTestSend = async (e: React.FormEvent) => {
      e.preventDefault();
      setBusyWa(true);
      setWaStatusBanner(null);
      try {
        const res = await neonDb.sendTestWhatsApp(testPhone, testText);
        setWaStatusBanner({
          ok: Boolean(res?.success),
          text: res?.success
            ? `تم إرسال الرسالة التجريبية إلى ${testPhone} بنجاح!`
            : `تعذر الإرسال عبر CRM (${res?.error || 'خطأ غير معروف'})`
        });
        await loadWhatsAppData();
      } finally {
        setBusyWa(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#fe9931]" />
              <span>أتمتة WhatsApp Pro CRM وقوالب الرسائل</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              إرسال تلقائي لرسائل تأكيد الطلب وتحديثات الشحن والدفع، مع إمكانية تبديل حساب CRM لرقم قمر الخاص في أي وقت.
            </p>
          </div>
          <button
            type="button"
            disabled={busyWa}
            onClick={runTestConnection}
            className="px-4 py-2 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <PlugZap className="w-4 h-4" />
            <span>اختبار الاتصال بـ CRM</span>
          </button>
        </div>

        {waStatusBanner && (
          <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border ${waStatusBanner.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {waStatusBanner.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{waStatusBanner.text}</span>
          </div>
        )}

        <form onSubmit={saveWaConfig} className="space-y-6">
          {/* CRM Account Config */}
          <div className="bg-white border rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <p className="font-extrabold text-sm text-[#252a31]">بيانات حساب WhatsApp Pro CRM</p>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-[#fe9931] font-bold">
                {envConfigured ? 'متصل بإعدادات السيرفر الاحتياطية (201554826209)' : 'يقرأ من بيانات الحفظ أدناه'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="space-y-1 font-bold">
                <span>رابط الخادم (WhatsApp CRM URL)</span>
                <input
                  type="url"
                  dir="ltr"
                  value={waUrl}
                  onChange={e => setWaUrl(e.target.value)}
                  placeholder="https://whatsapp-pro-crm-production-613b.up.railway.app"
                  className="w-full px-3 py-2 border rounded-xl font-normal"
                />
              </label>
              <label className="space-y-1 font-bold">
                <span>بريد الحساب (CRM Email)</span>
                <input
                  type="text"
                  dir="ltr"
                  value={waEmail}
                  onChange={e => setWaEmail(e.target.value)}
                  placeholder="201554826209@whatsapp.pro"
                  className="w-full px-3 py-2 border rounded-xl font-normal"
                />
              </label>
              <label className="space-y-1 font-bold">
                <span>كلمة المرور {hasSavedPass ? '(محفوظة — اتركها فارغة للإبقاء عليها)' : '(CRM Password)'}</span>
                <input
                  type="password"
                  dir="ltr"
                  value={waPass}
                  onChange={e => setWaPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border rounded-xl font-normal"
                />
              </label>
            </div>

            <label className="space-y-1 font-bold bg-amber-50/50 border border-amber-200 p-3 rounded-xl block">
              <span>رقم واتساب الأدمن لاستلام تنبيهات الطلبات (يدعم أكثر من رقم مفصولين بفاصلة ,)</span>
              <input
                type="text"
                dir="ltr"
                value={adminAlertNumber}
                onChange={e => setAdminAlertNumber(e.target.value)}
                placeholder="01003732029, 01554826209"
                className="w-full px-3 py-1.5 border rounded-lg bg-white font-normal"
              />
            </label>

            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-extrabold text-sm text-[#252a31]">
                    التحكم الفردي في الإرسال التلقائي عبر واتساب (هل يتعمل ولا ميتعملش؟)
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    أي مربع غير محدد لن تُرسل رسالته تلقائياً، ويمكنك إرسالها يدوياً من جدول الطلبات متى أردت.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllTriggers(true)}
                    className="px-3 py-1.5 rounded-full bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 font-bold text-[11px]"
                  >
                    تفعيل الكل تلقائياً
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllTriggers(false)}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold text-[11px]"
                  >
                    إيقاف التلقائي للكل (يدوي فقط)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {AUTO_TRIGGER_OPTIONS.map(opt => {
                  const checked = Boolean(triggers[opt.key]);
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        checked
                          ? 'bg-green-50/70 border-green-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e =>
                          setTriggers(prev => ({
                            ...prev,
                            [opt.key]: e.target.checked
                          }))
                        }
                        className="mt-0.5 w-4 h-4 accent-[#fe9931]"
                      />
                      <div className="min-w-0">
                        <span className="font-extrabold text-[#252a31] block leading-snug">{opt.title}</span>
                        <span className="text-[11px] text-gray-500 block mt-0.5 font-normal">{opt.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 7 Editable Templates */}
          <div className="bg-white border rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <p className="font-extrabold text-sm text-[#252a31]">قوالب الرسائل الجاهزة لقمر للعطور</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  المتغيرات المتاحة: <code dir="ltr" className="bg-gray-100 px-1.5 py-0.5 rounded">{'{customer_name} {customer_phone} {customer_whatsapp} {customer_wa_link} {order_number} {items} {total} {shipping_fee} {payment_method} {governorate} {address} {maps_url} {courier_name} {cod_due}'}</code>
                </p>
              </div>
              <button
                type="submit"
                disabled={busyWa}
                className="px-6 py-2 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold disabled:opacity-50"
              >
                حفظ الإعدادات والقوالب
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {TEMPLATE_LABELS.map(item => (
                <div key={item.key} className="p-3.5 rounded-xl bg-gray-50 border space-y-2">
                  <div>
                    <p className="font-extrabold text-[#252a31]">{item.title}</p>
                    <p className="text-[11px] text-gray-500">{item.desc}</p>
                  </div>
                  <textarea
                    rows={5}
                    value={templates[item.key] || ''}
                    onChange={e => setTemplates(prev => ({ ...prev, [item.key]: e.target.value }))}
                    className="w-full p-2.5 border rounded-xl bg-white text-xs leading-relaxed"
                  />
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Instant Test Send */}
        <form onSubmit={runTestSend} className="bg-white border rounded-2xl p-5 space-y-3 text-xs">
          <p className="font-extrabold text-sm text-[#252a31] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#fe9931]" />
            <span>إرسال رسالة تجريبية الآن</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="tel" dir="ltr" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="01xxxxxxxxx" className="px-3 py-2 border rounded-xl" required />
            <input type="text" value={testText} onChange={e => setTestText(e.target.value)} placeholder="نص الرسالة" className="sm:col-span-2 px-3 py-2 border rounded-xl" required />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busyWa} className="px-5 py-2 rounded-full bg-[#25D366] text-white font-bold flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span>إرسال عبر WhatsApp CRM</span>
            </button>
            <a href={whatsappUrl(testPhone, testText)} target="_blank" rel="noreferrer" className="px-5 py-2 rounded-full border border-gray-300 font-bold text-[#252a31] flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح في واتساب ويب يدوياً</span>
            </a>
          </div>
        </form>

        {/* Notification Logs */}
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b flex items-center justify-between">
            <p className="font-extrabold text-sm text-[#252a31]">سجل رسائل الواتساب المرسلة ({waLogs.length})</p>
            <button type="button" onClick={loadWhatsAppData} className="text-xs font-bold text-[#fe9931] flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> تحديث
            </button>
          </div>
          <table className="w-full text-xs text-right">
            <thead className="bg-gray-50 font-bold text-gray-500">
              <tr><th className="p-3">رقم الطلب</th><th className="p-3">العميل</th><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">التوقيت</th><th className="p-3">إجراء</th></tr>
            </thead>
            <tbody className="divide-y">
              {waLogs.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">لم تُرسل رسائل أوتوماتيكية بعد.</td></tr>
              ) : waLogs.map(log => (
                <tr key={log.id}>
                  <td className="p-3 font-bold" dir="ltr">{log.order_number || log.order_id || 'اختبار'}</td>
                  <td className="p-3" dir="ltr">{log.phone}</td>
                  <td className="p-3 font-bold">{log.notification_type}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.status === 'sent' ? 'تم الإرسال ✓' : 'تعذر'}
                    </span>
                    {log.error_message && <p className="text-[10px] text-red-600 mt-0.5 max-w-xs truncate">{log.error_message}</p>}
                  </td>
                  <td className="p-3 text-gray-500">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                  <td className="p-3">
                    <a href={whatsappUrl(log.phone, log.message_text)} target="_blank" rel="noreferrer" className="text-[#25D366] font-bold hover:underline">
                      فتح يدوي
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'emails') {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#fe9931]" />
          <span>إعدادات وقوالب البريد الإلكتروني</span>
        </h1>
        <div className="bg-white border rounded-2xl p-6 text-sm text-gray-600 space-y-3">
          <p>إرسال أكواد التحقق OTP مفعّل عبر إعدادات `SMTP_USER` / `SMTP_PASS` على الخادم.</p>
          <p>البريد الرسمي الظاهر بالمتجر: <strong>{settings.email}</strong></p>
        </div>
      </div>
    );
  }

  // settings
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><Settings className="w-5 h-5 text-[#fe9931]" /><span>إعدادات المتجر والهيرو بانر</span></h1>
      {msg && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-xs font-bold">{msg}</div>}
      <form onSubmit={async e => { e.preventDefault(); await updateSettings(formSettings); setMsg('تم حفظ الإعدادات وتحديثها في قاعدة البيانات.'); }} className="bg-white border rounded-2xl p-6 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 font-bold"><span>عنوان البانر الرئيسي (Hero)</span><input type="text" value={formSettings.hero_heading} onChange={e => setFormSettings({ ...formSettings, hero_heading: e.target.value })} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>رقم الواتساب</span><input type="text" value={formSettings.whatsapp_number} onChange={e => setFormSettings({ ...formSettings, whatsapp_number: e.target.value })} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>رسوم الشحن الافتراضية</span><input type="number" value={formSettings.shipping_fee} onChange={e => setFormSettings({ ...formSettings, shipping_fee: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>حد الشحن المجاني</span><input type="number" value={formSettings.free_shipping_threshold} onChange={e => setFormSettings({ ...formSettings, free_shipping_threshold: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-xl" /></label>
        </div>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={formSettings.announcement_enabled} onChange={e => setFormSettings({ ...formSettings, announcement_enabled: e.target.checked })} className="accent-[#fe9931]" />
          تفعيل شريط الإعلانات العلوي ({formSettings.announcement_text})
        </label>
        <PaymentGatewaySettingsCard />
        <MarketingAdToolsCard formSettings={formSettings} setFormSettings={setFormSettings} />
        <button type="submit" className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white font-bold">حفظ الإعدادات</button>
      </form>
      <PolicyPagesEditorCard
        settings={settings}
        onSavePolicyPages={async (nextPolicyPages: PolicyPagesConfig) => {
          setFormSettings(prev => ({ ...prev, policy_pages: nextPolicyPages }));
          await updateSettings({ ...formSettings, policy_pages: nextPolicyPages });
        }}
      />
    </div>
  );
};
