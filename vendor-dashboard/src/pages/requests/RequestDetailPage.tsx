import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft, MapPin, Phone, Send, XCircle, CheckCircle2, Clock3, Wallet, Package, Navigation,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge, RequestStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageSpinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useRequest, useRespondToRequest, useDeclineRequest } from '../../hooks/useRequests';
import { ensurePush } from '../../services/push';
import { formatNaira, formatRelative, formatDateTime } from '../../lib/format';

const Detail = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) => (
  <div className="flex items-start gap-2">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
    <div className="min-w-0">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-medium text-text-primary">{value}</p>
    </div>
  </div>
);

export default function RequestDetailPage() {
  const { t } = useTranslation();
  const { requestId } = useParams();
  const { data: request, isLoading, isError, refetch } = useRequest(requestId);
  const respond = useRespondToRequest(requestId as string);
  const decline = useDeclineRequest(requestId as string);

  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [etaText, setEtaText] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);

  if (isLoading) return <PageSpinner />;
  if (isError || !request) return <ErrorState title={t('requests.detail.couldntLoad')} onRetry={() => refetch()} />;

  const customerName = request.customer
    ? `${request.customer.firstName} ${request.customer.lastName || ''}`.trim()
    : t('table.customer');
  const phone = request.customer?.phone;
  const myResponse = request.myResponse;
  const accepted = myResponse?.status === 'ACCEPTED';
  const isOpen = request.status === 'OPEN';

  const budget =
    request.budgetMin != null || request.budgetMax != null
      ? `${request.budgetMin != null ? formatNaira(request.budgetMin) : '-'} – ${request.budgetMax != null ? formatNaira(request.budgetMax) : '-'}`
      : t('requests.detail.notSpecified');

  const reach =
    request.reach === 'NEARBY'
      ? `${t('requests.detail.nearby')}${request.radiusKm != null ? ` · ${t('requests.detail.withinKm', { km: request.radiusKm })}` : ''}`
      : t('requests.detail.anywhere');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // Replying notifies the customer - offer push (with a reason) once.
    ensurePush('request');
    const parsed = price.trim() ? Number(price) : undefined;
    respond.mutate({
      message: message.trim(),
      price: parsed != null && !Number.isNaN(parsed) ? parsed : undefined,
      priceNote: priceNote.trim() || undefined,
      etaText: etaText.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/requests" className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-text-primary">{request.title}</h1>
          <p className="text-sm text-text-muted">{t('requests.detail.posted', { time: formatRelative(request.createdAt) })}</p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      {accepted && phone && (
        <Card className="border-success-soft bg-success-soft/40">
          <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{t('requests.detail.acceptedTitle')}</p>
                <p className="text-xs text-text-muted">{t('requests.detail.acceptedBody', { name: customerName })}</p>
              </div>
            </div>
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-text-onBrand hover:bg-brand-strong"
            >
              <Phone className="h-4 w-4" /> {phone}
            </a>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('requests.detail.title')}</CardTitle>
              {(request.category || request.subcategory) && (
                <Badge>{request.subcategory?.name || request.category?.name}</Badge>
              )}
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="whitespace-pre-line text-sm text-text-primary">{request.description}</p>

              {request.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {request.images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img src={url} className="h-20 w-20 rounded-lg border border-border object-cover" alt={t('requests.detail.attachment')} />
                    </a>
                  ))}
                </div>
              )}

              {request.videos?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {request.videos.map((url, i) => (
                    <video
                      key={i}
                      src={url}
                      controls
                      className="h-40 w-64 rounded-lg border border-border bg-black object-contain"
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <Detail icon={Package} label={t('requests.detail.quantity')} value={request.quantity} />
                <Detail icon={Wallet} label={t('requests.detail.budget')} value={budget} />
                <Detail icon={Clock3} label={t('requests.detail.neededBy')} value={request.neededBy ? formatDateTime(request.neededBy) : t('requests.detail.flexible')} />
                <Detail icon={Navigation} label={t('requests.detail.range')} value={reach} />
                {request.distanceKm != null && (
                  <Detail icon={MapPin} label={t('requests.detail.distance')} value={t('requests.kmAway', { km: request.distanceKm.toFixed(1) })} />
                )}
                <Detail
                  icon={MapPin}
                  label={t('requests.detail.location')}
                  value={[request.lga, request.state].filter(Boolean).join(', ') || request.address}
                />
                <Detail icon={Clock3} label={t('requests.detail.urgency')} value={t(`requests.detail.urgencyLevels.${request.urgency}`, request.urgency)} />
              </div>
            </CardBody>
          </Card>

          {myResponse && (
            <Card>
              <CardHeader>
                <CardTitle>{t('requests.detail.yourResponse')}</CardTitle>
                <Badge tone={accepted ? 'success' : 'neutral'}>{t(`requests.detail.responseStatus.${myResponse.status}`, myResponse.status)}</Badge>
              </CardHeader>
              <CardBody className="space-y-2">
                <p className="whitespace-pre-line text-sm text-text-primary">{myResponse.message}</p>
                {myResponse.price != null && (
                  <p className="text-sm text-text-muted">
                    {t('requests.detail.priceLabel')} <span className="font-medium text-text-primary">{formatNaira(myResponse.price)}</span>
                  </p>
                )}
                {myResponse.priceNote && <p className="text-sm text-text-muted">{t('requests.detail.noteLabel')} {myResponse.priceNote}</p>}
                {myResponse.etaText && <p className="text-sm text-text-muted">{t('requests.detail.etaLabel')} {myResponse.etaText}</p>}
              </CardBody>
            </Card>
          )}

          {isOpen && (
            <Card>
              <CardHeader>
                <CardTitle>{t('requests.detail.sendReply')}</CardTitle>
              </CardHeader>
              <CardBody>
                <form className="space-y-4" onSubmit={submit}>
                  <Textarea
                    label={t('requests.detail.message')}
                    required
                    placeholder={t('requests.detail.messagePlaceholder')}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Input
                      label={t('requests.detail.price')}
                      type="number"
                      min="0"
                      placeholder={t('requests.detail.pricePlaceholder')}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <Input
                      label={t('requests.detail.priceNote')}
                      placeholder={t('requests.detail.priceNotePlaceholder')}
                      value={priceNote}
                      onChange={(e) => setPriceNote(e.target.value)}
                    />
                    <Input
                      label={t('requests.detail.eta')}
                      placeholder={t('requests.detail.etaPlaceholder')}
                      value={etaText}
                      onChange={(e) => setEtaText(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    icon={<Send className="h-4 w-4" />}
                    loading={respond.isPending}
                    disabled={!message.trim()}
                  >
                    {t('requests.detail.sendResponse')}
                  </Button>
                </form>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('table.customer')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar src={request.customer?.profilePicture} name={customerName} size={40} />
                <div>
                  <p className="text-sm font-medium text-text-primary">{customerName}</p>
                  {phone ? (
                    <a href={`tel:${phone}`} className="flex items-center gap-1 text-xs text-brand hover:text-brand-strong">
                      <Phone className="h-3 w-3" /> {phone}
                    </a>
                  ) : (
                    <p className="text-xs text-text-muted">{t('requests.detail.phoneAfterAcceptance')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 border-t border-border pt-3 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                <div>
                  <p className="font-medium text-text-primary">{t('requests.detail.location')}</p>
                  <p className="text-text-muted">{request.address}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('requests.detail.actions')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {isOpen ? (
                <Button
                  variant="danger"
                  className="w-full"
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={() => setDeclineOpen(true)}
                >
                  {t('requests.detail.decline')}
                </Button>
              ) : (
                <p className="text-sm text-text-muted">
                  {t('requests.detail.noLongerAccepting', { status: t(`status.request.${request.status}`).toLowerCase() })}
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        onConfirm={() => decline.mutate(undefined, { onSuccess: () => setDeclineOpen(false) })}
        title={t('requests.detail.declineTitle')}
        description={t('requests.detail.declineBody')}
        confirmLabel={t('requests.detail.declineConfirm')}
        danger
        loading={decline.isPending}
      />
    </div>
  );
}
