import { neon } from '@neondatabase/serverless';

function escXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toFullUrl(baseUrl, pathOrUrl) {
  const s = String(pathOrUrl || '').trim();
  if (!s) return '';
  return s.startsWith('http') ? s : `${baseUrl}${s.startsWith('/') ? '' : '/'}${s}`;
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'qamar-fragrances.com';
  const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.0\.0\.1)(:|$)/i.test(host) ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  let products = [];
  let collections = [];
  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const [pRows, cRows] = await Promise.all([
        sql`SELECT id, handle, name_ar, images, updated_at FROM products WHERE is_active = true ORDER BY shop_order ASC, created_at DESC LIMIT 1000`,
        sql`SELECT handle, title, image FROM collections WHERE is_visible = true ORDER BY sort_order ASC`
      ]);
      products = pRows || [];
      collections = cRows || [];
    } catch {}
  }

  const staticPaths = [
    { path: '/ar', priority: '1.0', changefreq: 'daily' },
    { path: '/ar/shop', priority: '0.9', changefreq: 'daily' },
    { path: '/ar/contact-us', priority: '0.6', changefreq: 'monthly' },
    { path: '/ar/terms', priority: '0.4', changefreq: 'monthly' },
    { path: '/ar/privacy-policy', priority: '0.4', changefreq: 'monthly' },
    { path: '/ar/return-policy', priority: '0.4', changefreq: 'monthly' },
    { path: '/ar/shipping-policy', priority: '0.4', changefreq: 'monthly' }
  ];

  const urls = [
    ...staticPaths.map(
      p => `  <url>
    <loc>${escXml(`${baseUrl}${p.path}`)}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    ),
    ...collections.map(c => {
      const img = c.image ? toFullUrl(baseUrl, c.image) : '';
      return `  <url>
    <loc>${escXml(`${baseUrl}/ar/product/${encodeURIComponent(c.handle)}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${
      img
        ? `
    <image:image>
      <image:loc>${escXml(img)}</image:loc>
      <image:title>${escXml(c.title)}</image:title>
    </image:image>`
        : ''
    }
  </url>`;
    }),
    ...products.map(p => {
      const imgs = (Array.isArray(p.images) ? p.images : []).slice(0, 3).map(src => toFullUrl(baseUrl, src)).filter(Boolean);
      const lastmod = p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : undefined;
      return `  <url>
    <loc>${escXml(`${baseUrl}/ar/product/all/${encodeURIComponent(p.handle || p.id)}`)}</loc>${
      lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
    }
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imgs
      .map(
        img => `
    <image:image>
      <image:loc>${escXml(img)}</image:loc>
      <image:title>${escXml(p.name_ar)}</image:title>
    </image:image>`
      )
      .join('')}
  </url>`;
    })
  ];

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`);
}
