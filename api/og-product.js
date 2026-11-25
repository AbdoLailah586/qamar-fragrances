import { neon } from '@neondatabase/serverless';

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res, deps) {
  const rawId = String(req.query?.id || '').trim();
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {}
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'qamar-fragrances.com';
  const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.0\.0\.1)(:|$)/i.test(host) ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  let product = deps?.product || null;
  if (!product && id && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`
        SELECT id, handle, name_ar, name_en, brand, category, price, stock_quantity, images, specs
        FROM products WHERE id=${id} OR handle=${id} OR lower(handle)=lower(${id}) LIMIT 1
      `;
      product = rows[0] || null;
    } catch {}
  }

  const title = product ? `${product.name_ar} | قمر للعطور Qamar Fragrances` : 'قمر للعطور | Qamar Fragrances';
  const priceNum = Number(product?.price || 0);
  const specsObj = product?.specs && typeof product.specs === 'object' ? product.specs : {};
  const details = specsObj.__product_data && typeof specsObj.__product_data === 'object' ? specsObj.__product_data : {};
  const customDesc = details.description_ar || specsObj.description_ar || '';
  const desc = product
    ? `${customDesc ? `${customDesc} — ` : ''}السعر يبدأ من ${priceNum} ج.م. لدى قمر للعطور (ثبات وفوحان فائق وتوصيل لجميع المحافظات).`.slice(0, 220)
    : 'نؤمن أن العطر ليس مجرد رائحة، بل أثر يدوم مع كل حضور.';
  const imgs = Array.isArray(product?.images) && product.images.length ? product.images : ['/qamar-images/626c06f2fe557fd9.webp'];
  const fullImgs = imgs.map(p => (p.startsWith('http') ? p : `${baseUrl}${p}`));
  const canonicalUrl = product ? `${baseUrl}/ar/product/all/${encodeURIComponent(product.handle || product.id)}` : `${baseUrl}/ar`;
  const inStock = Number(product?.stock_quantity ?? product?.stock ?? 1) > 0;

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name_ar,
        alternateName: product.name_en || undefined,
        description: desc,
        sku: product.id,
        image: fullImgs,
        brand: { '@type': 'Brand', name: product.brand || 'Qamar Fragrances' },
        category: product.category,
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'EGP',
          price: priceNum,
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
        }
      }
    : null;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <link rel="canonical" href="${esc(canonicalUrl)}" />
  <meta name="description" content="${esc(desc)}" />
  <meta property="og:type" content="${product ? 'product' : 'website'}" />
  <meta property="og:site_name" content="قمر للعطور | Qamar Fragrances" />
  <meta property="og:locale" content="ar_EG" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:image" content="${esc(fullImgs[0])}" />
  <meta property="og:image:secure_url" content="${esc(fullImgs[0])}" />
  <meta property="og:image:alt" content="${esc(title)}" />
  ${product ? `<meta property="product:brand" content="${esc(product.brand || 'Qamar Fragrances')}" />
  <meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}" />
  <meta property="product:condition" content="new" />
  <meta property="product:price:amount" content="${priceNum}" />
  <meta property="product:price:currency" content="EGP" />
  <meta property="product:retailer_item_id" content="${esc(product.id)}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(fullImgs[0])}" />
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body style="font-family:sans-serif;text-align:center;padding:32px;direction:rtl;">
  <img src="${esc(fullImgs[0])}" alt="${esc(title)}" style="max-width:320px;border-radius:16px;" />
  <h1>${esc(title)}</h1>
  <p>${esc(desc)}</p>
  <a href="${esc(canonicalUrl)}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#fe9931;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold;">تصفح العطر في المتجر</a>
</body>
</html>`);
}
