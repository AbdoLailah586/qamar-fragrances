export interface DeliveryNoteFields {
  city?: string;
  address_details?: string;
  notes?: string;
  customer_whatsapp?: string;
}

export function normalizePhone(raw: string): string {
  const digits = String(raw || '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  if (digits.startsWith('201') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.startsWith('00201') && digits.length === 14) return '0' + digits.slice(4);
  return digits;
}

export function encodeDeliveryNotes(data: DeliveryNoteFields): string {
  return JSON.stringify({
    city: data.city || '',
    address_details: data.address_details || '',
    notes: data.notes || '',
    customer_whatsapp: data.customer_whatsapp || ''
  });
}

export function decodeDeliveryNotes(raw: unknown): DeliveryNoteFields {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  return { notes: raw };
}

export function formatDeliveryAddress(data: { governorate?: string; city?: string; address_details?: string }): string {
  return [data.governorate, data.city, data.address_details].filter(Boolean).join(' - ');
}
