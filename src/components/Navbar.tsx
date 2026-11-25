import React, { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, User, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { formatEGP, toArabicDigits } from '../utils/arabicNumbers';
import { InstallAppButton } from './PwaControls';
import { SocialIconLinks } from './SocialIcons';

export const Navbar: React.FC = () => {
  const {
    products,
    settings,
    cartCount,
    cartSubtotal,
    setIsCartOpen,
    currentTab,
    searchQuery,
    setSearchQuery,
    navigate,
    openProduct
  } = useStore();
  const { user, canAccessAdmin, openAuthModal } = useAuth();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showSuggest, setShowSuggest] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalSearch(searchQuery); }, [searchQuery]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const suggestions = localSearch.trim().length >= 2
    ? products
        .filter(p =>
          p.is_active !== false &&
          (p.name_ar.toLowerCase().includes(localSearch.trim().toLowerCase()) ||
           p.brand.toLowerCase().includes(localSearch.trim().toLowerCase()))
        )
        .slice(0, 6)
    : [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggest(false);
    setSearchQuery(localSearch);
    navigate('shop', { search: localSearch, category: 'all' });
  };

  return (
    <header className="w-full bg-white sticky top-0 z-40 shadow-[0_1px_0_0_#eaeaea]">
      {settings.announcement_enabled && settings.announcement_text && (
        <div className="bg-black text-white text-xs text-center py-2 px-4">
          {settings.announcement_text}
        </div>
      )}

      {/* Top Header Row: Logo (Right) - Search (Center) - Account & Cart (Left) */}
      <div className="max-w-[1320px] mx-auto px-3.5 sm:px-4 md:px-8 py-2.5 md:py-3 flex flex-wrap md:flex-nowrap items-center justify-between gap-2.5 md:gap-6">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="shrink-0 flex items-center focus:outline-none"
          aria-label="Qamar Fragrances"
        >
          <img
            src={settings.logo_url || '/qamar-images/626c06f2fe557fd9.webp'}
            alt="Qamar Fragrances"
            className="h-10 sm:h-11 md:h-14 w-auto object-contain"
          />
        </button>

        {/* Pill Search Bar */}
        <div ref={wrapRef} className="order-3 md:order-2 w-full md:flex-1 md:max-w-3xl relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              value={localSearch}
              onFocus={() => setShowSuggest(true)}
              onChange={e => { setLocalSearch(e.target.value); setShowSuggest(true); }}
              placeholder="ما الذي تبحث عنه؟"
              className="w-full h-10 md:h-11 rounded-full border border-[#eaecf0] bg-[#f8f9fb] md:bg-white pr-4 md:pr-5 pl-12 text-sm text-[#252a31] placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#fe9931] transition"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => { setLocalSearch(''); setSearchQuery(''); }}
                className="absolute left-11 text-gray-400 hover:text-gray-600 p-1"
                aria-label="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute left-3.5 text-gray-500 hover:text-[#fe9931] transition p-1"
              aria-label="بحث"
            >
              <Search className="w-5 h-5" />
            </button>
          </form>

          {showSuggest && suggestions.length > 0 && (
            <div className="absolute top-full mt-1.5 inset-x-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
              {suggestions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setShowSuggest(false); openProduct(p); }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-right border-b last:border-b-0 border-gray-50"
                >
                  <img src={p.images[0]} alt={p.name_ar} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#252a31] truncate">{p.name_ar}</p>
                    <p className="text-xs text-[#fe9931] font-bold">{formatEGP(p.price)}</p>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="w-full py-2.5 text-center text-xs font-bold text-[#fe9931] bg-gray-50 hover:bg-gray-100"
              >
                عرض جميع نتائج "{localSearch}"
              </button>
            </div>
          )}
        </div>

        {/* Left Side: Mobile Install + Login / Profile + Admin + Cart Pill */}
        <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
          <div className="md:hidden">
            <InstallAppButton compact />
          </div>

          {canAccessAdmin && (
            <button
              type="button"
              onClick={() => navigate('admin')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4f4335] text-white text-xs font-bold hover:bg-[#3a3126] transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#fe9931]" />
              لوحة الإدارة
            </button>
          )}

          {user ? (
            <button
              type="button"
              onClick={() => navigate('profile')}
              className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#252a31] hover:text-[#fe9931] transition"
            >
              <User className="w-4 h-4" />
              <span className="max-w-[110px] truncate">{user.name || 'حسابي'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#252a31] hover:text-[#fe9931] transition"
            >
              <User className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded-full px-3 py-1.5 md:px-3.5 md:py-2 transition"
            aria-label="السلة"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 text-[#252a31]" />
              <span className="absolute -top-2.5 -left-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#fe9931] text-white text-[11px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <span className="hidden sm:inline text-sm font-semibold text-[#252a31]">{formatEGP(cartSubtotal)}</span>
          </button>
        </div>
      </div>

      {/* Desktop Secondary Nav Row (Mobile uses bottom app bar instead) */}
      <div className="hidden md:block border-t border-gray-100">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-6 md:gap-8 h-full text-sm font-semibold">
            <button
              type="button"
              onClick={() => navigate('home')}
              className={`h-full flex items-center border-b-[3px] transition ${
                currentTab === 'home' ? 'border-[#fe9931] text-[#252a31]' : 'border-transparent text-[#585757] hover:text-[#252a31]'
              }`}
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => navigate('shop', { category: 'all', search: '' })}
              className={`h-full flex items-center border-b-[3px] transition ${
                currentTab === 'shop' || currentTab === 'product' ? 'border-[#fe9931] text-[#252a31]' : 'border-transparent text-[#585757] hover:text-[#252a31]'
              }`}
            >
              المتجر
            </button>
            <button
              type="button"
              onClick={() => navigate('contact')}
              className={`h-full flex items-center border-b-[3px] transition ${
                currentTab === 'contact' ? 'border-[#fe9931] text-[#252a31]' : 'border-transparent text-[#585757] hover:text-[#252a31]'
              }`}
            >
              اتصل بنا
            </button>
          </nav>

          {/* Desktop Install + Real Brand Social Circles */}
          <div className="flex items-center gap-2.5">
            <InstallAppButton compact />
            <SocialIconLinks variant="header" />
          </div>
        </div>
      </div>
    </header>
  );
};
