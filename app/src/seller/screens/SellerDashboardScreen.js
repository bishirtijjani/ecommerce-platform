import React from "react";
import { RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { useVendorProfile, useToggleShopStatus, useVendorOrders, useSalesSummary } from "../hooks/useSeller";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { Avatar, Card, EmptyState, PageHeader, SectionLabel, StatTile, relativeTime } from "../components/ui";

const QUICK_ACTIONS = [
  { label: "Add product", sub: "Grow your catalogue", icon: "add-circle-outline", screen: "SellerProductForm", params: {} },
  { label: "Edit shop", sub: "Logo, hours, location", icon: "storefront-outline", screen: "SellerShopProfile" },
  { label: "Analytics", sub: "Sales and trends", icon: "bar-chart-outline", screen: "SellerAnalytics" },
  { label: "Requests", sub: "Buyer requests", icon: "mail-unread-outline", screen: "SellerRequests" },
];

export default function SellerDashboardScreen() {
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const { data: vendor, isLoading, isError, refetch } = useVendorProfile();
  const toggle = useToggleShopStatus();
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useVendorOrders({ status: "PENDING", limit: 5 });
  const { data: recentData, isLoading: recentLoading, refetch: refetchRecent } = useVendorOrders({ limit: 6 });
  const { data: sales, isLoading: salesLoading, refetch: refetchSales } = useSalesSummary("7d");

  const pending = pendingData?.data || pendingData?.orders || (Array.isArray(pendingData) ? pendingData : []);
  const recent = recentData?.data || recentData?.orders || (Array.isArray(recentData) ? recentData : []);
  const firstName = vendor?.user?.firstName || vendor?.name?.split(" ")[0] || "there";

  if (isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load your shop"
          subtitle="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  const renderOrderRow = (order, last) => {
    const name = `${order.customer?.firstName || "Customer"} ${order.customer?.lastName || ""}`.trim();
    return (
      <TouchableOpacity
        key={order.id}
        onPress={() => navigation.navigate("SellerOrderDetail", { orderId: order.id })}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={`Order from ${name}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderTopWidth: last ? 0 : 1,
          borderTopColor: tokens.border.default,
        }}
      >
        <Avatar name={name} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: tokens.text.primary }}>
            {name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: tokens.text.muted, marginTop: 1 }}>
            {formatNaira(order.total ?? 0)} · {relativeTime(order.createdAt)}
          </Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={(pendingLoading || recentLoading || salesLoading) && (isLoading || pending.length + recent.length > 0)}
            onRefresh={() => {
              refetch();
              refetchPending();
              refetchRecent();
              refetchSales();
            }}
            tintColor={tokens.brand.default}
          />
        }
      >
        <PageHeader title={`Hi, ${firstName}`} subtitle="Here's how your shop is doing today." />

        {vendor && vendor.locationComplete === false && (
          <TouchableOpacity
            onPress={() => navigation.navigate("SellerShopProfile")}
            activeOpacity={0.75}
            style={{
              marginHorizontal: 16,
              marginBottom: 10,
              backgroundColor: tokens.bg.surfaceMuted,
              borderRadius: 14,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Ionicons name="location-outline" size={20} color={tokens.brand.default} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.text.primary }}>
                Add your shop location
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>
                Pin your shop so nearby customers and requests can find you.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
          </TouchableOpacity>
        )}

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatTile icon="receipt-outline" label="Orders (7d)" value={String(sales?.totalOrders ?? 0)} tone="brand" />
            <StatTile icon="wallet-outline" label="Revenue (7d)" value={formatNaira(sales?.totalRevenue ?? sales?.total ?? 0)} tone="success" />
            <StatTile icon="checkmark-done-outline" label="Completed" value={String(sales?.completedOrders ?? 0)} tone="info" />
          </View>

          <Card padded>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: vendor?.isOpen ? tokens.status.successSoft : tokens.bg.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={vendor?.isOpen ? "storefront" : "storefront-outline"}
                  size={19}
                  color={vendor?.isOpen ? tokens.status.successStrong : tokens.text.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }}>
                  {vendor?.isOpen ? "Shop is open" : "Shop is closed"}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>
                  {vendor?.isOpen ? "Customers can place orders right now." : "Customers can browse but cannot order."}
                </Text>
              </View>
              <Switch
                value={!!vendor?.isOpen}
                onValueChange={(v) => toggle.mutate(v)}
                trackColor={{ true: tokens.brand.default, false: tokens.border.strong }}
              />
            </View>
          </Card>

          <View>
            <SectionLabel style={{ marginTop: 8 }}>Needs attention</SectionLabel>
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }}>
                  Pending orders
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate("SellerOrders", { status: "PENDING" })}>
                  <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 12 }}>View all</Text>
                </TouchableOpacity>
              </View>
              {pending.length === 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingBottom: 14,
                    paddingTop: 2,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={17} color={tokens.status.success} />
                  <Text style={{ fontSize: 12.5, color: tokens.text.muted }}>All caught up — nothing waiting.</Text>
                </View>
              ) : (
                pending.map((order, index) => renderOrderRow(order, index === pending.length - 1))
              )}
            </Card>
          </View>

          <View>
            <SectionLabel style={{ marginTop: 8 }}>Quick actions</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {QUICK_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  onPress={() => navigation.navigate(action.screen, action.params)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityHint={action.sub}
                  style={{
                    width: "48%",
                    minWidth: 0,
                    flexGrow: 1,
                    backgroundColor: tokens.bg.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.border.default,
                    padding: 14,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: tokens.brand.soft,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Ionicons name={action.icon} size={17} color={tokens.brand.default} />
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: tokens.text.primary }}>{action.label}</Text>
                  <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>{action.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <SectionLabel>Recent orders</SectionLabel>
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }}>Latest activity</Text>
                <TouchableOpacity onPress={() => navigation.navigate("SellerOrders")}>
                  <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 12 }}>View all</Text>
                </TouchableOpacity>
              </View>
              {recent.length === 0 ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 16, paddingTop: 2 }}>
                  <Text style={{ fontSize: 12.5, color: tokens.text.muted }}>
                    No orders yet — share your shop to get your first sale.
                  </Text>
                </View>
              ) : (
                recent.map((order, index) => renderOrderRow(order, index === recent.length - 1))
              )}
            </Card>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
