import React, { useState } from "react";
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { useOrder, useAcceptOrder, useRejectOrder, useUpdateOrderStatus, useOrderMessages, usePostOrderMessage } from "../hooks/useSeller";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { Avatar, Card, EmptyState, LoadingState, PrimaryButton, SectionLabel } from "../components/ui";

const inputStyle = (tokens) => ({
  backgroundColor: tokens.bg.surfaceMuted,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: tokens.border.default,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: tokens.text.primary,
  fontSize: 14,
});

export default function SellerOrderDetailScreen() {
  const { tokens } = useTheme();
  const route = useRoute();
  const orderId = route.params?.orderId;
  const currentUserId = useSelector((s) => s?.auth?.user?.id);
  const { data: order, isLoading } = useOrder(orderId);
  const accept = useAcceptOrder(orderId);
  const reject = useRejectOrder(orderId);
  const update = useUpdateOrderStatus(orderId);
  const { data: messages } = useOrderMessages(orderId);
  const postMsg = usePostOrderMessage(orderId);

  const [msg, setMsg] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [tracking, setTracking] = useState("");

  if (isLoading && !order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <LoadingState label="Loading order..." />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <EmptyState
          icon="receipt-outline"
          title="Order not found"
          subtitle="It may have been removed, or you may not have access to it."
        />
      </SafeAreaView>
    );
  }

  const msgs = Array.isArray(messages) ? messages : messages?.data || [];
  const customerName = `${order.customer?.firstName || "Customer"} ${order.customer?.lastName || ""}`.trim();
  const canAccept = order.status === "PENDING";
  const canShip = order.status === "ACCEPTED" || order.status === "PROCESSING";
  const canDeliver = order.status === "SHIPPED";
  const busy = accept.isPending || reject.isPending || update.isPending;

  const sendMessage = () => {
    const text = msg.trim();
    if (!text) return;
    postMsg.mutate(text);
    setMsg("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Card padded style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary }}>
              #{order.id?.slice(0, 8)}
            </Text>
            <OrderStatusBadge status={order.status} />
          </View>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>
            Placed {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}
          </Text>

          <View style={{ height: 1, backgroundColor: tokens.border.default, marginVertical: 12 }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={customerName} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }}>
                {customerName}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>
                {order.customer?.phone || "No phone on file"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, color: tokens.text.muted }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.text.primary }}>
                {formatNaira(order.total ?? 0)}
              </Text>
            </View>
          </View>
        </Card>

        {canAccept || canShip || canDeliver ? (
          <Card padded style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary, marginBottom: 10 }}>
              {canAccept ? "Respond to this order" : canShip ? "Mark as shipped" : "Mark as delivered"}
            </Text>

            {canAccept ? (
              <>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Reason (only needed if rejecting)"
                  placeholderTextColor={tokens.text.placeholder}
                  style={[inputStyle(tokens), { marginBottom: 10 }]}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <PrimaryButton
                    label="Reject"
                    variant="danger"
                    onPress={() => reject.mutate(rejectReason || "Rejected")}
                    disabled={busy}
                    loading={reject.isPending}
                    style={{ flex: 1 }}
                  />
                  <PrimaryButton
                    label="Accept order"
                    icon="checkmark"
                    onPress={() => accept.mutate()}
                    disabled={busy}
                    loading={accept.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : null}

            {canShip ? (
              <>
                <TextInput
                  value={tracking}
                  onChangeText={setTracking}
                  placeholder="Tracking number (optional)"
                  placeholderTextColor={tokens.text.placeholder}
                  style={[inputStyle(tokens), { marginBottom: 10 }]}
                />
                <PrimaryButton
                  label="Mark as shipped"
                  icon="cube-outline"
                  onPress={() => update.mutate({ status: "SHIPPED", trackingNumber: tracking })}
                  disabled={busy}
                  loading={update.isPending}
                />
              </>
            ) : null}

            {canDeliver ? (
              <PrimaryButton
                label="Mark as delivered"
                icon="checkmark-done-outline"
                onPress={() => update.mutate({ status: "DELIVERED" })}
                disabled={busy}
                loading={update.isPending}
              />
            ) : null}
          </Card>
        ) : null}

        <SectionLabel>Items</SectionLabel>
        <Card style={{ marginBottom: 14 }}>
          {(order.items || []).map((item, index) => {
            const unit = Number(item.unitPrice ?? item.price ?? item.product?.basePrice ?? 0);
            const line = Number(item.lineTotal ?? unit * (item.quantity || 1));
            return (
              <View
                key={item.id || index}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderBottomWidth: index < (order.items || []).length - 1 ? 1 : 0,
                  borderBottomColor: tokens.border.default,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    backgroundColor: tokens.bg.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted }}>
                    {item.quantity || 1}×
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "600", color: tokens.text.primary }}>
                    {item.product?.name || item.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: tokens.text.muted, marginTop: 1 }}>
                    {formatNaira(unit)} each
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary }}>
                  {formatNaira(line)}
                </Text>
              </View>
            );
          })}
        </Card>

        <Card padded style={{ marginBottom: 14 }}>
          {[
            { label: "Subtotal", value: order.subtotal },
            ...(Number(order.tax) > 0 ? [{ label: "Tax", value: order.tax }] : []),
            ...(Number(order.discountAmount) > 0 ? [{ label: "Discount", value: -Number(order.discountAmount) }] : []),
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 12.5, color: tokens.text.muted }}>{row.label}</Text>
              <Text style={{ fontSize: 12.5, color: tokens.text.primary }}>{formatNaira(row.value ?? 0)}</Text>
            </View>
          ))}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingTop: 8,
              marginTop: 2,
              borderTopWidth: 1,
              borderTopColor: tokens.border.default,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.text.primary }}>Total</Text>
            <Text style={{ fontSize: 15, fontWeight: "900", color: tokens.text.primary }}>
              {formatNaira(order.total ?? 0)}
            </Text>
          </View>
        </Card>

        <SectionLabel>Order chat</SectionLabel>
        <Card style={{ marginBottom: 10 }}>
          {msgs.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: tokens.text.muted, padding: 14 }}>
              No messages on this order yet.
            </Text>
          ) : (
            <FlatList
              data={msgs}
              keyExtractor={(m) => m.id}
              scrollEnabled
              style={{ maxHeight: 260, paddingHorizontal: 12, paddingTop: 10 }}
              renderItem={({ item }) => {
                const mine = item.fromUserId === currentUserId;
                return (
                  <View
                    style={{
                      alignSelf: mine ? "flex-end" : "flex-start",
                      backgroundColor: mine ? tokens.brand.default : tokens.bg.surfaceMuted,
                      paddingHorizontal: 11,
                      paddingVertical: 8,
                      borderRadius: 12,
                      marginBottom: 7,
                      maxWidth: "85%",
                    }}
                  >
                    <Text style={{ color: mine ? tokens.text.onBrand : tokens.text.primary, fontSize: 13.5 }}>
                      {item.body}
                    </Text>
                  </View>
                );
              }}
            />
          )}
        </Card>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder="Message the customer"
            placeholderTextColor={tokens.text.placeholder}
            style={[inputStyle(tokens), { flex: 1 }]}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!msg.trim() || postMsg.isPending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: tokens.brand.default,
              alignItems: "center",
              justifyContent: "center",
              opacity: !msg.trim() || postMsg.isPending ? 0.5 : 1,
            }}
          >
            <Ionicons name="send" size={18} color={tokens.text.onBrand} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
