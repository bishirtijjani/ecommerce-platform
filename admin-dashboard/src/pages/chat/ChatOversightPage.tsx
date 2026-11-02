import { useState } from 'react';
import { Search, MessageCircle, Eye, Trash2, Phone, Link2, Package } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useChats, useConversationMessages, useDeleteChatMessage } from '../../hooks/useChats';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { formatDateTime, formatPhone, formatRelative } from '../../lib/format';
import type { ChatConversation, ChatMessage } from '../../types';

const customerName = (conversation: ChatConversation) =>
  conversation.customer ? `${conversation.customer.firstName} ${conversation.customer.lastName}` : 'Unknown customer';

const vendorName = (conversation: ChatConversation) => conversation.vendor?.name ?? 'Unknown vendor';

const ParticipantCell = ({ conversation }: { conversation: ChatConversation }) => (
  <div className="flex items-center gap-3">
    <Avatar src={conversation.customer?.profilePicture} name={customerName(conversation)} size={36} />
    <div>
      <p className="text-sm font-medium text-text-primary">{customerName(conversation)}</p>
      <p className="text-xs text-text-muted">{vendorName(conversation)}</p>
    </div>
  </div>
);

const ContextProductCell = ({ conversation }: { conversation: ChatConversation }) => (
  <div className="flex items-center gap-2">
    {conversation.contextProductImage ? (
      <img
        src={conversation.contextProductImage}
        alt=""
        className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
      />
    ) : (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted text-text-muted">
        <Package className="h-4 w-4" />
      </div>
    )}
    <span className="max-w-[180px] truncate text-sm text-text-primary">{conversation.contextProductName || '-'}</span>
  </div>
);

const ChatRow = ({ conversation, onView }: { conversation: ChatConversation; onView: (c: ChatConversation) => void }) => (
  <tr
    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-bg-muted/40"
    onClick={() => onView(conversation)}
  >
    <td className="px-4 py-3">
      <ParticipantCell conversation={conversation} />
    </td>
    <td className="px-4 py-3">
      <ContextProductCell conversation={conversation} />
    </td>
    <td className="px-4 py-3">
      <div className="max-w-[240px]">
        <p className="truncate text-sm text-text-primary">{conversation.lastMessageBody || '-'}</p>
        <p className="text-xs text-text-muted">{formatRelative(conversation.lastMessageAt)}</p>
      </div>
    </td>
    <td className="px-4 py-3">
      <Badge>{conversation.messageCount}</Badge>
    </td>
    <td className="px-4 py-3 text-right">
      <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => onView(conversation)}>
        View
      </Button>
    </td>
  </tr>
);

const ChatCard = ({ conversation, onView }: { conversation: ChatConversation; onView: (c: ChatConversation) => void }) => (
  <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between gap-3">
      <ParticipantCell conversation={conversation} />
      <Button
        variant="ghost"
        size="icon"
        aria-label={`View thread with ${conversation.customer?.firstName || 'customer'}`}
        onClick={() => onView(conversation)}
      >
        <Eye className="h-4 w-4" />
      </Button>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className="max-w-[60%] truncate text-xs text-text-muted">{conversation.contextProductName || 'No context product'}</span>
      <Badge>{conversation.messageCount}</Badge>
    </div>
    <div className="mt-2">
      <p className="truncate text-sm text-text-primary">{conversation.lastMessageBody || '-'}</p>
      <p className="text-xs text-text-muted">{formatRelative(conversation.lastMessageAt)}</p>
    </div>
  </div>
);

