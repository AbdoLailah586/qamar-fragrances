import React from 'react';
import { ShoppingCart, X, Plus, Minus, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeFromCart,
    cartSubtotal,
    navigate
  } = useStore();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex qamar-fade-in">
      {/* Drawer anchored to the left (matching Qamar RTL cart drawer) */}
      <div className="relative w-full max-w-[380px] bg-white h-full shadow-2xl flex flex-col z-10 qamar-slide-left">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#252a31] font-bold text-base">
            <ShoppingCart className="w-5 h-5" />
            <span>السلَّة</span>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="text-[#fe9931] hover:bg-[#fe9931]/10 p-1.5 rounded-full transition"
            aria-label="إغلاق السلة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingCart className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium mb-4">السلة فارغة حالياً</p>
              <button
                type="button"
                onClick={() => { setIsCartOpen(false); navigate('shop', { category: 'all', search: '' }); }}
                className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white text-sm font-bold hover:bg-[#e88722] transition"
              >
                تسوق الآن
              </button>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={`${item.product.id}-${item.selectedSize || ''}`}
                className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-b-0"
              >
                <img
                  src={item.product.images?.[0] || '/qamar-images/626c06f2fe557fd9.webp'}
                  alt={item.product.name_ar}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#252a31] line-clamp-2 leading-snug">
                    {item.product.name_ar}
                  </p>
                  {item.selectedSize && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.selectedSize}</p>
                  )}
                  <p className="text-sm font-bold text-[#252a31] mt-1">
                    {formatEGP(item.unitPrice)}
                  </p>

                  <div className="flex items-center gap-2.5 mt-2.5">
                    <div className="inline-flex items-center border border-gray-200 rounded-full overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1, item.selectedSize)}
                        className="px-2.5 py-1 text-gray-600 hover:bg-gray-100"
                        aria-label="تقليل الكمية"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-bold text-[#252a31]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1, item.selectedSize)}
                        className="px-2.5 py-1 text-gray-600 hover:bg-gray-100"
                        aria-label="زيادة الكمية"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id, item.selectedSize)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      aria-label="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-2.5">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-bold text-[#252a31] text-base">{formatEGP(cartSubtotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => { setIsCartOpen(false); navigate('checkout'); }}
              className="w-full py-3 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm transition"
            >
              الدفع
            </button>
            <button
              type="button"
              onClick={() => { setIsCartOpen(false); navigate('cart'); }}
              className="w-full py-2.5 rounded-full border border-gray-300 hover:border-[#fe9931] text-[#252a31] font-semibold text-sm transition"
            >
              عرض محتويات السلة
            </button>
          </div>
        )}
      </div>

      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-[1px]"
        onClick={() => setIsCartOpen(false)}
      />
    </div>
  );
};
