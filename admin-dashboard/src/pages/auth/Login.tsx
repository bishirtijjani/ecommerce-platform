import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { login, logout as logoutApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { validateEmail, validateMinLength } from '../../lib/validation';
import type { ApiError } from '../../api/client';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });

  const fieldErrors = useMemo(() => {
    const errs: { email?: string; password?: string } = {};
    if (touched.email && !validateEmail(email)) errs.email = 'Enter a valid email address';
    if (touched.password && !validateMinLength(password, 6)) errs.password = 'Password must be at least 6 characters';
    return errs;
  }, [email, password, touched]);

  const canSubmit = validateEmail(email) && validateMinLength(password, 6);

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, location.state, navigate]);

  const mutation = useMutation({
    mutationFn: () => login(email.trim().toLowerCase(), password),
    onSuccess: async (data) => {
      if (data.user.role !== 'ADMIN') {
        const refreshToken = data.tokens.refreshToken;
        if (refreshToken) {
          try {
            await logoutApi(refreshToken);
          } catch {
            // ignore
          }
        }
        setError('This account does not have admin access.');
        return;
      }
      setSession(data.user, data.tokens);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    },
    onError: (err: ApiError) => setError(err.message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-canvas px-4 py-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex justify-center">
          <Logo size={48} />
        </div>
        <div className="rounded-2xl border border-border bg-bg-surface p-6 shadow-popover sm:p-8">
          <h1 className="text-xl font-bold text-text-primary">Admin sign in</h1>
          <p className="mt-1 text-sm text-text-muted">Manage your marketplace operations.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              mutation.mutate();
            }}
          >
            <Input
              label="Email"
              type="email"
              required
              autoFocus
              leftIcon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setTouched((t) => ({ ...t, email: true })); }}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="admin@marketplace.com"
              error={fieldErrors.email}
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              leftIcon={<Lock className="h-4 w-4" />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              value={password}
              onChange={(e) => { setPassword(e.target.value); setTouched((t) => ({ ...t, password: true })); }}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder="••••••••"
              error={fieldErrors.password}
            />
            {error && <p role="alert" aria-live="polite" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={mutation.isPending} disabled={!canSubmit}>
              Sign in
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-text-placeholder">Marketplace Admin · Secure access only</p>
      </div>
    </div>
  );
}
