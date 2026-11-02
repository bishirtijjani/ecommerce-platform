import React, { useEffect, useRef, useState } from "react";
import { FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useConversationMessages, useSendChatMessage, useMarkConversationRead } from "../hooks/useSeller";
import { Avatar, EmptyState, LoadingState, relativeTime } from "../components/ui";

export default function SellerMessagesThreadScreen() {
  const { tokens } = useTheme();
  const route = useRoute();
  const conversationId = route.params?.conversationId;
  const currentUserId = useSelector((s) => s?.auth?.user?.id);
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useConversationMessages(conversationId);
  const send = useSendChatMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const [body, setBody] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (conversationId) markRead.mutate();
  }, [conversationId]);

  // Each page is a slice of history returned oldest-first, and the backend
  // hands back the newest slice first, so the pages are reversed to get a
  // chronological timeline. Older pages sit ABOVE the current one, hence the
  // "earlier messages" header instead of an end-of-list fetch.
  const pages = data?.pages || [];
  const messages = [...pages].reverse().flat();

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => {
      try { listRef.current?.scrollToEnd({ animated: true }); } catch (_) {}
    }, 80);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    send.mutate({ body: text });
    setBody("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <FlatList
        ref={listRef}
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        ListHeaderComponent={
          hasNextPage ? (
            <TouchableOpacity
              onPress={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 12 }}>
                {isFetchingNextPage ? "Loading earlier messages..." : "Load earlier messages"}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => {
          const mine = item.senderId === currentUserId;
          const senderName = `${item.sender?.firstName || ""} ${item.sender?.lastName || ""}`.trim();
          return (
            <View style={{ marginBottom: 10, alignItems: mine ? "flex-end" : "flex-start", maxWidth: "86%" }}>
              {!mine && senderName ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, marginLeft: 2 }}>
                  <Avatar name={senderName} size={22} />
                  <Text style={{ fontSize: 10.5, color: tokens.text.muted, fontWeight: "600" }}>{senderName}</Text>
                </View>
              ) : null}
              <View
                style={{
                  backgroundColor: mine ? tokens.brand.default : tokens.bg.surface,
                  borderWidth: mine ? 0 : 1,
                  borderColor: tokens.border.default,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 14,
                  borderBottomRightRadius: mine ? 4 : 14,
                  borderBottomLeftRadius: mine ? 14 : 4,
                }}
              >
                <Text style={{ color: mine ? tokens.text.onBrand : tokens.text.primary, fontSize: 14, lineHeight: 19 }}>
                  {item.body}
                </Text>
              </View>
              <Text style={{ fontSize: 9.5, color: tokens.text.placeholder, marginTop: 3, marginHorizontal: 2 }}>
                {relativeTime(item.createdAt)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <LoadingState label="Loading messages..." />
          ) : (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No messages yet"
              subtitle="Say hello or answer the customer's question to start the conversation."
            />
          )
        }
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: tokens.border.default,
          backgroundColor: tokens.bg.surface,
          width: "100%",
          maxWidth: 960,
          alignSelf: "center",
        }}
      >
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Message"
          placeholderTextColor={tokens.text.placeholder}
          multiline
          style={{
            flex: 1,
            maxHeight: 110,
            backgroundColor: tokens.bg.surfaceMuted,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: tokens.text.primary,
            fontSize: 14,
          }}
        />
        <TouchableOpacity
          onPress={submit}
          disabled={!body.trim() || send.isPending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: tokens.brand.default,
            alignItems: "center",
            justifyContent: "center",
            opacity: !body.trim() || send.isPending ? 0.5 : 1,
          }}
        >
          <Ionicons name="send" size={18} color={tokens.text.onBrand} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
