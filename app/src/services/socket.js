/**
 * Socket.io client - connection lifecycle and generic in-app notifications.
 *
 * The old request/merchant/rider lifecycle events (this product has no
 * delivery or rider leg - it's chat-commerce, see ContactVendorSheet) were
 * retired along with the screens that listened for them.
 */

import { io } from "socket.io-client";
import * as SecureStore from "../lib/storage";
import { SOCKET_URL, ensureFreshAccessToken } from "./api";
import Toast from "react-native-toast-message";

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    // Guards the refresh-then-reconnect path so a server that keeps rejecting
    // the token can't spin: one auth retry per connection attempt.
    this._authRetry = false;
    // AppNavigator updates this with the current route name so we can
    // suppress redundant toasts (e.g. a notification:new toast while the
    // user is already on the NotificationCenter screen).
    this._currentRouteName = null;
    // ChatThreadScreen updates this with the open conversation's id so a
    // `chat:message:new` for that thread doesn't also pop a toast on top of
    // the message appearing live in the list.
    this._openConversationId = null;
  }

  setCurrentRouteName(name) {
    this._currentRouteName = name || null;
  }

  setOpenConversationId(conversationId) {
    this._openConversationId = conversationId || null;
  }

  async connect() {
    if (this.socket?.connected) return;

    // Tear down a socket that gave up or was closed for backgrounding before
    // creating a new one, otherwise its listeners linger on the old instance.
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._authRetry = false;

    try {
      // Refresh first. The handshake carries a single JWT snapshot, so a token
      // older than 15 minutes makes the server reject every reconnect with
      // "jwt expired" and realtime stays dead until the app is restarted.
      const token =
        (await ensureFreshAccessToken().catch(() => null)) ||
        (await SecureStore.getItemAsync("accessToken"));
      if (!token) {
        console.log("[Socket] No token available, skipping connection");
        return;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.setupEventListeners();
      console.log("[Socket] Connecting...");
    } catch (error) {
      console.error("[Socket] Connection error:", error);
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("[Socket] Connected:", this.socket.id);
      this.reconnectAttempts = 0;
      this._authRetry = false;
      this.emit("connectionStateChange", true);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      this.emit("connectionStateChange", false);
    });

    this.socket.on("connect_error", async (error) => {
      console.error("[Socket] Connection error:", error.message);

      // Expired access token: rotate it, hand the fresh one to the handshake
      // and retry once. Anything else (server down, network) falls through to
      // the normal bounded reconnect counter.
      const message = String(error?.message || "");
      if (/jwt|token|auth/i.test(message) && !this._authRetry) {
        this._authRetry = true;
        try {
          const token = await ensureFreshAccessToken({ force: true });
          if (token && this.socket) {
            this.socket.auth = { token };
            this.socket.connect();
            return;
          }
        } catch (_) {
          this._authRetry = false;
        }
      }

      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.disconnect();
      }
    });

    // --- Generic notifications ---
    this.socket.on("notification:new", (data) => {
      // Suppress the toast if the user is already on the Notification Center
      // (they'll see the row prepend instead) - avoids a redundant toast +
      // list-row pair on the same event. Chat message notifications are
      // suppressed here too when their thread is open - ChatThreadScreen
      // shows the message live instead.
      const isOpenChatNotification =
        data?.data?.kind === "chat" && data?.data?.conversationId === this._openConversationId;
      if (this._currentRouteName !== "NotificationCenter" && !isOpenChatNotification) {
        Toast.show({
          type: "info",
          text1: data.title || "Notification",
          text2: data.body || "",
        });
      }
      this.emit("notificationNew", data);
    });

    // --- Chat (buyer<->vendor conversations) ---
    this.socket.on("chat:message:new", (data) => this.emit("chatMessageNew", data));
    this.socket.on("chat:conversation:updated", (data) => this.emit("chatConversationUpdated", data));
    this.socket.on("chat:typing:start", (data) => this.emit("chatTypingStart", data));
    this.socket.on("chat:typing:stop", (data) => this.emit("chatTypingStop", data));
    this.socket.on("chat:read", (data) => this.emit("chatRead", data));
  }

  // --- Chat room membership + typing (emit to server) ---

  joinConversation(conversationId) {
    if (conversationId) this.socket?.emit("chat:room:join", { conversationId });
  }

  leaveConversation(conversationId) {
    if (conversationId) this.socket?.emit("chat:room:leave", { conversationId });
  }

  sendTypingStart(conversationId) {
    if (conversationId) this.socket?.emit("chat:typing:start", { conversationId });
  }

  sendTypingStop(conversationId) {
    if (conversationId) this.socket?.emit("chat:typing:stop", { conversationId });
  }

  // --- Subscription helpers ---

  onNotificationNew(cb)           { return this.on("notificationNew", cb); }
  onChatMessageNew(cb)            { return this.on("chatMessageNew", cb); }
  onChatConversationUpdated(cb)   { return this.on("chatConversationUpdated", cb); }
  onChatTypingStart(cb)           { return this.on("chatTypingStart", cb); }
  onChatTypingStop(cb)            { return this.on("chatTypingStop", cb); }
  onChatRead(cb)                  { return this.on("chatRead", cb); }

  // Connection-quality banner. Listeners receive `true` on connect and
  // `false` on disconnect.
  onConnectionStateChange(cb) {
    return this.on("connectionStateChange", cb);
  }

  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(callback);
    return () => this.eventHandlers.get(event)?.delete(callback);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((cb) => {
        try { cb(data); } catch (err) { console.error("[Socket]", event, err); }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new SocketService();
