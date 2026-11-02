/**
 * OrdersScreen - customer order history.
 *
 * Simplified rebuild: the old OrdersScreen assumed live rider tracking /
 * request lifecycle from the forked delivery product. That leg doesn't
 * exist here - orders just move PENDING -> PROCESSING -> SHIPPED ->
 * DELIVERED, no payment step, no live map. Customers never create orders
 * themselves (the app is chat-commerce - see ContactVendorSheet); a vendor
 * logs the order after agreeing terms by phone/chat, and it shows up here.
 * This screen is a plain status list against GET /orders.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import EmptyState from "../../components/EmptyState";
import SignInPrompt from "../../components/SignInPrompt";
import { useTheme } from "../../theme";

const STATUS_ICON = {
  PENDING: "time-outline",
  PROCESSING: "sync-outline",
  SHIPPED: "cube-outline",
  DELIVERED: "checkmark-circle-outline",
  CANCELLED: "close-circle-outline",
};

export default function OrdersScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const envelope = await api.get("/orders");
      setOrders(envelope?.data || []);
    } catch (_) {
      // Leave the previous list in place on a failed refresh.
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load(false);
    else setIsLoading(false);
  }, [isAuthenticated, load]);

  if (!isAuthenticated) {
    return <SignInPrompt icon="receipt-outline" title={t("orders.signInTitle")} />;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, justifyContent: "center", alignItems: "center" }} edges={["top"]}>
        <ActivityIndicator size="large" color={tokens.brand.default} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {navigation.canGoBack() && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 4,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
          </TouchableOpacity>
        )}
        <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>
          {t("orders.title")}
        </Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={t("orders.emptyTitle")}
            subtitle={t("orders.emptySub")}
          />
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: tokens.bg.surface,
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: tokens.border.default,
            }}
          >
            <View
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: tokens.bg.surfaceMuted,
                alignItems: "center", justifyContent: "center", marginRight: 12,
              }}
            >
              <Ionicons name={STATUS_ICON[item.status] || "cube-outline"} size={18} color={tokens.brand.default} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: tokens.text.primary, fontSize: 14 }} numberOfLines={1}>
                {item.vendor?.name || item.merchant?.name || `Order #${String(item.id).slice(0, 8)}`}
              </Text>
              <Text style={{ color: tokens.text.muted, fontSize: 12, marginTop: 2 }}>
                {t(`orders.status.${item.status}`, item.status)}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
