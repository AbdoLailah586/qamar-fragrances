export interface DeliveryNoteFields {
  city?: string;
  address_details?: string;
  notes?: string;
  customer_whatsapp?: string;
  google_maps_url?: string;
  latitude?: number;
  longitude?: number;
}

export function normalizePhone(raw: string): string {
  const digits = String(raw || '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  if (digits.startsWith('201') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.startsWith('00201') && digits.length === 14) return '0' + digits.slice(4);
  return digits;
}

export function coordsToGoogleMapsUrl(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function isGoogleMapsUrl(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'www.google.com' ||
      host === 'google.com' ||
      host === 'maps.google.com' ||
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && parsed.pathname.startsWith('/maps'))
    );
  } catch {
    return false;
  }
}

export function sanitizeGoogleMapsUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return isGoogleMapsUrl(trimmed) ? trimmed : '';
}

export function encodeDeliveryNotes(data: DeliveryNoteFields): string {
  const lat =
    typeof data.latitude === 'number' && Number.isFinite(data.latitude)
      ? Number(data.latitude.toFixed(6))
      : undefined;
  const lng =
    typeof data.longitude === 'number' && Number.isFinite(data.longitude)
      ? Number(data.longitude.toFixed(6))
      : undefined;
  const mapsUrl =
    sanitizeGoogleMapsUrl(data.google_maps_url) ||
    (lat !== undefined && lng !== undefined ? coordsToGoogleMapsUrl(lat, lng) : '');

  return JSON.stringify({
    city: data.city || '',
    address_details: data.address_details || '',
    notes: data.notes || '',
    customer_whatsapp: data.customer_whatsapp || '',
    ...(mapsUrl ? { google_maps_url: mapsUrl } : {}),
    ...(lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : {})
  });
}

export function decodeDeliveryNotes(raw: unknown): DeliveryNoteFields {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as DeliveryNoteFields;
      return {
        ...obj,
        google_maps_url: sanitizeGoogleMapsUrl(obj.google_maps_url) || undefined
      };
    }
  } catch {}
  return { notes: raw };
}

export function formatDeliveryAddress(data: { governorate?: string; city?: string; address_details?: string }): string {
  return [data.governorate, data.city, data.address_details].filter(Boolean).join(' - ');
}
