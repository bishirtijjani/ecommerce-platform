import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { useAuthStore } from '../../store/authStore';

export const StatusLayout = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-canvas px-4 py-12">
      <div className="mb-8">
        <Logo size={30} />
      </div>
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">{icon}</div>
        {children}
      </div>
      <button
        onClick={() => {
          logout();
          navigate('/login');
        }}
        className="mt-6 flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary"
      >
        <LogOut className="h-4 w-4" /> {t('nav.logout')}
      </button>
    </div>
  );
};
