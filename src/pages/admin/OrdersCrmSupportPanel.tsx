import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, BarChart3, ShoppingBag, Truck, MessageSquare, PackageCheck,
  MessageCircle, Star, CheckCircle2, X, Send, ExternalLink, MapPin
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { neonDb } from '../../services/neonDb';
import { formatEGP } from '../../utils/arabicNumbers';
import { buildQamarCustomerMessage, whatsappUrl } from '../../utils/whatsappService';
import type { Order, WhatsAppNotificationType } from '../../types';

const WA_PRESETS: { type: WhatsAppNotificationType; label: string }[] = [
  { type: 'order_confirmed', label: 'تأكيد الطلب' },
  { type: 'payment_verified', label: 'تأكيد الدفع' },
  { type: 'shipped', label: 'تم الشحن' },
  { type: 'out_for_delivery', label: 'مع المندوب اليوم' },
  { type: 'delivered', label: 'تم التسليم' },
  { type: 'review_request', label: 'طلب تقييم ⭐' }
];

export const OrdersCrmSupportPanel: React.FC<{ section: 'overview' | 'analytics' | 'orders' | 'fulfillment' | 'crm' | 'support'; onGo?: (s: string) => void }> = ({ section, onGo }) => {
  const { products, orders, collections, settings, activeCarts, updateOrderStatus, refreshActiveCarts, refreshOrders } = useStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [refusals, setRefusals] = useState<any[]>([]);

  // WhatsApp Quick Send Modal
  const [waOrder, setWaOrder] = useState<Order | null>(null);
  const [waType, setWaType] = useState<WhatsAppNotificationType>('order_confirmed');
  const [waText, setWaText] = useState('');
  const [waAlert, setWaAlert] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sendingWa, setSendingWa] = useState(false);

  useEffect(() => {
    if (section === 'support') neonDb.listSupportTickets().then(setTickets).catch(() => {});
    if (section === 'fulfillment') neonDb.getAllRefusals().then(setRefusals).catch(() => {});
    if (section === 'crm') void refreshActiveCarts();
  }, [section]);

  const metrics = useMemo(() => {
    const delivered = orders.filter(o => o.order_status === 'delivered');
    const pending = orders.filter(o => o.order_status === 'pending' || o.order_status === 'confirmed');
    const revenue = delivered.reduce((s, o) => s + o.total, 0);
    return { totalOrders: orders.length, pendingCount: pending.length, deliveredCount: delivered.length, revenue };
  }, [orders]);

  const openWaModal = (order: Order, type: WhatsAppNotificationType = 'order_confirmed') => {
    setWaOrder(order);
    setWaType(type);
    setWaText(buildQamarCustomerMessage(type, order, settings));
    setWaAlert(null);
  };

  const sendViaCrm = async () => {
    if (!waOrder) return;
    setSendingWa(true);
    setWaAlert(null);
    try {
      const res = await neonDb.sendOrderWhatsApp(waOrder.id, waType, waText);
      setWaAlert({
        ok: Boolean(res?.success),
        msg: res?.success ? 'تم إرسال رسالة الواتساب للعميل بنجاح ✓' : (res?.error || 'تعذر الإرسال عبر CRM — استخدم زر الفتح اليدوي أدناه.')
      });
    } catch (err: any) {
      setWaAlert({ ok: false, msg: err?.message || 'تعذر الإرسال.' });
    } finally {
      setSendingWa(false);
    }
  };

  const quickSendReview = async (order: Order) => {
    setWaAlert(null);
    const res = await neonDb.sendOrderWhatsApp(order.id, 'review_request');
    setWaAlert({
      ok: Boolean(res?.success),
      msg: res?.success ? `تم إرسال طلب التقييم للعميل ${order.customer_name} ✓` : (res?.error || 'تعذر الإرسال التلقائي — افتح نافذة الواتساب للإرسال اليدوي.')
    });
  };

  const verifyPayment = async (order: Order) => {
    await neonDb.updateOrderState(order.id, { payment_status: 'verified' });
    await refreshOrders();
    setWaAlert({ ok: true, msg: `تم تأكيد دفع الطلب ${order.order_number} وإرسال إشعار واتساب للعميل.` });
  };

  if (section === 'overview' || section === 'analytics') {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          {section === 'analytics' ? <BarChart3 className="w-5 h-5 text-[#fe9931]" /> : <LayoutDashboard className="w-5 h-5 text-[#fe9931]" />}
          <span>{section === 'analytics' ? 'تحليلات العطور والمبيعات' : 'نظرة عامة على متجر قمر للعطور'}</span>
        </h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border"><p className="text-xs text-gray-500">إجمالي العطور</p><p className="text-2xl font-black text-[#252a31] mt-1">{products.length}</p></div>
          <div className="bg-white p-5 rounded-2xl border"><p className="text-xs text-gray-500">المجموعات</p><p className="text-2xl font-black text-[#fe9931] mt-1">{collections.length}</p></div>
          <div className="bg-white p-5 rounded-2xl border"><p className="text-xs text-gray-500">إجمالي الطلبات</p><p className="text-2xl font-black mt-1">{metrics.totalOrders}</p></div>
          <div className="bg-white p-5 rounded-2xl border"><p className="text-xs text-gray-500">مبيعات مُسلمة</p><p className="text-2xl font-black text-green-600 mt-1">{formatEGP(metrics.revenue, false)}</p></div>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <h2 className="font-bold text-sm text-[#252a31] mb-4">توزيع العطور حسب المجموعة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {collections.map(c => {
              const cnt = products.filter(p => p.category === c.handle || (p.categories || []).includes(c.handle)).length;
              return (
                <div key={c.id} className="p-3.5 rounded-xl bg-gray-50 flex items-center justify-between text-xs">
                  <span className="font-bold text-[#252a31]">{c.title}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#fe9931]/10 text-[#fe9931] font-extrabold">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>

        {onGo && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onGo('oils')} className="px-4 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold">فتح مخزون الزيوت والزجاجات</button>
            <button type="button" onClick={() => onGo('whatsapp')} className="px-4 py-2 rounded-full bg-[#25D366] text-white text-xs font-bold">أتمتة واتساب وقوالب الرسائل</button>
            <button type="button" onClick={() => onGo('notes_finder')} className="px-4 py-2 rounded-full border bg-white text-xs font-bold">دليل النوتات العطرية</button>
            <button type="button" onClick={() => onGo('labels')} className="px-4 py-2 rounded-full border bg-white text-xs font-bold">طباعة استيكرات الزجاجات</button>
          </div>
        )}
      </div>
    );
  }

  if (section === 'orders' || section === 'fulfillment') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
            {section === 'fulfillment' ? <Truck className="w-5 h-5 text-[#fe9931]" /> : <ShoppingBag className="w-5 h-5 text-[#fe9931]" />}
            <span>{section === 'fulfillment' ? 'التجهيز والتغليف والشحن' : `إدارة الطلبات (${orders.length})`}</span>
          </h1>
          {onGo && (
            <button type="button" onClick={() => onGo('whatsapp')} className="px-4 py-1.5 rounded-full bg-[#25D366]/10 text-[#1ebd5a] border border-[#25D366]/30 text-xs font-bold flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> إعدادات وقوالب واتساب
            </button>
          )}
        </div>

        {waAlert && !waOrder && (
          <div className={`p-3 rounded-xl text-xs font-bold ${waAlert.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
            {waAlert.msg}
          </div>
        )}

        <div className="bg-white border rounded-2xl overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-gray-50 font-bold text-gray-500">
              <tr><th className="p-3">رقم الطلب</th><th className="p-3">العميل</th><th className="p-3">المحافظة</th><th className="p-3">الإجمالي</th><th className="p-3">الدفع</th><th className="p-3">الحالة</th><th className="p-3">تحديث وإشعارات</th></tr>
            </thead>
            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">لا توجد طلبات حتى الآن.</td></tr>
              ) : orders.map(o => (
                <tr key={o.id}>
                  <td className="p-3 font-bold whitespace-nowrap" dir="ltr">{o.order_number}</td>
                  <td className="p-3">{o.customer_name}<br /><span className="text-gray-400" dir="ltr">{o.customer_whatsapp || o.customer_phone}</span></td>
                  <td className="p-3">
                    <div>{o.governorate}{o.city ? ` - ${o.city}` : ''}</div>
                    {o.address_details && <div className="text-[11px] text-gray-500 max-w-[200px] truncate">{o.address_details}</div>}
                    {o.google_maps_url && (
                      <a href={o.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-[#fe9931] hover:underline">
                        <MapPin className="w-3 h-3" /> خريطة التوصيل
                      </a>
                    )}
                  </td>
                  <td className="p-3 font-bold text-[#fe9931] whitespace-nowrap">{formatEGP(o.total, false)}</td>
                  <td className="p-3">
                    {o.payment_status === 'verified' || o.payment_status === 'paid' ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">مؤكد</span>
                    ) : (
                      <button type="button" onClick={() => verifyPayment(o)} className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold hover:bg-amber-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> تأكيد الدفع
                      </button>
                    )}
                  </td>
                  <td className="p-3 font-bold">{o.order_status}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select value={o.order_status} onChange={e => updateOrderStatus(o.id, e.target.value)} className="px-2 py-1 border rounded-lg bg-white">
                        {['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      {section === 'fulfillment' && (
                        <button type="button" onClick={() => neonDb.confirmPacking(o.id, [], { courierName: 'شركة الشحن' }).then(() => refreshOrders())}
                          className="px-2.5 py-1 rounded-lg bg-[#fe9931] text-white font-bold flex items-center gap-1">
                          <PackageCheck className="w-3.5 h-3.5" /> شحن
                        </button>
                      )}
                      <button type="button" onClick={() => openWaModal(o)}
                        className="px-2.5 py-1 rounded-lg bg-[#25D366] text-white font-bold flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" /> واتساب
                      </button>
                      <button type="button" onClick={() => quickSendReview(o)} title="إرسال طلب تقييم على واتساب"
                        className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 font-bold flex items-center gap-1">
                        <Star className="w-3 h-3" /> تقييم
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {waOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setWaOrder(null)}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-[#252a31] flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                    <span>إرسال واتساب للعميل ({waOrder.customer_name})</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{waOrder.order_number} • {waOrder.customer_whatsapp || waOrder.customer_phone}</p>
                </div>
                <button type="button" onClick={() => setWaOrder(null)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {WA_PRESETS.map(p => (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => { setWaType(p.type); setWaText(buildQamarCustomerMessage(p.type, waOrder, settings)); }}
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${waType === p.type ? 'bg-[#fe9931] text-white border-[#fe9931]' : 'bg-gray-50 text-gray-600'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={7}
                value={waText}
                onChange={e => setWaText(e.target.value)}
                className="w-full p-3 border rounded-2xl text-xs leading-relaxed focus:outline-none focus:border-[#fe9931]"
              />

              {waAlert && (
                <div className={`p-3 rounded-xl text-xs font-bold ${waAlert.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {waAlert.msg}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={sendingWa}
                  onClick={sendViaCrm}
                  className="flex-1 py-2.5 px-4 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingWa ? 'جاري الإرسال...' : 'إرسال تلقائي عبر WhatsApp CRM'}</span>
                </button>
                <a
                  href={whatsappUrl(waOrder.customer_whatsapp || waOrder.customer_phone, waText)}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 rounded-full border border-gray-300 text-xs font-bold text-[#252a31] flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح يدوي</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {section === 'fulfillment' && refusals.length > 0 && (
          <div className="bg-white border rounded-2xl p-4">
            <h3 className="font-bold text-xs text-red-700 mb-2">سجل مرتجعات التوصيل ({refusals.length})</h3>
            {refusals.map(r => (
              <div key={r.id} className="text-xs py-1 border-b last:border-b-0 flex justify-between">
                <span>{r.order_id} — {r.customer_phone}</span>
                <span className="text-gray-500">{r.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section === 'crm') {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-[#fe9931]" /><span>السلات النشطة والمتروكة ({activeCarts.length})</span></h1>
        <div className="bg-white border rounded-2xl divide-y">
          {activeCarts.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">لا توجد سلات نشطة أو متروكة حالياً.</p>
          ) : activeCarts.map(c => (
            <div key={c.session_id} className="p-4 flex justify-between items-center text-xs">
              <div>
                <p className="font-bold">{c.customer_name || 'زائر'} {c.customer_phone || ''}</p>
                <p className="text-gray-500">{Array.isArray(c.items) ? c.items.length : 0} منتجات</p>
              </div>
              <div className="text-left">
                <p className="font-bold text-[#fe9931]">{formatEGP(Number(c.subtotal || 0), false)}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.is_abandoned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {c.is_abandoned ? 'متروكة' : 'نشطة الآن'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // support
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><MessageSquare className="w-5 h-5 text-[#fe9931]" /><span>تذاكر الدعم ورسائل اتصل بنا ({tickets.length})</span></h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border rounded-2xl divide-y">
          {tickets.map(t => (
            <button key={t.id} type="button" onClick={async () => setActiveTicket(await neonDb.getSupportTicket(t.id))}
              className="w-full p-4 text-right hover:bg-gray-50 text-xs space-y-1">
              <div className="flex justify-between font-bold"><span>{t.customer_name || t.customer_phone}</span><span className="text-[#fe9931]">{t.status}</span></div>
              <p className="text-gray-500 truncate">{t.subject}</p>
            </button>
          ))}
        </div>
        <div className="lg:col-span-7 bg-white border rounded-2xl p-5 space-y-4">
          {!activeTicket ? (
            <p className="text-sm text-gray-400">اختر تذكرة لعرض الرسائل والرد.</p>
          ) : (
            <>
              <div className="flex justify-between items-center border-b pb-3">
                <p className="font-bold text-sm">{activeTicket.ticket.subject}</p>
                <button type="button" onClick={() => neonDb.closeSupportTicket(activeTicket.ticket.id)} className="px-3 py-1 rounded-full bg-gray-100 text-xs font-bold">إغلاق</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeTicket.messages.map((m: any) => (
                  <div key={m.id} className={`p-3 rounded-xl text-xs ${m.sender_type === 'staff' ? 'bg-amber-50 text-[#4f4335]' : 'bg-gray-100'}`}>
                    <strong>{m.sender_type === 'staff' ? 'الإدارة: ' : 'العميل: '}</strong>{m.body}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="اكتب ردك..." className="flex-1 px-3 py-2 border rounded-xl text-xs" />
                <button type="button" onClick={async () => {
                  await neonDb.replySupportTicket(activeTicket.ticket.id, 'staff', replyText);
                  setReplyText('');
                  setActiveTicket(await neonDb.getSupportTicket(activeTicket.ticket.id));
                }} className="px-4 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold">إرسال</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
