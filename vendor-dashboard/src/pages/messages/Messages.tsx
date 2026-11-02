import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Send, Paperclip, Phone, MessageCircle, Check, CheckCheck, Loader2, AlertCircle, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { uploadMedia } from '../../api/upload';
import {
  useConversations, useConversation, useConversationMessages, useSendChatMessage, useMarkConversationRead,
} from '../../hooks/useChat';
import { chatSocket } from '../../lib/socket';
import { ensurePush } from '../../services/push';
import { formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { ChatMessage, Conversation } from '../../types';

const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string, t: TFunction) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t('messages.today');
  if (d.toDateString() === yesterday.toDateString()) return t('messages.yesterday');
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });

function ConversationRow({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const name = `${conv.customer?.firstName ?? ''} ${conv.customer?.lastName ?? ''}`.trim() || t('messages.customer');
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-bg-muted',
        active && 'bg-brand-soft/60',
      )}
    >
      <Avatar src={conv.customer?.profilePicture} name={name} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('truncate text-sm', conv.unread ? 'font-bold text-text-primary' : 'font-medium text-text-primary')}>{name}</p>
          <span className={cn('shrink-0 text-[11px]', conv.unread ? 'font-semibold text-brand' : 'text-text-placeholder')}>
            {conv.lastMessageAt ? formatRelative(conv.lastMessageAt) : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-xs', conv.unread ? 'font-medium text-text-primary' : 'text-text-muted')}>
            {conv.lastMessageIsMine ? t('messages.youPrefix') : ''}
            {conv.lastMessageBody || t('messages.sayHelloShort')}
          </p>
          {conv.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
        </div>
        {conv.contextProductName && (
          <p className="mt-0.5 truncate text-[11px] text-text-placeholder">{t('messages.about', { product: conv.contextProductName })}</p>
        )}
      </div>
    </button>
  );
}

