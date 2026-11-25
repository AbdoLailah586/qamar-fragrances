import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

const KNOWN_BRANDS = [
  'Maison Francis Kurkdjian', 'Maison Martin Margiela', 'Maison Crivelli',
  'Goldfield & Banks Australia', 'Goldfield & Banks', 'Marc Antoine Barrois',
  'Born to Stand Out', 'Born To Stand Out', 'Parfums de Marly', 'De Parfums De Marly',
  'Stephane Humbert Lucas', 'The Spirit of Dubai', 'Smumukh The Spirit of Dibai',
  'Giardini Di Toscana', 'Yves Saint Laurent', 'Carolina Herrera', 'Clive Christian',
  'Arabian Oud', 'Emporio Armani', 'Eporio Armani', 'Giorgio Armani',
  'Jean Paul Gaultier', 'Dolce & Gabbana', 'Narciso Rodriguez', 'Tiziana Terenzi',
  'Acqua di Parma', 'Lorenzo Pazzaglia', 'Matiere Premiere', 'Frederic Malle',
  'Penhaligon\'s', 'By Kilian', 'BDK Parfums', 'Louis Vuitton', 'Roja Dove',
  'Tom Ford', 'Le Labo', 'Memo Paris', 'Ex Nihilo', 'Orto Parisi', 'Amouage',
  'Guerlain', 'Xerjoff', 'Givenchy', 'Rasasi', 'Gucci', 'Byredo', 'Dior',
  'Sospiro', 'Bvlgari', 'Initio', 'Nishane', 'Mancera', 'Montale', 'Chanel',
  'Creed', 'Lattafa', 'Armaf', 'Afnan', 'Al Haramain', 'Swiss Arabian',
  'Kayali', 'Versace', 'Prada', 'Valentino', 'Paco Rabanne', 'Rabanne',
  'Burberry', 'Hugo Boss', 'Montblanc', 'Lacoste', 'Calvin Klein', 'Jo Malone',
  'Diptyque', 'Nasomatto', 'Electimuss', 'Kajal', 'Armani', 'Link',
  'Victoria\'s Secret', 'Bath & Body Works', 'Sol de Janeiro'
];

function inferBrand(title, categories) {
  if (categories.includes('عطور-نيش') || title.includes('فواحة') || title.includes('مبخرة') || title.includes('بخور')) {
    return 'Qamar Home';
  }
  const normalized = title.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (normalized.includes(brand.toLowerCase())) {
      if (brand === 'De Parfums De Marly') return 'Parfums de Marly';
      if (brand === 'Eporio Armani') return 'Emporio Armani';
      if (brand === 'Smumukh The Spirit of Dibai') return 'The Spirit of Dubai';
      return brand;
    }
  }
  const asciiWords = title.replace(/[^\x20-\x7E]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (asciiWords.length >= 2) return asciiWords.slice(-2).join(' ');
  if (asciiWords.length === 1) return asciiWords[0];
  return 'Qamar Fragrances';
}

const SIZE_ORDER = new Map([
  ['ربع تولا', 1], ['نصف تولا', 2], ['تولا', 3],
  ['5ml', 4], ['10ml', 5], ['30ml', 6], ['50ml', 7],
  ['55ml', 8], ['100ml', 9], ['110ml', 10], ['125ml', 11], ['250ml', 12]
]);

function mapVariants(rawProduct, urlToLocal) {
  const nodes = rawProduct.variants?.nodes || [];
  const mapped = nodes.map((v, idx) => {
    const selectedLabel = v.selectedOptions?.[0]?.value?.name || (nodes.length === 1 ? 'العبوة الكاملة' : `خيار ${idx + 1}`);
    const price = Number(v.price?.amount || 0);
    const compareAt = v.compareAtPrice?.amount ? Number(v.compareAtPrice.amount) : null;
    const imgSrc = v.image?.src ? (urlToLocal[v.image.src] || v.image.src) : null;
    return {
      id: v.id,
      label: selectedLabel,
      price,
      compareAtPrice: compareAt,
      sku: v.sku || `${rawProduct.id.slice(-6).toUpperCase()}-${selectedLabel.replace(/\s+/g, '')}`,
      stock: typeof v.quantity === 'number' ? v.quantity : 50,
      costPrice: Math.round(price * 0.45),
      image: imgSrc
    };
  });
  mapped.sort((a, b) => (SIZE_ORDER.get(a.label) ?? 99) - (SIZE_ORDER.get(b.label) ?? 99) || a.price - b.price);
  return mapped;
}

