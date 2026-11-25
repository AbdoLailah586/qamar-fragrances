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
      const rows = await sql`SELECT id, handle, name_ar, price, images, specs FROM products WHERE id=${id} OR handle=${id} LIMIT 1`;
      product = rows[0] || null;
    } catch {}
  }

  const title = product ? `${product.name_ar} | Qamar Fragrances` : 'قمر للعطور | Qamar Fragrances';
  const desc = product ? `السعر يبدأ من ${product.price} ج.م. — عطور محاكاة بجودة مطابقة للأوريجينال لدى قمر للعطور.` : 'نؤمن أن العطر ليس مجرد رائحة، بل أثر يدوم مع كل حضور.';
  const imgPath = Array.isArray(product?.images) && product.images[0] ? product.images[0] : '/qamar-images/626c06f2fe557fd9.webp';
  const imageUrl = imgPath.startsWith('http') ? imgPath : `${baseUrl}${imgPath}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body><h1>${esc(title)}</h1><p>${esc(desc)}</p></body>
</html>`);
}
