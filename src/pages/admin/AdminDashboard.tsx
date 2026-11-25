import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { AdminShell } from './AdminShell';
import { OilsAndBottlesPanel } from './OilsAndBottlesPanel';
import { FragranceNotesPanel } from './FragranceNotesPanel';
import { PerfumeOperationsPanels } from './PerfumePricingAndLabelsPanel';
import { InventoryAndCatalogPanel } from './InventoryAndCatalogPanel';
import { OrdersCrmSupportPanel } from './OrdersCrmSupportPanel';
import { SystemAdminPanel } from './SystemAdminPanel';

export const AdminDashboard: React.FC = () => {
  const { canAccessAdmin, adminSections, openAuthModal } = useAuth();
  const { navigate } = useStore();
  const [activeSection, setActiveSection] = useState<string>(() => adminSections[0] || 'overview');

  if (!canAccessAdmin) {
    return (
      <main className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#fe9931]/10 text-[#fe9931] flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-extrabold text-[#252a31]">لوحة تحكم الإدارة للإداريين فقط</h1>
        <p className="text-sm text-gray-500">يجب تسجيل الدخول بحساب يملك صلاحية الوصول إلى لوحة إدارة قمر للعطور.</p>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={() => openAuthModal('سجّل الدخول بحساب الإدارة للمتابعة')}
            className="px-6 py-2.5 rounded-full bg-[#fe9931] text-white text-sm font-bold">
            تسجيل الدخول بحساب الإدارة
          </button>
          <button type="button" onClick={() => navigate('home')}
            className="px-6 py-2.5 rounded-full border border-gray-300 text-sm font-bold text-[#252a31]">
            العودة للمتجر
          </button>
        </div>
      </main>
    );
  }

  const section = adminSections.includes(activeSection) ? activeSection : (adminSections[0] || 'overview');

  return (
    <AdminShell
      activeSection={section}
      onSelectSection={setActiveSection}
      allowedSections={adminSections}
      onBackToStore={() => navigate('home')}
    >
      {section === 'oils' && <OilsAndBottlesPanel />}
      {section === 'notes_finder' && <FragranceNotesPanel />}
      {(section === 'pricing' || section === 'labels' || section === 'quality' || section === 'stocktake' || section === 'reorder' || section === 'suppliers') && (
        <PerfumeOperationsPanels section={section} />
      )}
      {(section === 'products' || section === 'inventory' || section === 'tools') && (
        <InventoryAndCatalogPanel section={section} />
      )}
      {(section === 'overview' || section === 'analytics' || section === 'orders' || section === 'fulfillment' || section === 'crm' || section === 'support') && (
        <OrdersCrmSupportPanel section={section} onGo={setActiveSection} />
      )}
      {(section === 'users' || section === 'security' || section === 'settings' || section === 'whatsapp' || section === 'emails') && (
        <SystemAdminPanel section={section} />
      )}
    </AdminShell>
  );
};
