import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Truck, CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { egyptianGovernorates } from '../data/governorates';
import { formatEGP } from '../utils/arabicNumbers';
import { normalizePhone } from '../utils/deliveryAddress';
import type { PaymentMethod } from '../types';

export const Checkout: React.FC = () => {
  const { cart, cartSubtotal, settings, createOrder, navigate } = useStore();
  const { user } = useAuth();

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerWhatsapp, setCustomerWhatsapp] = useState(user?.phone || '');
  const [governorate, setGovernorate] = useState('الدقهلية - المنصورة');
  const [city, setCity] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedGov = egyptianGovernorates.find(g => g.name_ar === governorate) || egyptianGovernorates[0];
  const freeThreshold = settings.free_shipping_threshold || 1500;
  const shippingFee = cartSubtotal >= freeThreshold ? 0 : (selectedGov?.shipping_fee ?? settings.shipping_fee ?? 60);
  const total = cartSubtotal + shippingFee;

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">سلتك فارغة. أضف عطور أولاً لإتمام الطلب.</p>
        <button type="button" onClick={() => navigate('shop', { category: 'all', search: '' })}
          className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm">
          تصفح العطور
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const phone = normalizePhone(customerPhone);
    if (phone.length !== 11) {
      setError('أدخل رقم هاتف مصري صحيح مكون من 11 رقم.');
      return;
    }
    if (!customerName.trim() || !addressDetails.trim()) {
      setError('الاسم والعنوان بالتفصيل مطلوبان.');
      return;
    }
    setSubmitting(true);
    try {
      await createOrder({
        customer_name: customerName.trim(),
        customer_phone: phone,
        customer_whatsapp: normalizePhone(customerWhatsapp) || phone,
        customer_email: user?.email,
        governorate,
        city: city.trim(),
        address_details: addressDetails.trim(),
        notes: notes.trim(),
        items: cart,
        subtotal: cartSubtotal,
        shipping_fee: shippingFee,
        discount: 0,
        total,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || undefined
      });
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      navigate('order-success');
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-[1150px] mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl font-extrabold text-[#252a31] mb-6">إتمام الطلب والدفع</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-base text-[#252a31] flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#fe9931]" />
              <span>بيانات التوصيل</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكامل</label>
                <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف</label>
                <input type="tel" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="01xxxxxxxxx"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المحافظة</label>
                <select value={governorate} onChange={e => setGovernorate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#fe9931]">
                  {egyptianGovernorates.map(g => (
                    <option key={g.name_ar} value={g.name_ar}>
                      {g.name_ar} ({g.shipping_fee} ج.م — {g.eta_days})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المدينة / المركز</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">العنوان بالتفصيل</label>
              <input type="text" required value={addressDetails} onChange={e => setAddressDetails(e.target.value)}
                placeholder="اسم الشارع، رقم العمارة، الدور، علامة مميزة"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم واتساب (اختياري)</label>
                <input type="tel" value={customerWhatsapp} onChange={e => setCustomerWhatsapp(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات للبائع / التغليف</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="تغليف هدية أو ملاحظات التوصيل"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-base text-[#252a31] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#fe9931]" />
              <span>طريقة الدفع</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'cod', title: 'الدفع عند الاستلام', sub: 'معاينة الطلب عند الاستلام' },
                { id: 'instapay', title: 'إنستاباي (InstaPay)', sub: 'تحويل فوري على 01003732029' },
                { id: 'vodafone_cash', title: 'فودافون كاش / محفظة', sub: 'تحويل على 01003732029' },
                { id: 'card', title: 'بطاقة بنكية (أونلاين)', sub: 'فيزا / ماستركارد' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-3.5 rounded-xl border text-right transition ${
                    paymentMethod === m.id ? 'border-[#fe9931] bg-[#fe9931]/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-bold text-sm text-[#252a31] flex items-center justify-between">
                    <span>{m.title}</span>
                    {paymentMethod === m.id && <CheckCircle2 className="w-4 h-4 text-[#fe9931]" />}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{m.sub}</p>
                </button>
              ))}
            </div>

            {(paymentMethod === 'instapay' || paymentMethod === 'vodafone_cash') && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم المرجع / الرقم المحول منه</label>
                <input type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)}
                  placeholder="أدخل رقم العملية أو الرقم المحول منه"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 space-y-4 sticky top-24">
          <h2 className="font-bold text-lg text-[#252a31]">ملخص طلبك</h2>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {cart.map(item => (
              <div key={`${item.product.id}-${item.selectedSize || ''}`} className="py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#252a31] truncate">{item.product.name_ar}</p>
                  <p className="text-xs text-gray-500">{item.selectedSize} × {item.quantity}</p>
                </div>
                <span className="font-bold text-[#252a31] shrink-0">{formatEGP(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-bold">{formatEGP(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">مصاريف الشحن ({selectedGov?.name_ar})</span>
              <span className="font-bold">{shippingFee === 0 ? 'شحن مجاني' : formatEGP(shippingFee)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-[#252a31] pt-2 border-t border-gray-100">
              <span>الإجمالي</span>
              <span className="text-[#fe9931]">{formatEGP(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm transition disabled:opacity-60"
          >
            {submitting ? 'جاري تأكيد الطلب...' : 'تأكيد وإرسال الطلب'}
          </button>

          <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#fe9931]" />
            <span>يتم التحقق من الأسعار وتوافر المخزون تلقائياً لحظة التأكيد</span>
          </p>
        </div>
      </form>
    </main>
  );
};
