import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, BarChart3, ShoppingBag, Truck, MessageSquare, PackageCheck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { neonDb } from '../../services/neonDb';
import { formatEGP } from '../../utils/arabicNumbers';

export const OrdersCrmSupportPanel: React.FC<{ section: 'overview' | 'analytics' | 'orders' | 'fulfillment' | 'crm' | 'support'; onGo?: (s: string) => void }> = ({ section, onGo }) => {
  const { products, orders, collections, activeCarts, updateOrderStatus, refreshActiveCarts } = useStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [refusals, setRefusals] = useState<any[]>([]);

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
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          {section === 'fulfillment' ? <Truck className="w-5 h-5 text-[#fe9931]" /> : <ShoppingBag className="w-5 h-5 text-[#fe9931]" />}
          <span>{section === 'fulfillment' ? 'التجهيز والتغليف والشحن' : `إدارة الطلبات (${orders.length})`}</span>
        </h1>

        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="w-full text-xs text-right">
            <thead className="bg-gray-50 font-bold text-gray-500">
              <tr><th className="p-3">رقم الطلب</th><th className="p-3">العميل</th><th className="p-3">المحافظة</th><th className="p-3">الإجمالي</th><th className="p-3">الحالة</th><th className="p-3">تحديث</th></tr>
            </thead>
            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد طلبات حتى الآن.</td></tr>
              ) : orders.map(o => (
                <tr key={o.id}>
                  <td className="p-3 font-bold" dir="ltr">{o.order_number}</td>
                  <td className="p-3">{o.customer_name} ({o.customer_phone})</td>
                  <td className="p-3">{o.governorate}</td>
                  <td className="p-3 font-bold text-[#fe9931]">{formatEGP(o.total, false)}</td>
                  <td className="p-3 font-bold">{o.order_status}</td>
                  <td className="p-3 flex items-center gap-2">
                    <select value={o.order_status} onChange={e => updateOrderStatus(o.id, e.target.value)} className="px-2 py-1 border rounded-lg bg-white">
                      {['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    {section === 'fulfillment' && (
                      <button type="button" onClick={() => neonDb.confirmPacking(o.id, [], { courierName: 'شركة الشحن' })}
                        className="px-2.5 py-1 rounded-lg bg-[#fe9931] text-white font-bold flex items-center gap-1">
                        <PackageCheck className="w-3.5 h-3.5" /> شحن
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
