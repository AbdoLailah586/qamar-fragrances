import React, { useEffect, useState } from 'react';
import { FileText, RotateCcw, Save, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';
import type { PolicyPagesConfig, StoreSettings } from '../../types';
import { POLICY_META, getDefaultPolicyDoc, type PolicyKey } from '../../utils/policyDefaults';

interface PolicyPagesEditorCardProps {
  settings: StoreSettings;
  onSavePolicyPages: (nextPolicyPages: PolicyPagesConfig) => Promise<void> | void;
}

const POLICY_TABS: Array<{ key: PolicyKey; icon: React.FC<{ className?: string }> }> = [
  { key: 'terms', icon: FileText },
  { key: 'privacy', icon: ShieldCheck },
  { key: 'refund', icon: RotateCcw },
  { key: 'shipping', icon: Truck },
];

export const PolicyPagesEditorCard: React.FC<PolicyPagesEditorCardProps> = ({
  settings,
  onSavePolicyPages,
}) => {
  const [selectedKey, setSelectedKey] = useState<PolicyKey>('terms');
  const [heading, setHeading] = useState('');
  const [intro, setIntro] = useState('');
  const [body, setBody] = useState('');
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const freeThreshold = `${Number(settings.free_shipping_threshold || 1500).toLocaleString()} ج.م`;
  const storeName = settings.store_name_ar || 'قمر للعطور';

  useEffect(() => {
    const def = getDefaultPolicyDoc(selectedKey, { storeName, freeThreshold });
    const custom = settings.policy_pages?.[selectedKey];
    setHeading(custom?.heading ?? def.heading);
    setIntro(custom?.intro ?? def.intro);
    setBody(custom?.body ?? def.body);
  }, [selectedKey, settings.policy_pages, settings.store_name_ar, settings.free_shipping_threshold]);

  const handleSaveCurrent = async () => {
    setSaving(true);
    setSavedBanner(null);
    try {
      const nextPolicyPages: PolicyPagesConfig = {
        ...(settings.policy_pages || {}),
        [selectedKey]: {
          heading: heading.trim(),
          intro: intro.trim(),
          body: body.trim(),
        },
      };
      await onSavePolicyPages(nextPolicyPages);
      setSavedBanner(`تم حفظ محتوى صفحة «${POLICY_META[selectedKey].tabLabel}» وتحديثه على المتجر فوراً.`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    setSavedBanner(null);
    try {
      const def = getDefaultPolicyDoc(selectedKey, { storeName, freeThreshold });
      setHeading(def.heading);
      setIntro(def.intro);
      setBody(def.body);
      const nextPolicyPages: PolicyPagesConfig = { ...(settings.policy_pages || {}) };
      delete nextPolicyPages[selectedKey];
      await onSavePolicyPages(nextPolicyPages);
      setSavedBanner(`تمت استعادة النص الافتراضي لصفحة «${POLICY_META[selectedKey].tabLabel}».`);
    } finally {
      setSaving(false);
    }
  };

  const hasCustomOverride = Boolean(
    settings.policy_pages?.[selectedKey]?.heading ||
    settings.policy_pages?.[selectedKey]?.intro ||
    settings.policy_pages?.[selectedKey]?.body
  );

  return (
    <div className="bg-white border rounded-2xl p-5 space-y-4 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-[#252a31] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#fe9931]" />
            <span>تعديل محتوى صفحات السياسات والشروط والأحكام</span>
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">
            عدّل النصوص الظاهرة للعملاء في صفحات شروط الاستخدام، الخصوصية، الاستبدال والاسترجاع، والشحن والتوصيل مباشرة من هنا.
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
            hasCustomOverride
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-gray-50 text-gray-600 border-gray-200'
          }`}
        >
          {hasCustomOverride ? 'نص مخصص محفوظ' : 'يستخدم النص الافتراضي'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {POLICY_TABS.map(({ key, icon: Icon }) => {
          const active = key === selectedKey;
          const customized = Boolean(settings.policy_pages?.[key]?.body || settings.policy_pages?.[key]?.heading);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSavedBanner(null);
                setSelectedKey(key);
              }}
              className={`px-3.5 py-2 rounded-full font-bold border flex items-center gap-1.5 transition ${
                active
                  ? 'bg-[#fe9931] text-white border-[#fe9931] shadow-sm'
                  : 'bg-gray-50 text-[#252a31] border-gray-200 hover:border-[#fe9931]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{POLICY_META[key].tabLabel}</span>
              {customized && (
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-green-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block font-bold text-[#252a31] mb-1">عنوان الصفحة الرئيسي:</label>
          <input
            type="text"
            value={heading}
            onChange={e => setHeading(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[#252a31] font-bold focus:outline-none focus:border-[#fe9931]"
          />
        </div>

        <div>
          <label className="block font-bold text-[#252a31] mb-1">المقدمة التعريفية:</label>
          <textarea
            rows={2}
            value={intro}
            onChange={e => setIntro(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[#252a31] leading-relaxed focus:outline-none focus:border-[#fe9931]"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label className="font-bold text-[#252a31]">محتوى الصفحة والبنود:</label>
            <span className="text-[11px] text-gray-500">
              استخدم <code className="bg-gray-100 px-1 rounded">### عنوان القسم</code> للعناوين الفرعية و <code className="bg-gray-100 px-1 rounded">- بند</code> للنقاط
            </span>
          </div>
          <textarea
            rows={10}
            value={body}
            onChange={e => setBody(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[#252a31] leading-7 focus:outline-none focus:border-[#fe9931]"
          />
        </div>
      </div>

      {savedBanner && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveCurrent}
          className="px-5 py-2 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'جاري الحفظ...' : `حفظ تعديلات «${POLICY_META[selectedKey].tabLabel}»`}</span>
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={handleResetToDefault}
          className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>استعادة النص الافتراضي لهذه الصفحة</span>
        </button>
      </div>
    </div>
  );
};
