import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { useSalesSummary, useOrderHistory } from "../hooks/useSeller";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { Avatar, Card, EmptyState, FilterChips, LoadingState, PageHeader, SectionLabel, StatTile } from "../components/ui";

const PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export default function SellerAnalyticsScreen() {
  const { tokens } = useTheme();
  const [period, setPeriod] = useState("7d");
  const [page, setPage] = useState(1);
  const { data: sales, isLoading: salesLoading, refetch: refetchSales } = useSalesSummary(period);
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useOrderHistory({ page, limit: 10 });

  const rows = Array.isArray(history) ? history : history?.data || history?.orders || [];
  const meta = history?.meta;

  const chartData = useMemo(() => {
    const byDay = new Map();
    rows.forEach((order) => {
      const day = new Date(order.createdAt).toLocaleDateString();
      byDay.set(day, (byDay.get(day) || 0) + Number(order.total || 0));
    });
    return Array.from(byDay.entries())
      .map(([date, total]) => ({ date, total }))
      .reverse();
  }, [rows]);

  const max = Math.max(...chartData.map((d) => d.total), 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={(salesLoading || historyLoading) && (rows.length > 0 || !!sales)}
            onRefresh={() => {
              refetchSales();
              refetchHistory();
            }}
            tintColor={tokens.brand.default}
          />
        }
      >
        <PageHeader title="Analytics" subtitle="Sales and order performance for your shop." />

        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ marginBottom: 14 }}>
            <FilterChips options={PERIODS} value={period} onChange={(v) => { setPeriod(v); setPage(1); }} />
          </View>

          {salesLoading && !sales ? (
            <LoadingState label="Loading performance..." />
          ) : (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
              <StatTile icon="receipt-outline" label="Orders" value={String(sales?.totalOrders ?? 0)} tone="brand" />
              <StatTile icon="wallet-outline" label="Revenue" value={formatNaira(sales?.totalRevenue ?? sales?.total ?? 0)} tone="success" />
              <StatTile icon="checkmark-done-outline" label="Completed" value={String(sales?.completedOrders ?? 0)} tone="info" />
            </View>
          )}

          <SectionLabel>Revenue trend</SectionLabel>
          <Card padded style={{ marginBottom: 18 }}>
            {chartData.length === 0 ? (
              <Text style={{ fontSize: 12.5, color: tokens.text.muted, paddingVertical: 12 }}>
                Not enough order data for this period yet.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 170 }}>
                {chartData.map((day, index) => (
                  <View key={`${day.date}-${index}`} style={{ flex: 1, alignItems: "center" }}>
                    <View
                      style={{
                        width: "100%",
                        height: 136,
                        borderRadius: 6,
                        backgroundColor: tokens.bg.surfaceMuted,
                        justifyContent: "flex-end",
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: "100%",
                          height: Math.max(4, (day.total / max) * 136),
                          backgroundColor: tokens.brand.default,
                          borderRadius: 6,
                        }}
                      />
                    </View>
                    <Text style={{ fontSize: 9, color: tokens.text.muted, marginTop: 5 }} numberOfLines={1}>
                      {day.date.slice(0, 5)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <SectionLabel>Order history</SectionLabel>
          <Card>
            {historyLoading && rows.length === 0 ? (
              <LoadingState label="Loading orders..." />
            ) : rows.length === 0 ? (
              <EmptyState icon="receipt-outline" title="No orders yet" subtitle="Completed orders will be listed here." />
            ) : (
              rows.map((order, index) => {
                const name = `${order.customer?.firstName || "Customer"} ${order.customer?.lastName || ""}`.trim();
                return (
                  <View
                    key={order.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: index < rows.length - 1 ? 1 : 0,
                      borderBottomColor: tokens.border.default,
                    }}
                  >
                    <Avatar name={name} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: tokens.text.primary }}>
                        {name}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: tokens.text.muted, marginTop: 1 }}>
                        #{order.id?.slice(0, 8)} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary }}>
                        {formatNaira(order.total ?? 0)}
                      </Text>
                      <OrderStatusBadge status={order.status} />
                    </View>
                  </View>
                );
              })
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderTopWidth: rows.length ? 1 : 0,
                borderTopColor: tokens.border.default,
              }}
            >
              <TouchableOpacity onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <Text style={{ color: page <= 1 ? tokens.text.placeholder : tokens.brand.default, fontWeight: "700", fontSize: 12 }}>
                  Previous
                </Text>
              </TouchableOpacity>
              <Text style={{ color: tokens.text.muted, fontSize: 11.5 }}>
                Page {meta?.page ?? page}
                {meta?.totalPages ? ` of ${meta.totalPages}` : ""}
              </Text>
              <TouchableOpacity
                onPress={() => setPage((p) => p + 1)}
                disabled={meta ? meta.page >= meta.totalPages : false}
              >
                <Text
                  style={{
                    color: meta && meta.page >= meta.totalPages ? tokens.text.placeholder : tokens.brand.default,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
