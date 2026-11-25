export type CategoryKey =
  | 'all'
  | 'عطور-رجالى-ديزاينر'
  | 'عطور-نيش-وعطور-عربية-للجنسين'
  | 'عطور-نسائى-ديزاينر'
  | 'مسك-الخام-زيوت-عطرية'
  | 'بادى-سبلاش-لوشن-للجسم'
  | 'عطور-نيش';

export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  compareAtPrice?: number | null;
  sku?: string;
  stock?: number;
  costPrice?: number;
  image?: string | null;
}

export interface StoreCollection {
  id: string;
  handle: string;
  title: string;
  short_description?: string;
  image: string;
  sort_order: number;
  products_count?: number;
}

export interface Product {
  id: string;
  handle: string;
  sku?: string;
  name_ar: string;
  name_en: string;
  category: string;
  categories: string[];
  brand: string;
  price: number;
  original_price?: number;
  cost_price?: number;
  discount_percentage?: number;
  stock: number;
  recorded_stock?: number;
  in_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  featured_order?: number | null;
  shop_order: number;
  concentration?: string;
  gender?: 'men' | 'women' | 'unisex' | 'home' | string;
  scent_family?: string;
  notes_top?: string;
  notes_heart?: string;
  notes_base?: string;
  size_options: string[];
  variants: ProductVariant[];
  images: string[];
  description_ar: string;
  description_en: string;
  specs: Record<string, string>;
  rating?: number;
  reviews_count?: number;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  variantId?: string;
  unitPrice: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'instapay' | 'vodafone_cash' | 'card';
export type PaymentStatus = 'unpaid' | 'paid' | 'verified';

export interface DeliveryAddressFields {
  governorate: string;
  city: string;
  address_details: string;
  notes?: string;
  customer_whatsapp?: string;
  google_maps_url?: string;
  latitude?: number;
  longitude?: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp?: string;
  customer_email?: string;
  governorate: string;
  city: string;
  address_details: string;
  notes?: string;
  google_maps_url?: string;
  latitude?: number;
  longitude?: number;
  items: CartItem[];
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference?: string;
  order_status: OrderStatus;
  tracking_number: string;
  courier_name?: string;
  packed_at?: string;
  packed_by?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  whatsapp_notification_sent?: boolean;
  created_at: string;
  updated_at: string;
}

export type WhatsAppNotificationType =
  | 'order_confirmed'
  | 'admin_new_order'
  | 'payment_verified'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'review_request'
  | 'custom';

export interface WhatsAppTemplates {
  order_confirmed?: string;
  admin_new_order?: string;
  payment_verified?: string;
  shipped?: string;
  out_for_delivery?: string;
  delivered?: string;
  cancelled?: string;
  review_request?: string;
}

export interface WhatsAppNotificationLog {
  id: string;
  order_id?: string;
  order_number?: string;
  phone: string;
  notification_type: WhatsAppNotificationType;
  message_text: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  sender_email?: string;
  created_at: string;
}

export interface StoreSettings {
  store_name: string;
  store_name_ar: string;
  tagline_ar: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  ink_normal: string;
  ink_subdued: string;
  whatsapp_number: string;
  phone: string;
  email: string;
  address_ar: string;
  shipping_fee: number;
  free_shipping_threshold: number;
  social_links: { name: string; link: string }[];
  hero_heading: string;
  hero_subheading: string;
  hero_image: string;
  hero_mobile_image: string;
  collections_heading: string;
  featured_heading: string;
  announcement_enabled: boolean;
  announcement_text: string;
  auto_send_on_order?: boolean;
  auto_send_on_status_change?: boolean;
  auto_alert_admin_on_order?: boolean;
  admin_alert_whatsapp_number?: string;
  whatsapp_templates?: WhatsAppTemplates;
  whatsapp_automation_url?: string;
  whatsapp_automation_email?: string;
  whatsapp_automation_pass?: string;
}

export interface OilReserve {
  id: string;
  product_id?: string;
  perfume_title: string;
  brand: string;
  oil_supplier: string;
  stock_ml: number;
  cost_per_ml: number;
  concentration_pct: number;
  maceration_days: number;
  batch_code: string;
  shelf_location: string;
  notes: string;
  updated_at?: string;
}

export interface BottleSupply {
  id: string;
  size_label: string;
  bottle_type: string;
  stock_qty: number;
  cost_per_unit: number;
  min_threshold: number;
  supplier: string;
  updated_at?: string;
}

export interface FragranceNotesEntry {
  id: string;
  product_id: string;
  scent_family: string;
  inspired_by: string;
  concentration: string;
  gender: string;
  season: string;
  top_notes: string;
  heart_notes: string;
  base_notes: string;
  longevity_hours: string;
  sillage: string;
}
