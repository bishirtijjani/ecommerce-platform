import { io, type Socket } from 'socket.io-client';
import { BASE_URL, tokenStorage } from '../api/client';

type Listener = (data: unknown) => void;

/**
 * Chat socket client - live message delivery, typing indicators, and read
 * receipts for the Messages inbox. This dashboard was REST+polling-only
 * before chat; kept intentionally scoped to chat events only rather than
 * generalized into a platform-wide event bus (the customer app's
 * services/socket.js is the reference for that broader shape, if this ever
 * needs to grow beyond chat).
 */
class ChatSocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Listener>>();

  connect() {
    if (this.socket?.connected) return;
    const token = tokenStorage.getAccess();
    if (!token) return;

    this.socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      timeout: 10_000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('chat:message:new', (data) => this.emit('chatMessageNew', data));
    this.socket.on('chat:conversation:updated', (data) => this.emit('chatConversationUpdated', data));
    this.socket.on('chat:typing:start', (data) => this.emit('chatTypingStart', data));
    this.socket.on('chat:typing:stop', (data) => this.emit('chatTypingStop', data));
    this.socket.on('chat:read', (data) => this.emit('chatRead', data));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected() {
    return !!this.socket?.connected;
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('chat:room:join', { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('chat:room:leave', { conversationId });
  }

  sendTypingStart(conversationId: string) {
    this.socket?.emit('chat:typing:start', { conversationId });
  }

  sendTypingStop(conversationId: string) {
    this.socket?.emit('chat:typing:stop', { conversationId });
  }

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('[chat socket]', event, err);
      }
    });
  }
}

export const chatSocket = new ChatSocketService();
