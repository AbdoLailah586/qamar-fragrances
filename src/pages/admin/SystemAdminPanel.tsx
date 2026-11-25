import React, { useState, useEffect } from 'react';
import { Users, Shield, Settings, MessageCircle, Mail, KeyRound } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { neonDb } from '../../services/neonDb';
import { ADMIN_SECTIONS } from '../../../lib/access.js';

export const SystemAdminPanel: React.FC<{ section: 'users' | 'security' | 'settings' | 'whatsapp' | 'emails' }> = ({ section }) => {
  const { settings, updateSettings } = useStore();
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [formSettings, setFormSettings] = useState(settings);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (section === 'users') neonDb.getAllUsers().then(setUsers).catch(() => {});
    if (section === 'security') neonDb.getAuditLog(100).then(setLogs).catch(() => {});
    if (section === 'settings') setFormSettings(settings);
  }, [section, settings]);

  if (section === 'users') {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><Users className="w-5 h-5 text-[#fe9931]" /><span>المستخدمون وصلاحيات الفريق ({users.length})</span></h1>
        {msg && <p className="text-xs font-bold text-[#fe9931]">{msg}</p>}
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="bg-white border rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div><p className="font-bold text-sm">{u.name}</p><p className="text-gray-500">{u.email} • {u.role}</p></div>
                <select value={u.role} onChange={async e => {
                  const res = await neonDb.updateUserAccess(u.id, { role: e.target.value as any, permissions: u.admin_permissions || [] });
                  if (res.success) { setMsg('تم تحديث الصلاحية'); setUsers(await neonDb.getAllUsers()); }
                }} className="px-3 py-1.5 border rounded-xl bg-white">
                  <option value="customer">Customer / Limited Staff</option>
                  <option value="admin">Full Admin</option>
                </select>
              </div>
              {u.role !== 'admin' && (
                <div className="flex flex-wrap gap-1.5">
                  {ADMIN_SECTIONS.map(sec => {
                    const has = (u.admin_permissions || []).includes(sec);
                    return (
                      <button key={sec} type="button" onClick={async () => {
                        const next = has ? (u.admin_permissions || []).filter((s: string) => s !== sec) : [...(u.admin_permissions || []), sec];
                        await neonDb.updateUserAccess(u.id, { role: 'customer', permissions: next });
                        setUsers(await neonDb.getAllUsers());
                      }} className={`px-2.5 py-1 rounded-full border ${has ? 'bg-[#fe9931] text-white border-[#fe9931]' : 'bg-gray-50 text-gray-600'}`}>
                        {sec}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
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

  if (section === 'whatsapp' || section === 'emails') {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          {section === 'whatsapp' ? <MessageCircle className="w-5 h-5 text-[#fe9931]" /> : <Mail className="w-5 h-5 text-[#fe9931]" />}
          <span>{section === 'whatsapp' ? 'قوالب رسائل الواتساب للعملاء' : 'إعدادات وقوالب البريد الإلكتروني'}</span>
        </h1>
        <div className="bg-white border rounded-2xl p-6 text-sm text-gray-600 space-y-3">
          <p>إشعارات الطلبات وتحديثات الشحن مفعلة تلقائياً على رقم المتجر: <strong dir="ltr">{settings.whatsapp_number}</strong></p>
          <p>البريد الرسمي للمتجر: <strong>{settings.email}</strong></p>
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
        <button type="submit" className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white font-bold">حفظ الإعدادات</button>
      </form>
    </div>
  );
};
