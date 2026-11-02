/**
 * ChatThreadScreen - a single buyer<->vendor conversation.
 *
 * Reached from ChatsScreen (tap a row) or ContactVendorSheet ("Chat with
 * vendor" starts/reopens the thread then navigates straight here). Live
 * message delivery + typing indicator + read receipts all ride the
 * `chat:*` socket events registered in services/socket.js; REST is the
 * source of truth for history/pagination.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { goBackOr } from "../../lib/goBack";
import { chooseImageSource } from "../../lib/chooseImageSource";
import { useTheme } from "../../theme";
import socketService from "../../services/socket";
import { ensurePushPermission } from "../../services/pushPermission";
import { pickImage, uploadAttachment } from "../support/supportUploads";
import {
  fetchConversationDetail,
  fetchMessages,
  sendMessage,
  markConversationRead,
  setActiveConversationId,
  clearActiveConversation,
} from "../../store/slices/chatSlice";

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
};

const timeLabel = (iso) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

const initial = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

function TypingBubble({ tokens }) {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8 }}>
      <View
        style={{
          backgroundColor: tokens.bg.surfaceMuted,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: tokens.text.muted, fontSize: 13 }}>typing…</Text>
      </View>
    </View>
  );
}

function MessageRow({ item, tokens, vendorName, showSeen }) {
  if (item.type === "date") {
    return (
      <View style={{ alignItems: "center", marginVertical: 14 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: tokens.text.muted,
            backgroundColor: tokens.bg.surfaceMuted,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
          }}
        >
          {item.label}
        </Text>
      </View>
    );
  }

  const message = item.message;
  const isMine = item.isMine;
  const failed = message.status === "failed";
  const sending = message.status === "sending";

  return (
    <View
      style={{
        flexDirection: isMine ? "row-reverse" : "row",
        alignItems: "flex-end",
        paddingHorizontal: 16,
        marginBottom: 10,
      }}
    >
      {!isMine && (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: tokens.brand.soft,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "800", color: tokens.brand.default }}>{initial(vendorName)}</Text>
        </View>
      )}
      <View style={{ maxWidth: "76%", alignItems: isMine ? "flex-end" : "flex-start" }}>
        {Array.isArray(message.attachmentUrls) && message.attachmentUrls.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: message.body ? 6 : 0 }}>
            {message.attachmentUrls.map((url, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(url).catch(() => {})}
                accessibilityRole="imagebutton"
                accessibilityLabel="View attachment"
              >
                <Image source={{ uri: url }} style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: tokens.bg.surfaceMuted }} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!!message.body && (
          <View
            style={{
              backgroundColor: isMine ? tokens.brand.default : tokens.bg.surfaceMuted,
              borderRadius: 16,
              borderBottomRightRadius: isMine ? 4 : 16,
              borderBottomLeftRadius: isMine ? 16 : 4,
              paddingHorizontal: 13,
              paddingVertical: 9,
              opacity: sending ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 14.5, lineHeight: 20, color: isMine ? tokens.text.onBrand : tokens.text.primary }}>
              {message.body}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
          <Text style={{ fontSize: 10, color: tokens.text.muted }}>{timeLabel(message.createdAt)}</Text>
          {isMine && !failed && !sending && (
            <Ionicons
              name={showSeen ? "checkmark-done" : "checkmark"}
              size={13}
              color={showSeen ? tokens.brand.default : tokens.text.muted}
              style={{ marginLeft: 4 }}
            />
          )}
          {sending && <ActivityIndicator size={9} color={tokens.text.muted} style={{ marginLeft: 4 }} />}
          {failed && (
            <TouchableOpacity onPress={item.onRetry} style={{ flexDirection: "row", alignItems: "center", marginLeft: 6 }}>
              <Ionicons name="alert-circle" size={13} color={tokens.status.errorStrong} />
              <Text style={{ fontSize: 10, color: tokens.status.errorStrong, marginLeft: 3, fontWeight: "700" }}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ChatThreadScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { tokens, isDark } = useTheme();
  const { conversationId, vendor: vendorParam } = route.params || {};

  const currentUserId = useSelector((s) => s.auth.user?.id);
  const {
    activeConversation,
    activeMessages,
    activeLoading,
    loadingMoreMessages,
    hasMoreMessages,
    sending,
  } = useSelector((s) => s.chat);

  const [text, setText] = useState("");
  const [pending, setPending] = useState([]); // optimistic local sends
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState(null);
  const [attaching, setAttaching] = useState(false);
  const listRef = useRef(null);
  const typingStopTimer = useRef(null);

  const vendor = activeConversation?.vendor || vendorParam || null;

  // --- Lifecycle: join room, load history, mark read ---
  useEffect(() => {
    if (!conversationId) return undefined;
    dispatch(setActiveConversationId(conversationId));
    dispatch(fetchConversationDetail(conversationId));
    dispatch(fetchMessages({ conversationId }));
    dispatch(markConversationRead(conversationId));
    socketService.joinConversation(conversationId);
    socketService.setOpenConversationId(conversationId);

    return () => {
      socketService.leaveConversation(conversationId);
      socketService.setOpenConversationId(null);
      dispatch(clearActiveConversation());
    };
  }, [conversationId, dispatch]);

  // Re-mark read whenever the screen regains focus (e.g. backgrounded app
  // brought back to this exact thread) and seed the read-receipt state from
  // the fetched conversation.
  useFocusEffect(
    useCallback(() => {
      if (conversationId) dispatch(markConversationRead(conversationId));
    }, [conversationId, dispatch]),
  );

  useEffect(() => {
    if (activeConversation?.otherLastReadAt) setOtherLastReadAt(activeConversation.otherLastReadAt);
  }, [activeConversation?.otherLastReadAt]);

  // --- Socket: typing + read receipts, scoped to this conversation ---
  useEffect(() => {
    if (!conversationId) return undefined;
    const unsubs = [
      socketService.onChatTypingStart((data) => {
        if (data?.conversationId === conversationId) setOtherTyping(true);
      }),
      socketService.onChatTypingStop((data) => {
        if (data?.conversationId === conversationId) setOtherTyping(false);
      }),
      socketService.onChatRead((data) => {
        if (data?.conversationId === conversationId && data.side === "vendor") {
          setOtherLastReadAt(data.readAt);
        }
      }),
      // A message arriving live also means we've "seen" it - mark read again
      // so the badge/list state upstream stays accurate while the thread is open.
      socketService.onChatMessageNew((data) => {
        if (data?.conversationId === conversationId && data.message?.senderId !== currentUserId) {
          dispatch(markConversationRead(conversationId));
        }
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [conversationId, currentUserId, dispatch]);

  // --- Auto-scroll to bottom on new content ---
  useEffect(() => {
    if (activeMessages?.length === 0 && pending?.length === 0) return;
    const id = setTimeout(() => {
      try { listRef.current?.scrollToEnd({ animated: true }); } catch (_) {}
    }, 80);
    return () => clearTimeout(id);
  }, [activeMessages?.length, pending?.length, otherTyping]);

  // --- Build the flat render list: date separators + messages + pending ---
  const rows = useMemo(() => {
    const all = [
      ...activeMessages.map((m) => ({ message: m, isMine: m.senderId === currentUserId, kind: "sent" })),
      ...pending.map((p) => ({ message: { ...p, id: p.tempId }, isMine: true, kind: "pending" })),
    ];
    const out = [];
    let lastDay = null;
    for (const entry of all) {
      const day = new Date(entry.message.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ type: "date", label: dayLabel(entry.message.createdAt), key: `date-${day}` });
        lastDay = day;
      }
      out.push({ type: "message", ...entry, key: entry.message.id });
    }
    return out;
  }, [activeMessages, pending, currentUserId]);

  // Last message that's mine, among real (non-pending) sent messages -
  // that's the only one a "seen" tick can meaningfully attach to.
  const lastMineId = useMemo(() => {
    for (let i = activeMessages?.length - 1; i >= 0; i -= 1) {
      if (activeMessages[i].senderId === currentUserId) return activeMessages[i].id;
    }
    return null;
  }, [activeMessages, currentUserId]);

  const handleTextChange = (val) => {
    setText(val);
    socketService.sendTypingStart(conversationId);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      socketService.sendTypingStop(conversationId);
    }, 2000);
  };

  const doSend = (body, attachmentUrls = []) => {
    // Sending a message notifies the other party - offer push if not yet asked.
    ensurePushPermission("chats");
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setPending((p) => [...p, { tempId, body, attachmentUrls, status: "sending", createdAt: new Date().toISOString() }]);
    dispatch(sendMessage({ conversationId, body, attachmentUrls }))
      .unwrap()
      .then(() => setPending((p) => p.filter((m) => m.tempId !== tempId)))
      .catch(() => setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m))));
  };

  const handleSend = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    socketService.sendTypingStop(conversationId);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    doSend(body, []);
  };

  const retryPending = (tempId) => {
    const item = pending.find((m) => m.tempId === tempId);
    if (!item) return;
    setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: "sending" } : m)));
    dispatch(sendMessage({ conversationId, body: item.body, attachmentUrls: item.attachmentUrls }))
      .unwrap()
      .then(() => setPending((p) => p.filter((m) => m.tempId !== tempId)))
      .catch(() => setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m))));
  };

  const attachFrom = (source) => async () => {
    if (attaching) return;
    const uri = await pickImage(source);
    if (!uri) return;
    setAttaching(true);
    try {
      const url = await uploadAttachment(uri, "chat");
      doSend("", [url]);
    } catch (err) {
      Toast.show({ type: "error", text1: "Couldn't send photo", text2: "Please try again." });
    } finally {
      setAttaching(false);
    }
  };

  const handleAttach = () => {
    if (attaching) return;
    chooseImageSource(attachFrom("camera"), attachFrom("gallery"), { title: "Attach a photo" });
  };

  const loadOlder = () => {
    if (loadingMoreMessages || !hasMoreMessages || activeMessages?.length === 0) return;
    dispatch(fetchMessages({ conversationId, before: activeMessages[0].createdAt }));
  };

  if (!conversationId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: tokens.text.muted }}>Conversation not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default,
          backgroundColor: tokens.bg.surface,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation, { name: "MainTabs", params: { screen: "ChatsTab" } })}
          style={{ padding: 6, marginRight: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          activeOpacity={0.7}
          onPress={() => vendor?.id && navigation.navigate("MainTabs", { screen: "HomeTab", params: { screen: "VendorStorefront", params: { vendorId: vendor.id, vendorName: vendor.name } } })}
          accessibilityRole="button"
          accessibilityLabel={`View ${vendor?.name || "vendor"}'s shop`}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: tokens.brand.soft,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
              overflow: "hidden",
            }}
          >
            {vendor?.logoUrl ? (
              <Image source={{ uri: vendor.logoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.brand.default }}>{initial(vendor?.name)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }} numberOfLines={1}>
              {vendor?.name || "Vendor"}
            </Text>
            <Text style={{ fontSize: 11, color: otherTyping ? tokens.brand.default : tokens.text.muted, fontWeight: otherTyping ? "700" : "400" }}>
              {otherTyping ? "typing…" : vendor?.isOpen ? "Shop is open" : "Shop is closed"}
            </Text>
          </View>
        </TouchableOpacity>
        {vendor?.phone ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${vendor.phone}`).catch(() => {})}
            style={{ padding: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Call ${vendor?.name}`}
          >
            <Ionicons name="call-outline" size={20} color={tokens.brand.default} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Product context chip */}
      {activeConversation?.contextProductName ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            activeConversation.contextProductId &&
            navigation.navigate("MainTabs", { screen: "HomeTab", params: { screen: "ProductDetail", params: { productId: activeConversation.contextProductId } } })
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 12,
            marginTop: 8,
            padding: 8,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
          }}
        >
          {activeConversation.contextProductImage ? (
            <Image
              source={{ uri: activeConversation.contextProductImage }}
              style={{ width: 32, height: 32, borderRadius: 8, marginRight: 8 }}
            />
          ) : (
            <Ionicons name="pricetag-outline" size={16} color={tokens.text.muted} style={{ marginRight: 8 }} />
          )}
          <Text style={{ flex: 1, fontSize: 12, color: tokens.text.muted }} numberOfLines={1}>
            About: <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>{activeConversation.contextProductName}</Text>
          </Text>
          <Ionicons name="chevron-forward" size={14} color={tokens.text.muted} />
        </TouchableOpacity>
      ) : null}

      {/* Messages */}
      {activeLoading && activeMessages?.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
          ListHeaderComponent={
            hasMoreMessages ? (
              <TouchableOpacity onPress={loadOlder} disabled={loadingMoreMessages} style={{ alignItems: "center", paddingVertical: 10 }}>
                {loadingMoreMessages ? (
                  <ActivityIndicator size="small" color={tokens.brand.default} />
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default }}>Load earlier messages</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={tokens.text.muted} />
              <Text style={{ marginTop: 10, fontSize: 13, color: tokens.text.muted, textAlign: "center" }}>
                Say hello to {vendor?.name || "the vendor"}, ask about price, stock, or availability.
              </Text>
            </View>
          }
          ListFooterComponent={otherTyping ? <TypingBubble tokens={tokens} /> : null}
          renderItem={({ item }) =>
            item.type === "date" ? (
              <MessageRow item={item} tokens={tokens} />
            ) : (
              <MessageRow
                item={{
                  ...item,
                  onRetry: item.kind === "pending" ? () => retryPending(item.message.tempId) : undefined,
                }}
                tokens={tokens}
                vendorName={vendor?.name}
                showSeen={
                  item.kind === "sent" &&
                  item.message.id === lastMineId &&
                  !!otherLastReadAt &&
                  new Date(otherLastReadAt) >= new Date(item.message.createdAt)
                }
              />
            )
          }
        />
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: tokens.border.default,
            backgroundColor: tokens.bg.surface,
          }}
        >
          <TouchableOpacity
            onPress={handleAttach}
            disabled={attaching}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginRight: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Attach photo"
          >
            {attaching ? (
              <ActivityIndicator size="small" color={tokens.brand.default} />
            ) : (
              <Ionicons name="camera-outline" size={22} color={tokens.text.muted} />
            )}
          </TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message the vendor…"
            placeholderTextColor={tokens.text.muted}
            multiline
            maxLength={2000}
            accessibilityLabel="Message"
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 120,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: tokens.bg.surfaceMuted,
              borderRadius: 20,
              fontSize: 14,
              color: tokens.text.primary,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: sending || !text.trim() }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: tokens.brand.default,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
              opacity: !text.trim() ? 0.5 : 1,
            }}
          >
            <Ionicons name="send" size={17} color={tokens.text.onBrand} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
