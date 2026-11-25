import React from 'react';
import { Home, ShoppingBag, ShoppingCart, Truck, User, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { toArabicDigits } from '../utils/arabicNumbers';

export const MobileBottomNav: React.FC = () => {
  const { currentTab, cartCount, setIsCartOpen, navigate } = useStore();
  const { user, canAccessAdmin, openAuthModal } = useAuth();

  if (currentTab === 'admin') return null;

  const itemClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 text-[11px] font-bold transition ${
      active ? 'text-[#fe9931]' : 'text-[#585757]'
    }`;

  return (
    <nav
      aria-label="التنقل السريع للموبايل"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-16 px-2">
        <button type="button" onClick={() => navigate('home')} className={itemClass(currentTab === 'home')}>
          <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.4]' : ''}`} />
          <span>الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('shop', { category: 'all', search: '' })}
          className={itemClass(currentTab === 'shop' || currentTab === 'product')}
        >
          <ShoppingBag className={`w-5 h-5 ${currentTab === 'shop' || currentTab === 'product' ? 'stroke-[2.4]' : ''}`} />
          <span>المتجر</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          aria-label="سلة المشتريات"
          className="relative -mt-4 flex flex-col items-center justify-center"
        >
          <div className="w-12 h-12 rounded-full bg-[#fe9931] text-white shadow-lg shadow-[#fe9931]/30 flex items-center justify-center relative border-2 border-white">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[20px] h-[20px] px-1 rounded-full bg-[#252a31] text-white text-[10px] font-extrabold flex items-center justify-center border border-white">
                {toArabicDigits(cartCount)}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-[#252a31] mt-0.5">السلة</span>
        </button>

        <button type="button" onClick={() => navigate('track-order')} className={itemClass(currentTab === 'track-order')}>
          <Truck className={`w-5 h-5 ${currentTab === 'track-order' ? 'stroke-[2.4]' : ''}`} />
          <span>طلباتي</span>
        </button>

        {canAccessAdmin ? (
          <button type="button" onClick={() => navigate('admin')} className={itemClass(false)}>
            <ShieldCheck className="w-5 h-5 text-[#fe9931]" />
            <span>الإدارة</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (user ? navigate('profile') : openAuthModal())}
            className={itemClass(currentTab === 'profile')}
          >
            <User className={`w-5 h-5 ${currentTab === 'profile' ? 'stroke-[2.4]' : ''}`} />
            <span>{user ? 'حسابي' : 'دخول'}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
