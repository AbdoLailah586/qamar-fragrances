import type { Product, StoreSettings } from '../types';

export interface PageSeoPayload {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'product';
  jsonLd?: Record<string, any> | Record<string, any>[];
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(data?: Record<string, any> | Record<string, any>[]) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('qamar-dynamic-jsonld');
  if (!data) {
    existing?.remove();
    return;
  }
  const script = existing || document.createElement('script');
  script.id = 'qamar-dynamic-jsonld';
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

/** Synchronize document title, OpenGraph tags, canonical URL, and JSON-LD rich schema for Google Search. */
export function applyPageSeo(payload: PageSeoPayload) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const origin = window.location.origin;
  const canonicalUrl = `${origin}${payload.path || window.location.pathname}`;
  const imageUrl = payload.image
    ? payload.image.startsWith('http')
      ? payload.image
      : `${origin}${payload.image}`
    : `${origin}/qamar-images/626c06f2fe557fd9.webp`;

  document.title = payload.title;
  upsertCanonical(canonicalUrl);
  upsertMeta('name', 'description', payload.description);
  upsertMeta('property', 'og:type', payload.type || 'website');
  upsertMeta('property', 'og:title', payload.title);
  upsertMeta('property', 'og:description', payload.description);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:image', imageUrl);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', payload.title);
  upsertMeta('name', 'twitter:description', payload.description);
  upsertMeta('name', 'twitter:image', imageUrl);
  upsertJsonLd(payload.jsonLd);
}

export function buildStoreJsonLd(origin: string, settings: Partial<StoreSettings>) {
  const storeName = settings.store_name_ar || 'قمر للعطور | Qamar Fragrances';
  const sameAs = (settings.social_links || [])
    .map(s => s.link)
    .filter(l => typeof l === 'string' && l.startsWith('http'));

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: storeName,
      alternateName: 'Qamar Fragrances',
      url: origin,
      logo: `${origin}${settings.logo_url || '/qamar-images/626c06f2fe557fd9.webp'}`,
      image: `${origin}${settings.hero_image || '/qamar-images/a182f7810c27ec59.webp'}`,
      description: settings.tagline_ar || 'عطور محاكاة بجودة مطابقة للأوريجينال - قمر للعطور',
      telephone: settings.phone || '+201003732029',
      email: settings.email || 'qamaraboalnaga@gmail.com',
      address: {
        '@type': 'PostalAddress',
        streetAddress: settings.address_ar || 'شارع الإمام محمد عبده - المنصورة',
        addressLocality: 'المنصورة',
        addressRegion: 'الدقهلية',
        addressCountry: 'EG'
      },
      sameAs
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: storeName,
      url: origin,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${origin}/ar/shop?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    }
  ];
}

export function buildProductJsonLd(origin: string, product: Product, settings: Partial<StoreSettings>, reviews: any[] = []) {
  const imgs = (product.images?.length ? product.images : ['/qamar-images/626c06f2fe557fd9.webp']).map(img =>
    img.startsWith('http') ? img : `${origin}${img}`
  );
  const productUrl = `${origin}/ar/product/all/${encodeURIComponent(product.handle)}`;
  const prices = (product.variants || []).map(v => Number(v.price)).filter(n => Number.isFinite(n) && n > 0);
  const lowPrice = prices.length ? Math.min(...prices) : Number(product.price || 0);
  const highPrice = prices.length ? Math.max(...prices) : Number(product.price || 0);
  const approvedReviews = reviews.filter(r => r.status === 'approved' || Number(r.rating) >= 1);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name_ar,
    alternateName: product.name_en || undefined,
    description: product.description_ar || `عطر ${product.name_ar} من ${settings.store_name_ar || 'قمر للعطور'} بثبات وفوحان فائق.`,
    sku: product.sku || product.id,
    image: imgs,
    brand: {
      '@type': 'Brand',
      name: product.brand || 'Qamar Fragrances'
    },
    category: product.category,
    offers:
      prices.length > 1 && lowPrice !== highPrice
        ? {
            '@type': 'AggregateOffer',
            url: productUrl,
            priceCurrency: 'EGP',
            lowPrice,
            highPrice,
            offerCount: prices.length,
            availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: settings.store_name_ar || 'قمر للعطور' }
          }
        : {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: 'EGP',
            price: lowPrice,
            availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: settings.store_name_ar || 'قمر للعطور' }
          }
  };

  if (approvedReviews.length > 0) {
    const avg = approvedReviews.reduce((s, r) => s + Number(r.rating || 5), 0) / approvedReviews.length;
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(avg.toFixed(1)),
      reviewCount: approvedReviews.length
    };
  }

  return [
    schema,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: `${origin}/ar` },
        { '@type': 'ListItem', position: 2, name: 'المتجر', item: `${origin}/ar/shop` },
        { '@type': 'ListItem', position: 3, name: product.name_ar, item: productUrl }
      ]
    }
  ];
}
