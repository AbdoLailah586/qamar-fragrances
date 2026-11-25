import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';

export const CartPage: React.FC = () => {
  const { cart, updateCartQuantity, removeFromCart, cartSubtotal, navigate } = useStore();

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-10 min-h-[60vh]">
      <h1 className="text-2xl font-bold text-[#252a31] mb-6">محتويات السلَّة</h1>

      {cart.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-5">سلتك فارغة حالياً.</p>
          <button
            type="button"
            onClick={() => navigate('shop', { category: 'all', search: '' })}
            className="px-7 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm"
          >
            العودة للمتجر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {cart.map(item => (
              <div key={`${item.product.id}-${item.selectedSize || ''}`} className="p-5 flex items-center gap-4">
                <img
                  src={item.product.images?.[0]}
                  alt={item.product.name_ar}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#252a31]">{item.product.name_ar}</p>
                  {item.selectedSize && <p className="text-xs text-gray-500 mt-0.5">الحجم: {item.selectedSize}</p>}
                  <p className="text-sm font-bold text-[#fe9931] mt-1">{formatEGP(item.unitPrice)}</p>
                </div>

                <div className="inline-flex items-center border border-gray-200 rounded-full">
                  <button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity - 1, item.selectedSize)} className="p-2 text-gray-600"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="px-3 text-sm font-bold">{item.quantity}</span>
                  <button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity + 1, item.selectedSize)} className="p-2 text-gray-600"><Plus className="w-3.5 h-3.5" /></button>
                </div>

                <p className="font-bold text-[#252a31] w-24 text-left hidden sm:block">
                  {formatEGP(item.unitPrice * item.quantity)}
                </p>

                <button type="button" onClick={() => removeFromCart(item.product.id, item.selectedSize)} className="text-gray-400 hover:text-red-500 p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-lg text-[#252a31]">ملخص الطلب</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-bold text-[#252a31]">{formatEGP(cartSubtotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('checkout')}
              className="w-full py-3 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm transition"
            >
              إتمام الدفع
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
