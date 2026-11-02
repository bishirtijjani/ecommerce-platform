import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '../../i18n';
import { CheckCircle2, Clock3, Inbox, Lock, Mail, Paperclip, Phone, Plus, Send, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { PageSpinner, Spinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { useCloseTicket, useCreateTicket, usePostTicketMessage, useTicket, useTickets } from '../../hooks/useSupport';
import { uploadMedia } from '../../api/upload';
import { formatDateTime, formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';
import type {
  SupportTicket, TicketCategory, TicketPriority, TicketStatus,
} from '../../types';

const LIMIT = 20;
const SUPPORT_EMAIL = 'support@mysooq.ng';
const SUPPORT_PHONE = '0800-000-0000';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

const STATUS_TONE: Record<TicketStatus, Tone> = {
  OPEN: 'brand',
  IN_PROGRESS: 'warning',
  PENDING_USER: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  URGENT: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

const TICKET_CATEGORIES: TicketCategory[] = [
  'ACCOUNT', 'PAYMENT', 'ORDER', 'DELIVERY', 'PRODUCT', 'TECHNICAL', 'OTHER',
];
const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED'];

const TicketStatusBadge = ({ status }: { status: TicketStatus }) => {
  const { t } = useTranslation();
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{t(`support.statuses.${status}`, status)}</Badge>;
};

const PriorityBadge = ({ priority }: { priority: TicketPriority }) => {
  const { t } = useTranslation();
  return <Badge tone={PRIORITY_TONE[priority] || 'neutral'}>{t(`support.priorities.${priority}`, priority)}</Badge>;
};

/**
 * Small uploader shared by the create form and the reply box. Uploads straight
 * to Cloudinary via the existing signed flow (kind 'ticket') so the platform's
 * attachment validator accepts the resulting URL.
 */
const useAttachmentUploader = (max = 3) => {
  const [items, setItems] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = max - items.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${max} files.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const res = await uploadMedia(file, 'ticket');
        setItems((prev) => [...prev, { url: res.url, name: file.name }]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.t('support.uploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (url: string) => setItems((prev) => prev.filter((i) => i.url !== url));
  const reset = () => setItems([]);

  return { items, uploading, inputRef, pick, remove, reset };
};

const AttachmentField = ({
  uploader,
  label,
}: {
  uploader: ReturnType<typeof useAttachmentUploader>;
  label?: string;
}) => {
  const { t } = useTranslation();
  const text = label ?? t('support.attachScreenshot');
  return (
  <div className="space-y-2">
    <input
      ref={uploader.inputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => uploader.pick(e.target.files)}
    />
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={uploader.uploading}
      onClick={() => uploader.inputRef.current?.click()}
      icon={uploader.uploading ? <Spinner className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
    >
      {text}
    </Button>
    {uploader.items.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {uploader.items.map((a) => (
          <span
            key={a.url}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-muted py-1 pl-1 pr-2 text-xs text-text-muted"
          >
            <img src={a.url} alt="" className="h-6 w-6 rounded object-cover" />
            <span className="max-w-[140px] truncate">{a.name}</span>
            <button
              type="button"
              aria-label={`Remove ${a.name}`}
              onClick={() => uploader.remove(a.url)}
              className="text-text-muted hover:text-error-strong"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    )}
  </div>
  );
};

const MessageBubble = ({
  label, mine, body, attachmentUrls, createdAt,
}: {
  label: string;
  mine: boolean;
  body: string;
  attachmentUrls: string[];
  createdAt: string;
}) => (
  <div className={cn('rounded-lg border p-4', mine ? 'border-border bg-bg-muted' : 'border-brand/30 bg-brand-soft')}>
    <div className="flex items-center justify-between gap-2">
      <Badge tone={mine ? 'neutral' : 'brand'}>{label}</Badge>
      <span className="text-xs text-text-muted">{formatDateTime(createdAt)}</span>
    </div>
    {body && <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{body}</p>}
    {attachmentUrls.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {attachmentUrls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border">
            <img src={url} alt="attachment" className="h-20 w-20 rounded-md object-cover" />
          </a>
        ))}
      </div>
    )}
  </div>
);

const TicketRow = ({ ticket, onOpen }: { ticket: SupportTicket; onOpen: () => void }) => {
  const { t } = useTranslation();
  return (
  <button
    onClick={onOpen}
    className="flex w-full flex-col gap-2 border-b border-border px-4 py-3.5 text-left last:border-0 hover:bg-bg-muted active:bg-bg-muted sm:px-5"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          <span className="text-text-muted">#{ticket.number}</span> {ticket.subject}
        </p>
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {t(`support.categories.${ticket.category}`)} · {formatRelative(ticket.lastActivityAt)}
        </p>
      </div>
      <TicketStatusBadge status={ticket.status} />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <PriorityBadge priority={ticket.priority} />
      {ticket.status === 'PENDING_USER' && (
        <span className="text-xs font-medium text-info-strong">{t('support.awaitingReply')}</span>
      )}
    </div>
  </button>
  );
};

const ContactCard = () => {
  const { t } = useTranslation();
  return (
  <Card>
    <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-text-primary">{t('support.preferContact')}</p>
        <p className="text-xs text-text-muted">{t('support.preferContactSub')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-muted"
        >
          <Mail className="h-4 w-4 text-brand" />
          {SUPPORT_EMAIL}
        </a>
        <a
          href={`tel:${SUPPORT_PHONE.replace(/[^0-9+]/g, '')}`}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-muted"
        >
          <Phone className="h-4 w-4 text-brand" />
          {SUPPORT_PHONE}
        </a>
      </div>
    </CardBody>
  </Card>
  );
};

const NewTicketModal = ({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ticket: SupportTicket) => void;
}) => {
  const { t } = useTranslation();
  const create = useCreateTicket();
  const attachments = useAttachmentUploader();
  const [category, setCategory] = useState<TicketCategory>('ACCOUNT');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCategory('ACCOUNT');
    setPriority('MEDIUM');
    setSubject('');
    setDescription('');
    setError(null);
    attachments.reset();
  };

  const submit = () => {
    if (subject.trim().length < 3) {
      setError(t('support.errSubject'));
      return;
    }
    if (description.trim().length < 10) {
      setError(t('support.errDescription'));
      return;
    }
    setError(null);
    create.mutate(
      {
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        attachmentUrls: attachments.items.map((a) => a.url),
      },
      {
        onSuccess: (ticket) => {
          reset();
          onCreated(ticket);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('support.newTicketTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={create.isPending} disabled={attachments.uploading}>
            {t('support.submitTicket')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select value={category} label={t('support.category')} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
            {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`support.categories.${c}`)}</option>)}
          </Select>
          <Select value={priority} label={t('support.priority')} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{t(`support.priorities.${p}`)}</option>)}
          </Select>
        </div>
        <Input
          label={t('support.subject')}
          value={subject}
          maxLength={200}
          placeholder={t('support.subjectPlaceholder')}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          label={t('support.description')}
          value={description}
          maxLength={5000}
          placeholder={t('support.descriptionPlaceholder')}
          className="min-h-[140px]"
          onChange={(e) => setDescription(e.target.value)}
        />
        <AttachmentField uploader={attachments} />
        {error && <p className="text-xs text-error-strong">{error}</p>}
      </div>
    </Modal>
  );
};

const TicketModal = ({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) => {
  const { t } = useTranslation();
  const { data: ticket, isLoading, error } = useTicket(ticketId ?? undefined);
  const postMessage = usePostTicketMessage(ticketId ?? '');
  const close = useCloseTicket();
  const attachments = useAttachmentUploader();
  const [reply, setReply] = useState('');

  const closed = ticket?.status === 'CLOSED';

  const send = () => {
    const body = reply.trim();
    if (!body && attachments.items.length === 0) return;
    postMessage.mutate(
      { body: body || t('support.attachment'), attachmentUrls: attachments.items.map((a) => a.url) },
      {
        onSuccess: () => {
          setReply('');
          attachments.reset();
        },
      },
    );
  };

  return (
    <Modal
      open={!!ticketId}
      onClose={onClose}
      size="lg"
      title={ticket ? `#${ticket.number} · ${ticket.subject}` : t('support.ticket')}
      footer={
        ticket && !closed ? (
          <>
            <Button
              variant="outline"
              icon={<CheckCircle2 className="h-4 w-4" />}
              loading={close.isPending}
              onClick={() => close.mutate(ticket.id)}
            >
              {t('support.closeTicket')}
            </Button>
            <Button
              icon={<Send className="h-4 w-4" />}
              loading={postMessage.isPending}
              disabled={attachments.uploading || (!reply.trim() && attachments.items.length === 0)}
              onClick={send}
            >
              {t('support.sendReply')}
            </Button>
          </>
        ) : undefined
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState
          title={t('support.couldntLoad')}
          subtitle={error.message}
          onRetry={() => window.location.reload()}
        />
      ) : ticket ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <Badge tone="neutral">{t(`support.categories.${ticket.category}`)}</Badge>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-text-muted">
              <Clock3 className="h-3 w-3" />
              {formatDateTime(ticket.createdAt)}
            </span>
          </div>

          {ticket.resolution && (
            <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success-strong">
              {ticket.resolution}
            </div>
          )}

          <div className="space-y-4">
            <MessageBubble
              label={t('support.you')}
              mine
              body={ticket.description}
              attachmentUrls={ticket.attachmentUrls}
              createdAt={ticket.createdAt}
            />
            {(ticket.messages ?? []).map((m) => {
              const fromAdmin = m.fromUser?.role === 'ADMIN';
              return (
                <MessageBubble
                  key={m.id}
                  label={fromAdmin ? t('support.supportTeam') : t('support.you')}
                  mine={!fromAdmin}
                  body={m.body}
                  attachmentUrls={m.attachmentUrls}
                  createdAt={m.createdAt}
                />
              );
            })}
          </div>

          {closed ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-muted p-3 text-sm text-text-muted">
              <Lock className="h-4 w-4" />
              {t('support.closedNotice')}
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              <Textarea
                label={t('support.reply')}
                value={reply}
                maxLength={2000}
                placeholder={t('support.replyPlaceholder')}
                onChange={(e) => setReply(e.target.value)}
              />
              <AttachmentField uploader={attachments} label={t('support.attachOptional')} />
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default function SupportPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useTickets({
    status: status || undefined,
    page,
    limit: LIMIT,
  });

  const tickets = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('support.title')}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{t('support.subtitle')}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          {t('support.newTicket')}
        </Button>
      </div>

      <ContactCard />

      <Card>
        <CardHeader>
          <CardTitle>{t('support.yourTickets')}</CardTitle>
          <div className="w-40">
            <Select
              value={status}
              aria-label={t('support.filterStatus')}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('support.allStatuses')}</option>
              {TICKET_STATUSES.map((s) => <option key={s} value={s}>{t(`support.statuses.${s}`)}</option>)}
            </Select>
          </div>
        </CardHeader>

        {isLoading ? (
          <PageSpinner />
        ) : isError ? (
          <ErrorState title={t('support.couldntLoad')} onRetry={() => refetch()} />
        ) : tickets.length ? (
          <div>
            {tickets.map((tk) => (
              <TicketRow key={tk.id} ticket={tk} onOpen={() => setSelectedId(tk.id)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title={t('support.noTickets')}
            subtitle={t('support.noTicketsSub')}
            action={<Button onClick={() => setCreateOpen(true)}>{t('support.newTicket')}</Button>}
          />
        )}

        <Pagination page={data?.meta?.page ?? page} totalPages={data?.meta?.totalPages ?? 1} onChange={setPage} />
      </Card>

      <NewTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => {
          setCreateOpen(false);
          setSelectedId(t.id);
        }}
      />
      <TicketModal ticketId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
