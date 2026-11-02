import { Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusLayout } from './StatusLayout';
import { useVendorProfile } from '../../hooks/useVendor';

export default function Suspended() {
  const { t } = useTranslation();
  const { data: vendor } = useVendorProfile();
  return (
    <StatusLayout icon={<Ban className="h-6 w-6 text-error" />}>
      <h1 className="text-lg font-semibold text-text-primary">{t('onboarding.suspendedTitle')}</h1>
      <p className="mt-2 text-sm text-text-muted">
        {vendor?.suspensionReason || t('onboarding.suspendedBody')}
      </p>
      <p className="mt-4 text-sm text-text-muted">{t('onboarding.suspendedContact')}</p>
    </StatusLayout>
  );
}
