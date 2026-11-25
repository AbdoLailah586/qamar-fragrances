import React from 'react';
import { ShieldCheck, FileText, RotateCcw, Truck, ArrowRight, MessageCircle, Phone, Mail, MapPin } from 'lucide-react';
import { useStore, type AppTab } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';
import { whatsappUrl } from '../utils/whatsappService';

export type PolicyTabKey = Extract<AppTab, 'terms' | 'privacy' | 'refund' | 'shipping'>;

interface PolicySection {
  title: string;
  points: string[];
}

interface PolicyDoc {
  key: PolicyTabKey;
  tabLabel: string;
  heading: string;
  updatedAt: string;
  intro: string;
  icon: React.FC<{ className?: string }>;
  sections: PolicySection[];
}

export const PolicyPage: React.FC<{ activePolicy: PolicyTabKey }> = ({ activePolicy }) => {
  const { settings, navigate } = useStore();
  const storeName = settings.store_name_ar || 'قمر للعطور';
  const freeThreshold = formatEGP(settings.free_shipping_threshold || 1500);

  const docs: PolicyDoc[] = [
    {
      key: 'terms',
      tabLabel: 'شروط الاستخدام',
      heading: 'شروط وأحكام استخدام المتجر',
      updatedAt: 'نوفمبر 2026',
      intro: `مرحباً بك في متجر ${storeName} (Qamar Fragrances). استخدامك للموقع أو إتمام أي طلب يعني موافقتك على الشروط والأحكام التالية المصممة لحماية حقوق العميل والمتجر بشفافية.`,
      icon: FileText,
      sections: [
        {
          title: '1. إنشاء الحساب وصحة البيانات',
          points: [
            'يجب أن تكون بيانات التواصل المسجلة (الاسم، رقم الهاتف/الواتساب، البريد الإلكتروني، وعنوان التوصيل أو موقع الخريطة) صحيحة ودقيقة لضمان سرعة الشحن وتأكيد الطلبات.',
            'يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات تسجيل الدخول الخاصة بحسابه، ويمكنه تعديلها أو حذف حسابه نهائياً في أي وقت من صفحة "حسابي".'
          ]
        },
        {
          title: '2. طبيعة المنتجات والعطور',
          points: [
            `يقدم متجر ${storeName} عطور محاكاة فاخرة بجودة عالية، زيوت عطرية، عطور نيش وعربية، ومستحضرات معطرة بأحجام متعددة.`,
            'قد يختلف لون الزجاجة أو التغليف الخارجي أحياناً بين دفعات التعبئة حسب التحديثات الشكلية مع الحفاظ التام على جودة الزيت العطري وثباته والتركيز المعلن.'
          ]
        },
        {
          title: '3. الأسعار والطلبات والإلغاء',
          points: [
            'تُعرض جميع الأسعار بالجنيه المصري (ج.م.) شاملة تغليف الحماية القياسي، وتُحتسب رسوم الشحن حسب المحافظة وتظهر بوضوح قبل تأكيد الطلب.',
            'يحق للعميل طلب تعديل أو إلغاء الطلب مجاناً قبل تسليمه لشركة الشحن عبر الواتساب أو من صفحة حسابي.',
            'يحتفظ المتجر بحق رفض أو إلغاء أي طلب في حال عدم توافر الكمية أو عدم تأكيد العميل للبيانات عبر الهاتف/الواتساب.'
          ]
        },
        {
          title: '4. حقوق الملكية والاستخدام العادل',
          points: [
            `جميع العلامات والصور والنصوص والأوصاف العطرية المعروضة داخل ${storeName} مخصصة لاستخدام المتجر وعملائه ولا يُسمح بإعادة نسخها أو استغلالها تجارياً دون إذن مسبق.`
          ]
        }
      ]
    },
    {
      key: 'privacy',
      tabLabel: 'سياسة الخصوصية',
      heading: 'سياسة الخصوصية وحماية البيانات',
      updatedAt: 'نوفمبر 2026',
      intro: `في ${storeName} نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية واستخدامها فقط في إتمام طلباتك وتحسين تجربتك في التسوق.`,
      icon: ShieldCheck,
      sections: [
        {
          title: '1. البيانات التي نقوم بجمعها',
          points: [
            'بيانات الحساب والتوصيل: الاسم الكامل، البريد الإلكتروني، رقم الهاتف/الواتساب، المحافظة، العنوان التفصيلي، وإحداثيات الموقع على الخريطة فقط عندما تختار تحديدها لتسهيل وصول المندوب.',
            'بيانات النشاط داخل المتجر: المنتجات التي تزورها وسلة التسوق لتحسين التوصيات العطرية ومتابعة السلات وإكمال الطلبات.'
          ]
        },
        {
          title: '2. كيف نستخدم بياناتك؟',
          points: [
            'تجهيز الطلبات وتسليمها لشركة الشحن ومندوب التوصيل.',
            'إرسال إشعارات حالة الطلب تلقائياً عبر الواتساب أو البريد الإلكتروني (تأكيد الطلب، الشحن، الخروج للتوصيل).',
            'تقديم خدمة الدعم الفني والرد على الاستفسارات وطلبات الاستبدال أو الاسترجاع.'
          ]
        },
        {
          title: '3. حماية الحسابات وتسجيل الدخول عبر Google',
          points: [
            'تُخزن كلمات المرور بصورة مشفرة (Hash)، وتُدار الجلسات عبر ملفات ارتباط آمنة (HttpOnly Cookies).',
            'عند تسجيل الدخول بحساب Google نستخدم فقط الاسم والبريد الإلكتروني وصورة الحساب لإنشاء أو ربط حسابك بالمتجر ولا نطلع على كلمة مرور حسابك في جوجل.'
          ]
        },
        {
          title: '4. مشاركة البيانات وحق حذف الحساب',
          points: [
            'لا نبيع ولا نؤجر بيانات عملائنا لأي جهة خارجية، ولا نشارك بيانات التوصيل إلا بالقدر اللازم مع شركة الشحن لإيصال طلبك.',
            'يحق لك في أي وقت تعديل بياناتك أو حذف حسابك نهائياً من داخل صفحة الحساب الشخصي.'
          ]
        }
      ]
    },
    {
      key: 'refund',
      tabLabel: 'الاستبدال والاسترجاع',
      heading: 'سياسة الاستبدال والاسترجاع',
      updatedAt: 'نوفمبر 2026',
      intro: `نهدف إلى رضاك التام عن كل عطر تطلبه من ${storeName}. نلتزم بضوابط واضحة وعادلة للاستبدال والاسترجاع.`,
      icon: RotateCcw,
      sections: [
        {
          title: '1. حالات الاستبدال أو الاسترجاع المجاني',
          points: [
            'إذا وصلك منتج مختلف عن المطلوب في الفاتورة أو به تلف/كسر أو تسريب أثناء الشحن، يتحمل المتجر كامل تكاليف الشحن للاستبدال الفوري أو استرداد المبلغ.',
            'يرجى التواصل معنا خلال 48 ساعة من الاستلام مع إرسال صورة أو فيديو يوضح حالة الطرد فور فتحه.'
          ]
        },
        {
          title: '2. الاستبدال أو الاسترجاع الاختياري (خلال 14 يوماً)',
          points: [
            'يمكن استرجاع أو استبدال الزجاجات القياسية المغلقة بحالتها الأصلية وبكامل السيلوفان/التغليف دون فتح أو استخدام خلال 14 يوماً من تاريخ الاستلام، مع تحمل العميل لمصاريف الشحن.',
            'حرصاً على سلامة وجودة المنتجات العطرية، لا يمكن استرجاع الزجاجات التي تم فتحها أو رشها أو الطلبات المعبأة بتركيبات مخصصة بعد الاستخدام ما لم يثبت وجود عيب.'
          ]
        },
        {
          title: '3. آلية ومدة استرداد المبلغ',
          points: [
            'بعد استلام المرتجع وفحصه خلال يومي عمل، يتم استرداد المبلغ بنفس وسيلة الدفع (فودافون كاش / إنستاباي / تحويل بنكي) خلال 3 إلى 7 أيام عمل.'
          ]
        }
      ]
    },
    {
      key: 'shipping',
      tabLabel: 'الشحن والتوصيل',
      heading: 'سياسة الشحن والتوصيل ووسائل الدفع',
      updatedAt: 'نوفمبر 2026',
      intro: `نوصل عطورنا إلى جميع محافظات جمهورية مصر العربية بتغليف آمن يحفظ جودة الزجاجات أثناء النقل.`,
      icon: Truck,
      sections: [
        {
          title: '1. مدد الشحن التقديرية',
          points: [
            'الدقهلية والمنصورة: خلال 1 إلى 2 يوم عمل.',
            'القاهرة الكبرى والجيزة والإسكندرية ومحافظات الدلتا والقناة: خلال 2 إلى 4 أيام عمل.',
            'محافظات الصعيد والبحر الأحمر ومطروح وسيناء والوادي الجديد: خلال 3 إلى 6 أيام عمل.'
          ]
        },
        {
          title: '2. رسوم الشحن والشحن المجاني',
          points: [
            'تُحدد تكلفة الشحن تلقائياً وفق المحافظة المختارة في صفحة إتمام الطلب.',
            `الشحن مجاني تماماً للطلبات التي تصل قيمتها إلى ${freeThreshold} أو أكثر.`
          ]
        },
        {
          title: '3. المتابعة والدفع والاستلام',
          points: [
            'يتاح الدفع عند الاستلام (كاش) أو الدفع الإلكتروني عبر إنستاباي وفودافون كاش.',
            'بمجرد تأكيد الطلب يصلك رقم تتبع (QMR-...) يمكنك متابعته في أي لحظة من صفحة تتبع الطلب كما تصلك التحديثات التلقائية على الواتساب.',
            'تحديد موقع التوصيل عبر GPS أو الخريطة التفاعلية في صفحة الدفع يساعد المندوب على الوصول إليك بدقة وسرعة أكبر.'
          ]
        }
      ]
    }
  ];

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
          {currentDoc.sections.map(section => (
            <section key={section.title} className="space-y-2.5">
              <h2 className="text-base md:text-lg font-extrabold text-[#252a31]">{section.title}</h2>
              <ul className="space-y-2 pr-4 list-disc marker:text-[#fe9931] text-sm text-gray-600 leading-relaxed">
                {section.points.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
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
