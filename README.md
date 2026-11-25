# قمر للعطور | Qamar Fragrances E-Commerce & Perfume ERP

متجر إلكتروني متكامل للعطور المحاكاة والنيش والزيوت العطرية ([qamar-fragrances.com](https://qamar-fragrances.com/ar)) مبني بنفس البنية الهندسية السريعة لـ **JOE Store Architecture**: واجهة React + TypeScript + Tailwind CSS فائقة السرعة متطابقة بصرياً ولغوياً مع هوية قمر للعطور، بالإضافة إلى **Edge CDN Caching** لطلبات الكتالوج ولوحة إدارة متكاملة من **٢٢ قسماً** مخصصة لإدارة مصنع ومتجر العطور على قاعدة بيانات **Neon PostgreSQL**.

---

## نظرة عامة على الطبقات (Architecture Layers)

```text
+-------------------------------------------------------------------------+
| 1. Edge Layer (Vercel Edge Network & Middleware)                        |
|    - vercel.json: SPA rewrites + static immutable cache (/qamar-images) |
|    - middleware.js: توجيه روبوتات واتساب/فيسبوك إلى /api/og-product      |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 2. Presentation Layer (React 18 + TypeScript + Vite + Tailwind + PWA)   |
|    - RTL عربية كاملة + أرقام عربية هندية (٠–٩) + خط Cairo              |
|    - Storefront: Home / Shop (351 منتج) / ProductDetails (الأحجام)     |
|    - Admin ERP: 22 قسماً مخصصاً للزيوت الخام والزجاجات والنوتات         |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 3. Client State & Offline Layer (src/context + src/services)            |
|    - StoreContext / AuthContext                                         |
|    - neonDb.ts: GET للكتالوج العام عبر الـ CDN + POST للعمليات الخاصة    |
|    - offlineCatalog.ts + public/sw.js: كاش محلي للعمل بدون إنترنت       |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 4. Serverless API & Security Boundary (api/ + lib/)                     |
|    - api/store.ts: GET allowlist (s-maxage=30, SWR=120) + POST no-store |
|    - lib/session.js: HttpOnly HMAC-SHA256 Signed Sessions + TOTP 2FA    |
|    - lib/access.js: RBAC على مستوى الـ ٢٢ قسماً الإداري                  |
|    - api/google-auth.js, api/send-otp.js, api/verify-otp.js             |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 5. Transactional Order Engine (server/store.ts + server/orderWrites.ts) |
|    - قفل صفوف المنتجات FOR UPDATE والتحقق من سعر كل حجم (Variant)      |
|    - توليد رقم طلب QMR-... وخصم المخزون وحساب الشحن بالخادم           |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 6. Persistence Layer (Neon Serverless PostgreSQL)                       |
|    - migrations/001_initial_schema.sql (26 جدول وفهرس)                  |
|    - جداول العطور: oil_reserves, bottle_supplies, fragrance_notes_catalog |
+-------------------------------------------------------------------------+
```

---

## لوحة تحكم إدارة العطور (22 قسماً — Fragrance ERP)

تم تكييف لوحة الإدارة بالكامل لطبيعة نشاط **تصنيع وتعبئة وبيع العطور والزيوت الخام**:

1. **التقارير والتحليل**: `overview` (نظرة عامة)، `analytics` (تحليلات المبيعات والعطور الأكثر طلباً)، `crm` (السلات النشطة والمتروكة).
2. **الكتالوج والزيوت**:
   - `products`: كتالوج العطور والأحجام (`5ml` إلى `250ml` والتولا) والخصومات وإخفاء/إظهار المنتجات.
   - `oils`: إدارة مخزون الزيوت الخام بالمللي، نسبة التركيز، أيام التعتيق (`maceration_days`)، ورصيد الزجاجات الفارغة (`bottle_supplies`).
   - `notes_finder`: دليل النوتات (الافتتاحية / القلب / القاعدة) والهرم العطري والبدائل لترشيح العطور للعملاء.
   - `pricing`: حاسبة تسعير الملي والتعبئة والهامش لكل حجم (`5ml`, `10ml`, `30ml`, `50ml`, `100ml`).
   - `labels`: طباعة استيكرات الزجاجات بمقاسات متعددة متضمنة اسم العطر والتركيز والحجم.
3. **المخزون والتوريد**: `inventory` (المخزون وتصدير Excel)، `quality` (جودة التعتيق والبيانات)، `stocktake` (الجرد السريع)، `reorder` (النواقص وإعادة الطلب)، `suppliers` (عروض أسعار موردي الزيوت والزجاجات).
4. **العمليات والعملاء**: `orders` (إدارة الطلبات)، `fulfillment` (التجهيز والشحن والمرتجعات)، `support` (الدعم والتذاكر)، `whatsapp` (قوالب رسائل واتساب)، `emails` (قوالب البريد).
5. **النظام والأمان**: `users` (الموظفون والصلاحيات لكل قسم)، `tools` (المراجعات والأدوات)، `security` (سجل التدقيق والتحقق الثنائي 2FA TOTP)، `settings` (إعدادات المتجر والشحن والبانرات).

---

## تسريع الأداء وتخفيف الحمل على الداتابيز (Edge CDN Caching)

- استدعاءات القراءة العامة في `src/services/neonDb.ts` تستخدم طلبات `GET /api/store?method=...` للمسارات المسموحة فقط:
  `getProducts`, `getCollections`, `getStoreSettings`, `getFragranceNotes`.
- يرجع `api/store.ts` الترويسة التالية عند وجود بيانات غير فارغة:
  `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=120`
  مما يعني خدمة آلاف الزوار من شبكة Vercel Edge دون استهلاك Compute/Egress من Neon DB عند كل زيارة.
- يتم تجاهل كوكي الجلسة ومعامل `includeHidden` وحذف حقول التكلفة (`cost_price`, `variant.costPrice`) تلقائياً في مسار `GET`.
- طلبات `POST /api/store` محمية بـ `Cache-Control: no-store` والتحقق من الأصل (`sameOrigin`) وصلاحيات RBAC قبل تنفيذ أي استعلام.
- جميع الصور (611 صورة) مرفوعة محلياً داخل `public/qamar-images/` مع ترويسة `Cache-Control: public, max-age=31536000, immutable`.

---

## التشغيل المحلي والاختبارات

### المتطلبات
- Node.js 22+ / 24+
- قاعدة بيانات Neon PostgreSQL

### التثبيت والإعداد

```bash
npm install
cp .env.example .env
# أضف رابط DATABASE_URL في ملف .env
```

### رفع الكتالوج (351 منتج + 6 مجموعات) إلى Neon DB

```bash
node scripts/seed_qamar_db.mjs
```

### تشغيل الخادم المحلي

```bash
npm run dev
# يعمل على http://localhost:5175
```

### الاختبارات والبناء

```bash
npx tsc --noEmit
npm test
npm run build
```

---

## النشر على Vercel (Deployment)

1. اربط المستودع [AbdoLailah586/qamar-fragrances](https://github.com/AbdoLailah586/qamar-fragrances) في لوحة تحكم Vercel.
2. أضف متغيرات البيئة التالية في **Vercel Project Settings -> Environment Variables**:
   - `DATABASE_URL`: رابط اتصال Neon PostgreSQL (ضروري).
   - *(اختياري)* `VITE_GOOGLE_CLIENT_ID` لتسجيل الدخول بـ Google.
   - *(اختياري)* `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` أو `BREVO_API_KEY` / `RESEND_API_KEY` لإرسال أكواد التحقق OTP عبر البريد.
3. سيبني Vercel التطبيق عبر `npm run build` ويرفع الدوال السحابية تحت `/api/*` وملفات الـ PWA تحت `dist/`.
