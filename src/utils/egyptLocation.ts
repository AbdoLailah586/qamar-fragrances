import { egyptianGovernorates } from '../data/governorates';

export const GOVERNORATE_COORDS: Record<string, [number, number]> = {
  'الدقهلية - المنصورة': [31.0409, 31.3785],
  'القاهرة': [30.0444, 31.2357],
  'الجيزة': [30.0131, 31.2089],
  'الإسكندرية': [31.2001, 29.9187],
  'الشرقية': [30.5877, 31.502],
  'الغربية': [30.7865, 31.0004],
  'المنوفية': [30.5972, 30.9876],
  'القليوبية': [30.466, 31.1848],
  'كفر الشيخ': [31.1107, 30.9388],
  'دمياط': [31.4175, 31.8144],
  'بورسعيد': [31.2653, 32.3019],
  'الإسماعيلية': [30.5965, 32.2715],
  'السويس': [29.9668, 32.5498],
  'البحيرة': [31.0409, 30.4699],
  'الفيوم': [29.3084, 30.8428],
  'بني سويف': [29.0661, 31.0994],
  'المنيا': [28.1099, 30.7503],
  'أسيوط': [27.1783, 31.1859],
  'سوهاج': [26.559, 31.6957],
  'قنا': [26.1551, 32.716],
  'الأقصر': [25.6872, 32.6396],
  'أسوان': [24.0889, 32.8998],
  'البحر الأحمر': [27.2579, 33.8116],
  'مطروح': [31.3543, 27.2373],
  'جنوب سيناء': [27.9158, 34.3299],
  'شمال سيناء': [31.1321, 33.8033],
  'الوادي الجديد': [25.4474, 30.546]
};

const GOVERNORATE_KEYWORDS: Array<{ keys: string[]; name_ar: string }> = [
  { keys: ['دقهلية', 'منصور', 'dakahlia', 'mansoura', 'talkha'], name_ar: 'الدقهلية - المنصورة' },
  { keys: ['قاهرة', 'cairo'], name_ar: 'القاهرة' },
  { keys: ['جيزة', 'giza'], name_ar: 'الجيزة' },
  { keys: ['إسكندرية', 'اسكندرية', 'alexandria'], name_ar: 'الإسكندرية' },
  { keys: ['شرقية', 'زقازيق', 'sharqia', 'zagazig'], name_ar: 'الشرقية' },
  { keys: ['غربية', 'طنطا', 'gharbia', 'tanta'], name_ar: 'الغربية' },
  { keys: ['منوفية', 'شبين الكوم', 'monufia', 'menofia'], name_ar: 'المنوفية' },
  { keys: ['قليوبية', 'بنها', 'qalyubia'], name_ar: 'القليوبية' },
  { keys: ['كفر الشيخ', 'kafr el-sheikh', 'kafr el sheikh'], name_ar: 'كفر الشيخ' },
  { keys: ['دمياط', 'damietta'], name_ar: 'دمياط' },
  { keys: ['بورسعيد', 'port said'], name_ar: 'بورسعيد' },
  { keys: ['إسماعيلية', 'اسماعيلية', 'ismailia'], name_ar: 'الإسماعيلية' },
  { keys: ['سويس', 'suez'], name_ar: 'السويس' },
  { keys: ['بحيرة', 'دمنهور', 'beheira'], name_ar: 'البحيرة' },
  { keys: ['فيوم', 'faiyum', 'fayoum'], name_ar: 'الفيوم' },
  { keys: ['بني سويف', 'beni suef'], name_ar: 'بني سويف' },
  { keys: ['منيا', 'minya'], name_ar: 'المنيا' },
  { keys: ['أسيوط', 'اسيوط', 'asyut', 'assiut'], name_ar: 'أسيوط' },
  { keys: ['سوهاج', 'sohag'], name_ar: 'سوهاج' },
  { keys: ['قنا', 'qena'], name_ar: 'قنا' },
  { keys: ['أقصر', 'اقصر', 'luxor'], name_ar: 'الأقصر' },
  { keys: ['أسوان', 'اسوان', 'aswan'], name_ar: 'أسوان' },
  { keys: ['بحر الأحمر', 'بحر احمر', 'غردقة', 'red sea', 'hurghada'], name_ar: 'البحر الأحمر' },
  { keys: ['مطروح', 'matrouh', 'matruh'], name_ar: 'مطروح' },
  { keys: ['جنوب سيناء', 'شرم الشيخ', 'south sinai'], name_ar: 'جنوب سيناء' },
  { keys: ['شمال سيناء', 'العريش', 'north sinai'], name_ar: 'شمال سيناء' },
  { keys: ['وادي الجديد', 'new valley'], name_ar: 'الوادي الجديد' }
];

export interface ReverseGeocodeResult {
  governorate?: string;
  city?: string;
  address_details?: string;
  display_name?: string;
}

/** Match Nominatim governorate/state text to an official Qamar governorate rate entry. */
export function matchGovernorateFromText(rawText: string): string | undefined {
  const normalized = String(rawText || '').toLowerCase();
  const hit = GOVERNORATE_KEYWORDS.find(entry => entry.keys.some(k => normalized.includes(k)));
  if (!hit) return undefined;
  return egyptianGovernorates.some(g => g.name_ar === hit.name_ar) ? hit.name_ar : undefined;
}

/** Reverse-geocode coordinates via OpenStreetMap Nominatim (Arabic labels, silent fallback on failure). */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return {};
    const data = await res.json();
    const addr = data?.address || {};
    const govCandidate = [addr.state, addr.region, addr.county, addr.city, data?.display_name].filter(Boolean).join(' ');
    const governorate = matchGovernorateFromText(govCandidate);
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.city_district || '';
    const streetParts = [addr.road || addr.pedestrian || addr.residential, addr.house_number, addr.neighbourhood || addr.quarter]
      .filter(Boolean)
      .join(' — ');
    return {
      governorate,
      city: String(city || ''),
      address_details:
        streetParts ||
        (typeof data?.display_name === 'string'
          ? data.display_name.split('،').slice(0, 3).join(' - ').trim()
          : ''),
      display_name: data?.display_name
    };
  } catch {
    return {};
  }
}
