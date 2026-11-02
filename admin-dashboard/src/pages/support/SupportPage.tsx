import { useEffect, useState } from 'react';
import { LifeBuoy, Scale, MessageSquare, Send, Eye, UserPlus, CheckCircle2 } from 'lucide-react';
import {
  useTickets,
  useTicket,
  useUpdateTicketStatus,
  useAssignTicket,
  usePostTicketMessage,
  useDisputes,
  useDispute,
  useResolveDispute,
  usePostDisputeMessage,
} from '../../hooks/useSupport';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner, PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { formatDateTime, formatNaira, formatRelative, initials } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';
import { ensurePush } from '../../services/push';
import type { SupportTicket, Dispute } from '../../types';

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

interface SupportMessage {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  fromUser: { id: string; firstName: string; lastName: string; role: string } | null;
}

const TICKET_STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: 'brand',
  IN_PROGRESS: 'warning',
  PENDING_USER: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  PENDING_USER: 'Pending user',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const PRIORITY_TONE: Record<string, BadgeTone> = {
  URGENT: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

const DISPUTE_STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: 'error',
  UNDER_REVIEW: 'warning',
  AWAITING_RESPONSE: 'info',
  RESOLVED: 'success',
  REJECTED: 'neutral',
};

const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  AWAITING_RESPONSE: 'Awaiting response',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

const TICKET_STATUSES: { value: SupportTicket['status'] | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PENDING_USER', label: 'Pending user' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITIES: { value: SupportTicket['priority'] | ''; label: string }[] = [
  { value: '', label: 'All priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const TICKET_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All categories' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'ORDER', label: 'Order' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'OTHER', label: 'Other' },
];

const DISPUTE_STATUSES: { value: Dispute['status'] | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'AWAITING_RESPONSE', label: 'Awaiting response' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const DISPUTE_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All categories' },
  { value: 'ITEM_NOT_RECEIVED', label: 'Item not received' },
  { value: 'ITEM_DAMAGED', label: 'Item damaged' },
  { value: 'WRONG_ITEM', label: 'Wrong item' },
  { value: 'PARTIAL_DELIVERY', label: 'Partial delivery' },
  { value: 'VENDOR_BEHAVIOR', label: 'Vendor behavior' },
  { value: 'PAYMENT_ISSUE', label: 'Payment issue' },
  { value: 'OTHER', label: 'Other' },
];

const RESOLUTIONS: { value: string; label: string }[] = [
  { value: 'FULL_REFUND', label: 'Full refund' },
  { value: 'PARTIAL_REFUND', label: 'Partial refund' },
];

const categoryLabel = (categories: { value: string; label: string }[], value: string) =>
  categories.find((c) => c.value === value)?.label ?? value;

export const TicketStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={TICKET_STATUS_TONE[status] || 'neutral'}>{TICKET_STATUS_LABEL[status] || status}</Badge>
);

export const TicketPriorityBadge = ({ priority }: { priority: string }) => (
  <Badge tone={PRIORITY_TONE[priority] || 'neutral'}>{priority}</Badge>
);

export const DisputeStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={DISPUTE_STATUS_TONE[status] || 'neutral'}>{DISPUTE_STATUS_LABEL[status] || status}</Badge>
);

