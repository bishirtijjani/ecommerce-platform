import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';
import { exchangeHandoff } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../api/client';

/**
 * Lands the auto-login button from vendor emails ("/auth/continue?h=...").
 * Redeems the one-time handoff code for a web session and drops the vendor
 * straight into the dashboard - no password prompt.
 */
export default function Continue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState('');
  // Latch so React StrictMode's double-invoke doesn't burn the single-use code.
  const started = useRef(false);

  useEffect(() => {
    const token = params.get('h');
    if (!token) {
      setError(t('auth.continueInvalid'));
      return;
    }
    if (started.current) return;
    started.current = true;

    exchangeHandoff(token)
      .then((data) => {
        setSession(data.user, data.tokens);
        navigate('/', { replace: true });
      })
      .catch((err: ApiError) => setError(err.message || t('auth.continueInvalid')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout title={t('auth.continueTitle')} subtitle={error ? undefined : t('auth.continueSubtitle')}>
      {error ? (
        <div className="space-y-5">
          <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>
          <Button className="w-full" size="lg" onClick={() => navigate('/login', { replace: true })}>
            {t('auth.backToLogin')}
          </Button>
        </div>
      ) : (
        <PageSpinner />
      )}
    </AuthLayout>
  );
}
