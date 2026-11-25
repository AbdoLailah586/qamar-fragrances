import React, { useState, useMemo, useEffect } from 'react';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { toArabicDigits } from '../utils/arabicNumbers';

const PER_PAGE = 24;

export const Shop: React.FC = () => {
  const {
    products,
    collections,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    isCatalogLoading
  } = useStore();

  const [sortBy, setSortBy] = useState<'default' | 'name_asc' | 'price_asc' | 'price_desc'>('default');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [openAcc, setOpenAcc] = useState<'collections' | 'size' | 'price' | null>('collections');

  useEffect(() => { setPage(1); }, [selectedCategory, searchQuery, selectedSize, minPrice, maxPrice, sortBy]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => (p.size_options || []).forEach(s => set.add(s)));
    const order = ['5ml', '10ml', '30ml', '50ml', '55ml', '100ml', '110ml', '125ml', '250ml', 'ربع تولا', 'نصف تولا', 'تولا'];
    return [...set].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [products]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minP = minPrice !== '' ? Number(minPrice) : null;
    const maxP = maxPrice !== '' ? Number(maxPrice) : null;

    const list = products.filter(p => {
      if (p.is_active === false) return false;
      if (selectedCategory && selectedCategory !== 'all') {
        const matchesCat = p.category === selectedCategory || (p.categories || []).includes(selectedCategory);
        if (!matchesCat) return false;
      }
      if (q) {
        const hay = `${p.name_ar} ${p.name_en} ${p.brand} ${p.handle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedSize && !(p.size_options || []).includes(selectedSize)) return false;
      if (minP !== null && Number.isFinite(minP) && p.price < minP) return false;
      if (maxP !== null && Number.isFinite(maxP) && p.price > maxP) return false;
      return true;
    });

    if (sortBy === 'price_asc') return [...list].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') return [...list].sort((a, b) => b.price - a.price);
    if (sortBy === 'name_asc') return [...list].sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
    return [...list].sort((a, b) => (a.shop_order ?? 9999) - (b.shop_order ?? 9999));
  }, [products, selectedCategory, searchQuery, selectedSize, minPrice, maxPrice, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageProducts = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const activeCollectionObj = collections.find(c => c.handle === selectedCategory);

  const clearFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setSelectedSize('');
    setMinPrice('');
    setMaxPrice('');
  };

  const pageNumbers = useMemo(() => {
    const items: (number | '...')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) {
        items.push(i);
      } else if (items[items.length - 1] !== '...') {
        items.push('...');
      }
    }
    return items;
  }, [totalPages, safePage]);

  return (
    <main className="max-w-[1320px] mx-auto px-3.5 sm:px-4 md:px-8 py-5 md:py-8 min-h-[70vh]">
      {/* Mobile Quick Collection Chips */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-3 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
            selectedCategory === 'all' || !selectedCategory
              ? 'bg-[#fe9931] text-white border-[#fe9931]'
              : 'bg-gray-50 text-[#4f4335] border-gray-200'
          }`}
        >
          الكل
        </button>
        {collections.map(col => (
          <button
            key={col.id}
            type="button"
            onClick={() => setSelectedCategory(col.handle)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
              selectedCategory === col.handle
                ? 'bg-[#fe9931] text-white border-[#fe9931]'
                : 'bg-gray-50 text-[#4f4335] border-gray-200'
            }`}
          >
            {col.title}
          </button>
        ))}
      </div>

      {activeCollectionObj && (
        <div className="mb-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#252a31]">{activeCollectionObj.title}</h1>
            <p className="text-xs text-gray-500 mt-1">عدد المنتجات: {toArabicDigits(filtered.length)} منتج</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="text-xs font-bold text-[#fe9931] hover:underline"
          >
            عرض كل المنتجات
          </button>
        </div>
      )}

      {/* Controls Bar: Filter button (Right) + Sort dropdown (Left) */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white text-sm font-bold transition shadow-xs"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>تصفية</span>
          </button>

          <span className="text-xs text-gray-500 font-medium hidden sm:inline">
            ({toArabicDigits(filtered.length)} منتج)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">الترتيب حسب</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm text-[#252a31] focus:outline-none focus:border-[#fe9931]"
          >
            <option value="default">الافتراضي</option>
            <option value="name_asc">الاسم</option>
            <option value="price_asc">السعر: من الأقل إلى الأعلى</option>
            <option value="price_desc">السعر: من الأعلى إلى الأقل</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {isCatalogLoading && products.length === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-3">
              <div className="aspect-square rounded-xl bg-gray-100" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-10 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : pageProducts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-gray-500 mb-4">لا توجد منتجات مطابقة لخيارات التصفية الحالية.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white text-sm font-bold"
          >
            مسح التصفية
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-7">
          {pageProducts.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Numeric Pagination (Arabic-Indic digits) */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => { setPage(safePage - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-[#fe9931] hover:border-[#fe9931] disabled:opacity-35"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {pageNumbers.map((num, idx) =>
            num === '...' ? (
              <span key={`dots-${idx}`} className="px-2 text-gray-400 text-sm">...</span>
            ) : (
              <button
                key={num}
                type="button"
                onClick={() => { setPage(num); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
                  safePage === num
                    ? 'bg-[#fe9931] text-white shadow-xs'
                    : 'border border-gray-200 text-[#252a31] hover:border-[#fe9931]'
                }`}
              >
                {toArabicDigits(num)}
              </button>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => { setPage(safePage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-[#fe9931] hover:border-[#fe9931] disabled:opacity-35"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Slide-Over Filter Drawer (Right side) */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex justify-start">
          <div className="w-full max-w-[360px] bg-white h-full shadow-2xl flex flex-col z-10">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-[#252a31]">تصفية</h3>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="text-[#fe9931] hover:bg-[#fe9931]/10 p-1.5 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {/* 1. Collections */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => setOpenAcc(openAcc === 'collections' ? null : 'collections')}
                  className="w-full flex items-center justify-between font-bold text-sm text-[#252a31]"
                >
                  <span>مجموعات المنتج</span>
                  <ChevronDown className={`w-4 h-4 transition ${openAcc === 'collections' ? 'rotate-180' : ''}`} />
                </button>
                {openAcc === 'collections' && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center justify-between text-sm cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="cat"
                          checked={selectedCategory === 'all'}
                          onChange={() => setSelectedCategory('all')}
                          className="accent-[#fe9931]"
                        />
                        كل المنتجات
                      </span>
                      <span className="text-xs text-gray-400">{toArabicDigits(products.length)}</span>
                    </label>
                    {collections.map(c => (
                      <label key={c.id} className="flex items-center justify-between text-sm cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="cat"
                            checked={selectedCategory === c.handle}
                            onChange={() => setSelectedCategory(c.handle)}
                            className="accent-[#fe9931]"
                          />
                          {c.title}
                        </span>
                        <span className="text-xs text-gray-400">{toArabicDigits(c.products_count ?? 0)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Size */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => setOpenAcc(openAcc === 'size' ? null : 'size')}
                  className="w-full flex items-center justify-between font-bold text-sm text-[#252a31]"
                >
                  <span>الحجم</span>
                  <ChevronDown className={`w-4 h-4 transition ${openAcc === 'size' ? 'rotate-180' : ''}`} />
                </button>
                {openAcc === 'size' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allSizes.map(sz => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(selectedSize === sz ? '' : sz)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          selectedSize === sz
                            ? 'border-[#fe9931] text-[#fe9931] bg-[#fe9931]/10'
                            : 'border-gray-200 text-[#252a31]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Price */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => setOpenAcc(openAcc === 'price' ? null : 'price')}
                  className="w-full flex items-center justify-between font-bold text-sm text-[#252a31]"
                >
                  <span>السعر</span>
                  <ChevronDown className={`w-4 h-4 transition ${openAcc === 'price' ? 'rotate-180' : ''}`} />
                </button>
                {openAcc === 'price' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="من (ج.م)"
                      value={minPrice}
                      onChange={e => setMinPrice(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                    />
                    <input
                      type="number"
                      placeholder="إلى (ج.م)"
                      value={maxPrice}
                      onChange={e => setMaxPrice(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 space-y-3 bg-white">
              <p className="text-xs font-bold text-gray-600">
                المنتجات: {toArabicDigits(filtered.length)} منتج
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="py-2.5 rounded-full border border-gray-300 text-sm font-bold text-[#252a31]"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="py-2.5 rounded-full bg-[#fe9931] text-white text-sm font-bold"
                >
                  تم
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setIsFilterOpen(false)} />
        </div>
      )}
    </main>
  );
};
