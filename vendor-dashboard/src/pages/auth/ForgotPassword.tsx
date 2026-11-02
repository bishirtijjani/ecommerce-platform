import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { forgotPassword } from '../../api/auth';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email.trim().toLowerCase()),
    onSuccess: () => navigate('/reset-password', { state: { email: email.trim().toLowerCase() } }),
  });

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
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
        />
        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
          {t('auth.sendResetCode')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-muted">
        <Link to="/login" className="font-medium text-brand hover:text-brand-strong">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