const MessageBubble = ({
  message,
  conversation,
  onDelete,
}: {
  message: ChatMessage;
  conversation: ChatConversation;
  onDelete: (message: ChatMessage) => void;
}) => {
  const isCustomer = !!conversation.customer && message.senderId === conversation.customer.id;
  const label = isCustomer ? 'Customer' : conversation.vendor ? 'Vendor' : 'Participant';
  return (
    <div
      className={
        isCustomer
          ? 'rounded-lg border border-border bg-bg-muted p-4'
          : 'rounded-lg border border-brand/30 bg-brand-soft p-4'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={isCustomer ? 'brand' : 'neutral'}>{label}</Badge>
          <span className="text-xs text-text-muted">{formatDateTime(message.createdAt)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          title="Delete message"
          aria-label="Delete message"
          onClick={() => onDelete(message)}
        >
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{message.body}</p>
      {message.attachmentUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.attachmentUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-surface px-2.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-muted"
            >
              <Link2 className="h-3.5 w-3.5 text-brand" />
              Attachment
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const ThreadModal = ({ conversation, onClose }: { conversation: ChatConversation | null; onClose: () => void }) => {
  const { data: messages, isLoading, error } = useConversationMessages(conversation?.id ?? '');
  const deleteMessage = useDeleteChatMessage();
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

  const confirmDelete = () => {
    if (!deleteTarget || !conversation) return;
    deleteMessage.mutate(
      { conversationId: conversation.id, messageId: deleteTarget.id },
      { onSettled: () => setDeleteTarget(null) },
    );
  };

  return (
    <>
      <Modal
        open={!!conversation}
        onClose={onClose}
        size="xl"
        title={conversation ? `Thread, ${customerName(conversation)} × ${vendorName(conversation)}` : ''}
      >
        {conversation && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-bg-muted p-4">
              <div className="flex items-center gap-3">
                <Avatar src={conversation.customer?.profilePicture} name={customerName(conversation)} size={40} />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{customerName(conversation)}</p>
                  <p className="flex items-center gap-1 text-xs text-text-muted">
                    <Phone className="h-3 w-3" />
                    {formatPhone(conversation.customer?.phone)}
                  </p>
                </div>
              </div>
              <span className="text-lg text-text-muted" aria-hidden="true">
                ×
              </span>
              <div className="flex items-center gap-3">
                <Avatar src={conversation.vendor?.logoUrl} name={vendorName(conversation)} size={40} />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{vendorName(conversation)}</p>
                  <p className="flex items-center gap-1 text-xs text-text-muted">
                    <Phone className="h-3 w-3" />
                    {formatPhone(conversation.vendor?.phone)}
                  </p>
                </div>
              </div>
              {conversation.contextProductName && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2">
                  {conversation.contextProductImage && (
                    <img src={conversation.contextProductImage} alt="" className="h-8 w-8 rounded object-cover" />
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-text-muted">Context product</p>
                    <p className="text-xs font-medium text-text-primary">{conversation.contextProductName}</p>
                  </div>
                </div>
              )}
            </div>

            {isLoading ? (
              <InlineSpinner />
            ) : error ? (
              <ErrorState
                title="Couldn't load messages"
                subtitle={error.message}
                onRetry={() => window.location.reload()}
              />
            ) : !messages?.length ? (
              <EmptyState icon={MessageCircle} title="No messages" subtitle="This thread has no messages yet." />
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    conversation={conversation}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete message"
        description="This permanently removes the message from the conversation."
        danger
        loading={deleteMessage.isPending}
        disabled={!deleteTarget}
      />
    </>
  );
};

export default function ChatOversightPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const limit = 20;

  const { data, isLoading, error } = useChats({
    page,
    limit,
    search: debouncedSearch || undefined,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Chat oversight</h1>
        <p className="text-sm text-text-muted">Monitor and moderate customer–vendor conversations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:max-w-md">
            <Input
              placeholder="Search conversations..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={MessageCircle} title="No chats found" subtitle="Try adjusting your filters or search query." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Participants</th>
                    <th className="px-4 py-3">Context product</th>
                    <th className="px-4 py-3">Last message</th>
                    <th className="px-4 py-3">Messages</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((conversation) => (
                    <ChatRow key={conversation.id} conversation={conversation} onView={setSelected} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((conversation) => (
              <ChatCard key={conversation.id} conversation={conversation} onView={setSelected} />
            ))}
          </div>
          {data.meta && data.meta.totalPages > 1 && (
            <div className="md:hidden">
              <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}

      <ThreadModal conversation={selected} onClose={() => setSelected(null)} />
    </div>
  );
}