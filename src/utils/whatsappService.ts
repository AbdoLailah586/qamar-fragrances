import type { Order, StoreSettings, WhatsAppNotificationType } from '../types';
import { normalizePhone } from './deliveryAddress';

export function buildQamarOrderWhatsAppMessage(order: Order): string {
  const lines = order.items
    .map(i => `• ${i.product.name_ar}${i.selectedSize ? ` (${i.selectedSize})` : ''} × ${i.quantity} = ${Math.round(i.unitPrice * i.quantity)} ج.م.`)
    .join('\n');
  return [
    `✨ *طلب جديد من متجر قمر للعطور (Qamar Fragrances)*`,
    `🔖 رقم الطلب: *${order.order_number}*`,
    `👤 العميل: ${order.customer_name}`,
    `📞 الهاتف: ${order.customer_phone}`,
    `📍 العنوان: ${order.governorate}${order.city ? ` - ${order.city}` : ''} - ${order.address_details}`,
    ...(order.google_maps_url ? [`🗺️ موقع الخريطة: ${order.google_maps_url}`] : []),
    ``,
    `🛍️ *العطور المطلوبة:*`,
    lines,
    ``,
    `🚚 الشحن: ${order.shipping_fee} ج.م.`,
    `💰 *الإجمالي: ${order.total} ج.م.*`,
    `💳 طريقة الدفع: ${order.payment_method === 'cod' ? 'الدفع عند الاستلام' : order.payment_method}`
  ].join('\n');
}

