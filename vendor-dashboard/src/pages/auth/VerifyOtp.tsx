import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AuthLayout } from './AuthLayout';
import { OtpInput } from '../../components/ui/OtpInput';
import { Button } from '../../components/ui/Button';
import { verifyOtp, resendOtp } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../api/client';

export default function VerifyOtp() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const email = (location.state as { email?: string } | null)?.email;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (!email) navigate('/register', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const mutation = useMutation({
    mutationFn: () => verifyOtp(email as string, code),
    onSuccess: (data) => {
      if (data.user && data.tokens) {
        setSession(data.user, data.tokens);
        navigate('/', { replace: true });
      } else {
        toast.success(t('auth.verifiedToast'));
        navigate('/login', { replace: true });
      }
    },
    onError: (err: ApiError) => setError(err.message),
  });

  const resend = useMutation({
    mutationFn: () => resendOtp(email as string),
    onSuccess: () => {
      toast.success(t('auth.codeResentToast'));
      setCooldown(60);
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  return (
    <AuthLayout title={t('auth.verifyTitle')} subtitle={t('auth.verifySubtitle', { email: email || '' })}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          if (code.length === 6) mutation.mutate();
        }}
      >
        <OtpInput value={code} onChange={setCode} />
        {error && <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending} disabled={code.length !== 6}>
          {t('auth.verifyButton')}
        </Button>
      </form>
      <div className="mt-5 text-center text-sm text-text-muted">
        {cooldown > 0 ? (
          <span>{t('auth.resendIn', { seconds: cooldown })}</span>
        ) : (
          <button onClick={() => resend.mutate()} className="font-medium text-brand hover:text-brand-strong" disabled={resend.isPending}>
            {t('auth.resend')}
          </button>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-text-muted">
        <Link to="/login" className="font-medium text-text-muted hover:text-text-primary">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
