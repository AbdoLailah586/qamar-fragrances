import React, { useState, useEffect } from 'react';
import {
  LogOut, Package, ShieldCheck, User as UserIcon, MapPin, Pencil,
  Trash2, Plus, X, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';
import { egyptianGovernorates } from '../data/governorates';

type ProfileTab = 'account' | 'orders' | 'addresses';
type EditField = 'name' | 'email' | 'phone' | 'password' | null;

const ORDER_STATUS_AR: Record<string, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  processing: 'جاري التجهيز',
  shipped: 'تم الشحن',
  out_for_delivery: 'مع المندوب',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي'
};

export const Profile: React.FC = () => {
  const {
    user,
    canAccessAdmin,
    logout,
    openAuthModal,
    updateProfile,
    updateEmail,
    changePassword,
    deleteAccount,
    addAddress,
    deleteAddress
  } = useAuth();
  const { orders, navigate } = useStore();

  const [tab, setTab] = useState<ProfileTab>(() => {
    if (typeof window === 'undefined') return 'account';
    const q = new URLSearchParams(window.location.search).get('tab');
    return q === 'orders' || q === 'addresses' ? q : 'account';
  });

  // Edit field dialog state
  const [editField, setEditField] = useState<EditField>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  // Add address modal state
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrTitle, setAddrTitle] = useState('المنزل');
  const [addrGov, setAddrGov] = useState('القاهرة');
  const [addrCity, setAddrCity] = useState('');
  const [addrDetails, setAddrDetails] = useState('');
  const [addrDefault, setAddrDefault] = useState(true);

  // Delete account confirmation modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onTabEvent = (e: any) => {
      if (e?.detail === 'account' || e?.detail === 'orders' || e?.detail === 'addresses') {
        setTab(e.detail);
      }
    };
    window.addEventListener('qamar-profile-tab', onTabEvent);
    return () => window.removeEventListener('qamar-profile-tab', onTabEvent);
  }, []);

  if (!user) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <UserIcon className="w-12 h-12 text-gray-300 mx-auto" />
        <h1 className="text-xl font-bold text-[#252a31]">حسابي</h1>
        <p className="text-sm text-gray-500">سجل دخولك لمتابعة طلباتك وعناوين التوصيل وإدارة حسابك.</p>
        <button type="button" onClick={() => openAuthModal()} className="px-7 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-sm">
          تسجيل الدخول
        </button>
      </main>
    );
  }

  const openEdit = (field: EditField) => {
    setEditField(field);
    setStatusBanner(null);
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
    if (field === 'name') setFieldValue(user.name || '');
    else if (field === 'email') setFieldValue(user.email || '');
    else if (field === 'phone') setFieldValue(user.phone || '');
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusBanner(null);
    try {
      if (editField === 'name') {
        const res = await updateProfile({ name: fieldValue.trim() });
        if (!res.success) setStatusBanner({ ok: false, msg: res.error || 'تعذر حفظ الاسم.' });
        else { setEditField(null); setStatusBanner({ ok: true, msg: 'تم تحديث الاسم بنجاح.' }); }
      } else if (editField === 'phone') {
        const res = await updateProfile({ phone: fieldValue.trim() });
        if (!res.success) setStatusBanner({ ok: false, msg: res.error || 'تعذر حفظ رقم الهاتف.' });
        else { setEditField(null); setStatusBanner({ ok: true, msg: 'تم تحديث رقم الهاتف بنجاح.' }); }
      } else if (editField === 'email') {
        const res = await updateEmail(fieldValue.trim());
        if (!res.success) setStatusBanner({ ok: false, msg: res.error || 'تعذر تحديث البريد الإلكتروني.' });
        else { setEditField(null); setStatusBanner({ ok: true, msg: 'تم تحديث البريد الإلكتروني بنجاح.' }); }
      } else if (editField === 'password') {
        if (newPass.length < 6) {
          setStatusBanner({ ok: false, msg: 'كلمة السر يجب أن لا تقل عن 6 أحرف.' });
          return;
        }
        if (newPass !== confirmPass) {
          setStatusBanner({ ok: false, msg: 'كلمتا السر غير متطابقتين.' });
          return;
        }
        const res = await changePassword(oldPass, newPass);
        if (!res.success) setStatusBanner({ ok: false, msg: res.error || 'تعذر تغيير كلمة السر.' });
        else { setEditField(null); setStatusBanner({ ok: true, msg: 'تم تحديث كلمة السر بنجاح.' }); }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrCity.trim() || !addrDetails.trim()) return;
    setSaving(true);
    try {
      const res = await addAddress({
        title: addrTitle.trim() || 'المنزل',
        governorate: addrGov,
        city: addrCity.trim(),
        details: addrDetails.trim(),
        address_details: addrDetails.trim(),
        isDefault: addrDefault
      });
      if (res.success) {
        setShowAddrForm(false);
        setAddrCity('');
        setAddrDetails('');
        setStatusBanner({ ok: true, msg: 'تم حفظ العنوان بنجاح.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await deleteAccount();
      if (res?.success) {
        setConfirmDeleteOpen(false);
        navigate('home');
      } else {
        setDeleteError(res?.error || 'تعذر حذف الحساب.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const sidebarBtnClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition text-right ${
      active ? 'bg-[#fe9931] text-white shadow-xs' : 'text-[#252a31] hover:bg-gray-50'
    }`;

  return (
    <main className="max-w-[1160px] mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Sidebar Card (Exact Qamar layout) */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-[#252a31] truncate">{user.name || 'عميل قمر للعطور'}</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate" dir="ltr">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => { logout(); navigate('home'); }}
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 flex items-center justify-center shrink-0 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <nav className="mt-4 space-y-1.5">
              <button type="button" onClick={() => setTab('account')} className={sidebarBtnClass(tab === 'account')}>
                <UserIcon className="w-4 h-4 shrink-0" />
                <span>حسابي</span>
              </button>
              <button type="button" onClick={() => setTab('orders')} className={sidebarBtnClass(tab === 'orders')}>
                <Package className="w-4 h-4 shrink-0" />
                <span>طلباتي ({orders.length})</span>
              </button>
              <button type="button" onClick={() => setTab('addresses')} className={sidebarBtnClass(tab === 'addresses')}>
                <MapPin className="w-4 h-4 shrink-0" />
                <span>عناويني ({(user.addresses || []).length})</span>
              </button>
            </nav>
          </div>

          {canAccessAdmin && (
            <button
              type="button"
              onClick={() => navigate('admin')}
              className="w-full py-3 px-4 rounded-2xl bg-[#4f4335] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#3a3126] transition"
            >
              <ShieldCheck className="w-4 h-4 text-[#fe9931]" />
              <span>الانتقال إلى لوحة تحكم الإدارة</span>
            </button>
          )}
        </aside>

        {/* Left Main Content Area */}
        <section className="lg:col-span-8 space-y-5">
          {statusBanner && !editField && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border ${statusBanner.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {statusBanner.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{statusBanner.msg}</span>
            </div>
          )}

          {tab === 'account' && (
            <>
              <h1 className="text-xl md:text-2xl font-extrabold text-[#252a31]">حسابي</h1>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-100">
                {/* Name Row */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">الاسم</p>
                    <p className="text-sm font-bold text-[#252a31] mt-1">{user.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit('name')}
                    className="px-5 py-2 rounded-full border border-gray-200 text-xs font-bold text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] flex items-center gap-1.5 shrink-0 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                </div>

                {/* Email Row */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">البريد الإلكتروني</p>
                    <p className="text-sm font-bold text-[#252a31] mt-1 break-all" dir="ltr">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit('email')}
                    className="px-5 py-2 rounded-full border border-gray-200 text-xs font-bold text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] flex items-center gap-1.5 shrink-0 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                </div>

                {/* Phone Row */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">رقم الهاتف</p>
                    <p className="text-sm font-bold text-[#252a31] mt-1" dir="ltr">
                      {user.phone ? (user.phone.startsWith('01') ? `+2${user.phone}` : user.phone) : 'لم يُضف رقم بعد'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit('phone')}
                    className="px-5 py-2 rounded-full border border-gray-200 text-xs font-bold text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] flex items-center gap-1.5 shrink-0 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                </div>

                {/* Password Row */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">كلمة السر</p>
                    <p className="text-sm font-bold text-[#252a31] mt-1 tracking-widest">••••••••••</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit('password')}
                    className="px-5 py-2 rounded-full border border-gray-200 text-xs font-bold text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] flex items-center gap-1.5 shrink-0 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                </div>
              </div>

              {/* Delete Account Button (exact Qamar placement & red pill style) */}
              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => { setDeleteError(''); setConfirmDeleteOpen(true); }}
                  className="px-7 py-2.5 rounded-full bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-sm shadow-sm active:scale-95 transition"
                >
                  حذف الحساب
                </button>
              </div>
            </>
          )}

          {tab === 'orders' && (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-xl md:text-2xl font-extrabold text-[#252a31]">طلباتي ({orders.length})</h1>
                <button type="button" onClick={() => navigate('track-order')} className="text-xs font-bold text-[#fe9931] hover:underline">
                  تتبع برقم الطلب
                </button>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                {orders.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <Package className="w-10 h-10 text-gray-300 mx-auto" />
                    <p className="text-sm text-gray-400">لا توجد طلبات مسجلة على حسابك حتى الآن.</p>
                    <button type="button" onClick={() => navigate('shop', { category: 'all' })} className="px-5 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold">
                      تصفح العطور
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map(o => (
                      <div key={o.id} className="p-4 rounded-xl border border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-bold text-[#252a31]" dir="ltr">{o.order_number}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{new Date(o.created_at).toLocaleDateString('ar-EG')} • {o.items.length} عطور</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-amber-50 text-[#fe9931] text-xs font-bold">
                          {ORDER_STATUS_AR[o.order_status] || o.order_status}
                        </span>
                        <span className="font-bold text-[#252a31]">{formatEGP(o.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'addresses' && (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-xl md:text-2xl font-extrabold text-[#252a31]">عناويني</h1>
                <button
                  type="button"
                  onClick={() => setShowAddrForm(v => !v)}
                  className="px-4 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عنوان</span>
                </button>
              </div>

              {showAddrForm && (
                <form onSubmit={handleAddAddress} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" value={addrTitle} onChange={e => setAddrTitle(e.target.value)} placeholder="التسمية (المنزل / العمل)" className="px-3.5 py-2.5 border rounded-xl" required />
                    <select value={addrGov} onChange={e => setAddrGov(e.target.value)} className="px-3.5 py-2.5 border rounded-xl bg-white">
                      {egyptianGovernorates.map(g => <option key={g.name_ar} value={g.name_ar}>{g.name_ar}</option>)}
                    </select>
                    <input type="text" value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="المدينة / المنطقة" className="px-3.5 py-2.5 border rounded-xl" required />
                  </div>
                  <input type="text" value={addrDetails} onChange={e => setAddrDetails(e.target.value)} placeholder="العنوان بالتفصيل (الشارع، العمارة، الدور)" className="w-full px-3.5 py-2.5 border rounded-xl" required />
                  <label className="flex items-center gap-2 font-bold">
                    <input type="checkbox" checked={addrDefault} onChange={e => setAddrDefault(e.target.checked)} className="accent-[#fe9931]" />
                    <span>تعيين كعنوان افتراضي</span>
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="px-5 py-2 rounded-full bg-[#fe9931] text-white font-bold">حفظ العنوان</button>
                    <button type="button" onClick={() => setShowAddrForm(false)} className="px-5 py-2 rounded-full border border-gray-200 font-bold">إلغاء</button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {(user.addresses || []).length === 0 ? (
                  <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-400">
                    لا توجد عناوين محفوظة بعد. أضف عنوانك لسرعة إتمام الطلب.
                  </div>
                ) : (user.addresses || []).map(addr => (
                  <div key={addr.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-start justify-between gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#252a31]">{addr.title}</span>
                        {addr.isDefault && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[#fe9931] text-[10px] font-bold">افتراضي</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{addr.governorate} - {addr.city}</p>
                      <p className="text-xs text-gray-700 mt-0.5">{addr.details}</p>
                    </div>
                    <button type="button" onClick={() => deleteAddress(addr.id)} className="p-2 text-gray-400 hover:text-red-600 transition" aria-label="حذف العنوان">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Edit Field Modal */}
      {editField && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditField(null)}>
          <form onSubmit={submitEdit} onClick={e => e.stopPropagation()} className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-[#252a31]">
                {editField === 'name' && 'تعديل الاسم'}
                {editField === 'email' && 'تعديل البريد الإلكتروني'}
                {editField === 'phone' && 'تعديل رقم الهاتف'}
                {editField === 'password' && 'تعديل كلمة السر'}
              </h3>
              <button type="button" onClick={() => setEditField(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {statusBanner && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold">{statusBanner.msg}</div>
            )}

            {editField === 'password' ? (
              <div className="space-y-3 text-xs">
                {user.provider !== 'google' && (
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">كلمة السر الحالية</label>
                    <input type="password" required value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full px-3.5 py-2.5 border rounded-xl" />
                  </div>
                )}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">كلمة السر الجديدة (6 أحرف فأكثر)</label>
                  <input type="password" required minLength={6} value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full px-3.5 py-2.5 border rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">تأكيد كلمة السر الجديدة</label>
                  <input type="password" required minLength={6} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full px-3.5 py-2.5 border rounded-xl" />
                </div>
              </div>
            ) : (
              <div className="text-xs">
                <label className="block font-bold text-gray-700 mb-1">
                  {editField === 'name' ? 'الاسم الكامل' : editField === 'email' ? 'البريد الإلكتروني الجديد' : 'رقم الهاتف (مثال: 01xxxxxxxxx)'}
                </label>
                <input
                  type={editField === 'email' ? 'email' : editField === 'phone' ? 'tel' : 'text'}
                  dir={editField === 'name' ? 'rtl' : 'ltr'}
                  required
                  value={fieldValue}
                  onChange={e => setFieldValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-[#fe9931]"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-full bg-[#fe9931] text-white font-bold text-xs disabled:opacity-50">
                {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
              <button type="button" onClick={() => setEditField(null)} className="px-5 py-2.5 rounded-full border border-gray-200 text-xs font-bold">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Permanent Delete Account Confirmation Modal */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDeleteOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-[#252a31]">تأكيد حذف الحساب نهائياً</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              سيتم حذف حسابك (<strong dir="ltr">{user.email}</strong>) وجميع جلسات الدخول والعناوين المحفوظة من قاعدة البيانات بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
            </p>
            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold">{deleteError}</div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteAccount}
                className="flex-1 py-2.5 rounded-full bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs disabled:opacity-50"
              >
                {deleting ? 'جاري حذف الحساب...' : 'نعم، احذف حسابي نهائياً'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-5 py-2.5 rounded-full border border-gray-200 text-xs font-bold text-[#252a31]"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
