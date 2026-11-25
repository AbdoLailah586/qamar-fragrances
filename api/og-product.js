import { neon } from '@neondatabase/serverless';

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const id = String(req.query?.id || '').trim();
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'qamar-fragrances.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${host}`;

  let product = null;
  if (id && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`
        SELECT id, handle, name_ar, name_en, brand, category, price, stock_quantity, images, specs
        FROM products WHERE id=${id} OR handle=${id} LIMIT 1
      `;
      product = rows[0] || null;
    } catch {}
  }

  const title = product ? `${product.name_ar} | قمر للعطور Qamar Fragrances` : 'قمر للعطور | Qamar Fragrances';
  const desc = product
    ? `اطلب الآن ${product.name_ar} بسعر يبدأ من ${product.price} ج.م. — عطور محاكاة بجودة مطابقة للأوريجينال وثبات عالي لدى قمر للعطور.`
    : 'نؤمن أن العطر ليس مجرد رائحة، بل أثر يدوم مع كل حضور.';
  const imgs = Array.isArray(product?.images) && product.images.length ? product.images : ['/qamar-images/626c06f2fe557fd9.webp'];
  const fullImgs = imgs.map(p => (p.startsWith('http') ? p : `${baseUrl}${p}`));
  const canonicalUrl = product ? `${baseUrl}/ar/product/all/${encodeURIComponent(product.handle || product.id)}` : `${baseUrl}/ar`;

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name_ar,
        alternateName: product.name_en || undefined,
        description: desc,
        image: fullImgs,
        brand: { '@type': 'Brand', name: product.brand || 'Qamar Fragrances' },
        category: product.category,
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'EGP',
          price: Number(product.price || 0),
          availability: Number(product.stock_quantity ?? 1) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
        }
      }
    : null;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <link rel="canonical" href="${esc(canonicalUrl)}" />
  <meta name="description" content="${esc(desc)}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:image" content="${esc(fullImgs[0])}" />
  <meta name="twitter:card" content="summary_large_image" />
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body><h1>${esc(title)}</h1><p>${esc(desc)}</p></body>
</html>`);
}
