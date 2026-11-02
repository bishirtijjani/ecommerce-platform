import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LOCALE_LABELS, SUPPORTED_LOCALES, setLocale, type Locale } from '../i18n';
import { cn } from '../lib/cn';

/** Compact language picker. Native <select> so it works well one-thumbed on a phone. */
export const LanguageSwitcher = ({ className }: { className?: string }) => {
  const { t, i18n } = useTranslation();
  const current = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
    ? (i18n.language as Locale)
    : 'en';

  return (
    <label
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-surface px-2 py-1.5',
        className,
      )}
      title={LOCALE_LABELS[current]}
    >
      <Globe className="h-4 w-4 shrink-0 text-text-muted" />
      <select
        value={current}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-sm font-medium text-text-primary focus:outline-none"
        aria-label={t('common.language')}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </label>
  );
};
