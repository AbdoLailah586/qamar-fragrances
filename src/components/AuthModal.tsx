import React, { useState } from 'react';
import { X, Mail, Lock, User, Phone, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authMessage,
    closeAuthModal,
    loginWithEmail,
    registerWithEmail,
    pendingSecondFactor,
    completeSecondFactor
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (pendingSecondFactor) {
        await completeSecondFactor(totpCode);
      } else if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(name, email, password, phone);
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#252a31]">
            {pendingSecondFactor ? 'التحقق الثنائي (2FA)' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h2>
          <button
            type="button"
            onClick={closeAuthModal}
            className="text-[#fe9931] hover:bg-[#fe9931]/10 p-1.5 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {authMessage && (
            <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium">
              {authMessage}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {pendingSecondFactor ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">كود تطبيق المصادقة (6 أرقام)</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                />
              </div>
            </div>
          ) : (
            <>
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم الكامل</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="الاسم"
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">كلمة المرور</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#fe9931]"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm transition disabled:opacity-60"
          >
            {loading ? 'جاري التنفيذ...' : pendingSecondFactor ? 'تأكيد الدخول' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
          </button>

          {!pendingSecondFactor && (
            <div className="text-center text-xs text-gray-500 pt-1">
              {mode === 'login' ? (
                <>
                  ليس لديك حساب؟{' '}
                  <button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-[#fe9931] font-bold">
                    أنشئ حساباً الآن
                  </button>
                </>
              ) : (
                <>
                  لديك حساب بالفعل؟{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-[#fe9931] font-bold">
                    تسجيل الدخول
                  </button>
                </>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
