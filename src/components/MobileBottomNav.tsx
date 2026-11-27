import React from 'react';
import { Home, ShoppingBag, ShoppingCart, Truck, User, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { toArabicDigits } from '../utils/arabicNumbers';

export const MobileBottomNav: React.FC = () => {
  const { currentTab, cartCount, setIsCartOpen, navigate } = useStore();
  const { user, canAccessAdmin, openAuthModal } = useAuth();

  if (currentTab === 'admin') return null;

  const pillClass = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 rounded-full text-[10px] font-bold transition-all duration-300 active:scale-95 ${
      active
        ? 'qamar-liquid-glass-pill text-[#fe9931]'
        : 'text-[#252a31]/75 hover:text-[#252a31]'
    }`;

  return (
    <div
      data-testid="mobile-liquid-glass-dock"
      className="md:hidden fixed bottom-[max(14px,env(safe-area-inset-bottom))] inset-x-3 z-40 mx-auto max-w-[430px] pointer-events-none"
    >
      <nav
        aria-label="التنقل السريع للموبايل"
        className="qamar-liquid-glass-dock pointer-events-auto relative rounded-full p-1.5 overflow-visible"
      >
        {/* Top crystal specular arc sheen */}
        <span
          aria-hidden="true"
          className="qamar-liquid-glass-sheen pointer-events-none absolute inset-0 rounded-full"
        />

        <div className="relative z-10 flex items-center justify-between gap-1">
          <button type="button" onClick={() => navigate('home')} className={pillClass(currentTab === 'home')}>
            <Home className={`w-[18px] h-[18px] ${currentTab === 'home' ? 'stroke-[2.4]' : ''}`} />
            <span>الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('shop', { category: 'all', search: '' })}
            className={pillClass(currentTab === 'shop' || currentTab === 'product')}
          >
            <ShoppingBag className={`w-[18px] h-[18px] ${currentTab === 'shop' || currentTab === 'product' ? 'stroke-[2.4]' : ''}`} />
            <span>المتجر</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label="سلة المشتريات"
            className="relative -mt-4 mx-0.5 flex flex-col items-center justify-center shrink-0 active:scale-95 transition-transform duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ffa84c] via-[#fe9931] to-[#e67e17] text-white shadow-[0_10px_24px_-4px_rgba(254,153,49,0.6),inset_0_1.5px_1px_rgba(255,255,255,0.75)] flex items-center justify-center relative border-2 border-white/90">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[20px] h-[20px] px-1 rounded-full bg-[#252a31] text-white text-[10px] font-extrabold flex items-center justify-center border border-white/95 shadow-sm">
                  {toArabicDigits(cartCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-extrabold text-[#252a31] mt-0.5 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              السلة
            </span>
          </button>

          <button type="button" onClick={() => navigate('track-order')} className={pillClass(currentTab === 'track-order')}>
            <Truck className={`w-[18px] h-[18px] ${currentTab === 'track-order' ? 'stroke-[2.4]' : ''}`} />
            <span>طلباتي</span>
          </button>

          {canAccessAdmin ? (
            <button type="button" onClick={() => navigate('admin')} className={pillClass(false)}>
              <ShieldCheck className="w-[18px] h-[18px] text-[#fe9931]" />
              <span>الإدارة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (user ? navigate('profile') : openAuthModal())}
              className={pillClass(currentTab === 'profile')}
            >
              <User className={`w-[18px] h-[18px] ${currentTab === 'profile' ? 'stroke-[2.4]' : ''}`} />
              <span>{user ? 'حسابي' : 'دخول'}</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};
