import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Plus, Minus, ShoppingCart, Star, Heart, Share2, Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { neonDb } from '../services/neonDb';
import { formatEGP } from '../utils/arabicNumbers';
import { applyPageSeo, buildProductJsonLd } from '../utils/seo';
import { buildProductAdUrl } from '../utils/adLinks';
import { ProductCard } from '../components/ProductCard';
import type { FragranceNotesEntry } from '../types';

export const ProductDetails: React.FC = () => {
  const {
    products,
    selectedProduct,
    settings,
    addToCart,
    buyNow,
    navigate,
    isInWishlist,
    toggleWishlist,
    sessionId
  } = useStore();
  const { user } = useAuth();

  const product = selectedProduct || products[0] || null;

  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const [isZooming, setIsZooming] = useState(false);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'reviews'>('desc');
  const [showSticky, setShowSticky] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [notesEntry, setNotesEntry] = useState<FragranceNotesEntry | null>(null);
  const [revName, setRevName] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revMsg, setRevMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setActiveImgIdx(0);
    setSelectedVariantIdx(0);
    setQty(1);
    setRevMsg('');
    if (!product) return;
    neonDb.getProductReviews(product.id, sessionId).then(setReviews).catch(() => setReviews([]));
    neonDb.getFragranceNotes().then(all => {
      setNotesEntry(all.find(n => n.product_id === product.id) || null);
    }).catch(() => {});
  }, [product?.id]);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 420);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!product || typeof window === 'undefined') return;
    const origin = window.location.origin;
    const desc =
      product.description_ar?.trim() ||
      `اطلب عطر ${product.name_ar} بسعر ${product.price} ج.م. من متجر ${settings.store_name_ar || 'قمر للعطور'} بثبات وفوحان فائق.`;
    applyPageSeo({
      title: `${product.name_ar} | قمر للعطور Qamar Fragrances`,
      description: desc.slice(0, 160),
      path: `/ar/product/all/${encodeURIComponent(product.handle)}`,
      image: product.images?.[0],
      type: 'product',
      jsonLd: buildProductJsonLd(origin, product, settings, reviews)
    });
  }, [product, settings, reviews]);

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter(p => p.id !== product.id && p.is_active !== false && p.category === product.category)
      .slice(0, 4);
  }, [products, product]);

  if (!product) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 py-20 text-center text-gray-500">
        جاري تحميل تفاصيل العطر...
      </div>
    );
  }

  const variants = product.variants || [];
  const activeVariant = variants[selectedVariantIdx] || variants[0] || null;
  const activePrice = Number(activeVariant?.price ?? product.price);
  const images = product.images?.length ? product.images : ['/qamar-images/626c06f2fe557fd9.webp'];
  const fav = isInWishlist(product.id);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await neonDb.submitProductReview({
      product_id: product.id,
      product_name_ar: product.name_ar,
      author_name: revName || user?.name || 'عميل قمر',
      comment: revComment,
      rating: revRating,
      session_id: sessionId
    });
    if (res.success) {
      setRevMsg('تم إرسال تقييمك للمراجعة بنجاح!');
      setRevComment('');
      if (res.review) setReviews(prev => [res.review, ...prev]);
    } else {
      setRevMsg(res.error || 'تعذر إرسال التقييم.');
    }
  };

  return (
    <main className="max-w-[1320px] mx-auto px-4 md:px-8 py-5 md:py-6 pb-36 md:pb-24">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <button type="button" onClick={() => navigate('shop', { category: 'all', search: '' })} className="hover:text-[#fe9931] flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />
          <span>متجر</span>
        </button>
      </div>

      {/* Main 2-column Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-start">
        {/* Image Gallery with silky cross-fade & interactive cursor zoom */}
        <div className="lg:col-span-5 space-y-3">
          <div
            onMouseEnter={() => setIsZooming(true)}
            onMouseLeave={() => { setIsZooming(false); setZoomOrigin('50% 50%'); }}
            onMouseMove={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              setZoomOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
            }}
            className="relative aspect-square rounded-2xl overflow-hidden bg-[#f8f9fa] border border-gray-100 cursor-zoom-in group"
          >
            {images.map((img, idx) => (
              <div
                key={`${product.id}-slide-${idx}`}
                className={`qamar-gallery-slide absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  activeImgIdx === idx
                    ? 'opacity-100 scale-100 translate-x-0 z-[1]'
                    : idx < activeImgIdx
                      ? 'opacity-0 scale-[0.96] -translate-x-5 pointer-events-none z-0'
                      : 'opacity-0 scale-[0.96] translate-x-5 pointer-events-none z-0'
                }`}
              >
                <img
                  src={img}
                  alt={activeImgIdx === idx ? product.name_ar : ''}
                  style={{
                    transformOrigin: zoomOrigin,
                    transform: activeImgIdx === idx && isZooming ? 'scale(1.42)' : 'scale(1)'
                  }}
                  className="w-full h-full object-cover will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                />
              </div>
            ))}
            <span className="hidden md:inline-block pointer-events-none absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-sm text-[11px] font-bold text-[#4f4335] opacity-80 group-hover:opacity-0 transition-opacity duration-300 shadow-xs z-10">
              مرّر للتكبير ✨
            </span>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setActiveImgIdx(i => (i - 1 + images.length) % images.length); }}
                  aria-label="الصورة السابقة"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-[#252a31] hover:text-[#fe9931] hover:scale-110 active:scale-95 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setActiveImgIdx(i => (i + 1) % images.length); }}
                  aria-label="الصورة التالية"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-[#252a31] hover:text-[#fe9931] hover:scale-110 active:scale-95 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  onMouseEnter={() => setActiveImgIdx(idx)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-300 ${
                    activeImgIdx === idx ? 'border-[#fe9931] scale-105 shadow-xs' : 'border-gray-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Controls (Left in RTL) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-[#fe9931] uppercase tracking-wide">{product.brand}</span>
              <h1 className="text-2xl md:text-3xl font-bold text-[#252a31] mt-1 leading-snug">
                {product.name_ar}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="btn-copy-product-link"
                onClick={async () => {
                  const link = buildProductAdUrl({ handle: product.handle });
                  try { await navigator.clipboard.writeText(link); } catch {}
                  setCopiedLink(true);
                  window.setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="p-2.5 rounded-full border border-gray-200 text-gray-500 hover:border-[#fe9931] hover:text-[#fe9931] transition shrink-0 flex items-center gap-1"
                title="نسخ رابط المنتج المشفّر للمشاركة أو الإعلانات"
                aria-label="نسخ رابط المنتج"
              >
                {copiedLink ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`p-2.5 rounded-full border transition shrink-0 ${
                  fav ? 'border-[#fe9931] text-[#fe9931] bg-[#fe9931]/10' : 'border-gray-200 text-gray-500 hover:border-[#fe9931]'
                }`}
                aria-label="إضافة للمفضلة"
              >
                <Heart className={`w-5 h-5 ${fav ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Size Variant Pills ("الحجم") */}
          {variants.length > 1 && (
            <div>
              <p className="text-sm font-bold text-[#252a31] mb-2.5">الحجم</p>
              <div className="flex flex-wrap gap-2.5">
                {variants.map((v, idx) => {
                  const selected = idx === selectedVariantIdx;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantIdx(idx)}
                      className={`px-5 py-2 rounded-full text-sm font-semibold border transition ${
                        selected
                          ? 'border-[#fe9931] text-[#fe9931] bg-[#fe9931]/5'
                          : 'border-gray-300 text-[#252a31] hover:border-gray-400'
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price */}
          <div className="text-2xl md:text-[28px] font-extrabold text-[#252a31]">
            {formatEGP(activePrice)}
          </div>

          {/* Stepper + Add to Cart + Buy Now */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="inline-flex items-center border border-gray-300 rounded-full h-12 px-2">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#fe9931]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-bold text-sm text-[#252a31]">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(q => q + 1)}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#fe9931]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={!product.in_stock}
              onClick={() => addToCart(product, qty, activeVariant)}
              className="flex-1 min-w-[180px] h-12 px-6 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>أضف إلى السلَّة</span>
            </button>

            <button
              type="button"
              disabled={!product.in_stock}
              onClick={() => buyNow(product, qty, activeVariant)}
              className="flex-1 min-w-[160px] h-12 px-6 rounded-full border border-[#fe9931] text-[#fe9931] hover:bg-[#fe9931]/5 font-bold text-sm transition disabled:opacity-50"
            >
              اشتري الآن
            </button>
          </div>
        </div>
      </div>

      {/* Description & Reviews Card ("وصف المنتج") */}
      <section className="mt-10 border border-gray-200 rounded-2xl bg-white overflow-hidden">
        <div className="border-b border-gray-200 px-6 flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('desc')}
            className={`py-4 text-sm font-bold border-b-2 transition ${
              activeTab === 'desc' ? 'border-[#fe9931] text-[#fe9931]' : 'border-transparent text-gray-500'
            }`}
          >
            وصف المنتج
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`py-4 text-sm font-bold border-b-2 transition ${
              activeTab === 'reviews' ? 'border-[#fe9931] text-[#fe9931]' : 'border-transparent text-gray-500'
            }`}
          >
            تقييمات العملاء ({reviews.length})
          </button>
        </div>

        <div className="p-6 text-sm text-[#4f4335] leading-relaxed space-y-4">
          {activeTab === 'desc' ? (
            <>
              <h3 className="font-bold text-base text-[#252a31]">{product.name_ar}</h3>
              <p>{product.description_ar}</p>
              {variants.length > 0 && (
                <div>
                  <p className="font-bold text-[#252a31] mb-1">الأحجام المتاحة:</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map(v => (
                      <span key={v.id} className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium">
                        {v.label} — {formatEGP(v.price)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {notesEntry && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div className="p-3 rounded-xl bg-amber-50/60">
                    <span className="text-xs font-bold text-[#fe9931]">افتتاحية العطر</span>
                    <p className="mt-1 font-medium">{notesEntry.top_notes}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/60">
                    <span className="text-xs font-bold text-[#fe9931]">قلب العطر</span>
                    <p className="mt-1 font-medium">{notesEntry.heart_notes}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/60">
                    <span className="text-xs font-bold text-[#fe9931]">قاعدة العطر</span>
                    <p className="mt-1 font-medium">{notesEntry.base_notes}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <form onSubmit={submitReview} className="space-y-3 bg-gray-50 p-4 rounded-xl">
                <p className="font-bold text-[#252a31]">أضف تقييمك</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => setRevRating(s)}>
                      <Star className={`w-5 h-5 ${s <= revRating ? 'text-[#fe9931] fill-[#fe9931]' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={revName}
                    onChange={e => setRevName(e.target.value)}
                    placeholder="الاسم"
                    className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={revComment}
                    onChange={e => setRevComment(e.target.value)}
                    placeholder="اكتب رأيك في الثبات والفوحان..."
                    className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                  />
                </div>
                <button type="submit" className="px-5 py-2 rounded-full bg-[#fe9931] text-white font-bold text-xs">
                  إرسال التقييم
                </button>
                {revMsg && <p className="text-xs text-[#fe9931] font-bold">{revMsg}</p>}
              </form>

              {reviews.length === 0 ? (
                <p className="text-gray-400">لا توجد تقييمات منشورة لهذا العطر حتى الآن.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <div key={r.id} className="p-4 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#252a31]">{r.author_name}</span>
                        <span className="text-xs text-[#fe9931]">{'★'.repeat(r.rating)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Related Products ("منتجات مشابهة") */}
      {related.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#252a31]">منتجات مشابهة</h2>
            <button
              type="button"
              onClick={() => navigate('shop', { category: product.category, search: '' })}
              className="text-sm font-bold text-[#fe9931] hover:underline"
            >
              شاهد جميع المنتجات
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-7">
            {related.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky Bottom Quick-Bar (Sits above bottom app bar on mobile, flush bottom on laptop) */}
      {showSticky && (
        <div className="fixed bottom-16 md:bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-lg py-2.5 px-4">
          <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <img src={images[0]} alt="" className="w-11 h-11 rounded-lg object-cover border border-gray-100 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#252a31] truncate">{product.name_ar}</p>
                <p className="text-xs text-gray-500">
                  {activeVariant?.label ? `${activeVariant.label} · ` : ''}
                  <span className="font-bold text-[#252a31]">{formatEGP(activePrice)}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => addToCart(product, 1, activeVariant)}
              className="px-6 py-2.5 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white text-sm font-bold shrink-0"
            >
              أضف إلى السلَّة
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
