import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, Lock, User, Phone, KeyRound, CheckCircle, AlertCircle, RotateCcw, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { loadGoogleIdentity } from '../services/googleIdentity';

const DEFAULT_GOOGLE_CLIENT_ID =
  ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) as string) ||
  '294509556603-op9cbf1s15b9nk1hgpnb8sfugfvqeer8.apps.googleusercontent.com';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authMessage,
    closeAuthModal,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    pendingSecondFactor,
    completeSecondFactor,
    sendOtp,
    verifyOtpAndRegister,
    redirectAfterLogin
  } = useAuth();
  const { navigate } = useStore();

  const [mode, setMode] = useState<'login' | 'register' | 'otp_verify'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const acceptedPoliciesRef = useRef(false);
  acceptedPoliciesRef.current = acceptedPolicies;

  const [googleStatus, setGoogleStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [googleError, setGoogleError] = useState('');
  const [googleRetry, setGoogleRetry] = useState(0);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const handleGoogleCredentialResponse = useCallback(async (response: any) => {
    if (!response?.credential) return;
    if (!acceptedPoliciesRef.current) {
      setError('يرجى وضع علامة الموافقة على الشروط والسياسات وملفات الكوكيز قبل تسجيل الدخول بحساب Google.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle({ credential: response.credential });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      if (redirectAfterLogin) navigate(redirectAfterLogin as any);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تسجيل الدخول بحساب Google. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle, navigate, redirectAfterLogin]);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuthModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  useEffect(() => {
    if (!isAuthModalOpen || pendingSecondFactor || mode === 'otp_verify') return;
    let cancelled = false;
    setGoogleStatus('loading');
    setGoogleError('');
    loadGoogleIdentity()
      .then(google => {
        if (cancelled || !googleBtnContainerRef.current) return;
        googleBtnContainerRef.current.innerHTML = '';
        google.initialize({
          client_id: DEFAULT_GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        google.renderButton(googleBtnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
          locale: 'ar'
        });
        setGoogleStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        setGoogleStatus('error');
        setGoogleError(err?.message || 'تعذّر تجهيز تسجيل Google. أعد المحاولة.');
      });
    return () => { cancelled = true; };
  }, [isAuthModalOpen, pendingSecondFactor, mode, googleRetry, handleGoogleCredentialResponse]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => setResendCooldown(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  if (!isAuthModalOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!pendingSecondFactor && !acceptedPolicies) {
      setError('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية وملفات تعريف الارتباط (Cookies) للمتابعة.');
      return;
    }
    setLoading(true);
    try {
      if (pendingSecondFactor) {
        await completeSecondFactor(totpCode);
        if (redirectAfterLogin) navigate(redirectAfterLogin as any);
      } else if (mode === 'login') {
        const ok = await loginWithEmail(email, password);
        if (ok && redirectAfterLogin) navigate(redirectAfterLogin as any);
      } else if (mode === 'register') {
        const otpRes: any = await sendOtp(email.trim(), name.trim());
        if (otpRes?.success) {
          setMode('otp_verify');
          setResendCooldown(60);
          setSuccessMsg(otpRes.message || `تم إرسال كود التأكيد إلى بريدك: ${email}`);
        } else if (String(otpRes?.error || '').includes('SMTP_USER')) {
          const ok = await registerWithEmail(name, email, password, phone);
          if (ok && redirectAfterLogin) navigate(redirectAfterLogin as any);
        } else {
          setError(otpRes?.error || 'تعذر إرسال كود التحقق إلى بريدك الإلكتروني.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...otpCode];
    next[index] = clean;
    setOtpCode(next);
    if (clean && index < 5) otpInputsRef.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!digits.length) return;
    const next = ['', '', '', '', '', ''];
    digits.forEach((d, idx) => { next[idx] = d; });
    setOtpCode(next);
    otpInputsRef.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.join('');
    if (code.length < 6) {
      setError('يرجى إدخال كود التأكيد كاملاً (6 أرقام).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtpAndRegister({
        email: email.trim(),
        code,
        name: name.trim(),
        phone: phone.trim(),
        password
      });
      if (res?.success) {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        if (redirectAfterLogin) navigate(redirectAfterLogin as any);
      } else {
        setError(res?.error || 'كود التأكيد غير صحيح.');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء التحقق من الكود.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const res: any = await sendOtp(email.trim(), name.trim());
      if (res?.success) {
        setResendCooldown(60);
        setSuccessMsg(res.message || 'تمت إعادة إرسال الكود إلى بريدك الإلكتروني.');
      } else {
        setError(res?.error || 'تعذر إعادة إرسال الكود.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={closeAuthModal}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#252a31]">
            {pendingSecondFactor
              ? 'التحقق الثنائي (2FA)'
              : mode === 'otp_verify'
                ? 'تأكيد البريد الإلكتروني'
                : mode === 'login'
                  ? 'تسجيل الدخول'
                  : 'إنشاء حساب جديد'}
          </h2>
          <button
            type="button"
            onClick={closeAuthModal}
            className="text-[#fe9931] hover:bg-[#fe9931]/10 p-1.5 rounded-full"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'otp_verify' && !pendingSecondFactor ? (
          <form onSubmit={handleVerifyOtp} className="p-6 space-y-4">
            <p className="text-xs text-gray-600 text-center">
              أرسلنا كود تأكيد من 6 أرقام إلى <span className="font-bold text-[#252a31]">{email}</span>
            </p>
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2" dir="ltr">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpInputsRef.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  className="w-11 h-12 text-center text-lg font-extrabold text-[#fe9931] bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#fe9931] focus:outline-none"
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={loading || otpCode.join('').length < 6}
              className="w-full py-3 rounded-full bg-[#fe9931] hover:bg-[#e88722] text-white font-bold text-sm transition disabled:opacity-50"
            >
              {loading ? 'جاري التحقق...' : 'تأكيد وتفعيل الحساب'}
            </button>
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setMode('register')} className="flex items-center gap-1 hover:text-[#252a31]">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>رجوع</span>
              </button>
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendOtp}
                className={`flex items-center gap-1 font-bold ${resendCooldown > 0 ? 'text-gray-400' : 'text-[#fe9931]'}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{resendCooldown > 0 ? `إعادة الإرسال (${resendCooldown} ث)` : 'إعادة إرسال الكود'}</span>
              </button>
            </div>
          </form>
        ) : (
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

            {!pendingSecondFactor && (
              <>
                <div className="space-y-2">
                  <div className="relative flex justify-center w-full min-h-[44px]">
                    <div
                      ref={googleBtnContainerRef}
                      className={`flex justify-center w-full min-h-[44px] ${loading || !acceptedPolicies ? 'opacity-65' : ''}`}
                    />
                    {!acceptedPolicies && (
                      <button
                        type="button"
                        aria-label="يجب الموافقة على الشروط والكوكيز قبل تسجيل الدخول بحساب Google"
                        onClick={() => setError('يرجى وضع علامة الموافقة على الشروط والسياسات وملفات الكوكيز أولاً قبل تسجيل الدخول عبر Google.')}
                        className="absolute inset-0 z-10 cursor-pointer rounded-full bg-white/35"
                      />
                    )}
                  </div>
                  {googleStatus === 'loading' && (
                    <p role="status" className="text-center text-xs text-gray-500">
                      جاري تجهيز تسجيل الدخول باستخدام Google...
                    </p>
                  )}
                  {googleStatus === 'error' && (
                    <div className="text-center space-y-1.5">
                      <p role="alert" className="text-xs text-red-600">{googleError}</p>
                      <button
                        type="button"
                        onClick={() => setGoogleRetry(v => v + 1)}
                        className="text-xs font-bold text-[#fe9931] underline"
                      >
                        إعادة تحميل تسجيل Google
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="bg-white px-3 text-[11px] text-gray-400 font-semibold shrink-0">
                    أو بالبريد الإلكتروني
                  </span>
                  <div className="border-t border-gray-200 w-full" />
                </div>
              </>
            )}

            {pendingSecondFactor ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">كود تطبيق المصادقة (6 أرقام)</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm text-center tracking-widest focus:outline-none focus:border-[#fe9931]"
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

            {!pendingSecondFactor && (
              <div
                data-testid="auth-policy-consent"
                className={`p-3 rounded-xl border text-[11px] leading-relaxed transition-colors ${
                  acceptedPolicies
                    ? 'bg-emerald-50/70 border-emerald-300 text-[#252a31]'
                    : 'bg-orange-50/70 border-orange-200 text-[#252a31]'
                }`}
              >
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="auth-policy-checkbox"
                    checked={acceptedPolicies}
                    onChange={e => {
                      setAcceptedPolicies(e.target.checked);
                      if (e.target.checked && error.includes('الموافقة')) setError('');
                    }}
                    className="mt-0.5 w-4 h-4 accent-[#fe9931] shrink-0"
                  />
                  <span>
                    أوافق على{' '}
                    <button
                      type="button"
                      onClick={() => { closeAuthModal(); navigate('terms'); }}
                      className="text-[#fe9931] font-bold underline"
                    >
                      شروط الاستخدام
                    </button>
                    ، و{' '}
                    <button
                      type="button"
                      onClick={() => { closeAuthModal(); navigate('privacy'); }}
                      className="text-[#fe9931] font-bold underline"
                    >
                      سياسة الخصوصية
                    </button>
                    ، و{' '}
                    <button
                      type="button"
                      onClick={() => { closeAuthModal(); navigate('refund'); }}
                      className="text-[#fe9931] font-bold underline"
                    >
                      الاستبدال والشحن
                    </button>
                    ، وجمع واستخدام ملفات تعريف الارتباط (<strong className="font-bold">Cookies</strong>) لحفظ الجلسة.
                  </span>
                </label>
              </div>
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
        )}
      </div>
    </div>
  );
};
