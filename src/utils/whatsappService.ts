import type { Order } from '../types';

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
    ``,
    `🛍️ *العطور المطلوبة:*`,
    lines,
    ``,
    `🚚 الشحن: ${order.shipping_fee} ج.م.`,
    `💰 *الإجمالي: ${order.total} ج.م.*`,
    `💳 طريقة الدفع: ${order.payment_method === 'cod' ? 'الدفع عند الاستلام' : order.payment_method}`
  ].join('\n');
}

export function whatsappUrl(phone = '201003732029', text?: string): string {
  const clean = phone.replace(/\D/g, '');
  const base = `https://api.whatsapp.com/send?phone=${clean}`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}
