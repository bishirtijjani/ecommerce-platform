import React, { useEffect, useCallback } from "react";
import { goBackOr } from "../../lib/goBack";
import { View, Text, TouchableOpacity, StatusBar, ScrollView, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import {
  fetchRequestDetail,
  acceptResponse,
  cancelRequest,
  repostRequest,
  clearRequestDetail,
} from "../../store/slices/requestSlice";
import { startConversation } from "../../store/slices/chatSlice";
import { ensurePushPermission } from "../../services/pushPermission";
import ErrorState from "../../components/ErrorState";

const money = (n) => (n == null ? null : `₦${Number(n).toLocaleString()}`);

export default function RequestDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { tokens, isDark } = useTheme();
  const requestId = route.params?.requestId;
  const { detail, detailLoading, detailError } = useSelector((s) => s.request);

  const load = useCallback(() => {
    if (requestId) dispatch(fetchRequestDetail(requestId));
  }, [dispatch, requestId]);

  useEffect(() => {
    load();
    return () => dispatch(clearRequestDetail());
  }, [load, dispatch]);

  const messageVendor = async (vendor) => {
    if (!vendor?.id) return;
    try {
      const conversation = await dispatch(startConversation({ vendorId: vendor.id })).unwrap();
      navigation.navigate("ChatThread", { conversationId: conversation.id, vendor: conversation.vendor || vendor });
    } catch (err) {
      Toast.show({ type: "error", text1: "Couldn't open chat", text2: err?.message || "Please try again." });
    }
  };

  const onAccept = async (response) => {
    // Accepting notifies the winning seller (and closes out the rest).
    ensurePushPermission("response");
    try {
      await dispatch(acceptResponse({ requestId, responseId: response.id })).unwrap();
      Toast.show({ type: "success", text1: "Seller selected", text2: "You can now see their contact details." });
    } catch (err) {
      Toast.show({ type: "error", text1: "Could not accept", text2: err?.message || "Please try again." });
    }
  };

  const onCancel = async () => {
    try {
      await dispatch(cancelRequest(requestId)).unwrap();
    } catch (err) {
      Toast.show({ type: "error", text1: "Could not cancel", text2: err?.message || "Please try again." });
    }
  };

  const onRepost = async () => {
    try {
      await dispatch(repostRequest(requestId)).unwrap();
      Toast.show({ type: "success", text1: "Reposted", text2: "We're alerting sellers again." });
    } catch (err) {
      Toast.show({ type: "error", text1: "Could not repost", text2: err?.message || "Please try again." });
    }
  };

  if (detailLoading && !detail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.brand.default} />
      </SafeAreaView>
    );
  }

  if (detailError && !detail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <ErrorState message={typeof detailError === "string" ? detailError : detailError?.message} onRetry={load} />
      </SafeAreaView>
    );
  }

  if (!detail) return <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} />;

  const isOpen = detail.status === "OPEN";
  const responses = detail.responses || [];
  const accepted = detail.acceptedResponse || responses.find((r) => r.status === "ACCEPTED");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
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
        <Text style={{ flex: 1, fontSize: 18, fontWeight: "900", color: tokens.text.primary }} numberOfLines={1}>
          Request
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: tokens.bg.surfaceMuted,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: tokens.brand.strong }}>{detail.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary }}>{detail.title}</Text>
        {detail.description ? (
          <Text style={{ fontSize: 14, color: tokens.text.muted, marginTop: 8, lineHeight: 20 }}>
            {detail.description}
          </Text>
        ) : null}

        {detail.images?.length || detail.videos?.length ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            {detail.images?.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {detail.images.map((url) => (
                  <Image
                    key={url}
                    source={{ uri: url }}
                    contentFit="cover"
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 12,
                      backgroundColor: tokens.bg.surfaceMuted,
                    }}
                  />
                ))}
              </ScrollView>
            ) : null}
            {detail.videos?.map((url) => (
              <RequestVideo key={url} uri={url} />
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {detail.category?.name ? (
            <Meta
              tokens={tokens}
              icon="pricetag-outline"
              label={[detail.category.name, detail.subcategory?.name].filter(Boolean).join(" · ")}
            />
          ) : null}
          <Meta
            tokens={tokens}
            icon="location-outline"
            label={[detail.lga, detail.state].filter(Boolean).join(", ") || detail.address}
          />
          {detail.distanceKm != null ? (
            <Meta tokens={tokens} icon="navigate-outline" label={`${detail.distanceKm} km`} />
          ) : null}
          {detail.reach === "ANYWHERE" ? <Meta tokens={tokens} icon="globe-outline" label="Anywhere" /> : null}
          {detail.budgetMin != null || detail.budgetMax != null ? (
            <Meta
              tokens={tokens}
              icon="cash-outline"
              label={`${money(detail.budgetMin) || ""}${detail.budgetMin != null && detail.budgetMax != null ? " – " : ""}${
                money(detail.budgetMax) || ""
              }`}
            />
          ) : null}
        </View>

        {accepted ? (
          <View
            style={{
              marginTop: 20,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: tokens.status.successStrong,
              backgroundColor: tokens.bg.surface,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color={tokens.status.successStrong} />
              <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.text.primary }}>
                {accepted.vendor?.name} selected
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 8 }}>{accepted.message}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              {accepted.vendor?.phone ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${accepted.vendor.phone}`).catch(() => {})}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    backgroundColor: tokens.brand.default,
                    borderRadius: 10,
                    paddingVertical: 11,
                  }}
                >
                  <Ionicons name="call" size={16} color={tokens.text.onBrand} />
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 13 }}>Call</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => messageVendor(accepted.vendor)}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1.5,
                  borderColor: tokens.brand.default,
                  borderRadius: 10,
                  paddingVertical: 11,
                }}
              >
                <Ionicons name="chatbubble-outline" size={16} color={tokens.brand.default} />
                <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 13 }}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Text style={{ fontSize: 15, fontWeight: "900", color: tokens.text.primary, marginTop: 26, marginBottom: 10 }}>
          {responses?.length} {responses?.length === 1 ? "reply" : "replies"}
        </Text>

        {responses?.length === 0 ? (
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.border.default,
              backgroundColor: tokens.bg.surface,
              padding: 18,
              alignItems: "center",
            }}
          >
            <Ionicons name="hourglass-outline" size={22} color={tokens.text.muted} />
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 8, textAlign: "center" }}>
              {isOpen
                ? "We've alerted sellers near you. Replies will show up here."
                : "No one replied to this request."}
            </Text>
          </View>
        ) : (
          responses.map((r) => (
            <View
              key={r.id}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: r.status === "ACCEPTED" ? tokens.status.successStrong : tokens.border.default,
                backgroundColor: tokens.bg.surface,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.text.primary }}>
                  {r.vendor?.name || "Seller"}
                </Text>
                {r.status !== "PENDING" ? (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.text.muted }}>{r.status}</Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 6, lineHeight: 19 }}>{r.message}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                {r.price != null ? (
                  <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.brand.strong }}>
                    {money(r.price)}
                    {r.priceNote ? <Text style={{ fontSize: 11, color: tokens.text.muted }}> {r.priceNote}</Text> : null}
                  </Text>
                ) : null}
                {r.etaText ? (
                  <Text style={{ fontSize: 12, color: tokens.text.muted }}>ETA: {r.etaText}</Text>
                ) : null}
              </View>

              {isOpen && r.status === "PENDING" ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => onAccept(r)}
                    accessibilityRole="button"
                    style={{
                      flex: 1,
                      backgroundColor: tokens.brand.default,
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 13 }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => messageVendor(r.vendor)}
                    accessibilityRole="button"
                    style={{
                      flex: 1,
                      borderWidth: 1.5,
                      borderColor: tokens.brand.default,
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 13 }}>Message</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}

        {isOpen ? (
          <TouchableOpacity
            onPress={onCancel}
            accessibilityRole="button"
            style={{ marginTop: 14, paddingVertical: 12, alignItems: "center" }}
          >
            <Text style={{ color: tokens.status.error, fontWeight: "700", fontSize: 13 }}>Cancel request</Text>
          </TouchableOpacity>
        ) : detail.status === "EXPIRED" || detail.status === "CANCELLED" ? (
          <TouchableOpacity
            onPress={onRepost}
            accessibilityRole="button"
            style={{
              marginTop: 14,
              borderWidth: 1.5,
              borderColor: tokens.brand.default,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 14 }}>Repost request</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const Meta = ({ tokens, icon, label }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: tokens.bg.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    }}
  >
    <Ionicons name={icon} size={13} color={tokens.text.muted} />
    <Text style={{ fontSize: 12, color: tokens.text.primary }} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const RequestVideo = ({ uri }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: 200, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}
      contentFit="contain"
      nativeControls
    />
  );
};
