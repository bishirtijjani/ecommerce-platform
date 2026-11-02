import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { getProfile, updateProfile, updateProfilePicture, type AdminProfile, type ProfileUpdateInput } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

const PROFILE_KEY = ['admin', 'profile'];
const PHONE_RE = /^0[789][01]\d{8}$/;

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  dateOfBirth: string;
}

const dobValue = (value: string | null) => (value ? value.slice(0, 10) : '');

export default function ProfilePage() {
  const updateUser = useAuthStore((s) => s.updateUser);
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: ({ signal }) => getProfile(signal),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        dateOfBirth: dobValue(profile.dateOfBirth),
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: (patch: ProfileUpdateInput) => updateProfile(patch),
    onSuccess: (data: AdminProfile) => {
      qc.setQueryData(PROFILE_KEY, data);
      updateUser({ firstName: data.firstName, lastName: data.lastName, phone: data.phone });
      toast.success('Profile updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const picture = useMutation({
    mutationFn: (url: string) => updateProfilePicture(url),
    onSuccess: (_res, url) => {
      qc.setQueryData<AdminProfile>(PROFILE_KEY, (old) => (old ? { ...old, profilePicture: url } : old));
      updateUser({ profilePicture: url });
      toast.success('Profile photo updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !form || !profile) return <PageSpinner />;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = () => {
    const patch: ProfileUpdateInput = {};
    if (form.firstName.trim() !== profile.firstName) patch.firstName = form.firstName.trim();
    if (form.lastName.trim() !== profile.lastName) patch.lastName = form.lastName.trim();
    if (form.phone.trim() !== (profile.phone ?? '')) patch.phone = form.phone.trim();
    if (form.address.trim() !== (profile.address ?? '')) patch.address = form.address.trim();
    if (form.dateOfBirth && form.dateOfBirth !== dobValue(profile.dateOfBirth)) {
      patch.dateOfBirth = form.dateOfBirth;
    }

    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save');
      return;
    }
    if (patch.firstName !== undefined && patch.firstName.length < 2) {
      return setError('First name must be at least 2 characters');
    }
    if (patch.lastName !== undefined && patch.lastName.length < 2) {
      return setError('Last name must be at least 2 characters');
    }
    if (patch.phone !== undefined && !PHONE_RE.test(patch.phone)) {
      return setError('Enter a valid Nigerian phone number, e.g. 08012345678');
    }
    setError('');
    save.mutate(patch);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">My profile</h1>
        <p className="text-sm text-text-muted">Manage your account details and profile photo.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Profile photo</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col items-center gap-4">
            <MediaUpload
              value={profile.profilePicture}
              kind="profile"
              aspect="square"
              containerClassName="h-32 w-32 rounded-full"
              onChange={(url) => {
                if (url) picture.mutate(url);
              }}
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-text-primary">
                {form.firstName} {form.lastName}
              </p>
              <p className="text-xs text-text-muted">{profile.email}</p>
              <div className="pt-2">
                <Badge tone="brand">Administrator</Badge>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
              <Input label="Last name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
            <Input
              label="Email"
              value={profile.email}
              disabled
              hint="Your login email can't be changed here."
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="08012345678"
            />
            <Input label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
            <Input
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
            />
            {error && <p className="text-sm text-error-strong">{error}</p>}
            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={handleSave} loading={save.isPending}>
                Save changes
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
