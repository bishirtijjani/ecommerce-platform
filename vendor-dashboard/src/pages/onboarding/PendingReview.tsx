import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusLayout } from './StatusLayout';
import { useVendorProfile } from '../../hooks/useVendor';

export default function PendingReview() {
  const { t } = useTranslation();
  const { data: vendor } = useVendorProfile();
  return (
    <StatusLayout icon={<Clock3 className="h-6 w-6 text-brand" />}>
      <h1 className="text-lg font-semibold text-text-primary">{t('onboarding.pendingTitle')}</h1>
      <p className="mt-2 text-sm text-text-muted">{t('onboarding.pendingBody', { name: vendor?.name })}</p>
    </StatusLayout>
  );
}
