import { neon } from '@neondatabase/serverless';
import { cancelOrder as cancelStoredOrder } from './orderWrites.js';
import { decodeDeliveryNotes } from '../src/utils/deliveryAddress.js';
import {
  buildServerOrderWhatsAppMessage,
  dispatchWhatsAppViaCrm,
  ensureWhatsAppNotificationsTable,
  resolveCrmConfig,
  testWhatsAppCrmConnection,
  DEFAULT_WHATSAPP_TEMPLATES
} from './whatsappCrm.js';
import type { Product, Order, OrderStatus, PaymentMethod, PaymentStatus, StoreCollection, WhatsAppNotificationType } from '../src/types.js';

const queryClient = () => neon(process.env.DATABASE_URL || '');
const sql: any = Object.assign((strings: any, ...values: any[]) => queryClient()(strings, ...values), {
  query: (...args: any[]) => (queryClient().query as any)(...args)
});

function mapRowToProduct(row: any): Product {
  const specsObj = row.specs && typeof row.specs === 'object' ? row.specs : {};
  const details = specsObj.__product_data && typeof specsObj.__product_data === 'object' ? specsObj.__product_data : {};
  const publicSpecs = Object.fromEntries(
    Object.entries(specsObj).filter(([k, v]) => !k.startsWith('__') && !k.startsWith('description_') && typeof v === 'string')
  ) as Record<string, string>;
  const variants = Array.isArray(row.variants) ? row.variants : [];
  const sizeOptions = Array.isArray(row.size_options) ? row.size_options : variants.map((v: any) => v.label).filter(Boolean);
  const categories = Array.isArray(row.categories) && row.categories.length ? row.categories : [row.category].filter(Boolean);
  const images = Array.isArray(row.images) && row.images.length ? row.images : ['/qamar-images/placeholder.svg'];

  return {
    id: row.id,
    handle: row.handle || row.name_ar,
    sku: details.sku || row.id.slice(-8).toUpperCase(),
    name_ar: row.name_ar,
    name_en: row.name_en || row.name_ar,
    category: row.category,
    categories,
    brand: row.brand || 'Qamar Fragrances',
    price: Number(row.price || 0),
    original_price: row.old_price ? Number(row.old_price) : undefined,
    cost_price: row.cost_price != null ? Number(row.cost_price) : undefined,
    discount_percentage:
      row.old_price && Number(row.old_price) > Number(row.price)
        ? Math.round(((Number(row.old_price) - Number(row.price)) / Number(row.old_price)) * 100)
        : undefined,
    stock: Math.max(0, Number(row.stock_quantity ?? 0)),
    recorded_stock: row.stock_quantity == null ? undefined : Number(row.stock_quantity),
    in_stock: Number(row.stock_quantity ?? 0) > 0 && Number(row.price) > 0 && row.is_active !== false,
    is_active: row.is_active !== false,
    is_featured: Boolean(row.is_featured),
    featured_order: row.featured_order ?? null,
    shop_order: Number(row.shop_order ?? 0),
    concentration: row.concentration || 'Extrait / EDP',
    gender: row.gender || 'unisex',
    scent_family: row.scent_family || '',
    notes_top: row.notes_top || '',
    notes_heart: row.notes_heart || '',
    notes_base: row.notes_base || '',
    size_options: sizeOptions,
    variants,
    images,
    description_ar: details.description_ar || specsObj.description_ar || row.name_ar,
    description_en: details.description_en || specsObj.description_en || row.name_en || row.name_ar,
    specs: publicSpecs,
    rating: details.rating ?? 5,
    reviews_count: details.reviews_count ?? 0,
    created_at: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-03-01'
  };
}