function inferGender(categories, title) {
  const hasMen = categories.includes('عطور-رجالى-ديزاينر');
  const hasWomen = categories.includes('عطور-نسائى-ديزاينر');
  if (categories.includes('عطور-نيش') || title.includes('فواحة')) return 'home';
  if (hasMen && !hasWomen) return 'men';
  if (hasWomen && !hasMen) return 'women';
  return 'unisex';
}

function inferConcentration(categories) {
  if (categories.includes('مسك-الخام-زيوت-عطرية')) return 'Pure Oil / Musk';
  if (categories.includes('بادى-سبلاش-لوشن-للجسم')) return 'Body Mist & Lotion';
  if (categories.includes('عطور-نيش')) return 'Home Diffuser & Bakhoor';
  return 'Extrait / EDP';
}

async function run() {
  const env = loadEnv();
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required in .env');
  const sql = neon(env.DATABASE_URL);

  console.log('1. Applying PostgreSQL schema...');
  const schemaSql = fs.readFileSync(path.resolve('migrations/001_initial_schema.sql'), 'utf8')
    .replace(/--.*$/gm, '');
  const statements = schemaSql
    .split(/;\s*\r?\n/)
    .map(s => s.trim())
    .filter(s => s && s.toUpperCase() !== 'BEGIN' && s.toUpperCase() !== 'COMMIT');

  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log(`   Applied ${statements.length} DDL statements.`);

  const canonical = JSON.parse(fs.readFileSync(path.resolve('scripts/seed_data/qamar_canonical.json'), 'utf8'));
  const { store, heroSlider, featuredHandles, shopOrderIds, urlToLocal, products } = canonical;

  const shopOrderMap = new Map(shopOrderIds.map((id, idx) => [id, idx]));
  const featuredMap = new Map(featuredHandles.map((h, idx) => [h.trim(), idx + 1]));

  console.log('2. Seeding collections...');
  const orderedCollectionHandles = [
    'عطور-رجالى-ديزاينر',
    'عطور-نيش-وعطور-عربية-للجنسين',
    'عطور-نسائى-ديزاينر',
    'مسك-الخام-زيوت-عطرية',
    'بادى-سبلاش-لوشن-للجسم',
    'عطور-نيش'
  ];
  const rawCols = store.collections?.nodes || [];
  const sortedCols = [...rawCols].sort((a, b) => {
    const ia = orderedCollectionHandles.indexOf(a.handle);
    const ib = orderedCollectionHandles.indexOf(b.handle);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (let i = 0; i < sortedCols.length; i++) {
    const c = sortedCols[i];
    const localImg = c.image?.src ? (urlToLocal[c.image.src] || c.image.src) : '';
    await sql`
      INSERT INTO collections (id, handle, title, short_description, image, sort_order, is_visible)
      VALUES (${c.id}, ${c.handle}, ${c.title}, ${c.description || ''}, ${localImg}, ${i}, true)
      ON CONFLICT (id) DO UPDATE SET
        handle = EXCLUDED.handle,
        title = EXCLUDED.title,
        image = EXCLUDED.image,
        sort_order = EXCLUDED.sort_order;
    `;
  }
  console.log(`   Seeded ${sortedCols.length} collections.`);

  console.log('3. Seeding all 351 products...');
  let count = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const title = p.title.trim();
    const cats = (p.collections?.nodes || []).map(c => c.handle);
    const primaryCat = cats[0] || 'عطور-نيش-وعطور-عربية-للجنسين';
    const images = (p.images || []).map(im => urlToLocal[im.src] || im.src);
    const variants = mapVariants(p, urlToLocal);
    const sizeOptions = variants.map(v => v.label);
    const minPrice = variants.length ? Math.min(...variants.map(v => v.price)) : 0;
    const compareAt = variants[0]?.compareAtPrice || null;
    const brand = inferBrand(title, cats);
    const gender = inferGender(cats, title);
    const concentration = inferConcentration(cats);
    const shopOrder = shopOrderMap.get(p.id) ?? (1000 + i);
    const fOrder = featuredMap.get(p.handle.trim()) ?? null;
    const isFeatured = fOrder !== null;
    const desc = (p.shortDescription || '').trim() || (
      sizeOptions.length > 1
        ? `${title} — متوفر بأحجام (${sizeOptions.join(' / ')}) بجودة محاكاة مطابقة للأوريجينال وثبات فواح.`
        : `${title} — متوفر الآن لدى قمر للعطور بجودة عالية.`
    );

    await sql`
      INSERT INTO products (
        id, handle, name_ar, name_en, category, categories, brand,
        price, old_price, cost_price, stock_quantity, is_active, is_featured,
        featured_order, shop_order, concentration, gender, scent_family,
        size_options, variants, images, specs
      )
      VALUES (
        ${p.id},
        ${p.handle.trim()},
        ${title},
        ${title},
        ${primaryCat},
        ${JSON.stringify(cats)}::jsonb,
        ${brand},
        ${minPrice},
        ${compareAt},
        ${Math.round(minPrice * 0.45)},
        ${p.isInStock ? 50 : 0},
        true,
        ${isFeatured},
        ${fOrder},
        ${shopOrder},
        ${concentration},
        ${gender},
        ${primaryCat},
        ${JSON.stringify(sizeOptions)}::jsonb,
        ${JSON.stringify(variants)}::jsonb,
        ${JSON.stringify(images)}::jsonb,
        ${JSON.stringify({ description_ar: desc, description_en: desc, shortDescription: p.shortDescription || '' })}::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        handle = EXCLUDED.handle,
        name_ar = EXCLUDED.name_ar,
        category = EXCLUDED.category,
        categories = EXCLUDED.categories,
        brand = EXCLUDED.brand,
        price = EXCLUDED.price,
        is_featured = EXCLUDED.is_featured,
        featured_order = EXCLUDED.featured_order,
        shop_order = EXCLUDED.shop_order,
        size_options = EXCLUDED.size_options,
        variants = EXCLUDED.variants,
        images = EXCLUDED.images,
        specs = EXCLUDED.specs,
        updated_at = NOW();
    `;
    count++;
    if (count % 50 === 0 || count === products.length) {
      console.log(`   Seeded ${count}/${products.length} products...`);
    }
  }

  console.log('4. Seeding store settings...');
  const hero = heroSlider[0] || {};
  const logoSrc = store.logo?.image?.src ? (urlToLocal[store.logo.image.src] || store.logo.image.src) : '';
  const favSrc = store.favIcon?.src ? (urlToLocal[store.favIcon.src] || store.favIcon.src) : '';
  const settingsObj = {
    store_name: 'Qamar Fragrances',
    store_name_ar: 'قمر للعطور',
    tagline_ar: store.description,
    logo_url: logoSrc,
    favicon_url: favSrc,
    primary_color: '#fe9931',
    ink_normal: '#4f4335',
    ink_subdued: '#585757',
    whatsapp_number: '201003732029',
    phone: '+20 10 03732029',
    email: 'qamaraboalnaga@gmail.com',
    address_ar: store.location?.address || 'المنصورة - شارع الإمام محمد عبده - فى مقدمة شارع المدارس',
    shipping_fee: 60,
    free_shipping_threshold: 1500,
    social_links: store.socialMedia || [],
    hero_heading: hero.headingText || 'عطور محاكاة بجودة مطابقة للأوريجينال',
    hero_subheading: hero.subHeadingText || store.description,
    hero_image: hero.image?.src ? (urlToLocal[hero.image.src] || hero.image.src) : '',
    hero_mobile_image: hero.mobileImage?.src ? (urlToLocal[hero.mobileImage.src] || hero.mobileImage.src) : '',
    collections_heading: 'مجوعاتنا المميزة لك',
    featured_heading: 'عطورنا الفائقة',
    announcement_enabled: false,
    announcement_text: 'لا تنسى السؤال عن عروضنا المستمرة'
  };

  await sql`
    INSERT INTO store_settings (id, settings, updated_at)
    VALUES ('main', ${JSON.stringify(settingsObj)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW();
  `;

  console.log('5. Seeding perfume bottle supplies & initial oil reserves...');
  const supplies = [
    ['sup-5ml', '5ml', 'زجاجة عينة / ترافل بخاخ', 320, 12, 50, 'مورد الزجاج - القاهرة'],
    ['sup-10ml', '10ml', 'زجاجة سيمبل فاخرة بخاخ', 280, 18, 50, 'مورد الزجاج - القاهرة'],
    ['sup-30ml', '30ml', 'زجاجة قمر كريستال 30 مل', 160, 28, 30, 'مورد الزجاج - القاهرة'],
    ['sup-50ml', '50ml', 'زجاجة قمر الفاخرة 50 مل', 145, 35, 30, 'مورد الزجاج - القاهرة'],
    ['sup-100ml', '100ml', 'زجاجة قمر الملكية 100 مل', 110, 48, 25, 'مورد الزجاج - القاهرة'],
    ['sup-tola', 'تولا', 'زجاجة مسك ودهن عود (تولا / نصف / ربع)', 95, 15, 20, 'مورد العبوات الشرقية']
  ];
  for (const [id, sz, btype, qty, cost, thr, sup] of supplies) {
    await sql`
      INSERT INTO bottle_supplies (id, size_label, bottle_type, stock_qty, cost_per_unit, min_threshold, supplier)
      VALUES (${id}, ${sz}, ${btype}, ${qty}, ${cost}, ${thr}, ${sup})
      ON CONFLICT (id) DO NOTHING;
    `;
  }

  // Seed oil reserves & fragrance notes for the 12 featured products
  const featuredProds = products.filter(p => featuredMap.has(p.handle.trim()));
  for (let idx = 0; idx < featuredProds.length; idx++) {
    const p = featuredProds[idx];
    const cats = (p.collections?.nodes || []).map(c => c.handle);
    const brand = inferBrand(p.title.trim(), cats);
    await sql`
      INSERT INTO oil_reserves (id, product_id, perfume_title, brand, oil_supplier, stock_ml, cost_per_ml, concentration_pct, maceration_days, batch_code, shelf_location)
      VALUES (
        ${`oil-${p.id.slice(-10)}`},
        ${p.id},
        ${p.title.trim()},
        ${brand},
        ${'الزيوت الفرنسية والسويسرية المعتمدة'},
        ${500 + idx * 50},
        ${8.5 + (idx % 4) * 1.5},
        ${32},
        ${21},
        ${`QMR-2026-${String(idx + 1).padStart(2, '0')}`},
        ${`رف A-${(idx % 4) + 1}`}
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    await sql`
      INSERT INTO fragrance_notes_catalog (id, product_id, scent_family, inspired_by, concentration, gender, season, top_notes, heart_notes, base_notes, longevity_hours, sillage)
      VALUES (
        ${`notes-${p.id.slice(-10)}`},
        ${p.id},
        ${'شرقي خشبي عنبري'},
        ${p.title.trim()},
        ${'Extrait de Parfum (32%)'},
        ${inferGender(cats, p.title)},
        ${'طوال العام / المساء'},
        ${'زعفران، برغموت، هيل'},
        ${'عنبر، ورد دمشقي، ياسمين'},
        ${'عود، خشب الأرز، فانيليا، مسك أبيض'},
        ${'10-14 ساعة'},
        ${'فواح وقوي'}
      )
      ON CONFLICT (product_id) DO NOTHING;
    `;
  }

  console.log('6. Ensuring owner admin account exists...');
  const seedPass = env.SEED_ADMIN_PASSWORD || randomBytes(12).toString('base64url');
  const existingOwner = await sql`SELECT id FROM users WHERE lower(email) = 'qamaraboalnaga@gmail.com' LIMIT 1`;
  if (!existingOwner.length) {
    await sql`
      INSERT INTO users (id, name, email, phone, password_hash, role, admin_permissions, provider, email_verified)
      VALUES (
        'usr-qamar-owner',
        'إدارة قمر للعطور',
        'qamaraboalnaga@gmail.com',
        '01003732029',
        ${hashPassword(seedPass)},
        'admin',
        '[]'::jsonb,
        'email',
        true
      );
    `;
    console.log(`   Created owner admin account: qamaraboalnaga@gmail.com`);
    if (!env.SEED_ADMIN_PASSWORD) {
      console.log(`   Initial temporary owner password (save & change after login): ${seedPass}`);
    }
  } else {
    console.log('   Owner admin account already exists.');
  }

  const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM products`;
  const [{ colTotal }] = await sql`SELECT COUNT(*)::int AS colTotal FROM collections`;
  console.log(`\nDONE! Neon DB verified -> products=${total}, collections=${colTotal}`);
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
