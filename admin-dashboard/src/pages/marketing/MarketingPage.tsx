import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Megaphone, Image, BadgePercent, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useSetCampaignStatus,
  useDeleteCampaign,
  useBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
  useDiscounts,
  useApproveDiscount,
  useRejectDiscount,
  useHighlights,
  useSetHighlightStatus,
  useDeleteHighlight,
  type CampaignInput,
  type BannerInput,
} from '../../hooks/useMarketing';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { ColorField } from '../../components/ui/ColorField';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { Tabs } from '../../components/ui/Tabs';
import { formatNaira, formatDate, formatRelative } from '../../lib/format';
import { isValidHex } from '../../lib/validation';
import type { PlatformCampaign, DiscountCode, Highlight, Banner, CampaignStatus } from '../../types';

const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, 'neutral' | 'success' | 'warning' | 'info'> = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'info',
};

const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

const CAMPAIGN_STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

const CampaignStatusBadge = ({ status }: { status: CampaignStatus }) => (
  <Badge tone={CAMPAIGN_STATUS_TONE[status]}>{CAMPAIGN_STATUS_LABEL[status]}</Badge>
);

const DISCOUNT_STATUS_TONE: Record<DiscountCode['status'], 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

const DISCOUNT_STATUS_LABEL: Record<DiscountCode['status'], string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const DiscountStatusBadge = ({ status }: { status: DiscountCode['status'] }) => (
  <Badge tone={DISCOUNT_STATUS_TONE[status]}>{DISCOUNT_STATUS_LABEL[status]}</Badge>
);

// =====================================================================
// Campaigns
// =====================================================================

interface CampaignFormData {
  name: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: string;
  targetAudience: string;
  status: CampaignStatus;
}

type CampaignField = keyof CampaignFormData;

const emptyCampaignForm: CampaignFormData = {
  name: '',
  type: 'promotion',
  description: '',
  startDate: '',
  endDate: '',
  budget: '',
  targetAudience: '',
  status: 'draft',
};

const initialCampaignTouched: Record<CampaignField, boolean> = {
  name: false,
  type: false,
  description: false,
  startDate: false,
  endDate: false,
  budget: false,
  targetAudience: false,
  status: false,
};

interface CampaignFormErrors {
  name?: string;
  budget?: string;
  endDate?: string;
}

const validateCampaign = (form: CampaignFormData): CampaignFormErrors => {
  const errors: CampaignFormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (form.budget && !Number.isFinite(Number(form.budget))) errors.budget = 'Enter a valid number';
  if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
    errors.endDate = 'End date must be after start date';
  }
  return errors;
};

const CampaignStatusSelect = ({
  campaign,
  onStatusChange,
}: {
  campaign: PlatformCampaign;
  onStatusChange: (id: string, status: CampaignStatus) => void;
}) => (
  <div className="w-32">
    <Select
      aria-label={`Set ${campaign.name} status`}
      value={campaign.status}
      onChange={(e) => onStatusChange(campaign.id, e.target.value as CampaignStatus)}
    >
      {CAMPAIGN_STATUS_OPTIONS.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </Select>
  </div>
);

const CampaignRow = ({
  campaign,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  campaign: PlatformCampaign;
  onStatusChange: (id: string, status: CampaignStatus) => void;
  onEdit: (campaign: PlatformCampaign) => void;
  onDelete: (id: string) => void;
}) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-text-primary">{campaign.name}</p>
        <Badge tone="neutral" className="capitalize">{campaign.type}</Badge>
      </div>
    </td>
    <td className="px-4 py-3"><CampaignStatusBadge status={campaign.status} /></td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</td>
    <td className="px-4 py-3">
      <p className="text-sm font-medium text-text-primary">{formatNaira(campaign.budget)}</p>
      <p className="text-xs text-text-muted">{formatNaira(campaign.spent)} spent</p>
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{campaign.vendor?.name || 'Platform'}</td>
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end gap-2">
        <CampaignStatusSelect campaign={campaign} onStatusChange={onStatusChange} />
        <Button variant="ghost" size="icon" onClick={() => onEdit(campaign)} aria-label="Edit campaign">
          <Pencil className="h-4 w-4 text-text-muted" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(campaign.id)} aria-label="Delete campaign">
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>
    </td>
  </tr>
);