export function mapRowToOrder(r: any): Order {
  const delivery = decodeDeliveryNotes(r.notes);
  return {
    ...delivery,
    id: r.id,
    order_number: r.order_number || r.id,
    customer_name: r.customer_name || 'عميل قمر للعطور',
    customer_phone: r.customer_phone || '',
    customer_whatsapp: delivery.customer_whatsapp || r.customer_phone || '',
    customer_email: r.customer_email || undefined,
    governorate: r.governorate || 'الدقهلية - المنصورة',
    city: delivery.city || '',
    address_details: delivery.address_details || r.address || '',
    notes: delivery.notes,
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: Number(r.subtotal || 0),
    shipping_fee: Number(r.shipping_fee || 0),
    discount: 0,
    total: Number(r.total || 0),
    payment_method: (r.payment_method || 'cod') as PaymentMethod,
    payment_status: (r.payment_status || 'unpaid') as PaymentStatus,
    payment_reference: r.payment_reference || undefined,
    order_status: (r.status || 'pending') as OrderStatus,
    tracking_number: r.order_number || r.id,
    courier_name: r.courier_name || undefined,
    packed_at: r.packed_at || undefined,
    packed_by: r.packed_by || undefined,
    cancellation_reason: r.cancellation_reason || undefined,
    cancelled_by: r.cancelled_by || undefined,
    cancelled_at: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : undefined,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function logAudit(entry: {
  actorId?: string; actorName?: string; action: string; entity: string; entityId?: string;
  before?: any; after?: any; reason?: string;
}) {
  try {
    await sql`
      INSERT INTO audit_log (id, actor_id, actor_name, action, entity, entity_id, before_data, after_data, reason)
      VALUES (
        ${`audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`},
        ${entry.actorId || null},
        ${entry.actorName || null},
        ${entry.action},
        ${entry.entity},
        ${entry.entityId || null},
        ${entry.before !== undefined ? JSON.stringify(entry.before) : null}::jsonb,
        ${entry.after !== undefined ? JSON.stringify(entry.after) : null}::jsonb,
        ${entry.reason || null}
      );
    `;
  } catch (error) {
    console.warn('Could not write audit log entry:', error);
  }
}

export const neonDb = {
  async getCollections(): Promise<StoreCollection[]> {
    try {
      const rows = await sql`
        SELECT c.*, (
          SELECT COUNT(*)::int FROM products p
          WHERE p.is_active = true AND (p.category = c.handle OR p.categories ? c.handle)
        ) AS products_count
        FROM collections c
        WHERE c.is_visible = true
        ORDER BY c.sort_order ASC;
      `;
      return rows as StoreCollection[];
    } catch (error) {
      console.error('getCollections error:', error);
      return [];
    }
  },

  async getAllProducts(params?: { includeHidden?: boolean }): Promise<Product[]> {
    const pageSize = 400;
    const first = await this.getProducts({ limit: pageSize, includeHidden: params?.includeHidden });
    if (first.total <= pageSize) return first.products;
    const remaining = await Promise.all(
      Array.from({ length: Math.ceil(first.total / pageSize) - 1 }, (_, index) =>
        this.getProducts({ limit: pageSize, offset: (index + 1) * pageSize, includeHidden: params?.includeHidden })
      )
    );
    const products = [...first.products, ...remaining.flatMap(p => p.products)];
    if (new Set(products.map(p => p.id)).size !== first.total) {
      throw new Error('The catalog could not be loaded completely.');
    }
    return products;
  },

  async getProducts(params?: {
    category?: string;
    search?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    limit?: number;
    offset?: number;
    includeHidden?: boolean;
  }): Promise<{ products: Product[]; total: number }> {
    try {
      const limit = Math.max(1, Math.min(500, Number(params?.limit) || 50));
      const offset = Math.max(0, Number(params?.offset) || 0);
      const category = params?.category;
      const search = params?.search?.trim();
      const size = params?.size?.trim();
      const minPrice = Number.isFinite(params?.minPrice) ? Number(params?.minPrice) : null;
      const maxPrice = Number.isFinite(params?.maxPrice) ? Number(params?.maxPrice) : null;
      const includeHidden = params?.includeHidden ?? false;

      let queryStr = `SELECT * FROM products WHERE 1=1`;
      let countStr = `SELECT COUNT(*)::int AS total FROM products WHERE 1=1`;
      const queryParams: any[] = [];
      let pIdx = 1;

      if (!includeHidden) {
        queryStr += ` AND is_active = true`;
        countStr += ` AND is_active = true`;
      }
      if (category && category !== 'all') {
        queryStr += ` AND (category = $${pIdx} OR categories ? $${pIdx})`;
        countStr += ` AND (category = $${pIdx} OR categories ? $${pIdx})`;
        queryParams.push(category);
        pIdx++;
      }
      if (search) {
        queryStr += ` AND (name_ar ILIKE $${pIdx} OR name_en ILIKE $${pIdx} OR brand ILIKE $${pIdx} OR handle ILIKE $${pIdx})`;
        countStr += ` AND (name_ar ILIKE $${pIdx} OR name_en ILIKE $${pIdx} OR brand ILIKE $${pIdx} OR handle ILIKE $${pIdx})`;
        queryParams.push(`%${search}%`);
        pIdx++;
      }
      if (size) {
        queryStr += ` AND size_options ? $${pIdx}`;
        countStr += ` AND size_options ? $${pIdx}`;
        queryParams.push(size);
        pIdx++;
      }
      if (minPrice !== null) {
        queryStr += ` AND price >= $${pIdx}`;
        countStr += ` AND price >= $${pIdx}`;
        queryParams.push(minPrice);
        pIdx++;
      }
      if (maxPrice !== null) {
        queryStr += ` AND price <= $${pIdx}`;
        countStr += ` AND price <= $${pIdx}`;
        queryParams.push(maxPrice);
        pIdx++;
      }

      const sortMap: Record<string, string> = {
        price_asc: 'price ASC, shop_order ASC',
        price_desc: 'price DESC, shop_order ASC',
        name_asc: 'name_ar ASC, shop_order ASC',
        name_desc: 'name_ar DESC, shop_order ASC',
        featured: 'is_featured DESC, featured_order ASC NULLS LAST, shop_order ASC',
        default: 'shop_order ASC, is_featured DESC, created_at DESC'
      };
      const orderBy = sortMap[params?.sort || 'default'] || sortMap.default;

      queryStr += ` ORDER BY ${orderBy} LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
      const [rows, countRows] = await Promise.all([
        sql.query(queryStr, [...queryParams, limit, offset]),
        sql.query(countStr, queryParams)
      ]);
      return {
        products: (rows as any[]).map(mapRowToProduct),
        total: Number(countRows[0]?.total || 0)
      };
    } catch (error) {
      console.error('getProducts error:', error);
      return { products: [], total: 0 };
    }
  },

  async toggleProductVisibility(productId: string, isActive: boolean) {
    try {
      await sql`UPDATE products SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${productId};`;
      return true;
    } catch (error) {
      console.error('toggleProductVisibility error:', error);
      return false;
    }
  },

  async updateProduct(productId: string, updates: any, actor?: { id: string; name: string }) {
    try {
      const pd = updates.product || {};
      const before = (await sql`SELECT price, cost_price, stock_quantity FROM products WHERE id = ${productId};`)[0];
      const variants = Array.isArray(pd.variants) ? pd.variants : null;
      const sizeOptions = variants ? variants.map((v: any) => v.label) : (Array.isArray(pd.size_options) ? pd.size_options : null);
      const nextPrice = updates.price ?? (variants && variants.length ? Math.min(...variants.map((v: any) => Number(v.price || 0))) : null);

      await sql`
        UPDATE products SET
          name_ar = COALESCE(${pd.name_ar ?? null}, name_ar),
          name_en = COALESCE(${pd.name_en ?? null}, name_en),
          brand = COALESCE(${pd.brand ?? null}, brand),
          category = COALESCE(${pd.category ?? null}, category),
          categories = COALESCE(${pd.categories ? JSON.stringify(pd.categories) : null}::jsonb, categories),
          price = COALESCE(${nextPrice}, price),
          old_price = COALESCE(${updates.old_price ?? pd.original_price ?? null}, old_price),
          cost_price = COALESCE(${pd.cost_price ?? null}, cost_price),
          stock_quantity = COALESCE(${updates.stock_quantity ?? pd.stock ?? null}, stock_quantity),
          is_active = COALESCE(${updates.is_active ?? pd.is_active ?? null}, is_active),
          is_featured = COALESCE(${updates.is_featured ?? pd.is_featured ?? null}, is_featured),
          concentration = COALESCE(${pd.concentration ?? null}, concentration),
          gender = COALESCE(${pd.gender ?? null}, gender),
          scent_family = COALESCE(${pd.scent_family ?? null}, scent_family),
          notes_top = COALESCE(${pd.notes_top ?? null}, notes_top),
          notes_heart = COALESCE(${pd.notes_heart ?? null}, notes_heart),
          notes_base = COALESCE(${pd.notes_base ?? null}, notes_base),
          variants = COALESCE(${variants ? JSON.stringify(variants) : null}::jsonb, variants),
          size_options = COALESCE(${sizeOptions ? JSON.stringify(sizeOptions) : null}::jsonb, size_options),
          images = COALESCE(${Array.isArray(pd.images) ? JSON.stringify(pd.images) : null}::jsonb, images),
          specs = CASE
            WHEN ${pd.description_ar ?? null}::text IS NOT NULL
              THEN jsonb_set(COALESCE(specs, '{}'::jsonb), '{description_ar}', to_jsonb(${pd.description_ar ?? ''}::text), true)
            ELSE specs
          END,
          updated_at = NOW()
        WHERE id = ${productId};
      `;

      if (actor && before) {
        await logAudit({
          actorId: actor.id,
          actorName: actor.name,
          action: 'PRODUCT_UPDATED',
          entity: 'product',
          entityId: productId,
          before,
          after: { price: nextPrice ?? before.price, cost_price: pd.cost_price ?? before.cost_price }
        });
      }
      return true;
    } catch (error) {
      console.error('updateProduct error:', error);
      return false;
    }
  },

  async bulkInsertProducts(products: Product[]) {
    let inserted = 0, errors = 0;
    for (const p of products) {
      try {
        const variants = Array.isArray(p.variants) && p.variants.length
          ? p.variants
          : [{ id: `var-${p.id}-default`, label: '100ml', price: p.price || 0, stock: p.stock ?? 50 }];
        const sizeOptions = variants.map(v => v.label);
        const cats = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category || 'عطور-نيش-وعطور-عربية-للجنسين'];
        await sql`
          INSERT INTO products (
            id, handle, name_ar, name_en, category, categories, brand,
            price, old_price, cost_price, stock_quantity, is_active, is_featured,
            shop_order, concentration, gender, scent_family, notes_top, notes_heart, notes_base,
            size_options, variants, images, specs
          ) VALUES (
            ${p.id}, ${p.handle || p.name_ar}, ${p.name_ar}, ${p.name_en || p.name_ar},
            ${cats[0]}, ${JSON.stringify(cats)}::jsonb, ${p.brand || 'Qamar Fragrances'},
            ${p.price || 0}, ${p.original_price || null}, ${p.cost_price ?? Math.round((p.price || 0) * 0.45)},
            ${p.stock ?? 50}, ${p.is_active !== false}, ${Boolean(p.is_featured)},
            ${p.shop_order ?? 999}, ${p.concentration || 'Extrait / EDP'}, ${p.gender || 'unisex'},
            ${p.scent_family || ''}, ${p.notes_top || ''}, ${p.notes_heart || ''}, ${p.notes_base || ''},
            ${JSON.stringify(sizeOptions)}::jsonb, ${JSON.stringify(variants)}::jsonb,
            ${JSON.stringify(p.images || [])}::jsonb,
            ${JSON.stringify({ description_ar: p.description_ar || p.name_ar })}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            name_ar = EXCLUDED.name_ar,
            brand = EXCLUDED.brand,
            price = EXCLUDED.price,
            stock_quantity = EXCLUDED.stock_quantity,
            variants = EXCLUDED.variants,
            size_options = EXCLUDED.size_options,
            images = EXCLUDED.images,
            updated_at = NOW();
        `;
        inserted++;
      } catch (err) {
        console.error('bulkInsertProducts item error:', err);
        errors++;
      }
    }
    return { inserted, errors };
  },

  async deleteProduct(productId: string, actor?: { id: string; name: string }) {
    try {
      await sql`DELETE FROM products WHERE id = ${productId};`;
      if (actor) await logAudit({ actorId: actor.id, actorName: actor.name, action: 'PRODUCT_DELETED', entity: 'product', entityId: productId });
      return true;
    } catch (error) {
      console.error('deleteProduct error:', error);
      return false;
    }
  },

  async trackActivity(activity: { sessionId: string; customerId?: string; actionType: string; targetId?: string; metadata?: Record<string, any> }) {
    try {
      await sql`
        INSERT INTO customer_activity (session_id, customer_id, action_type, target_id, metadata)
        VALUES (${activity.sessionId}, ${activity.customerId || null}, ${activity.actionType}, ${activity.targetId || null}, ${JSON.stringify(activity.metadata || {})}::jsonb);
      `;
    } catch {}
  },

  async syncActiveCart(cart: { sessionId: string; customerName?: string; customerPhone?: string; items: any[]; subtotal: number }) {
    try {
      if (!cart.items || cart.items.length === 0) {
        await sql`DELETE FROM active_carts WHERE session_id = ${cart.sessionId};`;
        return;
      }
      await sql`
        INSERT INTO active_carts (session_id, customer_name, customer_phone, items, subtotal, is_abandoned, last_updated_at)
        VALUES (${cart.sessionId}, ${cart.customerName || null}, ${cart.customerPhone || null}, ${JSON.stringify(cart.items)}::jsonb, ${cart.subtotal}, false, NOW())
        ON CONFLICT (session_id) DO UPDATE SET
          customer_name = COALESCE(EXCLUDED.customer_name, active_carts.customer_name),
          customer_phone = COALESCE(EXCLUDED.customer_phone, active_carts.customer_phone),
          items = EXCLUDED.items,
          subtotal = EXCLUDED.subtotal,
          is_abandoned = false,
          last_updated_at = NOW();
      `;
    } catch {}
  },

  async getActiveCarts() {
    try {
      await sql`UPDATE active_carts SET is_abandoned = true WHERE last_updated_at < NOW() - INTERVAL '15 minutes' AND is_abandoned = false;`;
      return await sql`SELECT * FROM active_carts ORDER BY last_updated_at DESC LIMIT 50;`;
    } catch { return []; }
  },

  async getOrders(): Promise<Order[]> {
    try {
      const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 150;`;
      return (rows as any[]).map(mapRowToOrder);
    } catch { return []; }
  },

  async getPersonalizedRecommendations(sessionId: string) {
    try {
      const activities = await sql`SELECT action_type, target_id, metadata FROM customer_activity WHERE session_id = ${sessionId} ORDER BY created_at DESC LIMIT 20;`;
      if (!activities?.length) {
        const rows = await sql`SELECT * FROM products WHERE is_active = true ORDER BY is_featured DESC, featured_order ASC NULLS LAST LIMIT 6;`;
        return { hasHistory: false, recommendedProducts: (rows as any[]).map(mapRowToProduct), searchTags: [] };
      }
      const rows = await sql`SELECT * FROM products WHERE is_active = true ORDER BY is_featured DESC, shop_order ASC LIMIT 6;`;
      return { hasHistory: true, recommendedProducts: (rows as any[]).map(mapRowToProduct), searchTags: [] };
    } catch {
      return { hasHistory: false, recommendedProducts: [], searchTags: [] };
    }
  },

  async getAllUsers() {
    try {
      return await sql`SELECT id, name, email, phone, avatar, role, provider, email_verified, addresses, created_at, admin_permissions FROM users ORDER BY created_at DESC;`;
    } catch { return []; }
  },

  async updateUserProfile(userId: string, data: any) {
    try {
      const rows = await sql`
        UPDATE users SET
          name = COALESCE(${data.name || null}, name),
          phone = COALESCE(${data.phone || null}, phone),
          avatar = COALESCE(${data.avatar || null}, avatar),
          addresses = COALESCE(${data.addresses ? JSON.stringify(data.addresses) : null}::jsonb, addresses),
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, name, email, phone, avatar, role, provider, email_verified, addresses, created_at;
      `;
      return rows[0] ? { success: true, user: rows[0] } : { success: false, error: 'لم يتم العثور على المستخدم.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getAuditLog(limit = 100) {
    try { return await sql`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ${limit};`; } catch { return []; }
  },

  async getPickingList() {
    try {
      const rows = await sql`SELECT * FROM orders WHERE status IN ('confirmed', 'processing') AND packed_at IS NULL ORDER BY created_at ASC;`;
      return (rows as any[]).map(mapRowToOrder);
    } catch { return []; }
  },

  async confirmPacking(orderId: string, _codes: string[], options?: { courierName?: string; override?: boolean; reason?: string; actor?: { id: string; name: string } }) {
    try {
      const rows = await sql`SELECT payment_method, payment_status FROM orders WHERE id = ${orderId} OR order_number = ${orderId};`;
      if (!rows.length) return { success: false, error: 'الطلب غير موجود.' };
      if (['instapay', 'vodafone_cash'].includes(rows[0].payment_method) && !['paid', 'verified'].includes(rows[0].payment_status) && !options?.override) {
        return { success: false, error: 'تأكيد التحويل الإلكتروني مطلوب قبل التجهيز والشحن.' };
      }
      await sql`
        UPDATE orders SET
          packed_at = NOW(),
          packed_by = ${options?.actor?.name || options?.actor?.id || 'فريق التجهيز'},
          courier_name = COALESCE(${options?.courierName || null}, courier_name),
          status = 'shipped',
          updated_at = NOW()
        WHERE id = ${orderId} OR order_number = ${orderId};
      `;
      await logAudit({ actorId: options?.actor?.id, actorName: options?.actor?.name, action: 'ORDER_PACKED_AND_SHIPPED', entity: 'order', entityId: orderId, reason: options?.reason });
      const updatedRows = await sql`SELECT * FROM orders WHERE id = ${orderId} OR order_number = ${orderId} LIMIT 1;`;
      if (updatedRows[0]) {
        const orderObj = mapRowToOrder(updatedRows[0]);
        const settings = await this.getStoreSettings();
        const crm = resolveCrmConfig(settings);
        if (crm.configured && crm.autoSendOnStatusChange && (orderObj.customer_whatsapp || orderObj.customer_phone)) {
          const text = buildServerOrderWhatsAppMessage('shipped', orderObj, settings);
          await dispatchWhatsAppViaCrm(sql, {
            recipient: orderObj.customer_whatsapp || orderObj.customer_phone,
            text,
            type: 'shipped',
            orderId: orderObj.id,
            orderNumber: orderObj.order_number,
            settings
          });
        }
      }
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async updateOrderStatus(orderId: string, status: string, options?: { courierName?: string; override?: boolean; overrideReason?: string; actor?: { id: string; name: string } }) {
    try {
      const rows = await sql`SELECT status FROM orders WHERE id = ${orderId} OR order_number = ${orderId};`;
      if (!rows.length) return { success: false, error: 'الطلب غير موجود.' };
      await sql`UPDATE orders SET status = ${status}, courier_name = COALESCE(${options?.courierName || null}, courier_name), updated_at = NOW() WHERE id = ${orderId} OR order_number = ${orderId};`;
      await logAudit({ actorId: options?.actor?.id, actorName: options?.actor?.name, action: 'ORDER_STATUS_CHANGED', entity: 'order', entityId: orderId, before: { status: rows[0].status }, after: { status }, reason: options?.overrideReason });
      const notifMap: Record<string, WhatsAppNotificationType> = {
        confirmed: 'order_confirmed',
        shipped: 'shipped',
        out_for_delivery: 'out_for_delivery',
        delivered: 'delivered',
        cancelled: 'cancelled'
      };
      const waType = notifMap[status];
      if (waType) {
        const updatedRows = await sql`SELECT * FROM orders WHERE id = ${orderId} OR order_number = ${orderId} LIMIT 1;`;
        if (updatedRows[0]) {
          const orderObj = mapRowToOrder(updatedRows[0]);
          const settings = await this.getStoreSettings();
          const crm = resolveCrmConfig(settings);
          if (crm.configured && crm.autoSendOnStatusChange && (orderObj.customer_whatsapp || orderObj.customer_phone)) {
            const text = buildServerOrderWhatsAppMessage(waType, orderObj, settings);
            await dispatchWhatsAppViaCrm(sql, {
              recipient: orderObj.customer_whatsapp || orderObj.customer_phone,
              text,
              type: waType,
              orderId: orderObj.id,
              orderNumber: orderObj.order_number,
              settings
            });
          }
        }
      }
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async getDeliveryBoard() {
    try {
      const rows = await sql`SELECT * FROM orders WHERE status IN ('processing', 'shipped', 'out_for_delivery') ORDER BY updated_at DESC;`;
      return (rows as any[]).map(mapRowToOrder);
    } catch { return []; }
  },

  async recordDeliveryRefusal(orderId: string, reason: string, courierName?: string, actor?: { id: string; name: string }) {
    try {
      const rows = await sql`SELECT customer_phone FROM orders WHERE id = ${orderId} OR order_number = ${orderId};`;
      if (!rows.length) return { success: false, error: 'الطلب غير موجود.' };
      await sql`
        INSERT INTO delivery_refusals (id, order_id, customer_phone, reason, courier_name, created_by)
        VALUES (${`refusal-${Date.now()}`}, ${orderId}, ${rows[0].customer_phone}, ${reason}, ${courierName || null}, ${actor?.id || null});
      `;
      await cancelStoredOrder(sql, orderId, `رفض استلام: ${reason}`, 'admin');
      await logAudit({ actorId: actor?.id, actorName: actor?.name, action: 'DELIVERY_REFUSED', entity: 'order', entityId: orderId, reason });
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async getRefusalHistory(phone: string) {
    try { return await sql`SELECT * FROM delivery_refusals WHERE customer_phone = ${phone} AND created_at > NOW() - INTERVAL '90 days' ORDER BY created_at DESC;`; } catch { return []; }
  },

  async getAllRefusals(limit = 100) {
    try { return await sql`SELECT * FROM delivery_refusals ORDER BY created_at DESC LIMIT ${limit};`; } catch { return []; }
  },

  async addSupplierQuote(productId: string, supplierName: string, price: number, actor?: { id: string }) {
    try {
      await sql`INSERT INTO supplier_quotes (id, product_id, supplier_name, quoted_price, created_by) VALUES (${`quote-${Date.now()}`}, ${productId}, ${supplierName}, ${price}, ${actor?.id || null});`;
      return true;
    } catch { return false; }
  },

  async getSupplierQuotes(productId: string) {
    try { return await sql`SELECT * FROM supplier_quotes WHERE product_id = ${productId} ORDER BY quoted_price ASC;`; } catch { return []; }
  },

  async findOrCreateSupportTicket(phone: string, name?: string, subject?: string, orderId?: string) {
    const existing = await sql`SELECT * FROM support_tickets WHERE customer_phone = ${phone} AND status IN ('open', 'pending', 'escalated') ORDER BY created_at DESC LIMIT 1;`;
    if (existing.length) return existing[0];
    const rows = await sql`
      INSERT INTO support_tickets (id, customer_phone, customer_name, order_id, subject)
      VALUES (${`ticket-${Date.now()}`}, ${phone}, ${name || null}, ${orderId || null}, ${subject || 'استفسار عميل'})
      RETURNING *;
    `;
    return rows[0];
  },

  async createSupportTicket(phone: string, message: string, name?: string, subject?: string, orderId?: string) {
    try {
      const ticket = await this.findOrCreateSupportTicket(phone, name, subject, orderId);
      if (message.trim()) {
        await sql`INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, body) VALUES (${`msg-${Date.now()}`}, ${ticket.id}, 'customer', null, ${message.trim()});`;
        await sql`UPDATE support_tickets SET status = CASE WHEN status = 'escalated' THEN status ELSE 'pending' END, updated_at = NOW() WHERE id = ${ticket.id};`;
      }
      return { success: true, ticket };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async listSupportTickets(status?: string) {
    try {
      return status
        ? await sql`SELECT * FROM support_tickets WHERE status = ${status} ORDER BY updated_at DESC LIMIT 100;`
        : await sql`SELECT * FROM support_tickets ORDER BY updated_at DESC LIMIT 100;`;
    } catch { return []; }
  },

  async getSupportTicket(ticketId: string) {
    try {
      const tickets = await sql`SELECT * FROM support_tickets WHERE id = ${ticketId};`;
      if (!tickets.length) return null;
      const messages = await sql`SELECT * FROM support_messages WHERE ticket_id = ${ticketId} ORDER BY created_at;`;
      return { ticket: tickets[0], messages };
    } catch { return null; }
  },

  async replySupportTicket(ticketId: string, senderType: 'staff' | 'customer', body: string, actor?: { id: string; name: string }) {
    try {
      if (!body.trim()) return { success: false, error: 'نص الرسالة مطلوب.' };
      await sql`INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, body) VALUES (${`msg-${Date.now()}`}, ${ticketId}, ${senderType}, ${actor?.id || null}, ${body.trim()});`;
      if (senderType === 'staff') {
        await sql`UPDATE support_tickets SET assigned_to = COALESCE(assigned_to, ${actor?.name || actor?.id || null}), status = CASE WHEN status = 'pending' THEN 'open' ELSE status END, updated_at = NOW() WHERE id = ${ticketId};`;
      } else {
        await sql`UPDATE support_tickets SET status = 'pending', updated_at = NOW() WHERE id = ${ticketId};`;
      }
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async escalateSupportTicket(ticketId: string, reason: string, actor?: { id: string; name: string }) {
    if (!reason.trim()) return { success: false, error: 'سبب التصعيد مطلوب.' };
    try {
      await sql`UPDATE support_tickets SET status = 'escalated', escalation_reason = ${reason}, updated_at = NOW() WHERE id = ${ticketId};`;
      await logAudit({ actorId: actor?.id, actorName: actor?.name, action: 'TICKET_ESCALATED', entity: 'support_ticket', entityId: ticketId, reason });
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async closeSupportTicket(ticketId: string, actor?: { id: string; name: string }) {
    try {
      await sql`UPDATE support_tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = ${ticketId};`;
      await logAudit({ actorId: actor?.id, actorName: actor?.name, action: 'TICKET_CLOSED', entity: 'support_ticket', entityId: ticketId });
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async rateSupportTicket(ticketId: string, rating: number, comment?: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { success: false, error: 'التقييم من 1 إلى 5.' };
    try {
      const rows = await sql`UPDATE support_tickets SET csat_rating = ${rating}, csat_comment = ${comment || null} WHERE id = ${ticketId} AND status = 'closed' AND csat_rating IS NULL RETURNING id;`;
      return rows.length ? { success: true } : { success: false, error: 'لا يمكن تقييم هذه المحادثة الآن.' };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  async logWishlistEvent(customerId: string, productId: string) {
    try { await sql`INSERT INTO wishlist_events (id, customer_id, product_id) VALUES (${`wish-${Date.now()}`}, ${customerId}, ${productId});`; } catch {}
  },

  async getWishlistGap(limit = 5) {
    try {
      return await sql`
        SELECT w.product_id, p.name_ar, COUNT(*)::int AS interest_count
        FROM wishlist_events w JOIN products p ON p.id = w.product_id
        WHERE p.stock_quantity <= 0 AND w.created_at > NOW() - INTERVAL '60 days'
        GROUP BY w.product_id, p.name_ar ORDER BY interest_count DESC LIMIT ${limit};
      `;
    } catch { return []; }
  },

  async getStoreSettings() {
    try {
      const rows = await sql`SELECT settings FROM store_settings WHERE id = 'main' LIMIT 1;`;
      return rows[0]?.settings || null;
    } catch { return null; }
  },

  async updateStoreSettings(newSettings: any) {
    try {
      if (!newSettings || typeof newSettings !== 'object') return { success: false, error: 'بيانات غير صالحة' };
      await sql`
        INSERT INTO store_settings (id, settings, updated_at)
        VALUES ('main', ${JSON.stringify(newSettings)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW();
      `;
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
  },

  async submitProductReview(review: any) {
    try {
      const author = String(review.author_name || '').trim();
      const comment = String(review.comment || '').trim();
      if (!review.product_id || !author || !comment) return { success: false, error: 'الاسم والتعليق والمنتج مطلوبين.' };
      const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5)));
      const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const rows = await sql`
        INSERT INTO product_reviews (id, product_id, product_name_ar, author_name, author_phone, user_id, session_id, rating, comment, images, status)
        VALUES (${id}, ${review.product_id}, ${review.product_name_ar || null}, ${author.slice(0, 100)}, ${review.author_phone || null}, ${review.user_id || null}, ${review.session_id || null}, ${rating}, ${comment.slice(0, 600)}, '[]'::jsonb, 'pending')
        RETURNING *;
      `;
      return { success: true, review: rows[0] };
    } catch (error: any) { return { success: false, error: error.message }; }
  },

  async getProductReviews(productId: string, sessionId?: string, userId?: string) {
    try {
      if (!productId) return [];
      if (sessionId || userId) {
        return await sql`
          SELECT * FROM product_reviews WHERE product_id = ${productId}
          AND (status = 'approved' OR (status = 'pending' AND ((${sessionId || null}::text IS NOT NULL AND session_id = ${sessionId || null}) OR (${userId || null}::text IS NOT NULL AND user_id = ${userId || null}))))
          ORDER BY created_at DESC;
        `;
      }
      return await sql`SELECT * FROM product_reviews WHERE product_id = ${productId} AND status = 'approved' ORDER BY created_at DESC;`;
    } catch { return []; }
  },

  async getAllProductReviews(params?: { status?: string; limit?: number }) {
    try {
      const limit = Math.min(300, Math.max(1, Number(params?.limit) || 100));
      const status = params?.status && ['pending', 'approved', 'rejected'].includes(params.status) ? params.status : null;
      const reviews = status
        ? await sql`SELECT * FROM product_reviews WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit};`
        : await sql`SELECT * FROM product_reviews ORDER BY created_at DESC LIMIT ${limit};`;
      const countsRows = await sql`
        SELECT COUNT(*)::int AS all,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
        FROM product_reviews;
      `;
      return { reviews, counts: countsRows[0] || { pending: 0, approved: 0, rejected: 0, all: 0 } };
    } catch { return { reviews: [], counts: { pending: 0, approved: 0, rejected: 0, all: 0 } }; }
  },

  async updateProductReviewStatus(reviewId: string, status: 'approved' | 'rejected', actor?: { id: string; name: string }) {
    try {
      await sql`UPDATE product_reviews SET status = ${status}, updated_at = NOW() WHERE id = ${reviewId};`;
      if (actor) await logAudit({ actorId: actor.id, actorName: actor.name, action: `REVIEW_${status.toUpperCase()}`, entity: 'product_review', entityId: reviewId });
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
  },

  async deleteProductReview(reviewId: string, actor?: { id: string; name: string }) {
    try {
      await sql`DELETE FROM product_reviews WHERE id = ${reviewId};`;
      if (actor) await logAudit({ actorId: actor.id, actorName: actor.name, action: 'REVIEW_DELETED', entity: 'product_review', entityId: reviewId });
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
  },

  // Perfume-specific ERP methods
  async getOilReserves() {
    try { return await sql`SELECT * FROM oil_reserves ORDER BY updated_at DESC, perfume_title ASC;`; } catch { return []; }
  },

  async upsertOilReserve(entry: any, actor?: { id: string }) {
    try {
      const id = entry.id || `oil-${Date.now().toString(36)}`;
      const rows = await sql`
        INSERT INTO oil_reserves (id, product_id, perfume_title, brand, oil_supplier, stock_ml, cost_per_ml, concentration_pct, maceration_days, batch_code, shelf_location, notes, updated_by, updated_at)
        VALUES (${id}, ${entry.product_id || null}, ${entry.perfume_title}, ${entry.brand || ''}, ${entry.oil_supplier || ''}, ${Number(entry.stock_ml || 0)}, ${Number(entry.cost_per_ml || 0)}, ${Number(entry.concentration_pct || 30)}, ${Number(entry.maceration_days || 14)}, ${entry.batch_code || ''}, ${entry.shelf_location || ''}, ${entry.notes || ''}, ${actor?.id || null}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          perfume_title = EXCLUDED.perfume_title,
          brand = EXCLUDED.brand,
          oil_supplier = EXCLUDED.oil_supplier,
          stock_ml = EXCLUDED.stock_ml,
          cost_per_ml = EXCLUDED.cost_per_ml,
          concentration_pct = EXCLUDED.concentration_pct,
          maceration_days = EXCLUDED.maceration_days,
          batch_code = EXCLUDED.batch_code,
          shelf_location = EXCLUDED.shelf_location,
          notes = EXCLUDED.notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *;
      `;
      return { success: true, entry: rows[0] };
    } catch (error: any) { return { success: false, error: error.message }; }
  },

  async deleteOilReserve(id: string) {
    try { await sql`DELETE FROM oil_reserves WHERE id = ${id};`; return { success: true }; } catch (e: any) { return { success: false, error: e.message }; }
  },

  async getBottleSupplies() {
    try { return await sql`SELECT * FROM bottle_supplies ORDER BY size_label ASC;`; } catch { return []; }
  },

  async updateBottleSupply(id: string, stockQty: number, costPerUnit?: number) {
    try {
      await sql`UPDATE bottle_supplies SET stock_qty = ${Math.max(0, Math.round(stockQty))}, cost_per_unit = COALESCE(${costPerUnit ?? null}, cost_per_unit), updated_at = NOW() WHERE id = ${id};`;
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  },

  async getFragranceNotes() {
    try { return await sql`SELECT * FROM fragrance_notes_catalog ORDER BY updated_at DESC;`; } catch { return []; }
  },

  async upsertFragranceNotes(entry: any, actor?: { id: string }) {
    try {
      const id = entry.id || `notes-${entry.product_id}`;
      const rows = await sql`
        INSERT INTO fragrance_notes_catalog (id, product_id, scent_family, inspired_by, concentration, gender, season, top_notes, heart_notes, base_notes, longevity_hours, sillage, updated_by, updated_at)
        VALUES (${id}, ${entry.product_id}, ${entry.scent_family || ''}, ${entry.inspired_by || ''}, ${entry.concentration || 'Extrait / EDP'}, ${entry.gender || 'unisex'}, ${entry.season || 'طوال العام'}, ${entry.top_notes || ''}, ${entry.heart_notes || ''}, ${entry.base_notes || ''}, ${entry.longevity_hours || '8-12 ساعة'}, ${entry.sillage || 'فواح'}, ${actor?.id || null}, NOW())
        ON CONFLICT (product_id) DO UPDATE SET
          scent_family = EXCLUDED.scent_family,
          inspired_by = EXCLUDED.inspired_by,
          concentration = EXCLUDED.concentration,
          gender = EXCLUDED.gender,
          season = EXCLUDED.season,
          top_notes = EXCLUDED.top_notes,
          heart_notes = EXCLUDED.heart_notes,
          base_notes = EXCLUDED.base_notes,
          longevity_hours = EXCLUDED.longevity_hours,
          sillage = EXCLUDED.sillage,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *;
      `;
      return { success: true, entry: rows[0] };
    } catch (error: any) { return { success: false, error: error.message }; }
  },

  // WhatsApp CRM Automation & Notification Logs
  async getWhatsAppAdminConfig() {
    const settings = (await this.getStoreSettings()) || {};
    const crm = resolveCrmConfig(settings);
    return {
      whatsapp_automation_url: settings.whatsapp_automation_url || crm.baseUrl || '',
      whatsapp_automation_email: settings.whatsapp_automation_email || crm.email || '',
      has_saved_password: Boolean(settings.whatsapp_automation_pass),
      using_env_fallback: !settings.whatsapp_automation_url || !settings.whatsapp_automation_email || !settings.whatsapp_automation_pass,
      env_configured: Boolean(process.env.WHATSAPP_CRM_URL && process.env.WHATSAPP_CRM_EMAIL && process.env.WHATSAPP_CRM_PASSWORD),
      auto_send_on_order: crm.autoSendOnOrder,
      auto_send_on_status_change: crm.autoSendOnStatusChange,
      whatsapp_number: settings.whatsapp_number || '201003732029',
      whatsapp_templates: { ...DEFAULT_WHATSAPP_TEMPLATES, ...(settings.whatsapp_templates || {}) }
    };
  },

  async saveWhatsAppAdminConfig(config: {
    whatsapp_automation_url?: string;
    whatsapp_automation_email?: string;
    whatsapp_automation_pass?: string;
    auto_send_on_order?: boolean;
    auto_send_on_status_change?: boolean;
    whatsapp_templates?: Record<string, string>;
  }) {
    const current = (await this.getStoreSettings()) || {};
    const merged: any = {
      ...current,
      auto_send_on_order: config.auto_send_on_order ?? current.auto_send_on_order ?? true,
      auto_send_on_status_change: config.auto_send_on_status_change ?? current.auto_send_on_status_change ?? true
    };
    if (typeof config.whatsapp_automation_url === 'string') merged.whatsapp_automation_url = config.whatsapp_automation_url.trim();
    if (typeof config.whatsapp_automation_email === 'string') merged.whatsapp_automation_email = config.whatsapp_automation_email.trim();
    if (typeof config.whatsapp_automation_pass === 'string' && config.whatsapp_automation_pass.trim()) {
      merged.whatsapp_automation_pass = config.whatsapp_automation_pass.trim();
    }
    if (config.whatsapp_templates && typeof config.whatsapp_templates === 'object') {
      merged.whatsapp_templates = { ...(current.whatsapp_templates || {}), ...config.whatsapp_templates };
    }
    return this.updateStoreSettings(merged);
  },

  async testWhatsAppConnection() {
    const settings = (await this.getStoreSettings()) || {};
    return testWhatsAppCrmConnection(settings);
  },

  async getWhatsAppNotifications(limit = 80) {
    try {
      await ensureWhatsAppNotificationsTable(sql);
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 80));
      return await sql`SELECT * FROM whatsapp_notifications ORDER BY created_at DESC LIMIT ${safeLimit};`;
    } catch {
      return [];
    }
  },

  async sendOrderWhatsApp(orderId: string, type: WhatsAppNotificationType = 'custom', customText?: string, recipientOverride?: string) {
    const rows = await sql`SELECT * FROM orders WHERE id = ${orderId} OR order_number = ${orderId} LIMIT 1;`;
    if (!rows[0]) return { success: false, error: 'الطلب غير موجود.' };
    const orderObj = mapRowToOrder(rows[0]);
    const settings = (await this.getStoreSettings()) || {};
    const recipient = recipientOverride || orderObj.customer_whatsapp || orderObj.customer_phone;
    const text = buildServerOrderWhatsAppMessage(type, orderObj, settings, customText);
    return dispatchWhatsAppViaCrm(sql, {
      recipient,
      text,
      type,
      orderId: orderObj.id,
      orderNumber: orderObj.order_number,
      settings
    });
  },

  async sendTestWhatsApp(phone: string, text: string) {
    const settings = (await this.getStoreSettings()) || {};
    return dispatchWhatsAppViaCrm(sql, {
      recipient: phone,
      text: text?.trim() || '✨ رسالة اختبارية من لوحة تحكم قمر للعطور (Qamar Fragrances)',
      type: 'custom',
      settings
    });
  }
};
