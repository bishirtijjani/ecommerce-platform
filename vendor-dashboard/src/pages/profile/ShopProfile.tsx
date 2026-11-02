import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, Star } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import StateLgaPicker from '../../components/ui/StateLgaPicker';
import { Switch } from '../../components/ui/Switch';
import { ImageUpload } from '../../components/ImageUpload';
import { LocationPicker } from '../../components/LocationPicker';
import { PageSpinner } from '../../components/ui/Spinner';
import { VendorStatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StickySaveBar } from '../../components/StickySaveBar';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { useVendorProfile, VENDOR_PROFILE_KEY } from '../../hooks/useVendor';
import { updateVendorProfile, reverseGeocode } from '../../api/vendor';
import { uploadMedia } from '../../api/upload';
import { useAuthStore } from '../../store/authStore';
import type { Vendor } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ShopProfile() {
  const { t } = useTranslation();
  const { data: vendor, isLoading } = useVendorProfile();
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const qc = useQueryClient();

  const [form, setForm] = useState<Partial<Vendor> | null>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const snapshot = useRef<string | null>(null);
  const pristineVendor = useRef<Partial<Vendor> | null>(null);

  useEffect(() => {
    if (vendor && !form) {
      setForm(vendor);
      pristineVendor.current = vendor;
      snapshot.current = JSON.stringify(vendor);
    }
  }, [vendor, form]);

  const dirty = !!form && snapshot.current !== null && JSON.stringify(form) !== snapshot.current;

  // Warn on leaving with unsaved changes (tab close/refresh + in-app links).
  const { showExitConfirm, cancelExit, confirmExit } = useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: (patch: Partial<Vendor>) => updateVendorProfile(vendorId, patch),
    onSuccess: (data) => {
      qc.setQueryData([...VENDOR_PROFILE_KEY, vendorId], data);
      // The server is now the source of truth; refresh the form AND the snapshot
      // so the bar clears and no false "unsaved changes" warning is raised.
      setForm(data);
      snapshot.current = JSON.stringify(data);
      toast.success(t('profile.updatedToast'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !form) return <PageSpinner />;

  const set = <K extends keyof Vendor>(key: K, value: Vendor[K]) => setForm((f) => ({ ...f, [key]: value }));

  const locationMissing: string[] = [];
  if (!form.state) locationMissing.push('State');
  if (!form.lga) locationMissing.push('LGA');
  if (!form.address || form.address === 'Pending - set in onboarding') locationMissing.push('address');
  const latNum = Number(form.lat);
  const lngNum = Number(form.lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || (latNum === 0 && lngNum === 0)) {
    locationMissing.push('map pin');
  }

  const toggleDay = (day: string) => {
    const days = form.openingDays || [];
    set('openingDays', days.includes(day) ? days.filter((d) => d !== day) : ([...days, day] as never));
  };

  const handleAddPhotos = async (files: File[] | FileList | null) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setAddingPhoto(true);
    try {
      const results = await Promise.all(list.map((file) => uploadMedia(file, 'vendor_cover')));
      set('photos', [...(form.photos || []), ...results.map((r) => r.url)] as never);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('products.upload.errFailed'));
    } finally {
      setAddingPhoto(false);
    }
  };

  const handlePinChange = async (lat: number, lng: number) => {
    setForm((f) => (f ? { ...f, lat, lng } : f));
    setGeocoding(true);
    try {
      const geo = await reverseGeocode(lat, lng);
      setForm((f) =>
        f
          ? {
              ...f,
              ...(geo.address ? { address: geo.address } : {}),
              ...(geo.state ? { state: geo.state } : {}),
              ...(geo.lga ? { lga: geo.lga } : {}),
            }
          : f,
      );
    } catch (_) {
      // Fall back to the manual State/LGA picker below.
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = () => {
    save.mutate({
      name: form.name,
      description: form.description || undefined,
      phone: form.phone,
      email: form.email || undefined,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      state: form.state ?? undefined,
      lga: form.lga ?? undefined,
      openingTime: form.openingTime,
      closingTime: form.closingTime,
      openingDays: form.openingDays,
      logoUrl: form.logoUrl || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      photos: form.photos,
      policies: form.policies,
    } as never);
  };

  const handleCancel = () => {
    // Revert every unsaved change back to the pristine vendor.
    if (pristineVendor.current) {
      setForm(pristineVendor.current);
      snapshot.current = JSON.stringify(pristineVendor.current);
    }
  };

  return (
    <div className="space-y-5 pb-24 lg:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">{t('profile.title')}</h1>
          {vendor && <VendorStatusBadge status={vendor.status} />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted">{form.isOpen ? t('topbar.shopOpen') : t('topbar.shopClosed')}</span>
          <Switch checked={!!form.isOpen} onChange={(v) => { set('isOpen', v as never); save.mutate({ isOpen: v }); }} />
        </div>
      </div>

      {locationMissing.length > 0 && (
        <div className="rounded-md border border-border bg-bg-muted px-4 py-3 text-sm text-text-muted">
          Shop location incomplete: {locationMissing.join(', ')}. Complete it to appear in nearby searches.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.branding.title')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <ImageUpload label={t('profile.branding.logo')} value={form.logoUrl || null} onChange={(url) => set('logoUrl', url as never)} kind="vendor_logo" aspect="square" />
            <div className="min-w-[240px] flex-1">
              <ImageUpload label={t('profile.branding.cover')} value={form.coverImageUrl || null} onChange={(url) => set('coverImageUrl', url as never)} kind="vendor_cover" aspect="wide" />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.business.title')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input label={t('onboarding.businessName')} required value={form.name || ''} onChange={(e) => set('name', e.target.value as never)} />
          <Textarea label={t('onboarding.description')} value={form.description || ''} onChange={(e) => set('description', e.target.value as never)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('settings.phone')} required value={form.phone || ''} onChange={(e) => set('phone', e.target.value as never)} />
            <Input label={t('settings.email')} type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value as never)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.location.title')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">
              {t('profile.location.pin', { defaultValue: 'Shop pin' })}
            </p>
            <LocationPicker lat={form.lat ?? null} lng={form.lng ?? null} onChange={handlePinChange} />
            {geocoding && <p className="mt-1 text-xs text-text-muted">Finding the address…</p>}
          </div>
          <Input label={t('onboarding.streetAddress')} required value={form.address || ''} onChange={(e) => set('address', e.target.value as never)} />
          {form.state && form.lga ? (
            <p className="text-sm text-text-muted">
              Detected area: {form.lga}, {form.state}
            </p>
          ) : (
            <StateLgaPicker
              state={form.state || ''}
              lga={form.lga || ''}
              onChange={(patch) => {
                if (patch.state !== undefined) set('state', patch.state as never);
                if (patch.lga !== undefined) set('lga', patch.lga as never);
              }}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('onboarding.openingTime')} type="time" value={form.openingTime || ''} onChange={(e) => set('openingTime', e.target.value as never)} />
            <Input label={t('onboarding.closingTime')} type="time" value={form.closingTime || ''} onChange={(e) => set('closingTime', e.target.value as never)} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">{t('profile.openDays')}</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const active = (form.openingDays || []).includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? 'bg-brand text-text-onBrand' : 'bg-bg-muted text-text-muted hover:bg-bg-strong'
                    }`}
                  >
                    {t(`profile.days.${day}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.photos.title')}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            {(form.photos || []).map((url, i) => (
              <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-md border border-border">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => set('photos', (form.photos || []).filter((_, idx) => idx !== i) as never)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-text-muted hover:border-brand">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  handleAddPhotos(files);
                }}
              />
              {addingPhoto ? <span className="text-xs">{t('profile.uploading')}</span> : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="text-xs">{t('profile.addPhoto')}</span>
                </>
              )}
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.policies.title')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Textarea
            label={t('profile.policies.shipping')}
            value={form.policies?.shipping || ''}
            onChange={(e) => set('policies', { ...(form.policies || {}), shipping: e.target.value } as never)}
          />
          <Textarea
            label={t('profile.policies.returns')}
            value={form.policies?.returns || ''}
            onChange={(e) => set('policies', { ...(form.policies || {}), returns: e.target.value } as never)}
          />
          <Textarea
            label={t('profile.policies.payment')}
            value={form.policies?.payment || ''}
            onChange={(e) => set('policies', { ...(form.policies || {}), payment: e.target.value } as never)}
          />
          <Textarea
            label={t('profile.policies.shopPolicies')}
            value={form.policies?.shopPolicies || ''}
            onChange={(e) => set('policies', { ...(form.policies || {}), shopPolicies: e.target.value } as never)}
          />
        </CardBody>
      </Card>

      {vendor && vendor.totalOrders > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.reputation.title')}</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Star className="h-5 w-5 fill-warning text-warning" />
              <span className="text-lg font-bold text-text-primary">{vendor.averageRating.toFixed(1)}</span>
            </div>
            <div className="text-sm text-text-muted">{t('profile.completedOrders', { count: vendor.totalOrders })}</div>
          </CardBody>
        </Card>
      )}

      <StickySaveBar dirty={dirty} saving={save.isPending} onSave={handleSave} onCancel={handleCancel} />

      <ConfirmDialog
        open={showExitConfirm}
        onClose={cancelExit}
        onConfirm={confirmExit}
        title={t('common.unsavedChanges')}
        description={t('products.form.unsavedDesc')}
        confirmLabel={t('products.form.discard')}
        danger
      />
    </div>
  );
}
