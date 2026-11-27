import React, { useMemo } from 'react';
import { CheckCircle2, MessageCircle, Search, AlertTriangle, Clock } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';
import { buildQamarOrderWhatsAppMessage, whatsappUrl } from '../utils/whatsappService';

export const OrderSuccess: React.FC = () => {
  const { currentOrder, orders, settings, navigate } = useStore();

  const urlPaymentState = useMemo(() => {
    if (typeof window === 'undefined') return { orderParam: '', paymentParam: '' };
    const sp = new URLSearchParams(window.location.search);
    return {
      orderParam: (sp.get('order') || '').trim(),
      paymentParam: (sp.get('payment') || '').trim().toLowerCase()
    };
  }, []);

  const displayOrder = useMemo(() => {
    if (urlPaymentState.orderParam) {
      const match = orders.find(
        o => o.order_number?.toUpperCase() === urlPaymentState.orderParam.toUpperCase()
      );
      if (match) return match;
    }
    return currentOrder;
  }, [currentOrder, orders, urlPaymentState.orderParam]);

  if (!displayOrder && !urlPaymentState.orderParam) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">لم يتم العثور على طلب حالي.</p>
        <button type="button" onClick={() => navigate('home')} className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const orderNumber = displayOrder?.order_number || urlPaymentState.orderParam;
  const isGatewayPaid = urlPaymentState.paymentParam === 'paid' || displayOrder?.payment_status === 'paid' || displayOrder?.payment_status === 'verified';
  const isGatewayPending = urlPaymentState.paymentParam === 'pending';
  const isGatewayFailed = urlPaymentState.paymentParam === 'failed' || urlPaymentState.paymentParam === 'unverified';
  const waLink = displayOrder
    ? whatsappUrl(settings.whatsapp_number, buildQamarOrderWhatsAppMessage(displayOrder))
    : whatsappUrl(settings.whatsapp_number, `مرحباً قمر للعطور، بخصوص الطلب رقم #${orderNumber}`);

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center space-y-5">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
            isGatewayFailed
              ? 'bg-red-100 text-red-600'
              : isGatewayPending
                ? 'bg-amber-100 text-[#fe9931]'
                : 'bg-green-100 text-green-600'
          }`}
        >
          {isGatewayFailed ? (
            <AlertTriangle className="w-9 h-9" />
          ) : isGatewayPending ? (
            <Clock className="w-9 h-9" />
          ) : (
            <CheckCircle2 className="w-9 h-9" />
          )}
        </div>

        <h1 className="text-2xl font-extrabold text-[#252a31]">
          {isGatewayFailed
            ? 'لم يكتمل الدفع الإلكتروني بعد'
            : isGatewayPaid
              ? 'تم استلام طلبك والدفع الإلكتروني بنجاح!'
              : isGatewayPending
                ? 'طلبك مسجّل وجاري مراجعة عملية الدفع'
                : 'تم استلام طلبك بنجاح!'}
        </h1>
        <p className="text-sm text-gray-500">
          رقم طلبك هو <span data-allow-copy="true" className="font-bold text-[#fe9931] select-text" dir="ltr">{orderNumber}</span>
        </p>

        {isGatewayPaid ? (
          <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 inline-block">
            ✓ تم تأكيد الدفع الإلكتروني تلقائياً عبر بوابة الدفع وجاري تجهيز عطورك
          </p>
        ) : isGatewayFailed ? (
          <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-2 inline-block">
            تم تسجيل طلبك ويمكنك تأكيد الدفع أو استكمال الطلب مباشرة عبر واتساب خدمة العملاء
          </p>
        ) : (
          <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 inline-block">
            ✓ يتم إرسال رسالة تأكيد الطلب تلقائياً على رقم الواتساب المسجل
          </p>
        )}

        {displayOrder && (
          <div className="bg-gray-50 rounded-2xl p-4 text-right text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500">الاسم:</span><span className="font-bold">{displayOrder.customer_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الهاتف:</span><span className="font-bold" dir="ltr">{displayOrder.customer_phone}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الإجمالي:</span><span className="font-bold text-[#fe9931]">{formatEGP(displayOrder.total)}</span></div>
            {displayOrder.google_maps_url && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-gray-500">موقع التوصيل:</span>
                <a href={displayOrder.google_maps_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#fe9931] hover:underline">
                  عرض على خرائط جوجل ↗
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a href={waLink} target="_blank" rel="noreferrer"
             className="px-6 py-3 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            <span>إرسال تفاصيل الطلب عبر واتساب</span>
          </a>
          <button type="button" onClick={() => navigate('track-order')}
            className="px-6 py-3 rounded-full border border-gray-300 text-[#252a31] font-bold text-sm flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>تتبع الطلب</span>
          </button>
        </div>
      </div>
    </main>
  );
};