export const CampaignsTab = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCampaigns(page, 20);
  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const setStatus = useSetCampaignStatus();
  const remove = useDeleteCampaign();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformCampaign | null>(null);
  const [form, setForm] = useState<CampaignFormData>(emptyCampaignForm);
  const [touched, setTouched] = useState<Record<CampaignField, boolean>>(initialCampaignTouched);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const errors = useMemo(() => validateCampaign(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCampaignForm);
    setTouched(initialCampaignTouched);
    setFormOpen(true);
  };

  const openEdit = (campaign: PlatformCampaign) => {
    setEditing(campaign);
    setForm({
      name: campaign.name,
      type: campaign.type,
      description: campaign.description || '',
      startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '',
      endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
      budget: campaign.budget ? String(campaign.budget) : '',
      targetAudience: campaign.targetAudience || '',
      status: campaign.status,
    });
    setTouched(initialCampaignTouched);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyCampaignForm);
    setTouched(initialCampaignTouched);
  };

  const updateField = (field: CampaignField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = () => {
    setTouched({ ...initialCampaignTouched, ...Object.fromEntries(Object.keys(form).map((k) => [k, true] as const)) });
    if (Object.keys(validateCampaign(form)).length > 0) return;
    const budget = form.budget ? Number(form.budget) : undefined;
    const payload: CampaignInput = {
      name: form.name.trim(),
      type: form.type,
      description: form.description || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budget: Number.isFinite(budget as number) ? budget : undefined,
      targetAudience: form.targetAudience || undefined,
      status: form.status,
    };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, { onSuccess: closeForm });
    } else {
      create.mutate(payload, { onSuccess: closeForm });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>New campaign</Button>
      </div>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns found"
          subtitle="Create your first promotional campaign to get started."
          action={<Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>New campaign</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    onStatusChange={(id, status) => setStatus.mutate({ id, status })}
                    onEdit={openEdit}
                    onDelete={setDeleteId}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit campaign' : 'New campaign'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={create.isPending || update.isPending}>Cancel</Button>
            <Button onClick={handleSubmit} loading={create.isPending || update.isPending} disabled={hasErrors}>
              {editing ? 'Save changes' : 'Create campaign'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            error={touched.name ? errors.name : undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Type" value={form.type} onChange={(e) => updateField('type', e.target.value)}>
              <option value="promotion">Promotion</option>
              <option value="announcement">Announcement</option>
              <option value="survey">Survey</option>
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => updateField('status', e.target.value as CampaignStatus)}>
              {CAMPAIGN_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start date" type="date" value={form.startDate} onChange={(e) => updateField('startDate', e.target.value)} />
            <Input
              label="End date"
              type="date"
              value={form.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
              error={touched.endDate ? errors.endDate : undefined}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Budget (₦)"
              type="number"
              min={0}
              value={form.budget}
              onChange={(e) => updateField('budget', e.target.value)}
              error={touched.budget ? errors.budget : undefined}
            />
            <Input
              label="Target audience"
              value={form.targetAudience}
              onChange={(e) => updateField('targetAudience', e.target.value)}
              placeholder="e.g. All users, Lagos only"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}
        title="Delete campaign?"
        description="This will permanently remove the campaign."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </div>
  );
};

// =====================================================================
// Banners
// =====================================================================

interface BannerFormData {
  title: string;
  subtitle: string;
  imageUrl: string;
  deepLink: string;
  bgColor: string;
  priority: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

type BannerField = keyof BannerFormData;

const emptyBannerForm: BannerFormData = {
  title: '',
  subtitle: '',
  imageUrl: '',
  deepLink: '',
  bgColor: '#0B3D24',
  priority: '0',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

const initialBannerTouched: Record<BannerField, boolean> = {
  title: false,
  subtitle: false,
  imageUrl: false,
  deepLink: false,
  bgColor: false,
  priority: false,
  startsAt: false,
  endsAt: false,
  isActive: false,
};

interface BannerFormErrors {
  title?: string;
  imageUrl?: string;
  bgColor?: string;
  endsAt?: string;
}

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validateBanner = (form: BannerFormData): BannerFormErrors => {
  const errors: BannerFormErrors = {};
  if (!form.title.trim()) errors.title = 'Title is required';
  if (!form.imageUrl.trim()) errors.imageUrl = 'Image URL is required';
  else if (!isHttpUrl(form.imageUrl.trim())) errors.imageUrl = 'Enter a valid URL';
  if (form.bgColor && !isValidHex(form.bgColor)) errors.bgColor = 'Enter a valid hex color like #0B3D24';
  if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
    errors.endsAt = 'End must be after start';
  }
  return errors;
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const BannerRow = ({
  banner,
  onToggle,
  onEdit,
  onDelete,
}: {
  banner: Banner;
  onToggle: (banner: Banner) => void;
  onEdit: (banner: Banner) => void;
  onDelete: (id: string) => void;
}) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3">
      <p className="text-sm font-medium text-text-primary">{banner.title}</p>
      {banner.subtitle && <p className="text-xs text-text-muted">{banner.subtitle}</p>}
    </td>
    <td className="px-4 py-3">
      <Switch checked={banner.isActive} onChange={() => onToggle(banner)} />
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{banner.priority}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatDate(banner.startsAt)} – {formatDate(banner.endsAt)}</td>
    <td className="px-4 py-3">
      <code className="rounded bg-bg-muted px-1.5 py-0.5 text-xs text-text-muted font-mono">{banner.deepLink || '-'}</code>
    </td>
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(banner)} aria-label="Edit banner">
          <Pencil className="h-4 w-4 text-text-muted" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(banner.id)} aria-label="Delete banner">
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>
    </td>
  </tr>
);

