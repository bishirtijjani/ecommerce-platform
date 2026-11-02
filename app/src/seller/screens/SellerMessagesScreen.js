import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { useConversations } from "../hooks/useSeller";
import { Avatar, EmptyState, LoadingState, PageHeader, SearchField, relativeTime } from "../components/ui";

export default function SellerMessagesScreen() {
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const { data, isLoading, refetch } = useConversations(false);
  const [search, setSearch] = useState("");

  const conversations = Array.isArray(data) ? data : [];
  const unreadCount = conversations.filter((c) => c.unread).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      `${c.customer?.firstName || ""} ${c.customer?.lastName || ""} ${c.lastMessageBody || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [conversations, search]);

  const renderConversation = ({ item }) => {
    const name = `${item.customer?.firstName || "Customer"} ${item.customer?.lastName || ""}`.trim();
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("SellerMessagesThread", { conversationId: item.id })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Conversation with ${name}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: tokens.bg.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tokens.border.default,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <Avatar name={name} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }}>
              {name}
            </Text>
            {item.unread ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.brand.default }} />
            ) : null}
          </View>
          <Text numberOfLines={1} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 3 }}>
            {item.lastMessageBody || "No messages yet"}
          </Text>
        </View>
        <Text style={{ fontSize: 10.5, color: tokens.text.placeholder }}>{relativeTime(item.lastMessageAt)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <FlatList
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        data={filtered}
        keyExtractor={(c) => c.id}
        renderItem={renderConversation}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isLoading && conversations.length > 0} onRefresh={() => refetch()} tintColor={tokens.brand.default} />
        }
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Messages"
              subtitle={
                unreadCount > 0
                  ? `${unreadCount} unread ${unreadCount === 1 ? "conversation" : "conversations"}`
                  : "Chat with customers about their orders"
              }
            />
            <View style={{ marginBottom: 14 }}>
              <SearchField value={search} onChangeText={setSearch} placeholder="Search conversations" />
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState label="Loading conversations..." />
          ) : (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title={conversations.length ? "No matching conversations" : "No messages yet"}
              subtitle={
                conversations.length
                  ? "Try a different search."
                  : "When customers message your shop, their conversations will appear here."
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}
