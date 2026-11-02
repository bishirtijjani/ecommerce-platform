import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock3, LifeBuoy } from 'lucide-react';
import { useVendorProfile } from '../../hooks/useVendor';

/**
 * Shown across the dashboard while the shop is under review. The vendor can
 * keep setting up (add products, hours, etc.) - they just don't appear to
 * customers until an admin approves them.
 */
export const PendingBanner = () => {
  const { t } = useTranslation();
  const { data: vendor } = useVendorProfile();

  if (!vendor || vendor.status !== 'PENDING_APPROVAL') return null;

  return (
    <div className="border-b border-warning/40 bg-warning-soft px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-3 text-sm text-warning-strong">
        <Clock3 className="h-4 w-4 shrink-0" />
        <p className="flex-1">
          {t('pendingBanner.message')}
        </p>
        <Link
          to="/support"
          className="hidden shrink-0 items-center gap-1.5 font-medium hover:underline sm:flex"
        >
          <LifeBuoy className="h-4 w-4" />
          {t('pendingBanner.contact')}
        </Link>
      </div>
    </div>
  );
};
