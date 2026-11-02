import React, { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import LogOrderModal from "../components/LogOrderModal";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { useVendorOrders } from "../hooks/useSeller";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { Avatar, EmptyState, FilterChips, LoadingState, PageHeader, SearchField, relativeTime } from "../components/ui";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function SellerOrdersScreen() {
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();

  const [status, setStatus] = useState(route.params?.status || "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (route.params?.status !== undefined) setStatus(route.params.status);
  }, [route.params?.status]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const { data, isLoading, refetch } = useVendorOrders({
    ...(status ? { status } : {}),
    page,
    limit: 20,
  });

  const orders = data?.data || data?.orders || (Array.isArray(data) ? data : []);
  const meta = data?.meta;
  const total = meta?.total ?? orders.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      `${o.customer?.firstName || ""} ${o.customer?.lastName || ""} ${o.customer?.phone || ""} ${o.id}`
        .toLowerCase()
        .includes(q)
    );
  }, [orders, search]);

  const renderOrder = ({ item }) => {
    const name = `${item.customer?.firstName || "Customer"} ${item.customer?.lastName || ""}`.trim();
    const itemCount = item.items?.length || 0;
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("SellerOrderDetail", { orderId: item.id })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Order ${item.id?.slice(0, 8)} from ${name}`}
        style={{
          backgroundColor: tokens.bg.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tokens.border.default,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={name} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
              {name}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
              {item.customer?.phone || `Order #${item.id?.slice(0, 8)}`}
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }}>
            {formatNaira(item.total ?? 0)}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: tokens.border.default,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <OrderStatusBadge status={item.status} />
            <Text style={{ fontSize: 11.5, color: tokens.text.muted }}>
              {itemCount} {itemCount === 1 ? "item" : "items"} · {relativeTime(item.createdAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={tokens.text.placeholder} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <FlatList
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        data={filtered}
        keyExtractor={(o) => o.id}
        renderItem={renderOrder}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isLoading && orders.length > 0} onRefresh={() => refetch()} tintColor={tokens.brand.default} />
        }
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Orders"
              subtitle={`${total} ${total === 1 ? "order" : "orders"} · track, accept and fulfil`}
            />
            <SearchField value={search} onChangeText={setSearch} placeholder="Search customer, phone or order ID" />
            <View style={{ marginTop: 10, marginBottom: 14 }}>
              <FilterChips options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            </View>
            <TouchableOpacity onPress={() => setLogOpen(true)} style={{ backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 12, alignItems: "center", marginBottom: 14 }}>
              <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>Log order</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState label="Loading orders..." />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title={status ? `No ${status.toLowerCase()} orders` : "No orders yet"}
              subtitle={
                status
                  ? "Try another status filter."
                  : "Orders from customers will appear here as soon as they come in."
              }
            />
          )
        }
        ListFooterComponent={
          meta && meta.totalPages > 1 ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                style={{ opacity: meta.page <= 1 ? 0.4 : 1, paddingVertical: 10, paddingHorizontal: 12 }}
              >
                <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 13 }}>Previous</Text>
              </TouchableOpacity>
              <Text style={{ color: tokens.text.muted, fontSize: 12 }}>
                Page {meta.page} of {meta.totalPages}
              </Text>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages}
                style={{ opacity: meta.page >= meta.totalPages ? 0.4 : 1, paddingVertical: 10, paddingHorizontal: 12 }}
              >
                <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 13 }}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
      <LogOrderModal open={logOpen} onClose={() => setLogOpen(false)} />
    </SafeAreaView>
  );
}
