import React from 'react';
import { CheckCircle2, MessageCircle, Search } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';
import { buildQamarOrderWhatsAppMessage, whatsappUrl } from '../utils/whatsappService';

export const OrderSuccess: React.FC = () => {
  const { currentOrder, settings, navigate } = useStore();

  if (!currentOrder) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">لم يتم العثور على طلب حالي.</p>
        <button type="button" onClick={() => navigate('home')} className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const waLink = whatsappUrl(settings.whatsapp_number, buildQamarOrderWhatsAppMessage(currentOrder));

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h1 className="text-2xl font-extrabold text-[#252a31]">تم استلام طلبك بنجاح!</h1>
        <p className="text-sm text-gray-500">
          رقم طلبك هو <span className="font-bold text-[#fe9931]" dir="ltr">{currentOrder.order_number}</span>
        </p>

        <div className="bg-gray-50 rounded-2xl p-4 text-right text-sm space-y-2">
          <div className="flex justify-between"><span className="text-gray-500">الاسم:</span><span className="font-bold">{currentOrder.customer_name}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">الهاتف:</span><span className="font-bold" dir="ltr">{currentOrder.customer_phone}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">الإجمالي:</span><span className="font-bold text-[#fe9931]">{formatEGP(currentOrder.total)}</span></div>
        </div>

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
