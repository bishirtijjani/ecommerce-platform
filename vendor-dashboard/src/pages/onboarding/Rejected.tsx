import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { XCircle } from 'lucide-react';
import { StatusLayout } from './StatusLayout';
import { Input, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useVendorProfile, VENDOR_PROFILE_KEY } from '../../hooks/useVendor';
import { resubmitVendor } from '../../api/vendor';
import { useAuthStore } from '../../store/authStore';

export default function Rejected() {
  const { t } = useTranslation();
  const { data: vendor } = useVendorProfile();
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState(() => ({
    name: vendor?.name || '',
    description: vendor?.description || '',
    phone: vendor?.phone || '',
    address: vendor?.address || '',
    lat: vendor?.lat ?? null,
    lng: vendor?.lng ?? null,
  }));

  const mutation = useMutation({
    mutationFn: () => resubmitVendor(vendorId, form as never),
    onSuccess: (data) => {
      qc.setQueryData([...VENDOR_PROFILE_KEY, vendorId], data);
      toast.success(t('onboarding.resubmittedToast'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!editing) {
    return (
      <StatusLayout icon={<XCircle className="h-6 w-6 text-error" />}>
        <h1 className="text-lg font-semibold text-text-primary">{t('onboarding.rejectedTitle')}</h1>
        <p className="mt-2 text-sm text-text-muted">{vendor?.rejectionReason || t('onboarding.noReason')}</p>
        <Button className="mt-5 w-full" onClick={() => setEditing(true)}>
          {t('onboarding.fixResubmit')}
        </Button>
      </StatusLayout>
    );
  }

  return (
    <div className="min-h-screen bg-bg-canvas px-4 py-10">
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-bg-surface p-6 shadow-card sm:p-8">
        <h1 className="text-lg font-semibold text-text-primary">{t('onboarding.updateTitle')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('onboarding.updateSubtitle')}</p>
        <div className="mt-6 space-y-5">
          <Input label={t('onboarding.businessName')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label={t('onboarding.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label={t('onboarding.businessPhone')} required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t('onboarding.streetAddress')} required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              {t('onboarding.resubmit')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
