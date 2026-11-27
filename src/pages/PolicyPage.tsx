import React from 'react';
import { ShieldCheck, FileText, RotateCcw, Truck, ArrowRight, MessageCircle, Phone, Mail, MapPin } from 'lucide-react';
import { useStore, type AppTab } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';
import { whatsappUrl } from '../utils/whatsappService';
import { POLICY_META, getDefaultPolicyDoc, parsePolicyBody, type PolicyKey, type ParsedPolicySection } from '../utils/policyDefaults';

export type PolicyTabKey = Extract<AppTab, 'terms' | 'privacy' | 'refund' | 'shipping'>;

const POLICY_ICONS: Record<PolicyKey, React.FC<{ className?: string }>> = {
  terms: FileText,
  privacy: ShieldCheck,
  refund: RotateCcw,
  shipping: Truck,
};

interface PolicyDoc {
  key: PolicyTabKey;
  tabLabel: string;
  heading: string;
  updatedAt: string;
  intro: string;
  icon: React.FC<{ className?: string }>;
  sections: ParsedPolicySection[];
}

export const PolicyPage: React.FC<{ activePolicy: PolicyTabKey }> = ({ activePolicy }) => {
  const { settings, navigate } = useStore();
  const storeName = settings.store_name_ar || 'قمر للعطور';
  const freeThreshold = formatEGP(settings.free_shipping_threshold || 1500);

  const policyKeys: PolicyKey[] = ['terms', 'privacy', 'refund', 'shipping'];

  const docs: PolicyDoc[] = policyKeys.map(key => {
    const def = getDefaultPolicyDoc(key, { storeName, freeThreshold });
    const custom = settings.policy_pages?.[key];
    const heading = custom?.heading?.trim() || def.heading;
    const intro = custom?.intro?.trim() || def.intro;
    const rawBody = custom?.body?.trim() ? custom.body : def.body;
    return {
      key: key as PolicyTabKey,
      tabLabel: POLICY_META[key].tabLabel,
      heading,
      updatedAt: 'نوفمبر 2026',
      intro,
      icon: POLICY_ICONS[key],
      sections: parsePolicyBody(rawBody),
    };
  });

  const currentDoc = docs.find(d => d.key === activePolicy) || docs[0];
  const Icon = currentDoc.icon;

  return (
    <main className="max-w-[1050px] mx-auto px-4 md:px-8 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#fe9931]"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للمتجر</span>
        </button>
        <span className="text-[11px] font-bold text-gray-400">آخر تحديث: {currentDoc.updatedAt}</span>
      </div>

      {/* Policy Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="tablist" aria-label="صفحات سياسات المتجر">
        {docs.map(doc => {
          const TabIcon = doc.icon;
          const active = doc.key === currentDoc.key;
          return (
            <button
              key={doc.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`policy-tab-${doc.key}`}
              onClick={() => navigate(doc.key)}
              className={`px-3.5 py-3 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                active
                  ? 'bg-[#fe9931] text-white border-[#fe9931] shadow-sm'
                  : 'bg-white text-[#252a31] border-gray-200 hover:border-[#fe9931]'
              }`}
            >
              <TabIcon className="w-4 h-4 shrink-0" />
              <span>{doc.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Policy Body Card */}
      <article className="bg-white border border-gray-200 rounded-3xl p-6 md:p-10 space-y-7 shadow-sm">
        <header className="border-b border-gray-100 pb-6 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-[#fe9931] text-xs font-extrabold">
            <Icon className="w-4 h-4" />
            <span>سياسات متجر {storeName}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#252a31]">{currentDoc.heading}</h1>
          <p className="text-sm text-gray-600 leading-relaxed">{currentDoc.intro}</p>
        </header>

        <div className="space-y-6">
          {currentDoc.sections.map((section, idx) => (
            <section key={`${section.title}-${idx}`} className="space-y-2.5">
              {section.title && (
                <h2 className="text-base md:text-lg font-extrabold text-[#252a31]">{section.title}</h2>
              )}
              {section.paragraphs.map((p, i) => (
                <p key={`p-${i}`} className="text-sm text-gray-600 leading-relaxed">
                  {p}
                </p>
              ))}
              {section.bullets.length > 0 && (
                <ul className="space-y-2 pr-4 list-disc marker:text-[#fe9931] text-sm text-gray-600 leading-relaxed">
                  {section.bullets.map((pt, i) => (
                    <li key={`b-${i}`}>{pt}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="border-t border-gray-100 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/80 rounded-2xl p-5">
          <div className="space-y-1 text-xs text-gray-600">
            <p className="font-extrabold text-sm text-[#252a31]">هل لديك استفسار بخصوص هذه السياسة؟</p>
            <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#fe9931]" /> {settings.address_ar}</p>
            <p className="flex items-center gap-3 flex-wrap pt-0.5">
              <span className="inline-flex items-center gap-1" dir="ltr"><Phone className="w-3.5 h-3.5 text-[#fe9931]" /> {settings.phone}</span>
              <span className="inline-flex items-center gap-1" dir="ltr"><Mail className="w-3.5 h-3.5 text-[#fe9931]" /> {settings.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={whatsappUrl(settings.whatsapp_number, `مرحباً ${storeName}، لدي استفسار بخصوص ${currentDoc.tabLabel}`)}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span>تواصل عبر واتساب</span>
            </a>
            <button
              type="button"
              onClick={() => navigate('contact')}
              className="px-4 py-2.5 rounded-full border border-gray-300 bg-white hover:border-[#fe9931] text-[#252a31] text-xs font-bold"
            >
              نموذج تواصل معنا
            </button>
          </div>
        </footer>
      </article>
    </main>
  );
};
