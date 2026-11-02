import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, Store } from 'lucide-react';
import { AuthLayout } from '../auth/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';
import {
  enrollVendor,
  exchangeHandoff,
  login as loginApi,
  registerAccount,
  resendOtp,
  verifyOtp,
} from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../api/client';

const PHONE_RE = /^0[789][01]\d{8}$/;

// Signup draft: keep the account fields so a browser back / refresh from the OTP
// step doesn't wipe everything the vendor just typed. Password is deliberately
// NOT persisted.
const DRAFT_KEY = 'mysooq_become_vendor_draft';
type Draft = Partial<{ firstName: string; lastName: string; email: string; phone: string }>;
const readDraft = (): Draft => {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
  } catch {
    return {};
  }
};

type Step = 'account' | 'otp' | 'shop' | 'done';
type Mode = 'register' | 'login';

/**
 * The single "become a vendor" flow for everyone.
 *
 * - New visitor: create account (one shared account, same as the customer
 *   app) -> verify OTP -> add shop details.
 * - Existing customer (from the app via a one-time handoff code, or by
 *   logging in): skip straight to shop details.
 * - Existing seller: sent to the dashboard.
 *
 * There is no second account type and no separate signup path.
 */
export default function BecomeVendor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Already signed in (e.g. arrived from the app with a handoff code)? Start
  // at the shop step so there's no flash of the login form.
  const [step, setStep] = useState<Step>(() => (useAuthStore.getState().isAuthenticated ? 'shop' : 'account'));
  const [mode, setMode] = useState<Mode>('register');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [redeeming, setRedeeming] = useState(params.has('h'));
  const [resendIn, setResendIn] = useState(0);

  // Account fields - seeded from the draft so navigating back to this step
  // (or refreshing) restores what was typed.
  const [draft] = useState<Draft>(readDraft);
  const [firstName, setFirstName] = useState(draft.firstName || '');
  const [lastName, setLastName] = useState(draft.lastName || '');
  const [email, setEmail] = useState(draft.email || '');
  const [phone, setPhone] = useState(draft.phone || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // OTP
  const [code, setCode] = useState('');
  // Shop fields
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [address, setAddress] = useState('');

  const handoffRef = useRef(false);

  // App -> web handoff: redeem the one-time code once, then strip it from the URL.
  useEffect(() => {
    const token = params.get('h');
    if (!token || handoffRef.current) return;
    handoffRef.current = true;
    setRedeeming(true);
    exchangeHandoff(token)
      .then((data) => {
        setSession(data.user, data.tokens);
        setParams({}, { replace: true });
      })
      .catch((err: ApiError) => {
        setError(err.message || t('sell.linkExpired'));
        setParams({}, { replace: true });
      })
      .finally(() => setRedeeming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Already a seller? Straight to the dashboard.
  useEffect(() => {
    if (isAuthenticated && user?.vendorId && step !== 'done') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user?.vendorId, step, navigate]);

  // Signed in but no shop yet -> collect shop details.
  useEffect(() => {
    if (isAuthenticated && !user?.vendorId && step === 'account') {
      setStep('shop');
      if (user?.phone && !businessPhone) setBusinessPhone(user.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.vendorId, step]);

  // Persist the account fields to a session draft (password excluded).
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ firstName, lastName, email, phone }));
    } catch {
      // Private mode / quota - the draft is a convenience, not required.
    }
  }, [firstName, lastName, email, phone]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const doLogin = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('sell.errEmail'));
    if (!password) return setError(t('sell.errPassword'));
    setBusy(true);
    try {
      const data = await loginApi(email.trim().toLowerCase(), password);
      setSession(data.user, data.tokens);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    setError('');
    if (firstName.trim().length < 2) return setError(t('sell.errFirstName'));
    if (lastName.trim().length < 2) return setError(t('sell.errLastName'));
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('sell.errEmail'));
    if (!PHONE_RE.test(phone.trim())) return setError(t('sell.errPhone'));
    if (password.length < 8) return setError(t('sell.errPassword'));
    setBusy(true);
    try {
      await registerAccount({
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });
      setStep('otp');
      setCode('');
      setResendIn(0);
      setNotice('');
    } catch (err) {
      const e = err as ApiError;
      // Same email = same one account. Send them to log in instead of erroring.
      if (e.code === 'EMAIL_TAKEN' || e.code === 'PHONE_TAKEN') {
        setMode('login');
        setError(t('sell.alreadyHaveAccount'));
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    setError('');
    setNotice('');
    if (!/^\d{6}$/.test(code.trim())) return setError(t('sell.errCode'));
    setBusy(true);
    try {
      const data = await verifyOtp(email.trim().toLowerCase(), code.trim());
      if (data?.tokens && data?.user) {
        setSession(data.user, data.tokens);
      } else {
        // Fallback for accounts that don't auto-login.
        const fresh = await loginApi(email.trim().toLowerCase(), password);
        setSession(fresh.user, fresh.tokens);
      }
      // Verification succeeded - advance to shop details. Without this the
      // form stayed on the OTP step, so a second submit hit the now-consumed
      // code and surfaced a bogus "OTP expired or not found".
      if (!businessPhone && phone.trim()) setBusinessPhone(phone.trim());
      setStep('shop');
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const doResend = async () => {
    setError('');
    setNotice('');
    if (resendIn > 0) return;
    setBusy(true);
    try {
      await resendOtp(email.trim().toLowerCase());
      setCode('');
      setResendIn(60);
      setNotice(t('auth.codeResentToast'));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const doEnroll = async () => {
    setError('');
    if (businessName.trim().length < 2) return setError(t('sell.errShopName'));
    if (businessPhone.trim().length < 10) return setError(t('sell.errShopPhone'));
    if (address.trim().length < 5) return setError(t('sell.errShopAddress'));
    setBusy(true);
    try {
      // The shop pin (and the State/LGA derived from it) is captured in the
      // onboarding wizard; enrollment only needs the address.
      const res = await enrollVendor({
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim(),
        businessEmail: email.trim().toLowerCase() || undefined,
        businessAddress: address.trim(),
      });
      const current = useAuthStore.getState().user;
      if (current) {
        setUser({
          ...current,
          vendorId: res.vendorId,
          roles: { customer: true, vendor: 'PENDING_APPROVAL' },
        });
      }
      setStep('done');
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (redeeming) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-canvas">
        <PageSpinner />
      </div>
    );
  }

  if (step === 'done') {
    return (
      <AuthLayout title={t('sell.doneTitle')} subtitle={t('sell.doneSubtitle')}>
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
            <CheckCircle2 className="h-8 w-8 text-success-strong" />
          </div>
          <p className="text-sm text-text-muted">{t('sell.doneBody', { email })}</p>
          <Button className="w-full" size="lg" onClick={() => navigate('/', { replace: true })}>
            {t('sell.doneContinue')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (step === 'shop') {
    return (
      <AuthLayout title={t('sell.shopStepTitle')} subtitle={t('sell.shopStepSubtitle')} wide>
        <div className="space-y-5">
          <Input
            label={t('sell.shopName')}
            required
            leftIcon={<Store className="h-4 w-4" />}
            placeholder={t('sell.shopNamePlaceholder')}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
          <Input
            label={t('sell.shopPhone')}
            required
            leftIcon={<Phone className="h-4 w-4" />}
            placeholder="08012345678"
            value={businessPhone}
            onChange={(e) => setBusinessPhone(e.target.value)}
          />
          <Input
            label={t('sell.shopAddress')}
            required
            placeholder={t('sell.shopAddressPlaceholder')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          {error && <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>}
          <Button className="w-full" size="lg" loading={busy} onClick={doEnroll}>
            {t('sell.openMyShop')}
          </Button>
          <p className="text-center text-xs text-text-muted">{t('sell.hoursNote')}</p>
        </div>
      </AuthLayout>
    );
  }

  if (step === 'otp') {
    return (
      <AuthLayout title={t('sell.checkEmailTitle')} subtitle={t('sell.checkEmailSubtitle', { email })}>
        <div className="space-y-5">
          <Input
            label={t('sell.sixDigitCode')}
            required
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {error && <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>}
          {notice && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-strong">{notice}</p>}
          <Button className="w-full" size="lg" loading={busy} onClick={doVerify}>
            {t('sell.verify')}
          </Button>
          <div className="text-center text-sm text-text-muted">
            {resendIn > 0 ? (
              <span>{t('auth.resendIn', { seconds: resendIn })}</span>
            ) : (
              <button
                type="button"
                onClick={doResend}
                disabled={busy}
                className="font-medium text-brand hover:text-brand-strong"
              >
                {t('auth.resend')}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setStep('account'); setError(''); setNotice(''); }}
            className="mx-auto flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> {t('common.back')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  // Step: account (login or create the single account).
  const isRegister = mode === 'register';
  return (
    <AuthLayout
      title={isRegister ? t('sell.openShopTitle') : t('sell.welcomeBackTitle')}
      subtitle={isRegister ? t('sell.openShopSubtitle') : t('sell.welcomeBackSubtitle')}
      wide={isRegister}
    >
      <div className="space-y-5">
        {isRegister ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('sell.firstName')} required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label={t('sell.lastName')} required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input
              label={t('auth.email')}
              type="email"
              required
              leftIcon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sm:col-span-2"
            />
            <Input
              label={t('sell.phone')}
              required
              leftIcon={<Phone className="h-4 w-4" />}
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="sm:col-span-2"
            />
            <Input
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              required
              leftIcon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              rightSlot={
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-text-muted hover:text-text-primary">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              className="sm:col-span-2"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              required
              autoFocus
              leftIcon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              required
              leftIcon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              rightSlot={
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-text-muted hover:text-text-primary">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>
        )}

        {error && <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>}

        <Button className="w-full" size="lg" loading={busy} onClick={isRegister ? doRegister : doLogin}>
          {isRegister ? t('common.continue') : t('auth.loginButton')}
        </Button>

        <button
          type="button"
          onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}
          className="mx-auto flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-strong"
        >
          {isRegister ? t('sell.loginToggle') : t('sell.registerToggle')}
        </button>
      </div>
    </AuthLayout>
  );
}
