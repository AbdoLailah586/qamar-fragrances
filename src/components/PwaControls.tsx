import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download, WifiOff, X, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { pwaSnapshot, subscribePwa, promptInstall, applyPwaUpdate } from '../services/pwa';
import { deviceIsOnline } from '../services/offlineCatalog';
import { readStorage, writeStorage } from '../utils/browserStorage';

const usePwa = () => useSyncExternalStore(subscribePwa, pwaSnapshot, pwaSnapshot);

export const InstallAppButton: React.FC<{
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ compact = false, className = '', children }) => {
  const state = usePwa();
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (showGuide) dialogRef.current?.showModal();
  }, [showGuide]);

  if (state.installed) {
    return compact ? null : (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
        ✓ التطبيق مثبّت على جهازك
      </span>
    );
  }

  const isIos =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const onInstall = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') setShowGuide(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={onInstall}
        className={
          className ||
          (compact
            ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fe9931]/10 text-[#fe9931] border border-[#fe9931]/30 text-xs font-bold hover:bg-[#fe9931] hover:text-white transition disabled:opacity-50'
            : 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white text-xs sm:text-sm font-bold shadow-sm transition disabled:opacity-50')
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{children || (compact ? 'التطبيق' : 'تثبيت تطبيق قمر للعطور')}</span>
      </button>

      {showGuide && (
        <dialog
          ref={dialogRef}
          onClose={() => setShowGuide(false)}
          className="backdrop:bg-black/60 max-w-md w-[calc(100%-2rem)] rounded-3xl bg-white text-[#252a31] p-0 shadow-2xl border border-gray-100"
        >
          <section className="relative p-6 sm:p-7 space-y-4">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="إغلاق"
              className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <img src="/pwa/icon-192.png" alt="قمر للعطور" className="w-12 h-12 rounded-2xl border border-gray-100 shadow-xs" />
              <div>
                <h2 className="font-extrabold text-base text-[#252a31]">تثبيت تطبيق قمر للعطور</h2>
                <p className="text-xs text-gray-500">يعمل كتطبيق مستقل على الموبايل واللابتوب</p>
              </div>
            </div>

            {isIos ? (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 text-xs leading-6 text-[#4f4335] space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-[#fe9931]">
                  <Smartphone className="w-4 h-4" /> لمستخدمي iPhone / iPad (Safari):
                </p>
                <p>١. افتح الموقع داخل متصفح <strong>Safari</strong>.</p>
                <p>٢. اضغط على زر <strong>المشاركة (Share ⬆️)</strong> في شريط المتصفح بالأسفل.</p>
                <p>٣. اختر <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong> ثم اضغط إضافة.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs leading-6 text-[#4f4335]">
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <p className="font-bold flex items-center gap-1.5 text-[#252a31] mb-1">
                    <Smartphone className="w-4 h-4 text-[#fe9931]" /> على الموبايل (Android Chrome):
                  </p>
                  <p>اضغط على القائمة <strong>⋮</strong> بأعلى المتصفح واختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <p className="font-bold flex items-center gap-1.5 text-[#252a31] mb-1">
                    <Monitor className="w-4 h-4 text-[#fe9931]" /> على اللابتوب (Chrome / Edge):
                  </p>
                  <p>اضغط على أيقونة التثبيت الموجودة على يمين/يسار شريط العنوان بالأعلى، أو من قائمة المتصفح اختر <strong>Install Qamar Fragrances</strong>.</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="w-full py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm"
            >
              فهمت
            </button>
          </section>
        </dialog>
      )}
    </>
  );
};

export const PwaStatus: React.FC = () => {
  const state = usePwa();
  const { currentTab, refreshCatalog, isCatalogLoading } = useStore();
  const [online, setOnline] = useState(deviceIsOnline);
  const [dismissed, setDismissed] = useState(() => Number(readStorage('qamar_pwa_prompt_until') || 0) > Date.now());

  useEffect(() => {
    const sync = () => setOnline(deviceIsOnline());
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (currentTab === 'admin') return null;

  return (
    <div className="relative z-30">
      {!online && (
        <div role="status" className="bg-amber-50 border-b border-amber-200 text-[#4f4335] px-4 py-2.5 text-xs">
          <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-[#fe9931] shrink-0" />
              <span>أنت غير متصل بالإنترنت — يتم عرض الكتالوج المحفوظ محلياً.</span>
            </div>
            <button
              type="button"
              onClick={refreshCatalog}
              disabled={isCatalogLoading}
              className="px-3 py-1 rounded-full border border-amber-300 font-bold hover:bg-white shrink-0"
            >
              تحديث
            </button>
          </div>
        </div>
      )}

      {state.updateReady && (
        <div className="bg-[#252a31] text-white px-4 py-2 text-xs">
          <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-3">
            <span>يتوفر تحديث جديد لتطبيق قمر للعطور.</span>
            <button
              type="button"
              onClick={applyPwaUpdate}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#fe9931] text-white font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث الآن
            </button>
          </div>
        </div>
      )}

      {state.installable && !state.installed && !dismissed && (
        <div className="bg-white border-b border-gray-100 px-4 py-2.5">
          <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/pwa/icon-192.png" alt="" className="w-9 h-9 rounded-xl border border-gray-100 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#252a31] truncate">
                  نزّل تطبيق قمر للعطور على جهازك
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  فتح أسرع بضغطة واحدة من شاشة الموبايل أو اللابتوب
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <InstallAppButton compact />
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => {
                  writeStorage('qamar_pwa_prompt_until', String(Date.now() + 7 * 86400000));
                  setDismissed(true);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
