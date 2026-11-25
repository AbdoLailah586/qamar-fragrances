import React from 'react';
import { LogOut, Package, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';

export const Profile: React.FC = () => {
  const { user, canAccessAdmin, logout, openAuthModal } = useAuth();
  const { orders, navigate } = useStore();

  if (!user) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <UserIcon className="w-12 h-12 text-gray-300 mx-auto" />
        <h1 className="text-xl font-bold text-[#252a31]">حسابي</h1>
        <p className="text-sm text-gray-500">سجل دخولك لمتابعة طلباتك وعناوين التوصيل.</p>
        <button type="button" onClick={() => openAuthModal()} className="px-7 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm">
          تسجيل الدخول
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-[1000px] mx-auto px-4 md:px-8 py-10 space-y-8">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#252a31]">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.email} {user.phone ? `• ${user.phone}` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {canAccessAdmin && (
            <button type="button" onClick={() => navigate('admin')}
              className="px-5 py-2.5 rounded-full bg-[#4f4335] text-white text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#fe9931]" />
              لوحة الإدارة
            </button>
          )}
          <button type="button" onClick={() => { logout(); navigate('home'); }}
            className="px-4 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-red-600 text-xs font-bold flex items-center gap-1.5">
            <LogOut className="w-4 h-4" />
            خروج
          </button>
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-bold text-base text-[#252a31] flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-[#fe9931]" />
          <span>طلباتي ({orders.length})</span>
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400">لا توجد طلبات مسجلة على حسابك حتى الآن.</p>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="p-4 rounded-xl border border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-bold text-[#252a31]" dir="ltr">{o.order_number}</p>
                  <p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString('ar-EG')}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-[#fe9931] text-xs font-bold">{o.order_status}</span>
                <span className="font-bold text-[#252a31]">{formatEGP(o.total)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
