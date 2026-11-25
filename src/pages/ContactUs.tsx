import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { neonDb } from '../services/neonDb';
import { whatsappUrl } from '../utils/whatsappService';

export const ContactUs: React.FC = () => {
  const { settings } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatusMsg(null);
    try {
      const res = await neonDb.createSupportTicket(phone, `${email ? `البريد: ${email}\n` : ''}${message}`, name, subject || 'رسالة تواصل معنا');
      if (res.success) {
        setStatusMsg({ ok: true, text: 'تم استلام رسالتك بنجاح، وسيتواصل معك فريق قمر للعطور في أقرب وقت.' });
        setName(''); setEmail(''); setPhone(''); setSubject(''); setMessage('');
      } else {
        setStatusMsg({ ok: false, text: res.error || 'يرجى إدخال رقم هاتف مصري صحيح (11 رقم).' });
      }
    } catch (err: any) {
      setStatusMsg({ ok: false, text: err?.message || 'تعذر إرسال الرسالة. يمكنك مراسلتنا عبر واتساب مباشرة.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-12">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#252a31]">تواصل معنا</h1>
        <p className="text-sm text-gray-500 mt-2">
          يمكنك إرسال أسئلتك واستفساراتك عن طريق ملء النموذج التالي، وسنعاود الاتصال بك في أقرب وقت ممكن.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <form onSubmit={submit} className="md:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          {statusMsg && (
            <div className={`p-3.5 rounded-xl text-sm font-medium flex items-center gap-2 ${statusMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {statusMsg.ok && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">الاسم</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">البريد الإلكتروني</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف</label>
              <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="01xxxxxxxxx"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">الموضوع</label>
            <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">نص الرسالة</label>
            <textarea rows={4} required value={message} onChange={e => setMessage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'جاري الإرسال...' : 'إرسال'}</span>
          </button>
        </form>

        <div className="md:col-span-5 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fe9931]/10 text-[#fe9931] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold">البريد الإلكتروني</p>
                <p className="text-sm font-semibold text-[#252a31] mt-0.5">{settings.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fe9931]/10 text-[#fe9931] flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold">رقم الهاتف</p>
                <p className="text-sm font-semibold text-[#252a31] mt-0.5" dir="ltr">{settings.phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fe9931]/10 text-[#fe9931] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold">العنوان</p>
                <p className="text-sm font-semibold text-[#252a31] mt-0.5 leading-relaxed">{settings.address_ar}</p>
              </div>
            </div>

            <a
              href={whatsappUrl(settings.whatsapp_number, 'مرحباً قمر للعطور، أحتاج استفسار بخصوص عطر...')}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-3 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold text-sm transition"
            >
              تواصل مباشر عبر واتساب
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};
