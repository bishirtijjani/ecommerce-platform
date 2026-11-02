import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Plus, Tag } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { useDiscountCodes, useCreateDiscountCode } from '../../hooks/useMarketing';
import { formatDate, formatNaira } from '../../lib/format';

const STATUS_TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' } as const;

export default function Marketing() {
  const { t } = useTranslation();
  const { data: codes, isLoading } = useDiscountCodes();
  const createCode = useCreateDiscountCode();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percentage' as 'percentage' | 'fixed', value: '', minOrder: '', usageLimit: '100' });

  const submit = () => {
    if (!form.code.trim() || !form.value) return;
    createCode.mutate(
      {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        minOrder: form.minOrder ? Number(form.minOrder) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      },
      { onSuccess: () => { setOpen(false); setForm({ code: '', type: 'percentage', value: '', minOrder: '', usageLimit: '100' }); } },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('nav.marketing')}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{t('marketing.subtitle')}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
          {t('marketing.newDiscountCode')}
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <PageSpinner />
        ) : codes?.length ? (
          <>
            <div className="divide-y divide-border md:hidden">
              {codes.map((c) => (
                <div key={c.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-text-primary">
                      <Tag className="h-3.5 w-3.5 text-brand" /> {c.code}
                    </span>
                    <Badge tone={STATUS_TONE[c.status]}>{t(`marketing.statuses.${c.status}`)}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-text-muted">
                    <span>
                      {c.type === 'percentage' ? t('marketing.percentOff', { value: c.value }) : t('marketing.amountOff', { amount: formatNaira(c.value) })}
                      {c.minOrder ? ` · ${t('marketing.minOrderShort', { amount: formatNaira(c.minOrder) })}` : ''}
                    </span>
                    <span>
                      {t('marketing.usedOf', { used: c.used, total: c.usageLimit })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    <th className="px-5 py-2.5">{t('marketing.code')}</th>
                    <th className="px-5 py-2.5">{t('marketing.discount')}</th>
                    <th className="px-5 py-2.5">{t('marketing.minOrder')}</th>
                    <th className="px-5 py-2.5">{t('marketing.used')}</th>
                    <th className="px-5 py-2.5">{t('table.status')}</th>
                    <th className="px-5 py-2.5">{t('marketing.created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {codes.map((c) => (
                    <tr key={c.id} className="hover:bg-bg-muted">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-text-primary">
                          <Tag className="h-3.5 w-3.5 text-brand" /> {c.code}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-text-primary">{c.type === 'percentage' ? `${c.value}%` : formatNaira(c.value)}</td>
                      <td className="px-5 py-3 text-text-muted">{c.minOrder ? formatNaira(c.minOrder) : '-'}</td>
                      <td className="px-5 py-3 text-text-muted">
                        {t('marketing.usedOf', { used: c.used, total: c.usageLimit })}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={STATUS_TONE[c.status]}>{t(`marketing.statuses.${c.status}`)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-text-muted">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState icon={Megaphone} title={t('marketing.emptyTitle')} subtitle={t('marketing.emptySubtitle')} />
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('marketing.modalTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={createCode.isPending} disabled={!form.code.trim() || !form.value}>
              {t('marketing.submitForReview')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={t('marketing.code')} required placeholder={t('marketing.codePlaceholder')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('table.type')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'percentage' | 'fixed' })}>
              <option value="percentage">{t('marketing.typePercentage')}</option>
              <option value="fixed">{t('marketing.typeFixed')}</option>
            </Select>
            <Input
              label={form.type === 'percentage' ? t('marketing.valuePercent') : t('marketing.valueFixed')}
              type="number"
              required
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('marketing.minOrderNaira')} type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
            <Input label={t('marketing.usageLimit')} type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
