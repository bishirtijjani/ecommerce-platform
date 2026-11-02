import React from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { useRequestInbox, useRequestUnreadCount } from "../hooks/useSeller";
import { Badge, EmptyState, LoadingState, PageHeader, relativeTime } from "../components/ui";

const URGENCY_TONE = { URGENT: "error", HIGH: "warning", NORMAL: "neutral", LOW: "neutral" };

export default function SellerRequestsScreen() {
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const { data, isLoading, isError, error, refetch } = useRequestInbox({});
  const unread = useRequestUnreadCount()?.data || 0;

  // The inbox endpoint returns a page object: { items, unseenCount, page, limit, total }.
  const items = data?.items || [];
  const total = data?.total ?? items.length;

  const renderRequest = ({ item }) => {
    const budget =
      item.budgetMin != null || item.budgetMax != null
        ? `${item.budgetMin != null ? formatNaira(item.budgetMin) : "—"} – ${item.budgetMax != null ? formatNaira(item.budgetMax) : "—"}`
        : "Budget open";
    const location = [item.lga, item.state].filter(Boolean).join(", ");

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("SellerRequestDetail", { requestId: item.id })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={item.title || "Buyer request"}
        style={{
          backgroundColor: tokens.bg.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: item.seenAt ? tokens.border.default : tokens.brand.softBorder,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary, lineHeight: 20 }}>
              {item.title || item.description || "Buyer request"}
            </Text>
            <Text numberOfLines={2} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 3, lineHeight: 17 }}>
              {item.description || "No description provided."}
            </Text>
          </View>
          {!item.seenAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.brand.default, marginTop: 5 }} /> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <Badge label={item.status || "OPEN"} tone={item.status === "OPEN" ? "brand" : "neutral"} />
          {item.urgency ? <Badge label={item.urgency} tone={URGENCY_TONE[item.urgency] || "neutral"} /> : null}
          <Badge label={budget} tone="info" />
          {item.quantity ? <Badge label={`Qty ${item.quantity}`} tone="neutral" /> : null}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: tokens.border.default,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
            <Ionicons name="location-outline" size={13} color={tokens.text.muted} />
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: tokens.text.muted }}>
              {location || "Location not specified"}
              {item.distanceKm != null ? ` · ${Math.round(item.distanceKm)} km` : ""}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: tokens.text.placeholder }}>{relativeTime(item.createdAt)}</Text>
          <Ionicons name="chevron-forward" size={16} color={tokens.text.placeholder} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <FlatList
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        data={items}
        keyExtractor={(r) => r.id}
        renderItem={renderRequest}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isLoading && items.length > 0} onRefresh={() => refetch()} tintColor={tokens.brand.default} />
        }
        ListHeaderComponent={
          <PageHeader
            title="Requests"
            subtitle={
              unread > 0
                ? `${unread} new ${unread === 1 ? "request" : "requests"} matched to your shop`
                : `${total} ${total === 1 ? "buyer request" : "buyer requests"} matched to your shop`
            }
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState label="Loading requests..." />
          ) : isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title={error?.code === 'SELLER_PROFILE_REQUIRED' ? "Seller profile required" : "Couldn't load requests"}
              subtitle={
                error?.code === 'SELLER_PROFILE_REQUIRED'
                  ? "Your account doesn't have a linked seller profile yet. Finish enrolling your shop to receive requests."
                  : "Something went wrong loading your inbox. Try again."
              }
              actionLabel="Retry"
              onAction={() => refetch()}
            />
          ) : (
            <EmptyState
              icon="mail-unread-outline"
              title="No requests right now"
              subtitle="When customers ask for something you sell, their requests will appear here."
            />
          )
        }
      />
    </SafeAreaView>
  );
}
