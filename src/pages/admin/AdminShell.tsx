import React from 'react';
import {
  LayoutDashboard, BarChart3, Package, Boxes, FlaskConical, Droplets,
  Sparkles, Calculator, Tag, ClipboardCheck, AlertTriangle, Truck,
  ShoppingBag, MessageSquare, Users, Mail, MessageCircle, Shield, Settings,
  Wrench, Store
} from 'lucide-react';

export interface AdminNavItem {
  id: string;
  label: string;
  group: string;
  icon: React.FC<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'overview', label: 'نظرة عامة', group: 'التقارير والتحليل', icon: LayoutDashboard },
  { id: 'analytics', label: 'تحليلات العطور والمبيعات', group: 'التقارير والتحليل', icon: BarChart3 },
  { id: 'crm', label: 'السلات النشطة والمتروكة', group: 'التقارير والتحليل', icon: ShoppingBag },

  { id: 'products', label: 'كتالوج العطور والأحجام', group: 'الكتالوج والزيوت', icon: Sparkles },
  { id: 'oils', label: 'الزيوت الخام والزجاجات', group: 'الكتالوج والزيوت', icon: Droplets },
  { id: 'notes_finder', label: 'دليل النوتات والبدائل', group: 'الكتالوج والزيوت', icon: FlaskConical },
  { id: 'pricing', label: 'تسعير الملي والهامش', group: 'الكتالوج والزيوت', icon: Calculator },
  { id: 'labels', label: 'طباعة استيكرات الزجاجات', group: 'الكتالوج والزيوت', icon: Tag },

  { id: 'inventory', label: 'المخزون وتقارير Excel', group: 'المخزون والتوريد', icon: Boxes },
  { id: 'quality', label: 'جودة التعتيق والبيانات', group: 'المخزون والتوريد', icon: ClipboardCheck },
  { id: 'stocktake', label: 'الجرد السريع', group: 'المخزون والتوريد', icon: Package },
  { id: 'reorder', label: 'النواقص وإعادة الطلب', group: 'المخزون والتوريد', icon: AlertTriangle },
  { id: 'suppliers', label: 'عروض أسعار الموردين', group: 'المخزون والتوريد', icon: Truck },

  { id: 'orders', label: 'إدارة الطلبات', group: 'العمليات والعملاء', icon: ShoppingBag },
  { id: 'fulfillment', label: 'التجهيز والشحن والمرتجعات', group: 'العمليات والعملاء', icon: Truck },
  { id: 'support', label: 'دعم العملاء والرسائل', group: 'العمليات والعملاء', icon: MessageSquare },
  { id: 'whatsapp', label: 'قوالب واتساب', group: 'العمليات والعملاء', icon: MessageCircle },
  { id: 'emails', label: 'قوالب البريد', group: 'العمليات والعملاء', icon: Mail },

  { id: 'users', label: 'المستخدمون والصلاحيات', group: 'النظام والأمان', icon: Users },
  { id: 'tools', label: 'المراجعات والأدوات', group: 'النظام والأمان', icon: Wrench },
  { id: 'security', label: 'الأمان وسجل التدقيق 2FA', group: 'النظام والأمان', icon: Shield },
  { id: 'settings', label: 'إعدادات المتجر والهيرو', group: 'النظام والأمان', icon: Settings }
];

interface Props {
  activeSection: string;
  onSelectSection: (id: string) => void;
  allowedSections: string[];
  onBackToStore: () => void;
  children: React.ReactNode;
}

export const AdminShell: React.FC<Props> = ({
  activeSection,
  onSelectSection,
  allowedSections,
  onBackToStore,
  children
}) => {
  const visibleItems = ADMIN_NAV_ITEMS.filter(item => allowedSections.includes(item.id));
  const groups = Array.from(new Set(visibleItems.map(i => i.group)));

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-l border-gray-200 shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-extrabold text-sm text-[#252a31]">لوحة تحكم قمر للعطور</p>
            <p className="text-[11px] text-[#fe9931] font-bold">Qamar Fragrance ERP</p>
          </div>
          <button
            type="button"
            onClick={onBackToStore}
            className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:border-[#fe9931] hover:text-[#fe9931]"
            title="العودة للمتجر"
          >
            <Store className="w-4 h-4" />
          </button>
        </div>

        <nav className="p-3 space-y-5 overflow-y-auto flex-1">
          {groups.map(g => (
            <div key={g}>
              <p className="px-3 text-[11px] font-bold text-gray-400 mb-1.5">{g}</p>
              <div className="space-y-1">
                {visibleItems.filter(i => i.group === g).map(item => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectSection(item.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition text-right ${
                        active
                          ? 'bg-[#fe9931] text-white shadow-xs'
                          : 'text-[#4f4335] hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};
