import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { OtpInput } from '../../components/ui/OtpInput';
import { resetPassword } from '../../api/auth';
import type { ApiError } from '../../api/client';

export default function ResetPassword() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as { email?: string } | null)?.email;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  const mutation = useMutation({
    mutationFn: () => resetPassword(email as string, code, password),
    onSuccess: () => {
      toast.success(t('auth.resetDoneToast'));
      navigate('/login', { replace: true });
    },
    onError: (err: ApiError) => setError(err.message),
  });

  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitleWithEmail', { email })}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          mutation.mutate();
        }}
      >
        <OtpInput value={code} onChange={setCode} />
        <Input label={t('auth.newPassword')} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending} disabled={code.length !== 6 || password.length < 8}>
          {t('auth.resetButton')}
        </Button>
      </form>
    </AuthLayout>
  );
}
