import React, { useEffect } from "react";
import { goBackOr } from "../../lib/goBack";
import { View, Text, TouchableOpacity, StatusBar, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { fetchMyRequests } from "../../store/slices/requestSlice";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import SkeletonLoader from "../../components/SkeletonLoader";
import SignInPrompt from "../../components/SignInPrompt";

const statusColor = (status, tokens) => {
  switch (status) {
    case "OPEN": return tokens.brand.strong;
    case "ASSIGNED": return tokens.status.successStrong;
    case "EXPIRED": return tokens.status.warning;
    case "CANCELLED": return tokens.text.muted;
    default: return tokens.text.muted;
  }
};

export default function MyRequestsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { tokens, isDark } = useTheme();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const { myRequests, myRequestsLoading, myRequestsError } = useSelector((s) => s.request);

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchMyRequests({}));
  }, [dispatch, isAuthenticated]);

  if (!isAuthenticated) {
    return <SignInPrompt icon="megaphone-outline" title="Sign in to see your requests" />;
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("RequestDetail", { requestId: item.id })}
      accessibilityRole="button"
      style={{
        backgroundColor: tokens.bg.surface,
        borderWidth: 1,
        borderColor: tokens.border.default,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor(item.status, tokens) }}>
          {item.status}
        </Text>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
        {item.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
        <Text style={{ fontSize: 12, color: tokens.text.muted }}>
          {[item.category?.name, item.subcategory?.name].filter(Boolean).join(" · ") || "General"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="chatbubble-outline" size={12} color={tokens.text.muted} />
          <Text style={{ fontSize: 12, color: tokens.text.muted }}>
            {item.responseCount || 0} {item.responseCount === 1 ? "reply" : "replies"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: "900", color: tokens.text.primary }}>
          My requests
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("RequestCompose")}
          accessibilityRole="button"
          accessibilityLabel="Post a request"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: tokens.brand.default,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <Ionicons name="add" size={16} color={tokens.text.onBrand} />
          <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 13 }}>New</Text>
        </TouchableOpacity>
      </View>

      {myRequestsLoading && myRequests.length === 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader.OrderRow key={i} />
          ))}
        </View>
      ) : myRequestsError && myRequests.length === 0 ? (
        <ErrorState
          message={typeof myRequestsError === "string" ? myRequestsError : myRequestsError?.message}
          onRetry={() => dispatch(fetchMyRequests({}))}
        />
      ) : myRequests.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          title="No requests yet"
          subtitle="Post what you need and nearby sellers will respond."
          ctaLabel="Post a request"
          onCta={() => navigation.navigate("RequestCompose")}
        />
      ) : (
        <FlatList
          data={myRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshing={myRequestsLoading}
          onRefresh={() => dispatch(fetchMyRequests({}))}
        />
      )}
    </SafeAreaView>
  );
}
