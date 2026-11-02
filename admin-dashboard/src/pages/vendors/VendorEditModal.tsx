import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { LocationField } from '../../components/ui/LocationField';
import { StateLgaPicker } from '../../components/ui/StateLgaPicker';
import { isValidUrl, validateEmail } from '../../lib/validation';
import { reverseGeocode } from '../../api/vendors';
import type { VendorProfileInput } from '../../api/vendors';
import type { Vendor } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const POLICY_FIELDS = [
  { key: 'shipping', label: 'Shipping' },
  { key: 'returns', label: 'Returns' },
  { key: 'payment', label: 'Payment' },
  { key: 'shopPolicies', label: 'Shop policies' },
] as const;

interface FormState {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  lga: string;
  lat: string;
  lng: string;
  openingTime: string;
  closingTime: string;
  openingDays: string[];
  logoUrl: string;
  coverImageUrl: string;
  photos: string[];
  policies: Record<string, string>;
}

const fromVendor = (v: Vendor): FormState => ({
  name: v.name,
  description: v.description ?? '',
  phone: v.phone,
  email: v.email ?? '',
  address: v.address,
  state: v.state ?? '',
  lga: v.lga ?? '',
  lat: String(v.lat),
  lng: String(v.lng),
  openingTime: v.openingTime,
  closingTime: v.closingTime,
  openingDays: v.openingDays ?? [],
  logoUrl: v.logoUrl ?? '',
  coverImageUrl: v.coverImageUrl ?? '',
  photos: v.photos ?? [],
  policies: (v.policies as Record<string, string> | null) ?? {},
});

export const VendorEditModal = ({
  vendor,
  onClose,
  onSubmit,
  loading,
}: {
  vendor: Vendor | null;
  onClose: () => void;
  onSubmit: (data: VendorProfileInput) => void;
  loading?: boolean;
}) => {
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');

  const lastId = useRef<string | null>(null);
  useEffect(() => {
    const id = vendor?.id ?? null;
    if (id === lastId.current) return;
    lastId.current = id;
    setForm(vendor ? fromVendor(vendor) : null);
    setError('');
  }, [vendor]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const toggleDay = (day: string) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            openingDays: prev.openingDays.includes(day)
              ? prev.openingDays.filter((d) => d !== day)
              : [...prev.openingDays, day],
          }
        : prev,
    );

  const handlePinChange = async (lat: number, lng: number) => {
    set('lat', String(lat));
    set('lng', String(lng));
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo.address) set('address', geo.address);
      if (geo.state) set('state', geo.state);
      if (geo.lga) set('lga', geo.lga);
    } catch (_) {
      // Fall back to the manual State/LGA picker.
    }
  };

  const handleSubmit = () => {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) return setError('Shop name must be at least 2 characters');
    if (form.phone.trim().length < 7) return setError('Enter a valid phone number');
    if (form.email.trim() && !validateEmail(form.email.trim())) return setError('Enter a valid email address');
    if (form.address.trim().length < 5) return setError('Enter a valid address');
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!form.openingDays.length) return setError('Select at least one open day');
    if (!isValidUrl(form.logoUrl) || !isValidUrl(form.coverImageUrl)) {
      return setError('Logo and cover must be valid image URLs');
    }
    if (form.photos.some((url) => !isValidUrl(url))) {
      return setError('Every shop photo must be a valid image URL');
    }

    onSubmit({
      name,
      description: form.description.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim(),
      state: form.state.trim() || undefined,
      lga: form.lga.trim() || undefined,
      lat,
      lng,
      openingTime: form.openingTime,
      closingTime: form.closingTime,
      openingDays: form.openingDays,
      logoUrl: form.logoUrl.trim(),
      coverImageUrl: form.coverImageUrl.trim(),
      photos: form.photos,
      policies: form.policies,
    });
  };

  return (
    <Modal
      open={!!vendor}
      onClose={onClose}
      title={vendor ? `Edit ${vendor.name}` : 'Edit shop'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!form}>
            Save changes
          </Button>
        </>
      }
    >
      {form && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Branding</h3>
            <div className="flex flex-wrap gap-4">
              <MediaUpload
                label="Logo"
                value={form.logoUrl || null}
                kind="vendor_logo"
                aspect="square"
                onChange={(url) => set('logoUrl', url)}
              />
              <div className="min-w-[240px] flex-1">
                <MediaUpload
                  label="Cover image"
                  value={form.coverImageUrl || null}
                  kind="vendor_cover"
                  aspect="wide"
                  onChange={(url) => set('coverImageUrl', url)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Business info</h3>
            <Input label="Shop name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Location & hours</h3>
            <LocationField
              address={form.address}
              lat={form.lat ? Number(form.lat) : null}
              lng={form.lng ? Number(form.lng) : null}
              onAddressChange={(value) => set('address', value)}
              onChange={handlePinChange}
            />
            {form.state && form.lga ? (
              <p className="text-sm text-text-muted">
                Detected area: {form.lga}, {form.state}
              </p>
            ) : (
              <StateLgaPicker
                state={form.state}
                lga={form.lga}
                onChange={(patch) => {
                  if (patch.state !== undefined) set('state', patch.state);
                  if (patch.lga !== undefined) set('lga', patch.lga);
                }}
              />
            )}
            {(!form.lat || !form.lng) && (
              <p className="text-xs text-text-muted">
                A map pin is required before this vendor can be approved or appear in nearby searches.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Opening time"
                type="time"
                value={form.openingTime}
                onChange={(e) => set('openingTime', e.target.value)}
              />
              <Input
                label="Closing time"
                type="time"
                value={form.closingTime}
                onChange={(e) => set('closingTime', e.target.value)}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">Open days</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const active = form.openingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        active ? 'bg-brand text-text-onBrand' : 'bg-bg-muted text-text-muted hover:bg-bg-strong'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Shop photos</h3>
            <div className="flex flex-wrap gap-3">
              {form.photos.map((url, index) => (
                <div key={`${url}-${index}`} className="relative">
                  <img src={url} alt="Shop photo" className="h-24 w-24 rounded-md border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => set('photos', form.photos.filter((_, i) => i !== index))}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white shadow"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <MediaUpload
                value={null}
                kind="vendor_cover"
                aspect="square"
                containerClassName="h-24 w-24"
                onChange={(url) => {
                  if (url) set('photos', [...form.photos, url]);
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Policies</h3>
            {POLICY_FIELDS.map(({ key, label }) => (
              <Textarea
                key={key}
                label={label}
                value={form.policies[key] ?? ''}
                onChange={(e) => set('policies', { ...form.policies, [key]: e.target.value })}
              />
            ))}
          </section>

          {error && <p className="text-sm text-error-strong">{error}</p>}
        </div>
      )}
    </Modal>
  );
};
