const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(input: string | number): string {
  return String(input).replace(/\d/g, d => ARABIC_DIGITS[Number(d)]);
}

export function formatEGP(amount: number, useArabicDigits = true): string {
  const num = Number.isFinite(amount) ? Math.round(amount) : 0;
  const formatted = num.toLocaleString('en-US');
  const display = useArabicDigits ? toArabicDigits(formatted) : formatted;
  return `${display} ج.م.`;
}
