import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { neonDb } from '../services/neonDb';
import type { DeliveryAddressFields } from '../types';
import { readStoredJson, writeStoredJson, removeStorage } from '../utils/browserStorage';
import { canAccessSection as hasSection, permittedSections } from '../../lib/access.js';

export interface UserAddress extends DeliveryAddressFields {
  id: string;
  title: string;
  governorate: string;
  city: string;
  details: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'customer' | 'admin';
  admin_permissions?: string[];
  provider: 'google' | 'email';
  email_verified?: boolean;
  addresses: UserAddress[];
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canAccessAdmin: boolean;
  canAccessSection: (section: string) => boolean;
  adminSections: string[];
  sessionReady: boolean;
  refreshAccess: () => Promise<boolean>;
  isAuthModalOpen: boolean;
  authMessage: string;
  openAuthModal: (msg?: string, redirectAfterLogin?: string) => void;
  closeAuthModal: () => void;
  loginWithGoogle: (data: { credential: string }) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<boolean>;
  registerWithEmail: (name: string, email: string, pass: string, phone: string) => Promise<boolean>;
  pendingSecondFactor: boolean;
  completeSecondFactor: (code: string) => Promise<void>;
  sendOtp: (email: string, name?: string) => Promise<any>;
  verifyOtpAndRegister: (data: { email: string; code: string; name: string; phone: string; password?: string }) => Promise<any>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  updateEmail: (newEmail: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  addAddress: (address: Omit<UserAddress, 'id'>) => Promise<{ success: boolean; error?: string }>;
  deleteAddress: (id: string) => Promise<{ success: boolean; error?: string }>;
  redirectAfterLogin: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isStoredUser(val: unknown): val is User {
  return Boolean(val && typeof val === 'object' && typeof (val as any).id === 'string' && typeof (val as any).email === 'string');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = readStoredJson<User | null>('qamar_store_user', null, isStoredUser);
    return saved ? { ...saved, role: 'customer', admin_permissions: [] } : null;
  });
  const [sessionReady, setSessionReady] = useState(false);
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | null>(null);
  const activeUserId = useRef(user?.id);
  activeUserId.current = user?.id;

  const acceptSignIn = (res: any) => {
    if (res.requiresTotp) { setUser(null); setPendingSecondFactor(true); return false; }
    if (!res.success || !res.user) throw new Error(res.error || 'تعذر تسجيل الدخول.');
    activeUserId.current = res.user.id;
    setSessionReady(true);
    setUser(res.user);
    setPendingSecondFactor(false);
    setIsAuthModalOpen(false);
    return true;
  };

  const refreshAccess = useCallback(async (): Promise<boolean> => {
    const userId = activeUserId.current;
    if (!userId) return false;
    try {
      const res = await neonDb.getUserAccess(userId);
      if (activeUserId.current !== userId || !res.success || !res.exists) return false;
      setUser(prev => prev?.id === userId ? { ...prev, role: res.role === 'admin' ? 'admin' : 'customer', admin_permissions: res.admin_permissions || [] } : prev);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    neonDb.getSession().then(res => {
      if (!cancelled) setUser(res?.user || null);
    }).catch(() => {}).finally(() => { if (!cancelled) setSessionReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    void refreshAccess();
    const onFocus = () => { void refreshAccess(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refreshAccess();
    }, 60_000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, [user?.id, refreshAccess]);

  useEffect(() => {
    if (user) {
      writeStoredJson('qamar_store_user', { ...user, role: 'customer', admin_permissions: [] });
    } else {
      removeStorage('qamar_store_user');
    }
  }, [user]);

  const openAuthModal = (msg = '', redirect?: string) => {
    setAuthMessage(msg);
    setRedirectAfterLogin(redirect || null);
    setIsAuthModalOpen(true);
  };
  const closeAuthModal = () => { setIsAuthModalOpen(false); setAuthMessage(''); };

  const loginWithEmail = async (email: string, pass: string) => {
    const res = await neonDb.authenticateUser(email, pass);
    return acceptSignIn(res);
  };

  const registerWithEmail = async (name: string, email: string, pass: string, phone: string) => {
    const res = await neonDb.registerCustomer(name, email, phone, pass);
    return acceptSignIn(res);
  };

  const loginWithGoogle = async (data: { credential: string }) => {
    const res = await neonDb.persistGoogleUser(data);
    acceptSignIn(res);
  };

  const completeSecondFactor = async (code: string) => {
    const res = await neonDb.verifyTotpLogin('', code);
    acceptSignIn(res);
  };

  const logout = () => {
    activeUserId.current = undefined;
    setUser(null);
    setPendingSecondFactor(false);
    neonDb.logoutSession().catch(() => {});
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return { success: false, error: 'يجب تسجيل الدخول.' };
    const res = await neonDb.updateUserProfile(user.id, data);
    if (res.success && res.user) setUser(prev => prev ? { ...prev, ...res.user } : res.user);
    return res;
  };

  const updateEmail = async (newEmail: string) => {
    if (!user) return { success: false, error: 'يجب تسجيل الدخول.' };
    const res = await neonDb.updateUserEmail(user.id, newEmail);
    if (res.success && res.user) setUser(prev => prev ? { ...prev, ...res.user } : res.user);
    return res;
  };

  const changePassword = async (oldPass: string, newPass: string) => {
    if (!user) return { success: false, error: 'يجب تسجيل الدخول.' };
    return neonDb.changePassword(user.id, oldPass, newPass);
  };

  const deleteAccount = async () => {
    if (!user) return { success: false, error: 'يجب تسجيل الدخول.' };
    const res = await neonDb.deleteUser(user.id);
    if (res?.success) {
      activeUserId.current = undefined;
      setUser(null);
      setPendingSecondFactor(false);
      removeStorage('qamar_store_user');
    }
    return res;
  };

  const addAddress = async (addr: Omit<UserAddress, 'id'>) => {
    if (!user) return { success: false, error: 'يجب تسجيل الدخول.' };
    const nextAddr: UserAddress = { ...addr, id: `addr-${Date.now()}` };
    const list = addr.isDefault
      ? [...(user.addresses || []).map(a => ({ ...a, isDefault: false })), nextAddr]
      : [...(user.addresses || []), nextAddr];
    return updateProfile({ addresses: list });
  };

  const deleteAddress = async (id: string) => {
    if (!user) return { success: false, error: 'يجب تسجيل الدخول.' };
    return updateProfile({ addresses: (user.addresses || []).filter(a => a.id !== id) });
  };

  const adminSections = permittedSections(user);
  const canAccessAdmin = adminSections.length > 0;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin,
      canAccessAdmin,
      canAccessSection: (s: string) => hasSection(user, s),
      adminSections,
      sessionReady,
      refreshAccess,
      isAuthModalOpen,
      authMessage,
      openAuthModal,
      closeAuthModal,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      pendingSecondFactor,
      completeSecondFactor,
      sendOtp: (email, name) => neonDb.sendVerificationOtp(email, name),
      verifyOtpAndRegister: async data => {
        const res = await neonDb.verifyOtpAndCreateUser(data);
        if (res.success && res.user) acceptSignIn(res);
        return res;
      },
      logout,
      updateProfile,
      updateEmail,
      changePassword,
      deleteAccount,
      addAddress,
      deleteAddress,
      redirectAfterLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
