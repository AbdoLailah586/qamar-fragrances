import React, { useState, useMemo } from 'react';
import { Megaphone, Copy, Check, Link2, ExternalLink } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { buildProductAdUrl, buildStoreAdUrl, type AdPlatformSource } from '../../utils/adLinks';
import { normalizeMetaPixelId } from '../../utils/metaPixel';
import type { StoreSettings } from '../../types';

interface Props {
  formSettings: StoreSettings;
  setFormSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
}

export const MarketingAdToolsCard: React.FC<Props> = ({ formSettings, setFormSettings }) => {
  const { products, collections } = useStore();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://qamar-fragrances.com';

  const [copiedKey, setCopiedKey] = useState<string>('');
  const [adSource, setAdSource] = useState<AdPlatformSource>('facebook');
  const [adCampaign, setAdCampaign] = useState('');
  const [targetType, setTargetType] = useState<'home' | 'shop' | 'collection' | 'product'>('product');
  const [selectedCollection, setSelectedCollection] = useState(collections[0]?.handle || '');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductHandle, setSelectedProductHandle] = useState(products[0]?.handle || '');

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 2000);
  };

  const matchingProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = q
      ? products.filter(p => p.is_active !== false && `${p.name_ar} ${p.brand} ${p.handle}`.toLowerCase().includes(q))
      : products.filter(p => p.is_active !== false);
    return list.slice(0, 60);
  }, [products, productSearch]);

  const activeHandle = selectedProductHandle || matchingProducts[0]?.handle || '';
  const generatedAdUrl = useMemo(() => {
    if (targetType === 'product' && activeHandle) {
      return buildProductAdUrl({ origin, handle: activeHandle, source: adSource, medium: 'cpc', campaign: adCampaign });
    }
    if (targetType === 'collection' && selectedCollection) {
      return buildStoreAdUrl({ origin, path: `/ar/product/${encodeURIComponent(selectedCollection)}`, source: adSource, medium: 'cpc', campaign: adCampaign });
    }
    if (targetType === 'shop') {
      return buildStoreAdUrl({ origin, path: '/ar/shop', source: adSource, medium: 'cpc', campaign: adCampaign });
    }
    return buildStoreAdUrl({ origin, path: '/ar', source: adSource, medium: 'cpc', campaign: adCampaign });
  }, [origin, targetType, activeHandle, selectedCollection, adSource, adCampaign]);

  const csvFeedUrl = `${origin}/meta-feed.csv`;
  const xmlFeedUrl = `${origin}/meta-feed.xml`;
  const pixelRaw = String(formSettings.meta_pixel_id || '');
  const pixelValid = !pixelRaw.trim() || Boolean(normalizeMetaPixelId(pixelRaw));

  return (
    <div className="space-y-5">
      {/* 1. Meta Pixel + Catalog Feed */}
      <div className="bg-white border rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="font-extrabold text-sm text-[#252a31] flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#fe9931]" />
              <span>إعدادات إعلانات فيسبوك وإنستجرام وكتالوج المنتجات (بدون Access Token)</span>
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              أضف رقم الـ Pixel فقط (15-16 رقم) لتفعيل تتبع المشتريات والسلة تلقائياً في Meta Ads Manager، واستخدم روابط الكتالوج لسحب الـ 351 عطر بالصور والأسعار تلقائياً.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <label className="space-y-1 font-bold">
            <span>رقم Meta Pixel ID (بدون أي Access Token)</span>
            <input
              type="text"
              dir="ltr"
              data-testid="input-meta-pixel-id"
              value={formSettings.meta_pixel_id || ''}
              onChange={e => setFormSettings({ ...formSettings, meta_pixel_id: e.target.value })}
              placeholder="مثال: 123456789012345"
              className={`w-full px-3 py-2 border rounded-xl font-mono ${!pixelValid ? 'border-red-400' : ''}`}
            />
            {!pixelValid && <span className="text-[11px] text-red-600 font-normal block">أدخل أرقام الـ Pixel ID الصحيحة (10 إلى 20 رقم).</span>}
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border cursor-pointer font-bold">
            <input
              type="checkbox"
              checked={formSettings.meta_pixel_enabled !== false}
              onChange={e => setFormSettings({ ...formSettings, meta_pixel_enabled: e.target.checked })}
              className="accent-[#fe9931] w-4 h-4"
            />
            <span>تفعيل أحداث Pixel التلقائية (PageView · ViewContent · AddToCart · InitiateCheckout · Purchase)</span>
          </label>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2.5">
          <p className="font-extrabold text-[#252a31]">روابط كتالوج المنتجات التلقائي لإعلانات Meta وGoogle Shopping (تتحدث لحظياً بكل العطور):</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white border rounded-xl p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-500">رابط Meta Catalog (CSV Scheduled Feed)</p>
                <p dir="ltr" className="font-mono text-[11px] text-[#252a31] truncate">{csvFeedUrl}</p>
              </div>
              <button
                type="button"
                data-testid="btn-copy-meta-csv"
                onClick={() => void copyText('csv', csvFeedUrl)}
                className="px-3 py-1.5 rounded-lg bg-[#fe9931] text-white font-bold shrink-0 flex items-center gap-1"
              >
                {copiedKey === 'csv' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'csv' ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>

            <div className="bg-white border rounded-xl p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-500">رابط Meta & Google Merchant (XML Feed)</p>
                <p dir="ltr" className="font-mono text-[11px] text-[#252a31] truncate">{xmlFeedUrl}</p>
              </div>
              <button
                type="button"
                data-testid="btn-copy-meta-xml"
                onClick={() => void copyText('xml', xmlFeedUrl)}
                className="px-3 py-1.5 rounded-lg bg-[#252a31] text-white font-bold shrink-0 flex items-center gap-1"
              >
                {copiedKey === 'xml' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'xml' ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ad Link Builder (Carousel Safe Encoded URLs) */}
      <div className="bg-white border rounded-2xl p-6 space-y-4 text-xs">
        <div className="border-b pb-3">
          <h2 className="font-extrabold text-sm text-[#252a31] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#fe9931]" />
            <span>مولد روابط إعلانات الكاروسيل والسوشيال (روابط مشفّرة بالكامل بالحروف العربية + UTM)</span>
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            انسخ رابط كل عطر أو قسم من هنا لضمان عدم وجود مسافات أو حروف عربية غير مشفرة داخل إعلانات Facebook & Instagram Carousel، مع إظهار المصدر تلقائياً في لوحة تحليلات الزوار.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1 font-bold">
            <span>منصة الإعلان</span>
            <select value={adSource} onChange={e => setAdSource(e.target.value as AdPlatformSource)} className="w-full px-3 py-2 border rounded-xl bg-white">
              <option value="facebook">إعلان فيسبوك (Facebook Ads)</option>
              <option value="instagram">إعلان إنستجرام (Instagram Ads)</option>
              <option value="tiktok">إعلان تيك توك (TikTok Ads)</option>
              <option value="google">إعلان جوجل (Google Ads)</option>
            </select>
          </label>

          <label className="space-y-1 font-bold">
            <span>الصفحة المستهدفة</span>
            <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full px-3 py-2 border rounded-xl bg-white">
              <option value="product">عطر محدد (لبطاقات Carousel)</option>
              <option value="home">الصفحة الرئيسية للمتجر</option>
              <option value="shop">صفحة جميع العطور</option>
              <option value="collection">مجموعة / تصنيف معين</option>
            </select>
          </label>

          <label className="space-y-1 font-bold">
            <span>اسم الحملة الإعلانية (اختياري)</span>
            <input
              type="text"
              value={adCampaign}
              onChange={e => setAdCampaign(e.target.value)}
              placeholder="مثال: winter_carousel_1"
              className="w-full px-3 py-2 border rounded-xl"
            />
          </label>
        </div>

        {targetType === 'collection' && (
          <label className="block space-y-1 font-bold">
            <span>اختر المجموعة</span>
            <select value={selectedCollection} onChange={e => setSelectedCollection(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-white">
              {collections.map(c => (
                <option key={c.id} value={c.handle}>{c.title}</option>
              ))}
            </select>
          </label>
        )}

        {targetType === 'product' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 font-bold">
              <span>بحث سريع عن العطر</span>
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="اكتب اسم العطر..."
                className="w-full px-3 py-2 border rounded-xl"
              />
            </label>
            <label className="space-y-1 font-bold">
              <span>اختر العطر المطلوب للإعلان</span>
              <select
                value={activeHandle}
                onChange={e => setSelectedProductHandle(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-white"
              >
                {matchingProducts.map(p => (
                  <option key={p.id} value={p.handle}>{p.name_ar} — {p.price} ج.م</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="bg-gray-50 border rounded-2xl p-3.5 space-y-2">
          <p className="text-[11px] font-bold text-gray-500">الرابط المشفّر الجاهز للإعلان:</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" readOnly dir="ltr" data-testid="generated-ad-url-input" value={generatedAdUrl} className="flex-1 min-w-[220px] px-3 py-2 border rounded-xl bg-white font-mono text-[11px]" />
            <button
              type="button"
              data-testid="btn-copy-generated-ad-url"
              onClick={() => void copyText('generated', generatedAdUrl)}
              className="px-4 py-2 rounded-xl bg-[#fe9931] hover:bg-[#e88520] text-white font-bold flex items-center gap-1.5"
            >
              {copiedKey === 'generated' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedKey === 'generated' ? 'تم النسخ ✓' : 'نسخ الرابط'}</span>
            </button>
            {targetType === 'product' && activeHandle && (
              <a
                href={`${origin}/api/og-product?id=${encodeURIComponent(activeHandle)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white font-bold text-[#252a31] flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>معاينة صورة فيسبوك</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
