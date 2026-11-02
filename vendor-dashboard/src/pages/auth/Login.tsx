import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { login } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../api/client';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => login(email.trim().toLowerCase(), password),
    onSuccess: (data) => {
      // One account for everything: if this account has no shop yet, the
      // wizard picks up where login left off instead of dead-ending.
      setSession(data.user, data.tokens);
      navigate(data.user.vendorId ? '/' : '/sell', { replace: true });
    },
    onError: (err: ApiError) => setError(err.message),
  });

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          mutation.mutate();
        }}
      >
        <Input
          label={t('auth.email')}
          type="email"
          required
          autoFocus
          leftIcon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
        />
        <Input
          label={t('auth.password')}
          type={showPassword ? 'text' : 'password'}
          required
          leftIcon={<Lock className="h-4 w-4" />}
          rightSlot={
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-text-muted hover:text-text-primary">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand hover:text-brand-strong">
            {t('auth.forgotPassword')}
          </Link>
        </div>
        {error && <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
          {t('auth.loginButton')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-muted">
        {t('auth.noShop')}{' '}
        <Link to="/sell" className="font-medium text-brand hover:text-brand-strong">
          {t('auth.openShopLink')}
        </Link>
      </p>
    </AuthLayout>
  );
}
