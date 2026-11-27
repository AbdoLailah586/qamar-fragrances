import React, { Suspense, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Truck, CreditCard, ShieldCheck, CheckCircle2, Navigation, MapPin, Loader2, ExternalLink, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { egyptianGovernorates } from '../data/governorates';
import { formatEGP } from '../utils/arabicNumbers';
import { coordsToGoogleMapsUrl, isGoogleMapsUrl, normalizePhone } from '../utils/deliveryAddress';
import { reverseGeocodeCoords } from '../utils/egyptLocation';
import { neonDb } from '../services/neonDb';
import type { PaymentMethod } from '../types';

const LocationPickerMap = React.lazy(() => import('../components/LocationPickerMap'));

export const Checkout: React.FC = () => {
  const { cart, cartSubtotal, settings, createOrder, navigate, sessionId, visitorAttribution } = useStore();
  const { user } = useAuth();

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerWhatsapp, setCustomerWhatsapp] = useState(user?.phone || '');
  const [governorate, setGovernorate] = useState('الدقهلية - المنصورة');
  const [city, setCity] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [locationHint, setLocationHint] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const lastAutoFillRef = useRef<{ city: string; address: string }>({ city: '', address: '' });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Early capture of guest name/phone into active_carts & visitor_sessions for CRM abandoned-cart follow-up
  useEffect(() => {
    if (user || cart.length === 0) return;
    const trimmedName = customerName.trim();
    const normalizedPhone = normalizePhone(customerPhone);
    if (!trimmedName && normalizedPhone.length < 10) return;
    const timer = window.setTimeout(() => {
      neonDb
        .syncActiveCart({
          sessionId,
          customerName: trimmedName || undefined,
          customerPhone: normalizedPhone.length >= 10 ? normalizedPhone : undefined,
          items: cart,
          subtotal: cartSubtotal,
          attribution: visitorAttribution
        })
        .catch(() => {});
    }, 650);
    return () => window.clearTimeout(timer);
  }, [user, cart, cartSubtotal, customerName, customerPhone, sessionId, visitorAttribution]);

  const applyCoordinates = async (lat: number, lng: number, source: 'gps' | 'map') => {
    const cleanLat = Number(lat.toFixed(6));
    const cleanLng = Number(lng.toFixed(6));
    setLatitude(cleanLat);
    setLongitude(cleanLng);
    setGoogleMapsUrl(coordsToGoogleMapsUrl(cleanLat, cleanLng));
    setLocationHint({
      tone: 'ok',
      text: source === 'gps' ? '✓ تم التقاط موقعك عبر GPS وجاري قراءة العنوان...' : '✓ تم تثبيت الدبوس على الخريطة بنجاح.'
    });

    const geo = await reverseGeocodeCoords(cleanLat, cleanLng);
    if (geo.governorate) setGovernorate(geo.governorate);
    if (geo.city) {
      const prevAutoCity = lastAutoFillRef.current.city;
      setCity(prev => (!prev.trim() || prev === prevAutoCity ? geo.city! : prev));
      lastAutoFillRef.current.city = geo.city;
    }
    if (geo.address_details) {
      const prevAutoAddr = lastAutoFillRef.current.address;
      setAddressDetails(prev => (!prev.trim() || prev === prevAutoAddr ? geo.address_details! : prev));
      lastAutoFillRef.current.address = geo.address_details;
    }
    setLocationHint({
      tone: 'ok',
      text: source === 'gps'
        ? '✓ تم تحديد موقعك تلقائياً وتحديث بيانات التوصيل.'
        : '✓ تم تحديد موقع التوصيل يدوياً من الخريطة.'
    });
  };

  const handleAutoGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationHint({ tone: 'err', text: 'المتصفح لا يدعم تحديد الموقع التلقائي. يمكنك تحديد موقعك يدوياً من الخريطة.' });
      setShowMapPicker(true);
      return;
    }
    setLocatingGps(true);
    setLocationHint(null);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setShowMapPicker(true);
        await applyCoordinates(pos.coords.latitude, pos.coords.longitude, 'gps');
        setLocatingGps(false);
      },
      err => {
        setLocatingGps(false);
        setShowMapPicker(true);
        setLocationHint({
          tone: 'err',
          text:
            err?.code === 1
              ? 'تم رفض إذن الوصول للموقع. يمكنك تفعيل GPS من إعدادات المتصفح أو الضغط على الخريطة لتحديد مكانك يدوياً.'
              : 'تعذر قراءة موقعك تلقائياً الآن. حدد مكانك يدوياً بالضغط على الخريطة بالأسفل.'
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleClearLocation = () => {
    setLatitude(undefined);
    setLongitude(undefined);
    setGoogleMapsUrl('');
    setLocationHint(null);
  };

  const selectedGov = egyptianGovernorates.find(g => g.name_ar === governorate) || egyptianGovernorates[0];
  const freeThreshold = settings.free_shipping_threshold || 1500;
  const shippingFee = cartSubtotal >= freeThreshold ? 0 : (selectedGov?.shipping_fee ?? settings.shipping_fee ?? 60);
  const total = cartSubtotal + shippingFee;

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">سلتك فارغة. أضف عطور أولاً لإتمام الطلب.</p>
        <button type="button" onClick={() => navigate('shop', { category: 'all', search: '' })}
          className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm">
          تصفح العطور
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const phone = normalizePhone(customerPhone);
    if (phone.length !== 11) {
      setError('أدخل رقم هاتف مصري صحيح مكون من 11 رقم.');
      return;
    }
    if (!customerName.trim() || !addressDetails.trim()) {
      setError('الاسم والعنوان بالتفصيل مطلوبان.');
      return;
    }
    if (googleMapsUrl.trim() && !isGoogleMapsUrl(googleMapsUrl)) {
      setError('أدخل رابط خرائط جوجل (Google Maps) صحيح يبدأ بـ https:// أو حدد الموقع من الخريطة.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createOrder({
        customer_name: customerName.trim(),
        customer_phone: phone,
        customer_whatsapp: normalizePhone(customerWhatsapp) || phone,
        customer_email: user?.email,
        governorate,
        city: city.trim(),
        address_details: addressDetails.trim(),
        notes: notes.trim(),
        google_maps_url: googleMapsUrl.trim() || undefined,
        latitude,
        longitude,
        items: cart,
        subtotal: cartSubtotal,
        shipping_fee: shippingFee,
        discount: 0,
        total,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || undefined
      });
      if (created.checkout_url && typeof window !== 'undefined') {
        window.location.assign(created.checkout_url);
        return;
      }
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      navigate('order-success');
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-[1150px] mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl font-extrabold text-[#252a31] mb-6">إتمام الطلب والدفع</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-base text-[#252a31] flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#fe9931]" />
              <span>بيانات التوصيل</span>
            </h2>

            {user?.addresses && user.addresses.length > 0 && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-gray-500">اختر من عناوينك المحفوظة:</p>
                <div className="flex flex-wrap gap-2">
                  {user.addresses.map(addr => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setGovernorate(addr.governorate || 'الدقهلية - المنصورة');
                        setCity(addr.city || '');
                        setAddressDetails(addr.address_details || addr.details || '');
                        setGoogleMapsUrl(addr.google_maps_url || '');
                        setLatitude(addr.latitude);
                        setLongitude(addr.longitude);
                      }}
                      className="px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-[#fe9931] text-xs font-bold text-[#252a31] transition-colors"
                    >
                      {addr.title || addr.governorate}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكامل</label>
                <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف</label>
                <input type="tel" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="01xxxxxxxxx"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المحافظة</label>
                <select value={governorate} onChange={e => setGovernorate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#fe9931]">
                  {egyptianGovernorates.map(g => (
                    <option key={g.name_ar} value={g.name_ar}>
                      {g.name_ar} ({g.shipping_fee} ج.م — {g.eta_days})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المدينة / المركز</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-[#fff9f2] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-xs font-extrabold text-[#252a31] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#fe9931]" />
                    <span>تحديد موقع التوصيل بدقة (GPS أو الخريطة)</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    حدد موقعك الحالي بضغطة زر أو اختر مكانك يدوياً من الخريطة لتسهيل وصول المندوب.
                  </p>
                </div>
                {(googleMapsUrl || (latitude !== undefined && longitude !== undefined)) && (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="text-[11px] font-bold text-gray-500 hover:text-red-600 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200"
                  >
                    <X className="w-3 h-3" /> مسح الموقع
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="btn-auto-gps"
                  onClick={handleAutoGps}
                  disabled={locatingGps}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#fe9931] hover:bg-[#e88520] disabled:opacity-70 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {locatingGps ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  <span>{locatingGps ? 'جاري تحديد موقعك...' : 'تحديد موقعي تلقائياً (GPS)'}</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-manual-map"
                  onClick={() => setShowMapPicker(prev => !prev)}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    showMapPicker
                      ? 'bg-[#252a31] text-white border-[#252a31]'
                      : 'bg-white text-[#252a31] border-gray-300 hover:border-[#fe9931]'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-[#fe9931]" />
                  <span>{showMapPicker ? 'إخفاء الخريطة التفاعلية' : 'تحديد الموقع يدوياً من الخريطة'}</span>
                </button>
              </div>

              {locationHint && (
                <div
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                    locationHint.tone === 'ok'
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {locationHint.text}
                </div>
              )}

              {showMapPicker && (
                <Suspense
                  fallback={
                    <div className="h-64 sm:h-72 rounded-2xl border border-orange-200 bg-white flex flex-col items-center justify-center gap-2 text-xs font-bold text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin text-[#fe9931]" />
                      <span>جاري تحميل الخريطة التفاعلية...</span>
                    </div>
                  }
                >
                  <LocationPickerMap
                    governorate={governorate}
                    latitude={latitude}
                    longitude={longitude}
                    onSelectCoords={(lat, lng) => {
                      void applyCoordinates(lat, lng, 'map');
                    }}
                  />
                </Suspense>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                  <label className="text-[11px] font-bold text-gray-600">رابط الموقع على خرائط جوجل</label>
                  {googleMapsUrl && isGoogleMapsUrl(googleMapsUrl) && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 whitespace-nowrap text-[11px] font-bold text-[#fe9931] hover:underline inline-flex items-center gap-1"
                    >
                      <span>معاينة الموقع</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  dir="ltr"
                  data-testid="input-google-maps-url"
                  value={googleMapsUrl}
                  onChange={e => {
                    setGoogleMapsUrl(e.target.value);
                    setLatitude(undefined);
                    setLongitude(undefined);
                  }}
                  placeholder="https://www.google.com/maps?q=..."
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs bg-white focus:outline-none ${
                    googleMapsUrl && !isGoogleMapsUrl(googleMapsUrl)
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-200 focus:border-[#fe9931]'
                  }`}
                />
                {googleMapsUrl && !isGoogleMapsUrl(googleMapsUrl) && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1">
                    يرجى إدخال رابط خرائط جوجل (Google Maps) صحيح يبدأ بـ https://
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">العنوان بالتفصيل</label>
              <input type="text" required value={addressDetails} onChange={e => setAddressDetails(e.target.value)}
                placeholder="اسم الشارع، رقم العمارة، الدور، علامة مميزة"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم واتساب (اختياري)</label>
                <input type="tel" value={customerWhatsapp} onChange={e => setCustomerWhatsapp(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات للبائع / التغليف</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="تغليف هدية أو ملاحظات التوصيل"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-base text-[#252a31] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#fe9931]" />
                <span>طريقة الدفع</span>
              </h2>
              {settings.payment_gateway_public?.configured && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                  دفع إلكتروني مؤمّن عبر {settings.payment_gateway_public.provider === 'paymob' ? 'Paymob' : 'Kashier'}
                </span>
              )}
            </div>

            {(() => {
              const gwMethods = settings.payment_gateway_public?.methods || { card: false, wallet: false, instapay: false };
              const gwName = settings.payment_gateway_public?.provider === 'paymob' ? 'Paymob' : 'Kashier';
              const options: Array<{
                id: PaymentMethod;
                title: string;
                sub: string;
                badge?: string;
                disabled?: boolean;
              }> = [
                { id: 'cod', title: 'الدفع عند الاستلام', sub: 'معاينة الطلب عند الاستلام' },
                {
                  id: 'card',
                  title: 'بطاقة بنكية (Visa / Mastercard / ميزة)',
                  sub: gwMethods.card
                    ? `دفع إلكتروني آمن مباشرة عبر ${gwName}`
                    : 'قريباً — جاهز للتفعيل فور ربط بوابة الدفع',
                  badge: gwMethods.card ? 'فوري أونلاين' : 'قريباً',
                  disabled: !gwMethods.card
                },
                {
                  id: 'vodafone_cash',
                  title: 'فودافون كاش / محافظ إلكترونية',
                  sub: gwMethods.wallet
                    ? `تحصيل فوري أونلاين عبر ${gwName}`
                    : `تحويل يدوي على ${settings.whatsapp_number || '01003732029'}`,
                  badge: gwMethods.wallet ? 'تأكيد تلقائي' : undefined
                },
                {
                  id: 'instapay',
                  title: 'إنستاباي (InstaPay)',
                  sub: gwMethods.instapay
                    ? `تحصيل فوري أونلاين عبر ${gwName}`
                    : `تحويل فوري على ${settings.phone || '01003732029'}`,
                  badge: gwMethods.instapay ? 'تأكيد تلقائي' : undefined
                }
              ];

              const showManualRef =
                (paymentMethod === 'vodafone_cash' && !gwMethods.wallet) ||
                (paymentMethod === 'instapay' && !gwMethods.instapay);
              const redirectOnline =
                (paymentMethod === 'card' && gwMethods.card) ||
                (paymentMethod === 'vodafone_cash' && gwMethods.wallet) ||
                (paymentMethod === 'instapay' && gwMethods.instapay);

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {options.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={m.disabled}
                        onClick={() => !m.disabled && setPaymentMethod(m.id)}
                        className={`p-3.5 rounded-xl border text-right transition ${
                          m.disabled
                            ? 'border-gray-200 bg-gray-50 opacity-65 cursor-not-allowed'
                            : paymentMethod === m.id
                              ? 'border-[#fe9931] bg-[#fe9931]/5 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-bold text-sm text-[#252a31] flex items-center justify-between gap-2">
                          <span>{m.title}</span>
                          {m.badge ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                m.disabled ? 'bg-gray-200 text-gray-600' : 'bg-[#fe9931]/15 text-[#fe9931]'
                              }`}
                            >
                              {m.badge}
                            </span>
                          ) : (
                            paymentMethod === m.id && <CheckCircle2 className="w-4 h-4 text-[#fe9931] shrink-0" />
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{m.sub}</p>
                      </button>
                    ))}
                  </div>

                  {redirectOnline && (
                    <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 font-semibold">
                      سيتم تحويلك إلى صفحة الدفع المؤمّنة الخاصة بـ {gwName} لإدخال بيانات البطاقة أو إتمام الدفع وتأكيد طلبك تلقائياً.
                    </div>
                  )}

                  {showManualRef && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">رقم المرجع / الرقم المحول منه</label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={e => setPaymentReference(e.target.value)}
                        placeholder="أدخل رقم العملية أو الرقم المحول منه"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 space-y-4 sticky top-24">
          <h2 className="font-bold text-lg text-[#252a31]">ملخص طلبك</h2>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {cart.map(item => (
              <div key={`${item.product.id}-${item.selectedSize || ''}`} className="py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#252a31] truncate">{item.product.name_ar}</p>
                  <p className="text-xs text-gray-500">{item.selectedSize} × {item.quantity}</p>
                </div>
                <span className="font-bold text-[#252a31] shrink-0">{formatEGP(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-bold">{formatEGP(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">مصاريف الشحن ({selectedGov?.name_ar})</span>
              <span className="font-bold">{shippingFee === 0 ? 'شحن مجاني' : formatEGP(shippingFee)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-[#252a31] pt-2 border-t border-gray-100">
              <span>الإجمالي</span>
              <span className="text-[#fe9931]">{formatEGP(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm transition disabled:opacity-60"
          >
            {submitting ? 'جاري تأكيد الطلب...' : 'تأكيد وإرسال الطلب'}
          </button>

          <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#fe9931]" />
            <span>يتم التحقق من الأسعار وتوافر المخزون تلقائياً لحظة التأكيد</span>
          </p>
        </div>
      </form>
    </main>
  );
};