function ConversationList({ conversationId, onSelect }: { conversationId?: string; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: conversations, isLoading, isError, refetch } = useConversations();

  return (
    <div className={cn('flex h-full flex-col overflow-hidden rounded-lg border border-border bg-bg-surface', conversationId && 'hidden lg:flex')}>
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-lg font-bold text-text-primary">{t('messages.title')}</h1>
        <p className="text-xs text-text-muted">{t('messages.subtitle')}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8"><Spinner className="mx-auto h-5 w-5" /></div>
        ) : isError ? (
          <ErrorState title={t('messages.couldntLoad')} onRetry={() => refetch()} />
        ) : conversations && conversations.length > 0 ? (
          conversations.map((c) => (
            <ConversationRow key={c.id} conv={c} active={c.id === conversationId} onClick={() => onSelect(c.id)} />
          ))
        ) : (
          <EmptyState icon={MessageCircle} title={t('messages.emptyTitle')} subtitle={t('messages.emptySubtitle')} />
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message, isMine, showSeen, onRetry,
}: { message: ChatMessage & { status?: 'sending' | 'failed' }; isMine: boolean; showSeen: boolean; onRetry?: () => void }) {
  const { t } = useTranslation();
  const sending = message.status === 'sending';
  const failed = message.status === 'failed';
  return (
    <div className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
      {!isMine && <Avatar name={`${message.sender.firstName} ${message.sender.lastName}`} size={26} className="text-[10px]" />}
      <div className={cn('flex max-w-[75%] flex-col', isMine ? 'items-end' : 'items-start')}>
        {message.attachmentUrls?.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {message.attachmentUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} className="h-32 w-32 rounded-lg border border-border object-cover" alt={t('messages.attachment')} />
              </a>
            ))}
          </div>
        )}
        {message.body && (
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2 text-sm',
              isMine ? 'rounded-br-sm bg-brand text-text-onBrand' : 'rounded-bl-sm bg-bg-muted text-text-primary',
              sending && 'opacity-60',
            )}
          >
            {message.body}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1 text-[10px] text-text-placeholder">
          <span>{timeLabel(message.createdAt)}</span>
          {isMine && sending && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
          {isMine && !sending && !failed && (showSeen ? <CheckCheck className="h-3 w-3 text-brand" /> : <Check className="h-3 w-3" />)}
          {failed && (
            <button onClick={onRetry} className="flex items-center gap-1 font-semibold text-error-strong">
              <AlertCircle className="h-3 w-3" /> {t('messages.retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatThread({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { data: conversation } = useConversation(conversationId);
  const { data: messagesData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendChatMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);

  const [text, setText] = useState('');
  const [pending, setPending] = useState<Array<{ tempId: string; body: string; attachmentUrls: string[]; status: 'sending' | 'failed'; createdAt: string }>>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(() => (messagesData ? [...messagesData.pages].reverse().flat() : []), [messagesData]);

  // Join the room, mark read, seed the read-receipt state.
  useEffect(() => {
    chatSocket.joinConversation(conversationId);
    markRead.mutate();
    return () => chatSocket.leaveConversation(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (conversation?.otherLastReadAt) setOtherLastReadAt(conversation.otherLastReadAt);
  }, [conversation?.otherLastReadAt]);

  useEffect(() => {
    const offStart = chatSocket.on('chatTypingStart', (data) => {
      const d = data as { conversationId: string };
      if (d.conversationId === conversationId) setOtherTyping(true);
    });
    const offStop = chatSocket.on('chatTypingStop', (data) => {
      const d = data as { conversationId: string };
      if (d.conversationId === conversationId) setOtherTyping(false);
    });
    const offRead = chatSocket.on('chatRead', (data) => {
      const d = data as { conversationId: string; side: string; readAt: string };
      if (d.conversationId === conversationId && d.side === 'customer') setOtherLastReadAt(d.readAt);
    });
    const offMessage = chatSocket.on('chatMessageNew', (data) => {
      const d = data as { conversationId: string; message: ChatMessage };
      if (d.conversationId === conversationId && d.message.senderId !== conversation?.vendor.id) {
        markRead.mutate();
      }
    });
    return () => { offStart(); offStop(); offRead(); offMessage(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending.length, otherTyping]);

  const rows = useMemo(() => {
    const all = [
      ...messages.map((m) => ({ message: m, isMine: m.senderId === conversation?.vendor.id, kind: 'sent' as const })),
      ...pending.map((p) => ({ message: { ...p, id: p.tempId, senderId: conversation?.vendor.id, sender: { id: '', firstName: '', lastName: '', role: 'VENDOR', profilePicture: null } } as unknown as ChatMessage & { status: 'sending' | 'failed' }, isMine: true, kind: 'pending' as const })),
    ];
    const out: Array<{ type: 'date'; label: string; key: string } | { type: 'message'; message: ChatMessage & { status?: 'sending' | 'failed'; tempId?: string }; isMine: boolean; kind: 'sent' | 'pending'; key: string }> = [];
    let last: string | null = null;
    for (const entry of all) {
      const dk = dayKey(entry.message.createdAt);
      if (dk !== last) {
        out.push({ type: 'date', label: dayLabel(entry.message.createdAt, t), key: `date-${dk}` });
        last = dk;
      }
      out.push({ type: 'message', ...entry, key: entry.message.id });
    }
    return out;
  }, [messages, pending, conversation?.vendor.id, t]);

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].senderId === conversation?.vendor.id) return messages[i].id;
    }
    return null;
  }, [messages, conversation?.vendor.id]);

  const doSend = (body: string, attachmentUrls: string[] = []) => {
    // Sending notifies the customer - offer push (with a reason) once.
    ensurePush('chats');
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setPending((p) => [...p, { tempId, body, attachmentUrls, status: 'sending', createdAt: new Date().toISOString() }]);
    sendMessage.mutate(
      { body, attachmentUrls },
      {
        onSuccess: () => setPending((p) => p.filter((m) => m.tempId !== tempId)),
        onError: () => setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m))),
      },
    );
  };

  const retryPending = (tempId: string) => {
    const item = pending.find((m) => m.tempId === tempId);
    if (!item) return;
    setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: 'sending' } : m)));
    sendMessage.mutate(
      { body: item.body, attachmentUrls: item.attachmentUrls },
      {
        onSuccess: () => setPending((p) => p.filter((m) => m.tempId !== tempId)),
        onError: () => setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m))),
      },
    );
  };

  const handleSend = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    chatSocket.sendTypingStop(conversationId);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    doSend(body);
  };

  const handleTextChange = (val: string) => {
    setText(val);
    chatSocket.sendTypingStart(conversationId);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => chatSocket.sendTypingStop(conversationId), 2000);
  };

  const handleFiles = async (files: File[] | FileList | null) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) {
      if (files && files.length) toast.error(t('messages.imageOnly'));
      return;
    }
    setUploading(true);
    try {
      const results = await Promise.all(list.map((file) => uploadMedia(file, 'chat')));
      doSend('', results.map((r) => r.url));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const customerName = conversation
    ? `${conversation.customer?.firstName ?? ''} ${conversation.customer?.lastName ?? ''}`.trim()
    : t('messages.customer');

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted lg:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>
        {conversation ? (
          <>
            <Avatar src={conversation.customer?.profilePicture} name={customerName} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">{customerName}</p>
              <p className={cn('text-xs', otherTyping ? 'font-medium text-brand' : 'text-text-muted')}>
                {otherTyping ? t('messages.typing') : conversation.customer?.phone || ''}
              </p>
            </div>
            {conversation.customer?.phone && (
              <a
                href={`tel:${conversation.customer.phone}`}
                className="flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand-soft"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </>
        ) : (
          <div className="h-9 flex-1" />
        )}
      </div>

      {conversation?.contextProductName && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-bg-muted px-3 py-2">
          {conversation.contextProductImage ? (
            <img src={conversation.contextProductImage} className="h-8 w-8 rounded object-cover" alt="" />
          ) : (
            <Tag className="h-4 w-4 text-text-muted" />
          )}
          <p className="truncate text-xs text-text-muted">
            {t('messages.aboutLabel')} <span className="font-medium text-text-primary">{conversation.contextProductName}</span>
          </p>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center"><Spinner className="h-5 w-5" /></div>
        ) : rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-text-muted">
            <MessageCircle className="mb-2 h-6 w-6" />
            {t('messages.emptyThread', { name: customerName })}
          </div>
        ) : (
          <>
            {hasNextPage && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-xs font-semibold text-brand hover:text-brand-strong disabled:opacity-50"
                >
                  {isFetchingNextPage ? t('messages.loadingEarlier') : t('messages.loadEarlier')}
                </button>
              </div>
            )}
            {rows.map((row) =>
              row.type === 'date' ? (
                <div key={row.key} className="flex justify-center py-1">
                  <span className="rounded-full bg-bg-muted px-2.5 py-1 text-[11px] font-medium text-text-muted">{row.label}</span>
                </div>
              ) : (
                <MessageBubble
                  key={row.key}
                  message={row.message}
                  isMine={row.isMine}
                  showSeen={
                    row.kind === 'sent' &&
                    row.message.id === lastMineId &&
                    !!otherLastReadAt &&
                    new Date(otherLastReadAt) >= new Date(row.message.createdAt)
                  }
                  onRetry={row.kind === 'pending' && row.message.tempId ? () => retryPending(row.message.tempId as string) : undefined}
                />
              ),
            )}
            {otherTyping && (
              <div className="flex">
                <div className="rounded-2xl rounded-bl-sm bg-bg-muted px-3.5 py-2 text-sm text-text-muted">{t('messages.typing')}</div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border px-3 py-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            handleFiles(files);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-bg-muted disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t('messages.replyPlaceholder')}
          rows={1}
          className="max-h-28 flex-1 resize-none rounded-2xl border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-text-onBrand transition-opacity hover:bg-brand-strong disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Messages() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="grid h-[calc(100vh-8.5rem)] grid-cols-1 gap-4 lg:h-[calc(100vh-6.5rem)] lg:grid-cols-[360px_1fr]">
      <ConversationList conversationId={conversationId} onSelect={(id) => navigate(`/messages/${id}`)} />
      <div className={cn('h-full', !conversationId && 'hidden lg:block')}>
        {conversationId ? (
          <ChatThread key={conversationId} conversationId={conversationId} onBack={() => navigate('/messages')} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border text-center text-text-muted">
            <MessageCircle className="mb-2 h-8 w-8" />
            <p className="text-sm">{t('messages.selectConversation')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
