/**
 * ChatsScreen - the buyer<->vendor conversation list.
 *
 * This is the chat-commerce core surface (see ContactVendorSheet): a
 * customer taps "Chat with vendor" from any product/storefront page, and
 * every thread they start shows up here, live-updated via the socket
 * `chat:message:new` / `chat:conversation:updated` bridge (see chatSlice +
 * chatBus). Vendors reading their own inbox use the vendor-dashboard web
 * app's Messages page against the same API.
 */

import React, { useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import EmptyState from "../../components/EmptyState";
import SignInPrompt from "../../components/SignInPrompt";
import SkeletonLoader from "../../components/SkeletonLoader";
import { fetchConversations } from "../../store/slices/chatSlice";
import { useTheme } from "../../theme";

const formatRelative = (iso) => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
};

const initial = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

function VendorAvatar({ vendor, tokens }) {
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        overflow: "hidden",
        backgroundColor: tokens.brand.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {vendor?.logoUrl ? (
        <Image source={{ uri: vendor.logoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Text style={{ fontSize: 17, fontWeight: "800", color: tokens.brand.default }}>{initial(vendor?.name)}</Text>
      )}
      {vendor?.isOpen ? (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 13,
            height: 13,
            borderRadius: 7,
            backgroundColor: tokens.status.success,
            borderWidth: 2,
            borderColor: tokens.bg.canvas,
          }}
        />
      ) : null}
    </View>
  );
}

export default function ChatsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { tokens } = useTheme();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const { conversations, conversationsLoading, conversationsError } = useSelector((s) => s.chat);

  const load = useCallback(() => {
    if (isAuthenticated) dispatch(fetchConversations());
  }, [dispatch, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  // Refresh whenever the tab regains focus (e.g. returning from a thread) so
  // a read-state change or a message sent elsewhere is reflected promptly,
  // without relying purely on the socket bridge.
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) dispatch(fetchConversations());
    }, [dispatch, isAuthenticated]),
  );

  if (!isAuthenticated) {
    return <SignInPrompt icon="chatbubbles-outline" title="Sign in to chat with vendors" />;
  }

  const openThread = (item) => {
    navigation.navigate("ChatThread", { conversationId: item.id, vendor: item.vendor });
  };

  const renderItem = ({ item }) => {
    const unread = !!item.unread;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openThread(item)}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${item.vendor?.name || "vendor"}${unread ? ", unread" : ""}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.subtle,
        }}
      >
        <VendorAvatar vendor={item.vendor} tokens={tokens} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{ flex: 1, fontSize: 15, fontWeight: unread ? "800" : "700", color: tokens.text.primary }}
              numberOfLines={1}
            >
              {item.vendor?.name || "Vendor"}
            </Text>
            <Text style={{ fontSize: 11, color: unread ? tokens.brand.default : tokens.text.muted, fontWeight: unread ? "700" : "400" }}>
              {formatRelative(item.lastMessageAt)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                color: unread ? tokens.text.primary : tokens.text.muted,
                fontWeight: unread ? "600" : "400",
              }}
              numberOfLines={1}
            >
              {item.lastMessageIsMine ? "You: " : ""}
              {item.lastMessageBody || "Say hello 👋"}
            </Text>
            {unread && (
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: tokens.brand.default,
                  marginLeft: 8,
                }}
              />
            )}
          </View>
          {item.contextProductName ? (
            <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 3 }} numberOfLines={1}>
              About: {item.contextProductName}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>Chats</Text>
      </View>

      {conversationsLoading && conversations.length === 0 ? (
        <View style={{ paddingTop: 4 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader.ChatRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={conversationsLoading && conversations.length > 0} onRefresh={load} tintColor={tokens.brand.default} />
          }
          ListEmptyComponent={
            conversationsError ? (
              <EmptyState
                icon="alert-circle-outline"
                title="Couldn't load your chats"
                subtitle={conversationsError}
                ctaLabel="Retry"
                onCta={load}
              />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="No chats yet"
                subtitle="Message a vendor from any product page to start chatting."
                ctaLabel="Browse products"
                onCta={() => navigation.navigate("MainTabs", { screen: "HomeTab", params: { screen: "Home" } })}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