export const MessageList = ({ messages }: { messages: SupportMessage[] }) => (
  <div className="space-y-5">
    {messages.length === 0 ? (
      <p className="text-sm text-text-muted">No messages yet.</p>
    ) : (
      messages.map((message) => {
        const from = message.fromUser;
        return (
          <div key={message.id} className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
              {initials(from?.firstName, from?.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-text-primary">
                  {from ? `${from.firstName} ${from.lastName}` : 'System'}
                </span>
                {from?.role && <span className="text-xs text-text-muted">{from.role}</span>}
                <span className="text-xs text-text-muted">{formatDateTime(message.createdAt)}</span>
                {message.isInternal && <Badge tone="warning">internal</Badge>}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{message.body}</p>
            </div>
          </div>
        );
      })
    )}
  </div>
);

const Composer = ({
  label,
  value,
  onChange,
  onSend,
  sending,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
}) => (
  <div className="space-y-2">
    <Textarea
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write a reply..."
      disabled={disabled}
    />
    <div className="flex justify-end">
      <Button onClick={onSend} disabled={disabled || !value.trim()} loading={sending} icon={<Send className="h-4 w-4" />}>
        Send reply
      </Button>
    </div>
  </div>
);

const TicketRow = ({ ticket, onView }: { ticket: SupportTicket; onView: (ticket: SupportTicket) => void }) => (
  <tr className="cursor-pointer border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors" onClick={() => onView(ticket)}>
    <td className="px-4 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">#{ticket.number}</p>
        <p className="text-xs text-text-muted">{ticket.subject}</p>
      </div>
    </td>
    <td className="px-4 py-3">
      <div>
        <p className="text-sm text-text-primary">{ticket.user ? `${ticket.user.firstName} ${ticket.user.lastName}` : '-'}</p>
        <p className="text-xs text-text-muted">{ticket.user?.email}</p>
      </div>
    </td>
    <td className="px-4 py-3"><Badge tone="neutral">{categoryLabel(TICKET_CATEGORIES, ticket.category)}</Badge></td>
    <td className="px-4 py-3"><TicketPriorityBadge priority={ticket.priority} /></td>
    <td className="px-4 py-3"><TicketStatusBadge status={ticket.status} /></td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatRelative(ticket.lastActivityAt)}</td>
    <td className="px-4 py-3 text-right">
      <Button variant="ghost" size="sm" onClick={() => onView(ticket)} icon={<Eye className="h-4 w-4" />}>View</Button>
    </td>
  </tr>
);

const TicketCard = ({ ticket, onView }: { ticket: SupportTicket; onView: (ticket: SupportTicket) => void }) => (
  <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">#{ticket.number}</p>
        <p className="truncate text-xs text-text-muted">{ticket.subject}</p>
      </div>
      <TicketStatusBadge status={ticket.status} />
    </div>
    <div className="mt-3 space-y-1 text-sm">
      <p><span className="text-text-muted">Requester:</span> {ticket.user ? `${ticket.user.firstName} ${ticket.user.lastName}` : '-'}</p>
      <p><span className="text-text-muted">Category:</span> <Badge tone="neutral">{categoryLabel(TICKET_CATEGORIES, ticket.category)}</Badge></p>
      <p><span className="text-text-muted">Priority:</span> <TicketPriorityBadge priority={ticket.priority} /></p>
      <p className="text-xs text-text-muted">{formatRelative(ticket.lastActivityAt)}</p>
    </div>
    <div className="mt-3 flex justify-end">
      <Button variant="outline" size="sm" onClick={() => onView(ticket)} icon={<Eye className="h-4 w-4" />}>View</Button>
    </div>
  </div>
);

export const TicketsTab = () => {
  const [status, setStatus] = useState<SupportTicket['status'] | ''>('');
  const [priority, setPriority] = useState<SupportTicket['priority'] | ''>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useTickets({
    page,
    limit,
    status: status || undefined,
    priority: priority || undefined,
    category: category || undefined,
  });

  const [selectedId, setSelectedId] = useState('');
  const [statusValue, setStatusValue] = useState<SupportTicket['status']>('OPEN');
  const [messageBody, setMessageBody] = useState('');

  const details = useTicket(selectedId);
  const updateStatus = useUpdateTicketStatus();
  const assign = useAssignTicket();
  const postMessage = usePostTicketMessage();
  const currentUser = useAuthStore((s) => s.user);

  const ticket = details.data;

  useEffect(() => {
    if (ticket?.status) setStatusValue(ticket.status);
  }, [ticket?.status]);

  useEffect(() => {
    setMessageBody('');
  }, [selectedId]);

  const openDetail = (t: SupportTicket) => setSelectedId(t.id);
  const closeDetail = () => setSelectedId('');

  const handleStatusChange = (value: SupportTicket['status']) => {
    setStatusValue(value);
    if (ticket) updateStatus.mutate({ id: ticket.id, status: value });
  };

  const handleAssign = () => {
    if (ticket && currentUser?.id) assign.mutate({ id: ticket.id, assignedToId: currentUser.id });
  };

  const handleSend = () => {
    if (!ticket || !messageBody.trim()) return;
    // Replying notifies the customer/vendor - offer push (with a reason) once.
    ensurePush('support');
    postMessage.mutate({ id: ticket.id, body: messageBody.trim() }, { onSuccess: () => setMessageBody('') });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as SupportTicket['status'] | ''); setPage(1); }} label="Status">
              {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select value={priority} onChange={(e) => { setPriority(e.target.value as SupportTicket['priority'] | ''); setPage(1); }} label="Priority">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
            <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} label="Category">
              {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={LifeBuoy} title="No tickets found" subtitle="Try adjusting your filters." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((t) => <TicketRow key={t.id} ticket={t} onView={openDetail} />)}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((t) => <TicketCard key={t.id} ticket={t} onView={openDetail} />)}
          </div>
          {data.meta && data.meta.totalPages > 1 && (
            <div className="md:hidden">
              <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}

      <Modal
        open={!!selectedId}
        onClose={closeDetail}
        title={ticket ? `Ticket #${ticket.number}` : 'Ticket'}
        size="xl"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Select
              label="Set status"
              value={statusValue}
              onChange={(e) => handleStatusChange(e.target.value as SupportTicket['status'])}
              disabled={updateStatus.isPending}
              className="sm:max-w-xs"
            >
              {TICKET_STATUSES.filter((s) => s.value !== '').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={handleAssign}
                loading={assign.isPending}
                disabled={!!ticket?.assignedToId && ticket.assignedToId === currentUser?.id}
                icon={<UserPlus className="h-4 w-4" />}
              >
                Assign to me
              </Button>
              <Button variant="outline" onClick={closeDetail}>Back</Button>
            </div>
          </div>
        }
      >
        {details.isLoading ? (
          <PageSpinner />
        ) : details.isError ? (
          <ErrorState onRetry={() => details.refetch()} />
        ) : !ticket ? null : (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-text-primary">{ticket.subject}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
                <Badge tone="neutral">{categoryLabel(TICKET_CATEGORIES, ticket.category)}</Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Requester</p>
                <p className="text-sm font-medium text-text-primary">{ticket.user ? `${ticket.user.firstName} ${ticket.user.lastName}` : '-'}</p>
                <p className="text-sm text-text-muted">{ticket.user?.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Assigned to</p>
                <p className="text-sm font-medium text-text-primary">{ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Created</p>
                <p className="text-sm text-text-primary">{formatDateTime(ticket.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Last activity</p>
                <p className="text-sm text-text-primary">{formatRelative(ticket.lastActivityAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{ticket.description}</p>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-text-muted" />
                <p className="text-sm font-semibold text-text-primary">Messages</p>
              </div>
              <div className="mt-4">
                <MessageList messages={ticket.messages || []} />
              </div>
            </div>

            <Composer
              label={ticket.status === 'CLOSED' ? 'Replies disabled' : 'Reply'}
              value={messageBody}
              onChange={setMessageBody}
              onSend={handleSend}
              sending={postMessage.isPending}
              disabled={ticket.status === 'CLOSED'}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

const DisputeRow = ({ dispute, onView }: { dispute: Dispute; onView: (dispute: Dispute) => void }) => (
  <tr className="cursor-pointer border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors" onClick={() => onView(dispute)}>
    <td className="px-4 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">#{dispute.number}</p>
        <p className="text-xs text-text-muted">{dispute.reason}</p>
      </div>
    </td>
    <td className="px-4 py-3 text-sm font-medium text-text-primary">#{dispute.orderId.slice(-8).toUpperCase()}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{dispute.order?.vendor?.name ?? '-'}</td>
    <td className="px-4 py-3 text-sm text-text-primary">{dispute.raisedBy ? `${dispute.raisedBy.firstName} ${dispute.raisedBy.lastName}` : '-'}</td>
    <td className="px-4 py-3"><DisputeStatusBadge status={dispute.status} /></td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatRelative(dispute.lastActivityAt)}</td>
    <td className="px-4 py-3 text-right">
      <Button variant="ghost" size="sm" onClick={() => onView(dispute)} icon={<Eye className="h-4 w-4" />}>View</Button>
    </td>
  </tr>
);

const DisputeCard = ({ dispute, onView }: { dispute: Dispute; onView: (dispute: Dispute) => void }) => (
  <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">#{dispute.number}</p>
        <p className="truncate text-xs text-text-muted">{dispute.reason}</p>
      </div>
      <DisputeStatusBadge status={dispute.status} />
    </div>
    <div className="mt-3 space-y-1 text-sm">
      <p><span className="text-text-muted">Order:</span> #{dispute.orderId.slice(-8).toUpperCase()}</p>
      <p><span className="text-text-muted">Vendor:</span> {dispute.order?.vendor?.name ?? '-'}</p>
      <p><span className="text-text-muted">Raised by:</span> {dispute.raisedBy ? `${dispute.raisedBy.firstName} ${dispute.raisedBy.lastName}` : '-'}</p>
      <p className="text-xs text-text-muted">{formatRelative(dispute.lastActivityAt)}</p>
    </div>
    <div className="mt-3 flex justify-end">
      <Button variant="outline" size="sm" onClick={() => onView(dispute)} icon={<Eye className="h-4 w-4" />}>View</Button>
    </div>
  </div>
);

export const DisputesTab = () => {
  const [status, setStatus] = useState<Dispute['status'] | ''>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useDisputes({
    page,
    limit,
    status: status || undefined,
    category: category || undefined,
  });

  const [selectedId, setSelectedId] = useState('');
  const [resolutionType, setResolutionType] = useState('FULL_REFUND');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [messageBody, setMessageBody] = useState('');

  const details = useDispute(selectedId);
  const resolve = useResolveDispute();
  const postMessage = usePostDisputeMessage();

  const dispute = details.data;
  const canResolve = !!dispute && dispute.status !== 'RESOLVED' && dispute.status !== 'REJECTED';

  useEffect(() => {
    setMessageBody('');
    setResolutionNotes('');
    setResolutionType('FULL_REFUND');
  }, [selectedId]);

  const openDetail = (d: Dispute) => setSelectedId(d.id);
  const closeDetail = () => setSelectedId('');

  const handleResolve = () => {
    if (!dispute) return;
    resolve.mutate({
      id: dispute.id,
      resolution: resolutionType,
      resolutionNotes: resolutionNotes.trim() || undefined,
    });
  };

  const handleSend = () => {
    if (!dispute || !messageBody.trim()) return;
    // Replying notifies the parties - offer push (with a reason) once.
    ensurePush('support');
    postMessage.mutate({ id: dispute.id, body: messageBody.trim() }, { onSuccess: () => setMessageBody('') });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as Dispute['status'] | ''); setPage(1); }} label="Status">
              {DISPUTE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} label="Category">
              {DISPUTE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={Scale} title="No disputes found" subtitle="Try adjusting your filters." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Dispute</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Raised by</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((d) => <DisputeRow key={d.id} dispute={d} onView={openDetail} />)}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((d) => <DisputeCard key={d.id} dispute={d} onView={openDetail} />)}
          </div>
          {data.meta && data.meta.totalPages > 1 && (
            <div className="md:hidden">
              <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}

      <Modal
        open={!!selectedId}
        onClose={closeDetail}
        title={dispute ? `Dispute #${dispute.number}` : 'Dispute'}
        size="xl"
        footer={
          <Button variant="outline" onClick={closeDetail}>Back</Button>
        }
      >
        {details.isLoading ? (
          <PageSpinner />
        ) : details.isError ? (
          <ErrorState onRetry={() => details.refetch()} />
        ) : !dispute ? null : (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-text-primary">{dispute.reason}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DisputeStatusBadge status={dispute.status} />
                <Badge tone="neutral">{categoryLabel(DISPUTE_CATEGORIES, dispute.category)}</Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Order</p>
                <p className="text-sm font-medium text-text-primary">#{dispute.orderId.slice(-8).toUpperCase()}</p>
                {dispute.order && (
                  <>
                    <p className="text-sm text-text-primary">{formatNaira(dispute.order.total)}</p>
                    <p className="text-sm text-text-muted">{dispute.order.vendor?.name}</p>
                  </>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Raised by</p>
                <p className="text-sm font-medium text-text-primary">{dispute.raisedBy ? `${dispute.raisedBy.firstName} ${dispute.raisedBy.lastName}` : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Created</p>
                <p className="text-sm text-text-primary">{formatDateTime(dispute.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Last activity</p>
                <p className="text-sm text-text-primary">{formatRelative(dispute.lastActivityAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{dispute.description}</p>
            </div>

            {canResolve ? (
              <div className="space-y-4 rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-text-primary">Resolve dispute</p>
                <Select label="Resolution" value={resolutionType} onChange={(e) => setResolutionType(e.target.value)}>
                  {RESOLUTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
                <Textarea label="Resolution notes (optional)" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Add notes about this resolution..." />
                <Button onClick={handleResolve} loading={resolve.isPending} icon={<CheckCircle2 className="h-4 w-4" />}>
                  Resolve dispute
                </Button>
              </div>
            ) : dispute.resolution ? (
              <div className="space-y-1 rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-text-primary">Resolution</p>
                <p className="text-sm text-text-primary">{dispute.resolution.replace(/_/g, ' ')}</p>
                {dispute.resolutionNotes && <p className="text-sm text-text-muted">{dispute.resolutionNotes}</p>}
              </div>
            ) : null}

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-text-muted" />
                <p className="text-sm font-semibold text-text-primary">Messages</p>
              </div>
              <div className="mt-4">
                <MessageList messages={dispute.messages || []} />
              </div>
            </div>

            <Composer
              label="Public reply"
              value={messageBody}
              onChange={setMessageBody}
              onSend={handleSend}
              sending={postMessage.isPending}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default function SupportPage() {
  const [tab, setTab] = useState('tickets');
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Support</h1>
        <p className="text-sm text-text-muted">Manage support tickets and customer disputes.</p>
      </div>
      <Tabs
        items={[{ key: 'tickets', label: 'Tickets' }, { key: 'disputes', label: 'Disputes' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'tickets' ? <TicketsTab /> : <DisputesTab />}
    </div>
  );
}