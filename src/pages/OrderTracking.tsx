import React, { useState } from 'react';
import { PackageSearch, CheckCircle2 } from 'lucide-react';
import { neonDb } from '../services/neonDb';
import { formatEGP } from '../utils/arabicNumbers';
import type { Order } from '../types';

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  processing: 'جاري التجهيز والتعبئة',
  shipped: 'تم الشحن',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغي'
};

export const OrderTracking: React.FC = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const found = await neonDb.trackOrder(orderNumber, phone);
      if (!found) setError('لم يتم العثور على طلب مطابق لرقم الطلب ورقم الهاتف.');
      else setOrder(found);
    } catch (err: any) {
      setError(err?.message || 'اكتب رقم الطلب ورقم الهاتف المسجل معًا.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 min-h-[60vh]">
      <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="text-center">
          <PackageSearch className="w-10 h-10 text-[#fe9931] mx-auto mb-2" />
          <h1 className="text-2xl font-extrabold text-[#252a31]">تتبع طلبك</h1>
          <p className="text-xs text-gray-500 mt-1">أدخل رقم الطلب ورقم الهاتف المسجل معًا لمتابعة حالة الشحنة</p>
        </div>

        <form onSubmit={search} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" required value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
              placeholder="رقم الطلب (مثال: QMR-2026-123456)"
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
            <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="رقم الهاتف (01xxxxxxxxx)"
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm">
            {loading ? 'جاري البحث...' : 'بحث عن الطلب'}
          </button>
        </form>

        {error && <p className="text-sm text-red-600 text-center font-medium">{error}</p>}

        {order && (
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#252a31]" dir="ltr">{order.order_number}</span>
              <span className="px-3 py-1 rounded-full bg-[#fe9931]/10 text-[#fe9931] text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {STATUS_LABELS[order.order_status] || order.order_status}
              </span>
            </div>
            <div className="text-sm space-y-1.5 text-gray-600">
              <p>العميل: <strong className="text-[#252a31]">{order.customer_name}</strong></p>
              <p>العنوان: {order.governorate} - {order.address_details}</p>
              <p>الإجمالي: <strong className="text-[#fe9931]">{formatEGP(order.total)}</strong></p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