export const BannersTab = () => {
  const { data, isLoading, error } = useBanners();
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const remove = useDeleteBanner();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerFormData>(emptyBannerForm);
  const [touched, setTouched] = useState<Record<BannerField, boolean>>(initialBannerTouched);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const errors = useMemo(() => validateBanner(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyBannerForm);
    setTouched(initialBannerTouched);
    setFormOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setEditing(banner);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl,
      deepLink: banner.deepLink || '',
      bgColor: banner.bgColor || '#0B3D24',
      priority: String(banner.priority),
      startsAt: toLocalInput(banner.startsAt),
      endsAt: toLocalInput(banner.endsAt),
      isActive: banner.isActive,
    });
    setTouched(initialBannerTouched);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyBannerForm);
    setTouched(initialBannerTouched);
  };

  const updateField = <K extends BannerField>(field: K, value: BannerFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = () => {
    const allTouched = Object.fromEntries(Object.keys(form).map((k) => [k, true] as const)) as Record<BannerField, boolean>;
    setTouched(allTouched);
    if (Object.keys(validateBanner(form)).length > 0) return;
    const payload: BannerInput = {
      title: form.title.trim(),
      subtitle: form.subtitle || undefined,
      imageUrl: form.imageUrl.trim(),
      deepLink: form.deepLink || undefined,
      bgColor: form.bgColor || undefined,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      priority: Number(form.priority) || 0,
      isActive: form.isActive,
    };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, { onSuccess: closeForm });
    } else {
      create.mutate(payload, { onSuccess: closeForm });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>New banner</Button>
      </div>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.length ? (
        <EmptyState
          icon={Image}
          title="No banners found"
          subtitle="Create your first banner to get started."
          action={<Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>New banner</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Banner</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Deep link</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((banner) => (
                  <BannerRow
                    key={banner.id}
                    banner={banner}
                    onToggle={(b) => update.mutate({ id: b.id, data: { isActive: !b.isActive } })}
                    onEdit={openEdit}
                    onDelete={setDeleteId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit banner' : 'New banner'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={create.isPending || update.isPending}>Cancel</Button>
            <Button onClick={handleSubmit} loading={create.isPending || update.isPending} disabled={hasErrors}>
              {editing ? 'Save changes' : 'Create banner'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              error={touched.title ? errors.title : undefined}
            />
            <Input
              label="Subtitle"
              value={form.subtitle}
              onChange={(e) => updateField('subtitle', e.target.value)}
            />
          </div>
          <div>
            <MediaUpload
              label="Banner image"
              value={form.imageUrl || null}
              kind="highlight"
              aspect="wide"
              onChange={(url) => updateField('imageUrl', url)}
            />
            {touched.imageUrl && errors.imageUrl && (
              <p className="mt-1.5 text-xs text-error-strong">{errors.imageUrl}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Deep link"
              value={form.deepLink}
              onChange={(e) => updateField('deepLink', e.target.value)}
              placeholder="/promo/summer"
            />
            <ColorField
              label="Background color"
              value={form.bgColor}
              onChange={(value) => updateField('bgColor', value)}
              error={touched.bgColor ? errors.bgColor : undefined}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Starts at"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => updateField('startsAt', e.target.value)}
            />
            <Input
              label="Ends at"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => updateField('endsAt', e.target.value)}
              error={touched.endsAt ? errors.endsAt : undefined}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Priority"
              type="number"
              min={0}
              value={form.priority}
              onChange={(e) => updateField('priority', e.target.value)}
            />
          </div>
          {editing && (
            <Switch
              label="Active"
              checked={form.isActive}
              onChange={(checked) => updateField('isActive', checked)}
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}
        title="Delete banner?"
        description="This will permanently remove the banner."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </div>
  );
};

// =====================================================================
// Discounts
// =====================================================================

const DISCOUNT_STATUS_FILTER: { value: '' | DiscountCode['status']; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const DiscountRow = ({
  discount,
  onApprove,
  onReject,
}: {
  discount: DiscountCode;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3">
      <code className="rounded bg-bg-muted px-1.5 py-0.5 text-xs text-text-primary font-mono">{discount.code}</code>
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{discount.vendor?.name || 'Platform'}</td>
    <td className="px-4 py-3 text-sm font-medium text-text-primary">
      {discount.type === 'percentage' && discount.discountPercentage
        ? `${discount.discountPercentage}% off`
        : formatNaira(discount.discountAmount)}
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatNaira(discount.minOrder)}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{discount.used}/{discount.usageLimit}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatDate(discount.startDate)} – {formatDate(discount.endDate)}</td>
    <td className="px-4 py-3"><DiscountStatusBadge status={discount.status} /></td>
    <td className="px-4 py-3">
      {discount.status === 'PENDING' ? (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onApprove(discount.id)} title="Approve" aria-label="Approve discount">
            <CheckCircle className="h-4 w-4 text-success" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onReject(discount.id)} title="Reject" aria-label="Reject discount">
            <XCircle className="h-4 w-4 text-error" />
          </Button>
        </div>
      ) : (
        <span className="text-sm text-text-muted">-</span>
      )}
    </td>
  </tr>
);

export const DiscountsTab = () => {
  const [status, setStatus] = useState<'' | DiscountCode['status']>('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useDiscounts({ page, limit: 20, status: status || undefined });
  const approve = useApproveDiscount();
  const reject = useRejectDiscount();

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select
              label="Status"
              className="sm:w-56"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as '' | DiscountCode['status']);
                setPage(1);
              }}
            >
              {DISCOUNT_STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={BadgePercent} title="No discounts found" subtitle="Try changing the status filter." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Min order</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((discount) => (
                  <DiscountRow
                    key={discount.id}
                    discount={discount}
                    onApprove={(id) => approve.mutate(id)}
                    onReject={(id) => reject.mutate(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
        </Card>
      )}
    </div>
  );
};

// =====================================================================
// Highlights
// =====================================================================

const HighlightRow = ({
  highlight,
  onToggle,
  onDelete,
}: {
  highlight: Highlight;
  onToggle: (highlight: Highlight) => void;
  onDelete: (id: string) => void;
}) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        {highlight.coverImageUrl ? (
          <img
            src={highlight.coverImageUrl}
            alt={highlight.name}
            className="h-10 w-10 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-muted text-text-muted">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
        <span className="text-sm font-medium text-text-primary">{highlight.name}</span>
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{highlight.vendor?.name || '-'}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{highlight._count?.stories ?? 0}</td>
    <td className="px-4 py-3">
      <Switch checked={highlight.isActive} onChange={() => onToggle(highlight)} />
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatRelative(highlight.createdAt)}</td>
    <td className="px-4 py-3">
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => onDelete(highlight.id)} aria-label="Delete highlight">
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>
    </td>
  </tr>
);

export const HighlightsTab = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useHighlights({ page, limit: 20, search: search || undefined });
  const setActive = useSetHighlightStatus();
  const remove = useDeleteHighlight();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <Input
            placeholder="Search highlights..."
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={Sparkles}
          title="No highlights found"
          subtitle={search ? 'Try a different search.' : 'No highlights yet.'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Highlight</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Stories</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((highlight) => (
                  <HighlightRow
                    key={highlight.id}
                    highlight={highlight}
                    onToggle={(h) => setActive.mutate({ id: h.id, isActive: !h.isActive })}
                    onDelete={setDeleteId}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}
        title="Delete highlight?"
        description="This will permanently remove the highlight from the app home page."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </div>
  );
};

export default function MarketingPage() {
  const [active, setActive] = useState('campaigns');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Marketing</h1>
        <p className="text-sm text-text-muted">Manage campaigns, banners, discounts and highlights.</p>
      </div>

      <Tabs
        items={[
          { key: 'campaigns', label: 'Campaigns' },
          { key: 'banners', label: 'Banners' },
          { key: 'discounts', label: 'Discounts' },
          { key: 'highlights', label: 'Highlights' },
        ]}
        active={active}
        onChange={setActive}
      />

      {active === 'campaigns' && <CampaignsTab />}
      {active === 'banners' && <BannersTab />}
      {active === 'discounts' && <DiscountsTab />}
      {active === 'highlights' && <HighlightsTab />}
    </div>
  );
}