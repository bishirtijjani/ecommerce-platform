import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVendorProfile } from '../hooks/useVendor';
import { useAuthStore } from '../store/authStore';
import { PageSpinner } from './ui/Spinner';
import { ErrorState } from './ui/EmptyState';

/** Backend seeds this exact string when a vendor signs up before setting a real address (see auth.service.js). */
export const ONBOARDING_PLACEHOLDER_ADDRESS = 'Pending - set in onboarding';

// A vendor's onboarding is complete only when the shop has a real address,
// State/LGA and a usable map pin. The backend exposes locationComplete, but
// compute a fallback for cached/legacy payloads.
export const needsOnboarding = (vendor: {
  address: string;
  state?: string | null;
  lga?: string | null;
  lat: number;
  lng: number;
  locationComplete?: boolean;
}) => {
  if (typeof vendor.locationComplete === 'boolean') return !vendor.locationComplete;
  const hasPin = Number.isFinite(vendor.lat) && Number.isFinite(vendor.lng) && !(vendor.lat === 0 && vendor.lng === 0);
  return (
    vendor.address === ONBOARDING_PLACEHOLDER_ADDRESS ||
    !vendor.state ||
    !vendor.lga ||
    !hasPin
  );
};

/**
 * Gates every authenticated dashboard route on the vendor's approval state.
 * A vendor account can be mid-onboarding, awaiting review, rejected, or
 * suspended - each gets a dedicated full-screen state instead of a half
 * broken dashboard.
 */
export const VendorGate = () => {
  const { t } = useTranslation();
  const hasVendor = !!useAuthStore((s) => s.user?.vendorId);
  const { data: vendor, isLoading, isError, refetch } = useVendorProfile();
  const location = useLocation();

  // Signed in but no shop yet (a plain customer): send them into the single
  // "open your shop" wizard instead of an error screen.
  if (!hasVendor) return <Navigate to="/sell" replace />;

  if (isLoading) return <PageSpinner />;
  if (isError || !vendor) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ErrorState title={t('common.errorLoadShop')} subtitle={t('common.checkConnection')} onRetry={() => refetch()} />
      </div>
    );
  }

  const onOnboardingRoute = location.pathname === '/onboarding';

  if (vendor.status === 'PENDING_APPROVAL' && needsOnboarding(vendor)) {
    return onOnboardingRoute ? <Outlet /> : <Navigate to="/onboarding" replace />;
  }
  if (onOnboardingRoute) {
    // Onboarding already complete - don't let a stale link back into the wizard.
    return <Navigate to="/" replace />;
  }
  // PENDING_APPROVAL is intentionally allowed through: the vendor can set up
  // their shop while under review, they just don't appear to customers until
  // approved (see the PendingBanner + the APPROVED-only customer queries).
  if (vendor.status === 'REJECTED') return <Navigate to="/account/rejected" replace />;
  if (vendor.status === 'SUSPENDED') return <Navigate to="/account/suspended" replace />;

  return <Outlet />;
};

/** Wraps the standalone /account/* status pages - still needs the vendor query. */
export const AccountStatusGate = () => {
  const { data: vendor, isLoading } = useVendorProfile();
  if (isLoading) return <PageSpinner />;
  if (vendor && vendor.status === 'APPROVED') return <Navigate to="/" replace />;
  return <Outlet />;
};
