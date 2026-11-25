export interface GovernorateRate {
  name_ar: string;
  name_en: string;
  shipping_fee: number;
  eta_days: string;
}

export const egyptianGovernorates: GovernorateRate[] = [
  { name_ar: 'الدقهلية - المنصورة', name_en: 'Dakahlia - Mansoura', shipping_fee: 45, eta_days: '1-2 يوم' },
  { name_ar: 'القاهرة', name_en: 'Cairo', shipping_fee: 60, eta_days: '2-3 أيام' },
  { name_ar: 'الجيزة', name_en: 'Giza', shipping_fee: 60, eta_days: '2-3 أيام' },
  { name_ar: 'الإسكندرية', name_en: 'Alexandria', shipping_fee: 65, eta_days: '2-4 أيام' },
  { name_ar: 'الشرقية', name_en: 'Sharqia', shipping_fee: 60, eta_days: '2-3 أيام' },
  { name_ar: 'الغربية', name_en: 'Gharbia', shipping_fee: 60, eta_days: '2-3 أيام' },
  { name_ar: 'المنوفية', name_en: 'Monufia', shipping_fee: 60, eta_days: '2-3 أيام' },
  { name_ar: 'القليوبية', name_en: 'Qalyubia', shipping_fee: 60, eta_days: '2-3 أيام' },
  { name_ar: 'كفر الشيخ', name_en: 'Kafr El Sheikh', shipping_fee: 60, eta_days: '2-3 أيام' },
  { name_ar: 'دمياط', name_en: 'Damietta', shipping_fee: 55, eta_days: '1-3 أيام' },
  { name_ar: 'بورسعيد', name_en: 'Port Said', shipping_fee: 65, eta_days: '2-4 أيام' },
  { name_ar: 'الإسماعيلية', name_en: 'Ismailia', shipping_fee: 65, eta_days: '2-4 أيام' },
  { name_ar: 'السويس', name_en: 'Suez', shipping_fee: 65, eta_days: '2-4 أيام' },
  { name_ar: 'البحيرة', name_en: 'Beheira', shipping_fee: 65, eta_days: '2-4 أيام' },
  { name_ar: 'الفيوم', name_en: 'Faiyum', shipping_fee: 70, eta_days: '3-4 أيام' },
  { name_ar: 'بني سويف', name_en: 'Beni Suef', shipping_fee: 70, eta_days: '3-4 أيام' },
  { name_ar: 'المنيا', name_en: 'Minya', shipping_fee: 75, eta_days: '3-5 أيام' },
  { name_ar: 'أسيوط', name_en: 'Asyut', shipping_fee: 75, eta_days: '3-5 أيام' },
  { name_ar: 'سوهاج', name_en: 'Sohag', shipping_fee: 80, eta_days: '3-5 أيام' },
  { name_ar: 'قنا', name_en: 'Qena', shipping_fee: 85, eta_days: '4-5 أيام' },
  { name_ar: 'الأقصر', name_en: 'Luxor', shipping_fee: 85, eta_days: '4-5 أيام' },
  { name_ar: 'أسوان', name_en: 'Aswan', shipping_fee: 90, eta_days: '4-6 أيام' },
  { name_ar: 'البحر الأحمر', name_en: 'Red Sea', shipping_fee: 90, eta_days: '4-6 أيام' },
  { name_ar: 'مطروح', name_en: 'Matrouh', shipping_fee: 90, eta_days: '4-6 أيام' },
  { name_ar: 'جنوب سيناء', name_en: 'South Sinai', shipping_fee: 95, eta_days: '4-6 أيام' },
  { name_ar: 'شمال سيناء', name_en: 'North Sinai', shipping_fee: 95, eta_days: '4-6 أيام' },
  { name_ar: 'الوادي الجديد', name_en: 'New Valley', shipping_fee: 95, eta_days: '5-7 أيام' }
];
