import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Laptop, Smartphone, Monitor as Monitor2, LifeBuoy } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { PageSpinner } from '../../components/ui/Spinner';
import {
  getProfile, updateProfile, listSessions, revokeSession, revokeOtherSessions,
  getNotificationPreferences, updateNotificationPreferences,
} from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { formatRelative } from '../../lib/format';

export default function Settings() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const { data: sessions, isLoading: sessionsLoading } = useQuery({ queryKey: ['sessions'], queryFn: listSessions });
  const { data: prefs, isLoading: prefsLoading } = useQuery({ queryKey: ['notification-prefs'], queryFn: getNotificationPreferences });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: () => updateProfile({ firstName, lastName, phone }),
    onSuccess: (data) => {
      // Keep the session's name in sync (topbar avatar/menu) without
      // clobbering vendorId/role, which /auth/profile doesn't return.
      if (user) setUser({ ...user, firstName: data.firstName, lastName: data.lastName });
      qc.setQueryData(['profile'], data);
      toast.success(t('settings.accountUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(t('settings.sessionSignedOut'));
    },
  });

  const revokeAll = useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(t('settings.othersSignedOut'));
    },
  });

  const savePrefs = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => {
      qc.setQueryData(['notification-prefs'], data);
      toast.success(t('settings.prefsSaved'));
    },
  });

  const deviceIcon = (ua: string | null) => {
    if (!ua) return Monitor2;
    if (/mobile/i.test(ua)) return Smartphone;
    return Laptop;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t('settings.title')}</h1>
        <p className="mt-0.5 text-sm text-text-muted">{t('settings.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account')}</CardTitle>
        </CardHeader>
        {profileLoading ? (
          <PageSpinner />
        ) : (
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label={t('settings.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label={t('settings.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <Input label={t('settings.email')} value={profile?.email || ''} disabled hint={t('settings.emailHint')} />
            <Input label={t('settings.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to="/support"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-strong"
              >
                <LifeBuoy className="h-4 w-4" />
                {t('settings.contactSupport')}
              </Link>
              <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.notifications')}</CardTitle>
        </CardHeader>
        {prefsLoading ? (
          <PageSpinner />
        ) : (
          <CardBody className="divide-y divide-border">
            {[
              { key: 'pushEnabled', label: t('settings.notifPush'), hint: t('settings.notifPushHint') },
              { key: 'orderUpdates', label: t('settings.notifOrder'), hint: t('settings.notifOrderHint') },
              { key: 'emailEnabled', label: t('settings.notifEmail'), hint: t('settings.notifEmailHint') },
              { key: 'promotions', label: t('settings.notifPromo'), hint: t('settings.notifPromoHint') },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">{row.label}</p>
                  <p className="text-xs text-text-muted">{row.hint}</p>
                </div>
                <Switch
                  checked={!!prefs?.[row.key as keyof typeof prefs]}
                  onChange={(v) => savePrefs.mutate({ [row.key]: v })}
                />
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.activeSessions')}</CardTitle>
          {sessions && sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => revokeAll.mutate()} loading={revokeAll.isPending}>
              {t('settings.signOutOthers')}
            </Button>
          )}
        </CardHeader>
        {sessionsLoading ? (
          <PageSpinner />
        ) : (
          <div className="divide-y divide-border">
            {sessions?.map((s) => {
              const Icon = deviceIcon(s.userAgent);
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-muted text-text-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {s.deviceName || s.deviceModel || t('settings.unknownDevice')} {s.isCurrent && <span className="text-brand">{t('settings.thisDevice')}</span>}
                      </p>
                      <p className="text-xs text-text-muted">
                        {s.ipAddress || t('settings.unknownIp')} · {t('settings.activeAgo', { time: formatRelative(s.lastUsedAt) })}
                      </p>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => revoke.mutate(s.id)} className="text-sm font-medium text-error-strong hover:underline">
                      {t('settings.signOut')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
