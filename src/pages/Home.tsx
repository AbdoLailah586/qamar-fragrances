import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { whatsappUrl } from '../utils/whatsappService';

export const Home: React.FC = () => {
  const { products, collections, settings, isCatalogLoading, navigate } = useStore();
  const [slideOffset, setSlideOffset] = useState(0);

  const visibleCollections = collections.slice(0, 6);
  const perView = 4;
  const maxOffset = Math.max(0, visibleCollections.length - perView);
  const shownCollections = visibleCollections.slice(slideOffset, slideOffset + perView);

  // Exact 12 featured products in their exact homepage order
  const featuredProducts = [...products]
    .filter(p => p.is_active !== false && p.is_featured)
    .sort((a, b) => (a.featured_order ?? 999) - (b.featured_order ?? 999))
    .slice(0, 12);

  const fallbackFeatured = featuredProducts.length > 0
    ? featuredProducts
    : products.filter(p => p.is_active !== false).slice(0, 12);

  return (
    <main className="w-full bg-white pb-6 md:pb-0">
      {/* 1. Hero Banner (Tailored mobile rounded card feel vs wide desktop hero) */}
      <section className="relative w-full min-h-[260px] md:min-h-[320px] md:aspect-[16/5] flex items-center justify-center overflow-hidden bg-[#8b8175] rounded-b-3xl md:rounded-none shadow-sm md:shadow-none">
        <img
          src={settings.hero_image || '/qamar-images/a182f7810c27ec59.webp'}
          alt={settings.hero_heading}
          className="hidden md:block absolute inset-0 w-full h-full object-cover"
        />
        <img
          src={settings.hero_mobile_image || settings.hero_image || '/qamar-images/66b77b422345ca7e.webp'}
          alt={settings.hero_heading}
          className="md:hidden absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/30 to-black/15 md:bg-black/25" />

        <div className="relative z-10 max-w-4xl mx-auto px-5 text-center text-white py-9 md:py-12">
          <h1 className="text-2xl sm:text-4xl md:text-[42px] font-extrabold leading-tight drop-shadow-sm">
            {settings.hero_heading}
          </h1>
          <p className="mt-2.5 md:mt-4 text-xs sm:text-sm md:text-[15px] text-white/95 max-w-2xl mx-auto leading-relaxed drop-shadow-sm line-clamp-3 md:line-clamp-none">
            {settings.hero_subheading}
          </p>

          <div className="mt-5 md:mt-6 flex flex-wrap items-center justify-center gap-2.5 md:gap-3">
            <button
              type="button"
              onClick={() => navigate('shop', { category: 'all', search: '' })}
              className="px-6 md:px-7 py-2.5 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-xs sm:text-sm shadow-md transition"
            >
              تسوق الأن
            </button>
            <a
              href={whatsappUrl(settings.whatsapp_number)}
              target="_blank"
              rel="noreferrer"
              className="px-6 md:px-7 py-2.5 rounded-full bg-white hover:bg-gray-100 text-[#252a31] font-bold text-xs sm:text-sm shadow-md transition"
            >
              تواصل معنا
            </a>
          </div>
        </div>
      </section>

      {/* 2. Collections Carousel: Horizontal snap swipe on Mobile, 4-col desktop grid on Laptop */}
      <section className="max-w-[1320px] mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-4 md:pb-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-2xl font-bold text-[#252a31]">
            {settings.collections_heading || 'مجوعاتنا المميزة لك'}
          </h2>
          <span className="md:hidden text-[11px] text-gray-400 font-semibold">اسحب للتصفح ←</span>
        </div>

        {/* Mobile App Horizontal Snap Carousel (shows all 6 collections smoothly) */}
        <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 no-scrollbar">
          {visibleCollections.map(col => (
            <button
              key={col.id}
              type="button"
              onClick={() => navigate('shop', { category: col.handle, search: '' })}
              className="snap-start shrink-0 w-[45%] min-w-[152px] group relative rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3] text-right shadow-sm border border-gray-100"
            >
              <img
                src={col.image}
                alt={col.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-2 bottom-2 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-2 flex items-center justify-between shadow-sm">
                <span className="text-[11px] font-bold text-[#252a31] truncate">
                  {col.title}
                </span>
                <ChevronLeft className="w-3.5 h-3.5 text-[#fe9931] shrink-0" />
              </div>
            </button>
          ))}
        </div>

        {/* Laptop Desktop 4-col Grid Carousel */}
        <div className="hidden md:grid md:grid-cols-4 gap-6">
          {shownCollections.map(col => (
            <button
              key={col.id}
              type="button"
              onClick={() => navigate('shop', { category: col.handle, search: '' })}
              className="group relative rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3] text-right shadow-sm border border-gray-100 focus:outline-none"
            >
              <img
                src={col.image}
                alt={col.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-x-3 bottom-3 bg-white/95 backdrop-blur-sm rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-sm">
                <span className="text-sm font-bold text-[#252a31] truncate">
                  {col.title}
                </span>
                <ChevronLeft className="w-4 h-4 text-[#252a31] shrink-0 group-hover:-translate-x-0.5 transition" />
              </div>
            </button>
          ))}
        </div>

        {/* Desktop Carousel dots & arrows */}
        <div className="hidden md:flex mt-5 items-center justify-center gap-3">
          <button
            type="button"
            disabled={slideOffset === 0}
            onClick={() => setSlideOffset(prev => Math.max(0, prev - 1))}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] disabled:opacity-35 transition"
            aria-label="السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxOffset + 1 }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSlideOffset(idx)}
                aria-label={`شريحة ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  slideOffset === idx ? 'w-5 bg-[#fe9931]' : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={slideOffset >= maxOffset}
            onClick={() => setSlideOffset(prev => Math.min(maxOffset, prev + 1))}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] disabled:opacity-35 transition"
            aria-label="التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 3. Featured Products Grid ("عطورنا الفائقة") */}
      <section className="max-w-[1320px] mx-auto px-4 md:px-8 pt-10 pb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-[#252a31]">
            {settings.featured_heading || 'عطورنا الفائقة'}
          </h2>
          <button
            type="button"
            onClick={() => navigate('shop', { category: 'all', search: '' })}
            className="text-sm font-bold text-[#fe9931] hover:underline"
          >
            عرض كل العطور
          </button>
        </div>

        {isCatalogLoading && fallbackFeatured.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="aspect-square rounded-xl bg-gray-100" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-10 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-7">
            {fallbackFeatured.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
