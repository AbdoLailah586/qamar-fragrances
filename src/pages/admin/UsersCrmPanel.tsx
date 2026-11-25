import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, Trash2, Eye, ShoppingCart, Package, Clock, Calendar,
  Search, Shield, RefreshCw, X, CheckCircle2, AlertCircle, MessageCircle,
  MapPin, ExternalLink, Sparkles, Mail, Phone, Globe, Megaphone, Smartphone, Monitor
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { neonDb } from '../../services/neonDb';
import { formatEGP } from '../../utils/arabicNumbers';
import { whatsappUrl } from '../../utils/whatsappService';
import { ADMIN_SECTIONS, OWNER_EMAIL } from '../../../lib/access.js';

interface RecentViewItem {
  product_id: string;
  name_ar: string;
  handle: string;
  category: string;
  price: number;
  image: string;
  viewed_at: string;
  view_count: number;
}

interface InsightsPayload {
  kind: 'user' | 'guest';
  profile: any;
  recentViews: RecentViewItem[];
  recentActions: any[];
  activeCarts: any[];
  orders: any[];
  reviews?: any[];
  topCategories: { category: string; score: number }[];
  stats: {
    total_orders: number;
    executed_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    total_spent: number;
    views_count: number;
  };
}

function formatDateTimeAr(raw?: string | null): string {
  if (!raw) return 'غير مسجل بعد';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return 'غير مسجل بعد';
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getRelativePresence(raw?: string | null): { label: string; isOnline: boolean } {
  if (!raw) return { label: 'لا يوجد نشاط مسجل', isOnline: false };
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return { label: 'غير معروف', isOnline: false };
  const diffMin = Math.floor((Date.now() - ts) / 60_000);
  if (diffMin < 5) return { label: 'متصل الآن', isOnline: true };
  if (diffMin < 60) return { label: `منذ ${diffMin} دقيقة`, isOnline: false };
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return { label: `منذ ${diffHr} ساعة`, isOnline: false };
  const diffDay = Math.floor(diffHr / 24);
  return { label: `منذ ${diffDay} يوم`, isOnline: false };
}

function sourceBadgeStyle(channel?: string | null): string {
  const c = String(channel || 'direct');
  if (c.startsWith('facebook')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (c.startsWith('instagram')) return 'bg-pink-50 text-pink-700 border-pink-200';
  if (c.startsWith('tiktok')) return 'bg-slate-900 text-white border-slate-900';
  if (c.startsWith('google')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (c === 'whatsapp') return 'bg-green-50 text-green-700 border-green-200';
  if (c === 'campaign' || c === 'paid_campaign' || c === 'referral') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

const SourceBadge: React.FC<{ channel?: string | null; label?: string | null; campaign?: string | null }> = ({
  channel,
  label,
  campaign
}) => {
  if (!channel && !label) return null;
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-flex items-center gap-1 ${sourceBadgeStyle(channel)}`}
    >
      <Megaphone className="w-3 h-3 shrink-0" />
      <span>{label || 'دخول مباشر'}</span>
      {campaign ? <span className="opacity-80">• {campaign}</span> : null}
    </span>
  );
};

export const UsersCrmPanel: React.FC = () => {
  const { user: currentAdmin, isAdmin: isCurrentFullAdmin } = useAuth();
  const [crmView, setCrmView] = useState<'registered' | 'guests'>('registered');

  const [users, setUsers] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'staff' | 'customers' | 'with_cart' | 'with_orders'>('all');
  const [guestFilter, setGuestFilter] = useState<'all' | 'meta' | 'tiktok' | 'google' | 'with_cart' | 'identified'>('all');
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  // Add account modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleType, setNewRoleType] = useState<'customer' | 'staff' | 'admin'>('customer');
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Delete confirmation modal state (user or guest)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'user' | 'guest'; item: any } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Unified Insights Modal (registered users + guest visitors)
  const [insightsSubject, setInsightsSubject] = useState<{ kind: 'user' | 'guest'; item: any } | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsPayload | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsTab, setInsightsTab] = useState<'overview' | 'views' | 'cart' | 'orders'>('overview');
  const [orderSubFilter, setOrderSubFilter] = useState<'executed' | 'all' | 'delivered' | 'cancelled'>('executed');

  const loadAllCrmData = async () => {
    setLoading(true);
    try {
      const [uList, gList] = await Promise.all([
        neonDb.getAllUsers().catch(() => []),
        neonDb.getGuestVisitors(120).catch(() => [])
      ]);
      setUsers(Array.isArray(uList) ? uList : []);
      setGuests(Array.isArray(gList) ? gList : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllCrmData();
  }, []);

  const openInsights = async (
    kind: 'user' | 'guest',
    item: any,
    initialTab: 'overview' | 'views' | 'cart' | 'orders' = 'overview'
  ) => {
    setInsightsSubject({ kind, item });
    setInsightsTab(initialTab);
    setOrderSubFilter('executed');
    setInsightsLoading(true);
    setInsightsData(null);
    try {
      if (kind === 'user') {
        const res = await neonDb.getUserInsights(item.id);
        if (res?.success) {
          setInsightsData({
            kind: 'user',
            profile: res.user,
            recentViews: res.recentViews || [],
            recentActions: res.recentActions || [],
            activeCarts: res.activeCarts || [],
            orders: res.orders || [],
            reviews: res.reviews || [],
            topCategories: res.topCategories || [],
            stats: res.stats
          });
        } else {
          setBanner({ ok: false, text: res?.error || 'تعذر تحميل تفاصيل الحساب.' });
        }
      } else {
        const res = await neonDb.getGuestInsights(item.session_id);
        if (res?.success) {
          setInsightsData({
            kind: 'guest',
            profile: res.guest,
            recentViews: res.recentViews || [],
            recentActions: res.recentActions || [],
            activeCarts: res.activeCarts || [],
            orders: res.orders || [],
            topCategories: res.topCategories || [],
            stats: res.stats
          });
        } else {
          setBanner({ ok: false, text: res?.error || 'تعذر تحميل تفاصيل الزائر.' });
        }
      }
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setBanner(null);
    try {
      const res = await neonDb.adminCreateUser({
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        password: newPassword,
        role: newRoleType === 'admin' ? 'admin' : 'customer',
        permissions: newRoleType === 'staff' ? newPerms : []
      });
      if (res?.success) {
        setShowAddModal(false);
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewPassword('');
        setNewRoleType('customer');
        setNewPerms([]);
        setBanner({ ok: true, text: `تم إنشاء حساب ${res.user?.name || newEmail} بنجاح.` });
        await loadAllCrmData();
      } else {
        setBanner({ ok: false, text: res?.error || 'تعذر إنشاء الحساب.' });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'user') {
        const res = await neonDb.deleteUser(deleteTarget.item.id);
        if (res?.success) {
          setBanner({ ok: true, text: `تم حذف حساب ${deleteTarget.item.name || deleteTarget.item.email} نهائياً.` });
          if (insightsSubject?.kind === 'user' && insightsSubject.item.id === deleteTarget.item.id) setInsightsSubject(null);
          setDeleteTarget(null);
          await loadAllCrmData();
        } else {
          setBanner({ ok: false, text: res?.error || 'تعذر حذف الحساب.' });
        }
      } else {
        const res = await neonDb.deleteGuestVisitor(deleteTarget.item.session_id);
        if (res?.success) {
          setBanner({ ok: true, text: `تم حذف سجل الزائر بنجاح.` });
          if (insightsSubject?.kind === 'guest' && insightsSubject.item.session_id === deleteTarget.item.session_id) setInsightsSubject(null);
          setDeleteTarget(null);
          await loadAllCrmData();
        } else {
          setBanner({ ok: false, text: res?.error || 'تعذر حذف سجل الزائر.' });
        }
      }
    } finally {
      setDeleting(false);
    }
  };

  const userSummary = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      total: users.length,
      staff: users.filter(u => u.role === 'admin' || (u.admin_permissions || []).length > 0).length,
      active24h: users.filter(u => new Date(u.last_activity_at || u.last_seen_at || 0).getTime() >= oneDayAgo).length,
      withCart: users.filter(u => Number(u.cart_items_count || 0) > 0).length,
      executedOrders: users.reduce((s, u) => s + Number(u.completed_orders_count || 0), 0)
    };
  }, [users]);

  const guestSummary = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      total: guests.length,
      active24h: guests.filter(g => new Date(g.last_seen_at || 0).getTime() >= oneDayAgo).length,
      socialAds: guests.filter(g => /^(facebook|instagram|tiktok)/i.test(String(g.source_channel || ''))).length,
      google: guests.filter(g => /^google/i.test(String(g.source_channel || ''))).length,
      withCart: guests.filter(g => Number(g.cart_items_count || 0) > 0).length
    };
  }, [guests]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (userFilter === 'staff' && !(u.role === 'admin' || (u.admin_permissions || []).length > 0)) return false;
      if (userFilter === 'customers' && (u.role === 'admin' || (u.admin_permissions || []).length > 0)) return false;
      if (userFilter === 'with_cart' && Number(u.cart_items_count || 0) <= 0) return false;
      if (userFilter === 'with_orders' && Number(u.completed_orders_count || 0) <= 0) return false;
      if (!q) return true;
      return (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.phone || '').toLowerCase().includes(q) ||
        String(u.source_label || '').toLowerCase().includes(q)
      );
    });
  }, [users, search, userFilter]);

  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter(g => {
      const ch = String(g.source_channel || 'direct').toLowerCase();
      if (guestFilter === 'meta' && !ch.startsWith('facebook') && !ch.startsWith('instagram')) return false;
      if (guestFilter === 'tiktok' && !ch.startsWith('tiktok')) return false;
      if (guestFilter === 'google' && !ch.startsWith('google')) return false;
      if (guestFilter === 'with_cart' && Number(g.cart_items_count || 0) <= 0) return false;
      if (guestFilter === 'identified' && !g.customer_phone && Number(g.completed_orders_count || 0) <= 0) return false;
      if (!q) return true;
      return (
        String(g.customer_name || '').toLowerCase().includes(q) ||
        String(g.customer_phone || '').toLowerCase().includes(q) ||
        String(g.session_id || '').toLowerCase().includes(q) ||
        String(g.source_label || '').toLowerCase().includes(q) ||
        String(g.utm_campaign || '').toLowerCase().includes(q)
      );
    });
  }, [guests, search, guestFilter]);

  const displayedCartItems = useMemo(() => {
    if (!insightsData?.activeCarts?.length) return [];
    return insightsData.activeCarts.flatMap((c: any) =>
      (Array.isArray(c.items) ? c.items : []).map((it: any) => ({
        ...it,
        session_id: c.session_id,
        is_abandoned: c.is_abandoned,
        last_updated_at: c.last_updated_at
      }))
    );
  }, [insightsData]);

  const filteredInsightOrders = useMemo(() => {
    const list = insightsData?.orders || [];
    if (orderSubFilter === 'executed') return list.filter(o => o.order_status !== 'cancelled');
    if (orderSubFilter === 'delivered') return list.filter(o => o.order_status === 'delivered');
    if (orderSubFilter === 'cancelled') return list.filter(o => o.order_status === 'cancelled');
    return list;
  }, [insightsData, orderSubFilter]);

  const subjectPhone = insightsSubject
    ? insightsData?.profile?.customer_phone || insightsData?.profile?.phone || insightsSubject.item?.customer_phone || insightsSubject.item?.phone || ''
    : '';
  const subjectName = insightsSubject
    ? insightsData?.profile?.customer_name ||
      insightsData?.profile?.name ||
      insightsSubject.item?.customer_name ||
      insightsSubject.item?.name ||
      `زائر #${String(insightsSubject.item?.session_id || '').slice(-6)}`
    : '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#fe9931]" />
            <span>المستخدمون وصلاحيات الفريق وتحليلات العملاء والزوار</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            تتبع الحسابات المسجلة والزوار بدون حساب، مصادر الإعلانات (فيسبوك / إنستجرام / تيك توك / بحث جوجل)، آخر 15 منتج، السلة، والأوردرات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAllCrmData()}
            className="px-3.5 py-2 rounded-full border border-gray-200 bg-white hover:border-[#fe9931] text-xs font-bold text-[#252a31] flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          {isCurrentFullAdmin && (
            <button
              type="button"
              data-testid="btn-open-add-user"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-full bg-[#fe9931] hover:bg-[#e88520] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة حساب جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary View Tabs: Registered Users vs Guest Visitors */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="tab-registered-users"
          onClick={() => setCrmView('registered')}
          className={`px-5 py-2.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition-all ${
            crmView === 'registered'
              ? 'bg-[#252a31] text-white border-[#252a31] shadow-sm'
              : 'bg-white text-[#252a31] border-gray-200 hover:border-[#fe9931]'
          }`}
        >
          <Users className="w-4 h-4 text-[#fe9931]" />
          <span>الحسابات المسجلة ({users.length})</span>
        </button>

        <button
          type="button"
          data-testid="tab-guests-crm"
          onClick={() => setCrmView('guests')}
          className={`px-5 py-2.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition-all ${
            crmView === 'guests'
              ? 'bg-[#252a31] text-white border-[#252a31] shadow-sm'
              : 'bg-white text-[#252a31] border-gray-200 hover:border-[#fe9931]'
          }`}
        >
          <Megaphone className="w-4 h-4 text-[#fe9931]" />
          <span>الزوار بدون حساب — تتبع الإعلانات وجوجل ({guests.length})</span>
        </button>
      </div>

      {/* KPI Strip */}
      {crmView === 'registered' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">إجمالي الحسابات</p>
            <p className="text-xl font-extrabold text-[#252a31] mt-0.5">{userSummary.total}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">الإدارة والموظفون</p>
            <p className="text-xl font-extrabold text-[#fe9931] mt-0.5">{userSummary.staff}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">نشطين خلال 24 ساعة</p>
            <p className="text-xl font-extrabold text-green-600 mt-0.5">{userSummary.active24h}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">لديهم أصناف بالسلة الآن</p>
            <p className="text-xl font-extrabold text-amber-600 mt-0.5">{userSummary.withCart}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-gray-400">إجمالي الأوردرات المنفذة</p>
            <p className="text-xl font-extrabold text-[#252a31] mt-0.5">{userSummary.executedOrders}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">إجمالي الزوار بدون حساب</p>
            <p className="text-xl font-extrabold text-[#252a31] mt-0.5">{guestSummary.total}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">زوار نشطين (24 ساعة)</p>
            <p className="text-xl font-extrabold text-green-600 mt-0.5">{guestSummary.active24h}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">إعلانات سوشيال (FB / IG / TT)</p>
            <p className="text-xl font-extrabold text-blue-600 mt-0.5">{guestSummary.socialAds}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-gray-400">بحث وإعلانات جوجل</p>
            <p className="text-xl font-extrabold text-[#fe9931] mt-0.5">{guestSummary.google}</p>
          </div>
          <div className="bg-white border rounded-2xl p-3.5 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-gray-400">لديهم سلة نشطة الآن</p>
            <p className="text-xl font-extrabold text-amber-600 mt-0.5">{guestSummary.withCart}</p>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
            banner.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {banner.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white border rounded-2xl p-3.5 flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={
              crmView === 'registered'
                ? 'ابحث بالاسم أو البريد أو الهاتف أو المصدر...'
                : 'ابحث برقم الهاتف أو الاسم أو مصدر الإعلان أو اسم الحملة...'
            }
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#fe9931]"
          />
        </div>

        {crmView === 'registered' ? (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {(
              [
                { id: 'all', label: `الكل (${userSummary.total})` },
                { id: 'staff', label: `الإدارة (${userSummary.staff})` },
                { id: 'customers', label: 'العملاء فقط' },
                { id: 'with_cart', label: `بسلة نشطة (${userSummary.withCart})` },
                { id: 'with_orders', label: 'لديهم طلبات' }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setUserFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full border transition-colors ${
                  userFilter === tab.id
                    ? 'bg-[#252a31] text-white border-[#252a31]'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#fe9931]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {(
              [
                { id: 'all', label: `كل الزوار (${guestSummary.total})` },
                { id: 'meta', label: 'فيسبوك وإنستجرام' },
                { id: 'tiktok', label: 'تيك توك' },
                { id: 'google', label: `جوجل (${guestSummary.google})` },
                { id: 'with_cart', label: `بسلة الآن (${guestSummary.withCart})` },
                { id: 'identified', label: 'تركوا الهاتف / طلبات' }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGuestFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full border transition-colors ${
                  guestFilter === tab.id
                    ? 'bg-[#252a31] text-white border-[#252a31]'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#fe9931]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* REGISTERED USERS LIST */}
      {crmView === 'registered' && (
        <div className="space-y-3">
          {loading && users.length === 0 ? (
            <div className="bg-white border rounded-2xl p-10 text-center text-xs text-gray-400">جاري تحميل الحسابات والإحصائيات...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white border rounded-2xl p-10 text-center text-xs text-gray-400">لا توجد حسابات مطابقة للبحث الحالي.</div>
          ) : (
            filteredUsers.map(u => {
              const isProtectedOwner = String(u.email || '').toLowerCase() === OWNER_EMAIL;
              const isSelf = currentAdmin?.id === u.id;
              const presence = getRelativePresence(u.last_activity_at || u.last_seen_at);
              const hasCart = Number(u.cart_items_count || 0) > 0;

              return (
                <div key={u.id} data-testid={`admin-user-card-${u.id}`} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 text-xs hover:border-orange-200 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} className="w-11 h-11 rounded-full object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-orange-50 text-[#fe9931] font-extrabold flex items-center justify-center border border-orange-100 shrink-0 text-sm">
                          {String(u.name || u.email || 'ق').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-extrabold text-sm text-[#252a31]">{u.name || 'عميل قمر للعطور'}</p>
                          {isProtectedOwner && (
                            <span className="px-2 py-0.5 rounded-full bg-[#252a31] text-white text-[10px] font-bold flex items-center gap-1">
                              <Shield className="w-3 h-3 text-[#fe9931]" /> المالك المحمي
                            </span>
                          )}
                          {isSelf && !isProtectedOwner && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#fe9931] text-[10px] font-bold">حسابك الحالي</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                            {u.provider === 'google' ? 'Google' : 'Email'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              presence.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${presence.isOnline ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                            {presence.label}
                          </span>
                          <SourceBadge channel={u.source_channel} label={u.source_label} campaign={u.utm_campaign} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500">
                          <span dir="ltr" className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</span>
                          {u.phone && <span dir="ltr" className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {u.phone}</span>}
                          {u.device_type && <span className="inline-flex items-center gap-1 text-[11px]">{u.device_type}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid={`btn-user-insights-${u.id}`}
                        onClick={() => void openInsights('user', u, 'overview')}
                        className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#fe9931] text-[#252a31] hover:text-white border border-orange-200 font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تحليلات الحساب والسلة والطلبات</span>
                      </button>

                      <select
                        value={u.role}
                        disabled={isProtectedOwner || isSelf || !isCurrentFullAdmin}
                        onChange={async e => {
                          const res = await neonDb.updateUserAccess(u.id, { role: e.target.value as any, permissions: u.admin_permissions || [] });
                          if (res.success) {
                            setBanner({ ok: true, text: `تم تحديث صلاحية ${u.name}` });
                            await loadAllCrmData();
                          } else {
                            setBanner({ ok: false, text: res?.error || 'تعذر تحديث الصلاحية' });
                          }
                        }}
                        className="px-3 py-1.5 border rounded-xl bg-white disabled:bg-gray-100 disabled:text-gray-400 font-bold"
                      >
                        <option value="customer">Customer / Limited Staff</option>
                        <option value="admin">Full Admin</option>
                      </select>

                      {isCurrentFullAdmin && !isProtectedOwner && !isSelf && (
                        <button
                          type="button"
                          data-testid={`btn-delete-user-${u.id}`}
                          onClick={() => setDeleteTarget({ kind: 'user', item: u })}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 font-bold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف الحساب</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-gray-100">
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Calendar className="w-3 h-3" /> تاريخ الإنشاء</p>
                      <p className="font-bold text-[#252a31] mt-0.5 truncate">{formatDateTimeAr(u.created_at)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> آخر ترافيك / أونلاين</p>
                      <p className="font-bold text-[#252a31] mt-0.5 truncate">{formatDateTimeAr(u.last_activity_at || u.last_seen_at)}</p>
                    </div>
                    <button type="button" onClick={() => void openInsights('user', u, 'views')} className="bg-gray-50 hover:bg-orange-50 rounded-xl px-3 py-2 text-right transition-colors">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Eye className="w-3 h-3 text-[#fe9931]" /> عطور زارها</p>
                      <p className="font-extrabold text-[#252a31] mt-0.5">{u.views_count || 0} منتج (عرض آخر 15)</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void openInsights('user', u, 'cart')}
                      className={`rounded-xl px-3 py-2 text-right transition-colors ${hasCart ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200' : 'bg-gray-50 hover:bg-orange-50'}`}
                    >
                      <p className="text-[10px] text-gray-500 font-bold flex items-center gap-1"><ShoppingCart className="w-3 h-3 text-[#fe9931]" /> في السلة الآن</p>
                      <p className="font-extrabold text-[#252a31] mt-0.5">
                        {hasCart ? `${u.cart_items_count} صنف • ${formatEGP(Number(u.cart_subtotal || 0), false)}` : 'السلة فارغة'}
                      </p>
                    </button>
                    <button type="button" onClick={() => void openInsights('user', u, 'orders')} className="bg-gray-50 hover:bg-orange-50 rounded-xl px-3 py-2 text-right transition-colors">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Package className="w-3 h-3 text-[#fe9931]" /> الأوردرات المنفذة</p>
                      <p className="font-extrabold text-[#252a31] mt-0.5">
                        {u.completed_orders_count || 0} منفذ • {formatEGP(Number(u.total_spent || 0), false)}
                      </p>
                    </button>
                  </div>

                  {u.role !== 'admin' && isCurrentFullAdmin && (
                    <div className="pt-1 space-y-1.5">
                      <p className="text-[10px] font-bold text-gray-400">صلاحيات الموظف المخصصة للأقسام:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ADMIN_SECTIONS.map(sec => {
                          const has = (u.admin_permissions || []).includes(sec);
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={async () => {
                                const next = has
                                  ? (u.admin_permissions || []).filter((s: string) => s !== sec)
                                  : [...(u.admin_permissions || []), sec];
                                await neonDb.updateUserAccess(u.id, { role: 'customer', permissions: next });
                                await loadAllCrmData();
                              }}
                              className={`px-2.5 py-1 rounded-full border ${
                                has ? 'bg-[#fe9931] text-white border-[#fe9931]' : 'bg-gray-50 text-gray-600'
                              }`}
                            >
                              {sec}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* GUEST VISITORS LIST */}
      {crmView === 'guests' && (
        <div className="space-y-3">
          {loading && guests.length === 0 ? (
            <div className="bg-white border rounded-2xl p-10 text-center text-xs text-gray-400">جاري تحميل بيانات الزوار ومصادر الزيارات...</div>
          ) : filteredGuests.length === 0 ? (
            <div className="bg-white border rounded-2xl p-10 text-center text-xs text-gray-400">لا توجد جلسات زوار مطابقة للبحث الحالي.</div>
          ) : (
            filteredGuests.map(g => {
              const presence = getRelativePresence(g.last_seen_at);
              const hasCart = Number(g.cart_items_count || 0) > 0;
              const isMobile = String(g.device_type || '').includes('موبايل');
              const labelName = g.customer_name || `زائر #${String(g.session_id || '').slice(-6)}`;

              return (
                <div key={g.session_id} data-testid={`guest-card-${g.session_id}`} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 text-xs hover:border-orange-200 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-gray-100 text-[#252a31] font-extrabold flex items-center justify-center border border-gray-200 shrink-0">
                        {isMobile ? <Smartphone className="w-5 h-5 text-[#fe9931]" /> : <Monitor className="w-5 h-5 text-[#fe9931]" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-extrabold text-sm text-[#252a31]">{labelName}</p>
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">بدون حساب</span>
                          <SourceBadge channel={g.source_channel} label={g.source_label} campaign={g.utm_campaign} />
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              presence.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${presence.isOnline ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                            {presence.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500">
                          <span dir="ltr" className="text-[11px] font-mono text-gray-400">{g.session_id}</span>
                          {g.customer_phone && (
                            <span dir="ltr" className="inline-flex items-center gap-1 font-bold text-[#252a31]">
                              <Phone className="w-3 h-3 text-[#fe9931]" /> {g.customer_phone}
                            </span>
                          )}
                          {g.device_type && <span>• {g.device_type}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid={`btn-guest-insights-${g.session_id}`}
                        onClick={() => void openInsights('guest', g, 'overview')}
                        className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#fe9931] text-[#252a31] hover:text-white border border-orange-200 font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تحليلات الزائر والسلة والمصدر</span>
                      </button>

                      {g.customer_phone && (
                        <a
                          href={whatsappUrl(g.customer_phone, `أهلاً بك ${g.customer_name || ''} من قمر للعطور ✨ لاحظنا تصفحك لعطورنا ويسعدنا مساعدتك في إتمام طلبك.`)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-[#25D366] text-white font-bold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </a>
                      )}

                      {isCurrentFullAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ kind: 'guest', item: g })}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 font-bold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف السجل</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-gray-100">
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Calendar className="w-3 h-3" /> أول زيارة</p>
                      <p className="font-bold text-[#252a31] mt-0.5 truncate">{formatDateTimeAr(g.first_seen_at)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> آخر ترافيك / أونلاين</p>
                      <p className="font-bold text-[#252a31] mt-0.5 truncate">{formatDateTimeAr(g.last_seen_at)}</p>
                    </div>
                    <button type="button" onClick={() => void openInsights('guest', g, 'views')} className="bg-gray-50 hover:bg-orange-50 rounded-xl px-3 py-2 text-right transition-colors">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Eye className="w-3 h-3 text-[#fe9931]" /> عطور زارها</p>
                      <p className="font-extrabold text-[#252a31] mt-0.5">{g.views_count || 0} منتج (عرض آخر 15)</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void openInsights('guest', g, 'cart')}
                      className={`rounded-xl px-3 py-2 text-right transition-colors ${hasCart ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200' : 'bg-gray-50 hover:bg-orange-50'}`}
                    >
                      <p className="text-[10px] text-gray-500 font-bold flex items-center gap-1"><ShoppingCart className="w-3 h-3 text-[#fe9931]" /> في السلة الآن</p>
                      <p className="font-extrabold text-[#252a31] mt-0.5">
                        {hasCart ? `${g.cart_items_count} صنف • ${formatEGP(Number(g.cart_subtotal || 0), false)}` : 'السلة فارغة'}
                      </p>
                    </button>
                    <button type="button" onClick={() => void openInsights('guest', g, 'orders')} className="bg-gray-50 hover:bg-orange-50 rounded-xl px-3 py-2 text-right transition-colors">
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Package className="w-3 h-3 text-[#fe9931]" /> الأوردرات المنفذة</p>
                      <p className="font-extrabold text-[#252a31] mt-0.5">
                        {g.completed_orders_count || 0} منفذ • {formatEGP(Number(g.total_spent || 0), false)}
                      </p>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <form
            onSubmit={handleCreateUser}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-[#252a31] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#fe9931]" />
                <span>إضافة حساب جديد</span>
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">الاسم الكامل</label>
                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="مثال: أحمد محمد" className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-[#fe9931]" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">رقم الهاتف (اختياري)</label>
                <input type="tel" dir="ltr" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01xxxxxxxxx" className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-[#fe9931]" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">البريد الإلكتروني</label>
                <input type="email" required dir="ltr" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-[#fe9931]" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">كلمة المرور (6 أحرف+)</label>
                <input type="password" required minLength={6} dir="ltr" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:border-[#fe9931]" />
              </div>
            </div>

            <div className="text-xs space-y-2">
              <label className="block font-bold text-gray-700">نوع الحساب والصلاحيات</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'customer', label: 'عميل عادي' },
                    { id: 'staff', label: 'موظف بصلاحيات' },
                    { id: 'admin', label: 'أدمن كامل' }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewRoleType(opt.id)}
                    className={`py-2 px-3 rounded-xl border font-bold ${
                      newRoleType === opt.id ? 'bg-[#fe9931] text-white border-[#fe9931]' : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {newRoleType === 'staff' && (
              <div className="text-xs space-y-2 bg-gray-50 p-3 rounded-2xl border">
                <p className="font-bold text-gray-600">اختر الأقسام المتاحة لهذا الحساب:</p>
                <div className="flex flex-wrap gap-1.5">
                  {ADMIN_SECTIONS.map(sec => {
                    const active = newPerms.includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setNewPerms(prev => (active ? prev.filter(s => s !== sec) : [...prev, sec]))}
                        className={`px-2.5 py-1 rounded-full border ${active ? 'bg-[#fe9931] text-white border-[#fe9931]' : 'bg-white text-gray-600'}`}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-full border text-xs font-bold">إلغاء</button>
              <button type="submit" disabled={creating} className="px-6 py-2 rounded-full bg-[#fe9931] hover:bg-[#e88520] text-white text-xs font-bold disabled:opacity-60">
                {creating ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="font-extrabold text-base text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>{deleteTarget.kind === 'user' ? 'تأكيد حذف الحساب' : 'تأكيد حذف سجل الزائر'}</span>
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {deleteTarget.kind === 'user'
                ? `هل أنت متأكد من حذف حساب ${deleteTarget.item.name || deleteTarget.item.email} (${deleteTarget.item.email}) نهائياً؟`
                : `هل أنت متأكد من مسح سجل تتبع الزائر (${deleteTarget.item.session_id}) وسلته المؤقتة؟`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-full border text-xs font-bold">تراجع</button>
              <button type="button" disabled={deleting} onClick={handleConfirmDelete} className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-60">
                {deleting ? 'جاري الحذف...' : deleteTarget.kind === 'user' ? 'نعم، احذف الحساب نهائياً' : 'نعم، احذف السجل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Insights Modal (Registered Users + Guest Visitors) */}
      {insightsSubject && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" onClick={() => setInsightsSubject(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3 bg-[#fff9f2]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#fe9931] text-white font-extrabold flex items-center justify-center">
                  {String(subjectName || 'Q').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-extrabold text-base text-[#252a31]">{subjectName}</h3>
                    <SourceBadge
                      channel={insightsData?.profile?.source_channel || insightsSubject.item?.source_channel}
                      label={insightsData?.profile?.source_label || insightsSubject.item?.source_label}
                      campaign={insightsData?.profile?.utm_campaign || insightsSubject.item?.utm_campaign}
                    />
                  </div>
                  <p className="text-xs text-gray-500" dir="ltr">
                    {insightsSubject.kind === 'user' ? insightsSubject.item.email : insightsSubject.item.session_id}{' '}
                    {subjectPhone ? `• ${subjectPhone}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {subjectPhone && (
                  <a
                    href={whatsappUrl(subjectPhone, `مرحباً ${subjectName}، معك فريق خدمة عملاء قمر للعطور ✨`)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-full bg-[#25D366] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>مراسلة واتساب</span>
                  </a>
                )}
                <button type="button" onClick={() => setInsightsSubject(null)} className="p-2 rounded-full bg-white border hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b bg-gray-50 flex flex-wrap gap-2 text-xs font-bold">
              {(
                [
                  { id: 'overview', label: 'التفاصيل ومصدر الإعلان' },
                  { id: 'views', label: `آخر 15 منتج زارهم (${insightsData?.recentViews?.length ?? 0})` },
                  { id: 'cart', label: `السلة الآن (${displayedCartItems.length})` },
                  { id: 'orders', label: `الأوردرات المنفذة (${insightsData?.stats?.total_orders ?? 0})` }
                ] as const
              ).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInsightsTab(t.id)}
                  className={`px-3.5 py-2 rounded-full border transition-colors ${
                    insightsTab === t.id ? 'bg-[#252a31] text-white border-[#252a31]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#fe9931]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {insightsLoading ? (
                <div className="py-16 text-center text-gray-400 font-bold">جاري تحميل التحليلات الكاملة...</div>
              ) : !insightsData ? (
                <div className="py-16 text-center text-red-500 font-bold">تعذر تحميل التحليلات.</div>
              ) : (
                <>
                  {insightsTab === 'overview' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gray-50 border rounded-2xl p-3.5">
                          <p className="text-[11px] text-gray-400 font-bold">الأوردرات المنفذة</p>
                          <p className="text-xl font-extrabold text-[#252a31] mt-1">{insightsData.stats.executed_orders}</p>
                        </div>
                        <div className="bg-gray-50 border rounded-2xl p-3.5">
                          <p className="text-[11px] text-gray-400 font-bold">تم تسليمها بالفعل</p>
                          <p className="text-xl font-extrabold text-green-600 mt-1">{insightsData.stats.delivered_orders}</p>
                        </div>
                        <div className="bg-gray-50 border rounded-2xl p-3.5">
                          <p className="text-[11px] text-gray-400 font-bold">إجمالي الإنفاق</p>
                          <p className="text-xl font-extrabold text-[#fe9931] mt-1">{formatEGP(insightsData.stats.total_spent, false)}</p>
                        </div>
                        <div className="bg-gray-50 border rounded-2xl p-3.5">
                          <p className="text-[11px] text-gray-400 font-bold">عطور تصفحها</p>
                          <p className="text-xl font-extrabold text-[#252a31] mt-1">{insightsData.stats.views_count}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border rounded-2xl p-4 space-y-2.5">
                          <h4 className="font-extrabold text-sm text-[#252a31]">مصدر الزيارة والإعلان والجهاز</h4>
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-gray-500">القناة / المصدر:</span>
                            <span className="font-bold">{insightsData.profile.source_label || 'دخول مباشر'}</span>
                          </div>
                          {insightsData.profile.utm_campaign && (
                            <div className="flex justify-between py-1 border-b border-gray-100">
                              <span className="text-gray-500">الحملة الإعلانية (utm_campaign):</span>
                              <span className="font-bold text-[#fe9931]">{insightsData.profile.utm_campaign}</span>
                            </div>
                          )}
                          {insightsData.profile.utm_medium && (
                            <div className="flex justify-between py-1 border-b border-gray-100">
                              <span className="text-gray-500">الوسيط (utm_medium):</span>
                              <span className="font-bold">{insightsData.profile.utm_medium}</span>
                            </div>
                          )}
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-gray-500">نوع الجهاز:</span>
                            <span className="font-bold">{insightsData.profile.device_type || 'غير مسجل'}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-gray-500">{insightsData.kind === 'user' ? 'تاريخ إنشاء الحساب:' : 'أول زيارة:'}</span>
                            <span className="font-bold">{formatDateTimeAr(insightsData.profile.created_at || insightsData.profile.first_seen_at)}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-gray-500">آخر ترافيك / أونلاين:</span>
                            <span className="font-bold">{formatDateTimeAr(insightsData.profile.last_activity_at || insightsData.profile.last_seen_at)}</span>
                          </div>
                          {insightsData.profile.landing_path && (
                            <div className="flex justify-between py-1 border-t border-gray-100">
                              <span className="text-gray-500">أول صفحة هبوط:</span>
                              <span className="font-mono text-[11px] truncate max-w-[200px]" dir="ltr">{insightsData.profile.landing_path}</span>
                            </div>
                          )}
                        </div>

                        <div className="border rounded-2xl p-4 space-y-3">
                          <h4 className="font-extrabold text-sm text-[#252a31]">أكثر التصنيفات العطرية اهتماماً</h4>
                          {insightsData.topCategories.length === 0 ? (
                            <p className="text-gray-400">لا توجد بيانات تصنيفات كافية بعد.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {insightsData.topCategories.map(c => (
                                <span key={c.category} className="px-3 py-1.5 rounded-full bg-orange-50 text-[#252a31] border border-orange-200 font-bold">
                                  {c.category} • {c.score} نقاط اهتمام
                                </span>
                              ))}
                            </div>
                          )}

                          {insightsData.kind === 'user' && (
                            <>
                              <h4 className="font-extrabold text-sm text-[#252a31] pt-2">العناوين المحفوظة ({(insightsData.profile.addresses || []).length})</h4>
                              {(insightsData.profile.addresses || []).length === 0 ? (
                                <p className="text-gray-400">لم يضف العميل عناوين محفوظة بعد.</p>
                              ) : (
                                <div className="space-y-2">
                                  {(insightsData.profile.addresses || []).map((a: any) => (
                                    <div key={a.id} className="bg-gray-50 rounded-xl p-2.5 flex justify-between items-center gap-2">
                                      <div>
                                        <p className="font-bold">{a.title || a.governorate} — {a.city}</p>
                                        <p className="text-gray-500">{a.address_details || a.details}</p>
                                      </div>
                                      {a.google_maps_url && (
                                        <a href={a.google_maps_url} target="_blank" rel="noreferrer" className="text-[#fe9931] font-bold flex items-center gap-1 shrink-0">
                                          <MapPin className="w-3.5 h-3.5" /> خريطة
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {insightsData.recentActions.length > 0 && (
                        <div className="border rounded-2xl p-4 space-y-2">
                          <h4 className="font-extrabold text-sm text-[#252a31] flex items-center gap-1.5">
                            <Globe className="w-4 h-4 text-[#fe9931]" />
                            <span>أحدث سجل التصفح والترافيك (Traffic)</span>
                          </h4>
                          <div className="divide-y max-h-48 overflow-y-auto">
                            {insightsData.recentActions.slice(0, 12).map((act: any, idx: number) => (
                              <div key={idx} className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-bold text-[#252a31]">
                                  {act.action_type === 'view_product'
                                    ? `زيارة عطر: ${act.metadata?.name_ar || act.target_id}`
                                    : act.action_type === 'add_to_cart'
                                      ? `إضافة للسلة: ${act.metadata?.size || act.target_id}`
                                      : act.action_type === 'order_placed'
                                        ? `إتمام طلب: ${act.target_id}`
                                        : `نشاط: ${act.action_type} (${act.target_id || '-'})`}
                                </span>
                                <span className="text-gray-400 shrink-0">{formatDateTimeAr(act.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {insightsTab === 'views' && (
                    <div className="space-y-3">
                      <p className="text-gray-500 font-semibold">آخر 15 عطر ومنتج تمت زيارتها (مرتبة من الأحدث):</p>
                      {insightsData.recentViews.length === 0 ? (
                        <div className="py-12 text-center border rounded-2xl text-gray-400 font-bold">لم تُسجل زيارات منتجات بعد.</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {insightsData.recentViews.map((v, idx) => (
                            <div key={`${v.product_id}-${idx}`} className="border rounded-2xl p-3 flex gap-3 items-center hover:border-[#fe9931] transition-colors">
                              <img src={v.image} alt={v.name_ar} className="w-14 h-14 rounded-xl object-cover border shrink-0" />
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-extrabold text-[#252a31] truncate">{v.name_ar}</p>
                                <p className="text-[11px] text-gray-500">{v.price > 0 ? formatEGP(v.price, false) : ''} • زاره {v.view_count} مرة</p>
                                <p className="text-[10px] text-gray-400">{formatDateTimeAr(v.viewed_at)}</p>
                              </div>
                              <a href={`/ar/product/all/${encodeURIComponent(v.handle)}`} target="_blank" rel="noreferrer" title="فتح صفحة المنتج" className="p-1.5 rounded-lg bg-gray-50 hover:bg-[#fe9931] hover:text-white text-gray-500 shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {insightsTab === 'cart' && (
                    <div className="space-y-4">
                      {displayedCartItems.length === 0 ? (
                        <div className="py-12 text-center border rounded-2xl text-gray-400 font-bold">لا توجد أصناف في السلة الآن.</div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                            <div>
                              <p className="font-extrabold text-[#252a31]">
                                حالة السلة: {insightsData.activeCarts[0]?.is_abandoned ? <span className="text-red-600">سلة متروكة</span> : <span className="text-green-700">نشطة الآن</span>}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                آخر تحديث للسلة: {formatDateTimeAr(insightsData.activeCarts[0]?.last_updated_at)} • الإجمالي:{' '}
                                <strong className="text-[#fe9931]">{formatEGP(Number(insightsData.activeCarts[0]?.subtotal || 0), false)}</strong>
                              </p>
                            </div>
                            {subjectPhone && (
                              <a
                                href={whatsappUrl(subjectPhone, `أهلاً بك يا ${subjectName} في قمر للعطور ✨ لاحظنا وجود ${displayedCartItems.length} عطور في سلتك وجاهزين لتجهيز طلبك وشحنه لك فوراً 🖤`)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 rounded-full bg-[#25D366] text-white font-bold flex items-center gap-1.5"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>تذكير بالسلة عبر واتساب</span>
                              </a>
                            )}
                          </div>

                          <div className="divide-y border rounded-2xl overflow-hidden">
                            {displayedCartItems.map((item: any, idx: number) => (
                              <div key={idx} className="p-3.5 flex items-center justify-between gap-3 bg-white">
                                <div className="flex items-center gap-3 min-w-0">
                                  <img src={item.product?.images?.[0] || '/qamar-images/placeholder.svg'} alt={item.product?.name_ar || ''} className="w-12 h-12 rounded-xl object-cover border shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-extrabold text-[#252a31] truncate">{item.product?.name_ar || 'منتج'}</p>
                                    <p className="text-[11px] text-gray-500">الحجم: {item.selectedSize || 'القياسي'} • الكمية: {item.quantity}</p>
                                  </div>
                                </div>
                                <div className="text-left shrink-0">
                                  <p className="font-extrabold text-[#fe9931]">{formatEGP(Number(item.unitPrice || item.product?.price || 0) * Number(item.quantity || 1), false)}</p>
                                  <p className="text-[10px] text-gray-400">سعر الوحدة: {formatEGP(Number(item.unitPrice || item.product?.price || 0), false)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {insightsTab === 'orders' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { id: 'executed', label: `الأوردرات المنفذة (${insightsData.stats.executed_orders})` },
                            { id: 'all', label: `الكل (${insightsData.stats.total_orders})` },
                            { id: 'delivered', label: `تم تسليمها (${insightsData.stats.delivered_orders})` },
                            { id: 'cancelled', label: `الملغية (${insightsData.stats.cancelled_orders})` }
                          ] as const
                        ).map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setOrderSubFilter(st.id)}
                            className={`px-3 py-1.5 rounded-full border font-bold ${orderSubFilter === st.id ? 'bg-[#fe9931] text-white border-[#fe9931]' : 'bg-white text-gray-600 border-gray-200'}`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>

                      {filteredInsightOrders.length === 0 ? (
                        <div className="py-12 text-center border rounded-2xl text-gray-400 font-bold">لا توجد أوردرات في هذا التصنيف.</div>
                      ) : (
                        <div className="space-y-3">
                          {filteredInsightOrders.map(o => (
                            <div key={o.id} className="border rounded-2xl p-4 space-y-2.5 bg-white">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-[#252a31]" dir="ltr">{o.order_number}</span>
                                  <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-[#fe9931] font-bold">{o.order_status}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">{o.payment_method} ({o.payment_status})</span>
                                </div>
                                <div className="text-left">
                                  <span className="font-extrabold text-sm text-[#fe9931]">{formatEGP(o.total, false)}</span>
                                  <span className="block text-[10px] text-gray-400">{formatDateTimeAr(o.created_at)}</span>
                                </div>
                              </div>

                              <div className="text-[11px] text-gray-600 flex flex-wrap items-center justify-between gap-2">
                                <span>📍 {o.governorate}{o.city ? ` - ${o.city}` : ''}{o.address_details ? ` — ${o.address_details}` : ''}</span>
                                {o.google_maps_url && (
                                  <a href={o.google_maps_url} target="_blank" rel="noreferrer" className="text-[#fe9931] font-bold flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" /> خريطة التوصيل
                                  </a>
                                )}
                              </div>

                              <div className="bg-gray-50 rounded-xl p-2.5 space-y-1 text-[11px]">
                                {(o.items || []).map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between">
                                    <span className="font-bold text-[#252a31]">• {item.product?.name_ar || 'منتج'} {item.selectedSize ? `(${item.selectedSize})` : ''} × {item.quantity}</span>
                                    <span className="text-gray-600 font-bold">{formatEGP(Math.round(Number(item.unitPrice || item.product?.price || 0) * Number(item.quantity || 1)), false)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
