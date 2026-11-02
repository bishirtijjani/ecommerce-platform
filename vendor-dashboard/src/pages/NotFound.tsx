import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Logo } from '../components/ui/Logo';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-canvas px-4 text-center">
      <Logo size={28} />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
        <Compass className="h-6 w-6 text-brand" />
      </div>
      <h1 className="text-lg font-semibold text-text-primary">{t('notFound.title')}</h1>
      <p className="max-w-sm text-sm text-text-muted">{t('notFound.subtitle')}</p>
      <Link to="/" className="text-sm font-medium text-brand hover:text-brand-strong">
        {t('notFound.goHome')}
      </Link>
    </div>
  );
}