export function buildQamarCustomerMessage(
  type: WhatsAppNotificationType,
  order: Order,
  settings?: Partial<StoreSettings> | null
): string {
  const itemsText = order.items
    .map((item, idx) => {
      const size = item.selectedSize ? ` (${item.selectedSize})` : '';
      return `${idx + 1}. ${item.product.name_ar}${size} × ${item.quantity} = ${Math.round(item.unitPrice * item.quantity)} ج.م.`;
    })
    .join('\n');

  const paymentLabel =
    order.payment_method === 'cod'
      ? 'الدفع عند الاستلام'
      : order.payment_method === 'instapay'
        ? 'إنستاباي InstaPay'
        : order.payment_method === 'vodafone_cash'
          ? 'فودافون كاش'
          : 'بطاقة بنكية';

  const codDue =
    order.payment_status === 'paid' || order.payment_status === 'verified'
      ? '0 ج.م. (مدفوع مسبقاً)'
      : `${Math.round(order.total)} ج.م.`;

  const customTemplate = settings?.whatsapp_templates?.[type as keyof typeof settings.whatsapp_templates];
  if (customTemplate && customTemplate.trim()) {
    const address = [order.governorate, order.city, order.address_details].filter(Boolean).join(' - ');
    const map: Record<string, string> = {
      customer_name: order.customer_name || 'عميلنا العزيز',
      order_number: order.order_number || order.id,
      items: itemsText,
      shipping_fee: String(Math.round(order.shipping_fee || 0)),
      subtotal: String(Math.round(order.subtotal || 0)),
      total: String(Math.round(order.total || 0)),
      payment_method: paymentLabel,
      cod_due: codDue,
      governorate: order.governorate || '',
      address,
      maps_url: order.google_maps_url || '',
      courier_name: order.courier_name || 'مندوب شحن قمر للعطور'
    };
    return customTemplate.replace(/\{([a-z0-9_]+)\}/gi, (_, k) => map[k] ?? '');
  }

  if (type === 'payment_verified') {
    return [
      `*تم تأكيد الدفع بنجاح - قمر للعطور* 💳✅`,
      ``,
      `عزيزنا *${order.customer_name}*،`,
      `تم مراجعة وتأكيد الدفع لطلبك رقم *#${order.order_number}* بمبلغ *${Math.round(order.total)} ج.م.* بنجاح.`,
      `جاري الآن تجهيز وتغليف عطورك لتسليمها لشركة الشحن.`
    ].join('\n');
  }
  if (type === 'shipped') {
    return [
      `*شحنتك في الطريق إليك - قمر للعطور* 🚚✨`,
      ``,
      `عزيزنا *${order.customer_name}*،`,
      `تم تسليم طلبك رقم *#${order.order_number}* إلى: *${order.courier_name || 'مندوب شحن قمر للعطور'}*.`,
      `📍 العنوان: ${order.governorate}`,
      ...(order.google_maps_url ? [`🗺️ موقع الخريطة: ${order.google_maps_url}`] : []),
      `💰 المطلوب عند الاستلام: ${codDue}`,
      ``,
      `يرجى إبقاء هاتفك متاحاً للرد على المندوب.`
    ].join('\n');
  }
  if (type === 'out_for_delivery') {
    return [
      `*مندوب التوصيل في طريقه إليك اليوم - قمر للعطور* 📦🛵`,
      ``,
      `عزيزنا *${order.customer_name}*،`,
      `طلبك رقم *#${order.order_number}* مع المندوب الآن وسيصلك اليوم بإذن الله.`,
      `💰 المطلوب عند الاستلام: *${codDue}*`
    ].join('\n');
  }
  if (type === 'delivered') {
    return [
      `*تم تسليم طلبك بنجاح - قمر للعطور* 🌸🖤`,
      ``,
      `تتهنى بعطورك يا *${order.customer_name}*!`,
      `يسعدنا إتمام تسليم طلبك رقم *#${order.order_number}*.`,
      `نتمنى لك ثباتاً وفوحاناً يدوم مع كل حضور ✨`
    ].join('\n');
  }
  if (type === 'cancelled') {
    return [
      `*تحديث بخصوص طلبك #${order.order_number} - قمر للعطور*`,
      ``,
      `عزيزنا *${order.customer_name}*،`,
      `تم إلغاء الطلب رقم *#${order.order_number}*. لأي استفسار أو إعادة طلب يسعدنا الرد عليك هنا.`
    ].join('\n');
  }
  if (type === 'review_request') {
    return [
      `⭐ *كيف كانت تجربتك مع قمر للعطور (Qamar Fragrances)؟*`,
      ``,
      `عزيزنا *${order.customer_name}*،`,
      `نتمنى أن تكون عطور طلبك *#${order.order_number}* قد نالت إعجابك بثباتها وجودتها!`,
      `رأيك يهمنا جداً — يسعدنا تقييمك بالرد على هذه الرسالة ❤️🌸`
    ].join('\n');
  }

  return [
    `*أهلاً بك يا ${order.customer_name} في قمر للعطور | Qamar Fragrances* ✨`,
    ``,
    `تم استلام طلبك رقم *#${order.order_number}* بنجاح وجاري مراجعته وتجهيزه لك بعناية.`,
    ``,
    `🛍️ *تفاصيل العطور:*`,
    itemsText,
    ``,
    `🚚 الشحن (${order.governorate}): *${Math.round(order.shipping_fee)} ج.م.*`,
    `💰 *الإجمالي النهائي:* *${Math.round(order.total)} ج.م.* (${paymentLabel})`,
    `📍 العنوان: ${[order.governorate, order.city, order.address_details].filter(Boolean).join(' - ')}`,
    ...(order.google_maps_url ? [`🗺️ موقع الخريطة: ${order.google_maps_url}`] : []),
    ``,
    `سيصلك إشعار فور شحن الطلب مع المندوب. شرفنا تواصلك!`
  ].join('\n');
}

export function formatWhatsAppRecipient(phone = '201003732029'): string {
  const local = normalizePhone(phone);
  if (/^01[0-9]{9}$/.test(local)) return `2${local}`;
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

export function whatsappUrl(phone = '201003732029', text?: string): string {
  const clean = formatWhatsAppRecipient(phone);
  const base = `https://api.whatsapp.com/send?phone=${clean}`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}
