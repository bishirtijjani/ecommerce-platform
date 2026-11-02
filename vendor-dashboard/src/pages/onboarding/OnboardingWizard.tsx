import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import StateLgaPicker from '../../components/ui/StateLgaPicker';
import { LocationPicker } from '../../components/LocationPicker';
import { useVendorProfile, VENDOR_PROFILE_KEY } from '../../hooks/useVendor';
import { updateVendorProfile, reverseGeocode } from '../../api/vendor';
import { useAuthStore } from '../../store/authStore';

export default function OnboardingWizard() {
  const { t } = useTranslation();
  const { data: vendor } = useVendorProfile();
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const qc = useQueryClient();

  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!vendor) return;
    setAddress(vendor.address === 'Pending - set in onboarding' ? '' : vendor.address || '');
    setState(vendor.state || '');
    setLga(vendor.lga || '');
    setLat(vendor.lat && vendor.lng ? vendor.lat : null);
    setLng(vendor.lat && vendor.lng ? vendor.lng : null);
    setOpeningTime(vendor.openingTime || '08:00');
    setClosingTime(vendor.closingTime || '22:00');
  }, [vendor]);

  const handlePinChange = async (nextLat: number, nextLng: number) => {
    setLat(nextLat);
    setLng(nextLng);
    setGeocoding(true);
    try {
      const geo = await reverseGeocode(nextLat, nextLng);
      if (geo.address) setAddress(geo.address);
      if (geo.state) setState(geo.state);
      if (geo.lga) setLga(geo.lga);
    } catch (_) {
      // Fall back to the manual State/LGA picker below.
    } finally {
      setGeocoding(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      updateVendorProfile(vendorId, {
        address: address.trim(),
        state,
        lga,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        openingTime,
        closingTime,
      }),
    onSuccess: (data) => {
      qc.setQueryData([...VENDOR_PROFILE_KEY, vendorId], data);
      toast.success(t('onboarding.savedToast'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    setError('');
    if (address.trim().length < 5) return setError(t('onboarding.addressError'));
    if (!state) return setError(t('geo.selectState'));
    if (!lga) return setError(t('geo.selectLga'));
    if (lat == null || lng == null || (lat === 0 && lng === 0)) {
      return setError(t('onboarding.pinError', { defaultValue: 'Drop a pin on the map to mark your shop location' }));
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-bg-canvas px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex justify-center">
          <Logo size={30} />
        </div>
        <div className="rounded-lg border border-border bg-bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft">
              <MapPin className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">{t('onboarding.wizardTitle')}</h1>
              <p className="mt-1 text-sm text-text-muted">{t('onboarding.wizardWelcome', { name: vendor?.name })}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">
                {t('profile.location.pin', { defaultValue: 'Shop pin' })}
              </p>
              <LocationPicker lat={lat} lng={lng} onChange={handlePinChange} />
              {geocoding && <p className="mt-1 text-xs text-text-muted">Finding the address…</p>}
            </div>
            <Input
              label={t('onboarding.streetAddress')}
              required
              placeholder={t('onboarding.streetAddressPlaceholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {state && lga ? (
              <p className="text-sm text-text-muted">
                Detected area: {lga}, {state}
              </p>
            ) : (
              <StateLgaPicker
                state={state}
                lga={lga}
                onChange={(patch) => {
                  if (patch.state !== undefined) setState(patch.state);
                  if (patch.lga !== undefined) setLga(patch.lga);
                }}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('onboarding.openingTime')} type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
              <Input label={t('onboarding.closingTime')} type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
            </div>
            {error && <p className="text-sm text-error-strong">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleSubmit} loading={mutation.isPending}>
              {t('onboarding.submitReview')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
