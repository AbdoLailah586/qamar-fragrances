BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL DEFAULT '',
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  avatar TEXT,
  password_hash TEXT NOT NULL DEFAULT '',
  role VARCHAR(30) NOT NULL DEFAULT 'customer',
  admin_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider VARCHAR(30) NOT NULL DEFAULT 'email',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  totp_secret VARCHAR(64),
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  totp_pending_secret VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  two_factor_verified BOOLEAN NOT NULL DEFAULT true,
  two_factor_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(20) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  id VARCHAR(100) PRIMARY KEY,
  handle VARCHAR(200) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(120) PRIMARY KEY,
  handle VARCHAR(300) UNIQUE NOT NULL,
  name_ar VARCHAR(400) NOT NULL,
  name_en VARCHAR(400) NOT NULL DEFAULT '',
  category VARCHAR(200) NOT NULL DEFAULT 'عطور-نيش-وعطور-عربية-للجنسين',
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand VARCHAR(200) NOT NULL DEFAULT 'Qamar Fragrances',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  old_price NUMERIC(12,2),
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  featured_order INTEGER,
  shop_order INTEGER NOT NULL DEFAULT 0,
  concentration VARCHAR(60) NOT NULL DEFAULT 'EDP',
  gender VARCHAR(30) NOT NULL DEFAULT 'unisex',
  scent_family VARCHAR(120) NOT NULL DEFAULT '',
  notes_top TEXT NOT NULL DEFAULT '',
  notes_heart TEXT NOT NULL DEFAULT '',
  notes_base TEXT NOT NULL DEFAULT '',
  size_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_active_order_idx ON products(is_active, shop_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products(is_featured, featured_order);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(100) PRIMARY KEY,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id VARCHAR(100),
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  customer_email VARCHAR(255),
  governorate VARCHAR(120) NOT NULL DEFAULT 'الدقهلية - المنصورة',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 60,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cod',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  payment_reference VARCHAR(200),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  courier_name VARCHAR(150),
  packed_at TIMESTAMPTZ,
  packed_by VARCHAR(150),
  cancellation_reason TEXT,
  cancelled_by VARCHAR(60),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders(customer_phone);

CREATE TABLE IF NOT EXISTS active_carts (
  session_id VARCHAR(120) PRIMARY KEY,
  customer_name VARCHAR(200),
  customer_phone VARCHAR(40),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_abandoned BOOLEAN NOT NULL DEFAULT false,
  recovered BOOLEAN NOT NULL DEFAULT false,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_activity (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(120) NOT NULL,
  customer_id VARCHAR(100),
  action_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(200),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_activity_session_idx ON customer_activity(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS product_reviews (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(120) NOT NULL,
  product_name_ar VARCHAR(400),
  author_name VARCHAR(150) NOT NULL,
  author_phone VARCHAR(40),
  user_id VARCHAR(100),
  session_id VARCHAR(120),
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT NOT NULL,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(100) PRIMARY KEY,
  customer_phone VARCHAR(40) NOT NULL,
  customer_name VARCHAR(200),
  order_id VARCHAR(100),
  subject VARCHAR(255) NOT NULL DEFAULT 'استفسار عميل',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  assigned_to VARCHAR(150),
  escalation_reason TEXT,
  access_hash CHAR(64),
  csat_rating INTEGER,
  csat_comment TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR(100) PRIMARY KEY,
  ticket_id VARCHAR(100) NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(30) NOT NULL,
  sender_id VARCHAR(100),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_refusals (
  id VARCHAR(100) PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  reason TEXT NOT NULL,
  courier_name VARCHAR(150),
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_quotes (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(120) NOT NULL,
  supplier_name VARCHAR(200) NOT NULL,
  quoted_price NUMERIC(12,2) NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_events (
  id VARCHAR(100) PRIMARY KEY,
  customer_id VARCHAR(120) NOT NULL,
  product_id VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(100) PRIMARY KEY,
  actor_id VARCHAR(100),
  actor_name VARCHAR(200),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(200),
  before_data JSONB,
  after_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_settings (
  id VARCHAR(50) PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Perfume-specific back-office ERP tables
CREATE TABLE IF NOT EXISTS oil_reserves (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(120),
  perfume_title VARCHAR(300) NOT NULL,
  brand VARCHAR(200) NOT NULL DEFAULT '',
  oil_supplier VARCHAR(200) NOT NULL DEFAULT '',
  stock_ml NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_per_ml NUMERIC(12,2) NOT NULL DEFAULT 0,
  concentration_pct INTEGER NOT NULL DEFAULT 30,
  maceration_days INTEGER NOT NULL DEFAULT 14,
  batch_code VARCHAR(100) NOT NULL DEFAULT '',
  shelf_location VARCHAR(120) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bottle_supplies (
  id VARCHAR(100) PRIMARY KEY,
  size_label VARCHAR(60) NOT NULL,
  bottle_type VARCHAR(120) NOT NULL DEFAULT 'زجاجة بخاخ',
  stock_qty INTEGER NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_threshold INTEGER NOT NULL DEFAULT 25,
  supplier VARCHAR(200) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fragrance_notes_catalog (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(120) UNIQUE NOT NULL,
  scent_family VARCHAR(120) NOT NULL DEFAULT '',
  inspired_by VARCHAR(250) NOT NULL DEFAULT '',
  concentration VARCHAR(60) NOT NULL DEFAULT 'Extrait / EDP',
  gender VARCHAR(40) NOT NULL DEFAULT 'unisex',
  season VARCHAR(80) NOT NULL DEFAULT 'طوال العام',
  top_notes TEXT NOT NULL DEFAULT '',
  heart_notes TEXT NOT NULL DEFAULT '',
  base_notes TEXT NOT NULL DEFAULT '',
  longevity_hours VARCHAR(60) NOT NULL DEFAULT '8-12 ساعة',
  sillage VARCHAR(60) NOT NULL DEFAULT 'فواح',
  updated_by VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
