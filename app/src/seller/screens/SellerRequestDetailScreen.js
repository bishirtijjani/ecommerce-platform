import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, Pressable } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTheme } from "../../theme";
import { useRequest, useRespondToRequest, useDeclineRequest } from "../hooks/useSeller";
import { LoadingState, EmptyState, relativeTime } from "../components/ui";
import { formatNaira } from "../../data/marketplace";

export default function SellerRequestDetailScreen() {
  const { tokens } = useTheme();
  const route = useRoute();
  const requestId = route.params?.requestId;
  const { data: req, isLoading, isError, error, refetch } = useRequest(requestId);
  const respond = useRespondToRequest(requestId);
  const decline = useDeclineRequest(requestId);
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [etaText, setEtaText] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [zoomUrl, setZoomUrl] = useState(null);

  if (isLoading && !req) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <LoadingState label="Loading request..." />
      </SafeAreaView>
    );
  }

  if (isError || !req) {
    const notInInbox = error?.code === 'REQUEST_NOT_IN_INBOX';
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <EmptyState
          icon={notInInbox ? "mail-unread-outline" : "alert-circle-outline"}
          title={notInInbox ? "Not in your inbox" : "Couldn't load this request"}
          subtitle={
            notInInbox
              ? "This request expired, was cancelled, or wasn't sent to you. It may have been reposted."
              : "It may have been removed, or your connection dropped. Try again."
          }
          actionLabel={notInInbox ? undefined : "Retry"}
          onAction={notInInbox ? undefined : () => refetch?.()}
        />
      </SafeAreaView>
    );
  }

  const customerName = req.customer ? `${req.customer.firstName} ${req.customer.lastName || ""}`.trim() : "Customer";
  const phone = req.customer?.phone;
  const myResponse = req.myResponse;
  const accepted = myResponse?.status === "ACCEPTED";
  const isOpen = req.status === "OPEN";

  const categoryLabel = [req.category?.name, req.subcategory?.name].filter(Boolean).join(" · ");
  const budget =
    req.budgetMin != null || req.budgetMax != null
      ? `${req.budgetMin != null ? formatNaira(req.budgetMin) : "—"} – ${req.budgetMax != null ? formatNaira(req.budgetMax) : "—"}`
      : "Not specified";

  const submit = () => {
    if (!message.trim()) return;
    const parsed = price.trim() ? Number(price) : undefined;
    respond.mutate({
      message: message.trim(),
      price: parsed != null && !Number.isNaN(parsed) ? parsed : undefined,
      priceNote: priceNote.trim() || undefined,
      etaText: etaText.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 860, alignSelf: "center" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, flex: 1 }}>{req.title}</Text>
          <Text style={{ color: tokens.text.muted, fontSize: 11, fontWeight: "700" }}>{req.status}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Text style={{ color: tokens.text.muted, fontSize: 12 }}>{relativeTime(req.createdAt)}</Text>
          {categoryLabel ? (
            <View style={{ backgroundColor: tokens.brand.soft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
              <Text style={{ color: tokens.brand.strong, fontSize: 10.5, fontWeight: "700" }}>{categoryLabel}</Text>
            </View>
          ) : null}
        </View>

        {accepted && phone ? (
          <View style={{ backgroundColor: tokens.status.successSoft, padding: 12, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: tokens.text.primary, fontWeight: "700", marginBottom: 4 }}>Accepted</Text>
            <Text style={{ color: tokens.text.muted, fontSize: 12, marginBottom: 6 }}>{customerName}</Text>
            <Text style={{ color: tokens.brand.default, fontWeight: "700" }}>{phone}</Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, padding: 12, marginBottom: 12 }}>
          <Text style={{ color: tokens.text.primary, marginBottom: 8 }}>{req.description}</Text>
          {(req.images || []).length > 0 || (req.videos || []).length > 0 ? (
            <View style={{ marginBottom: 8, gap: 8 }}>
              {(req.images || []).length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {req.images.map((url, i) => (
                    <TouchableOpacity key={i} onPress={() => setZoomUrl(url)} activeOpacity={0.85}>
                      <Image source={{ uri: url }} style={{ width: 104, height: 104, borderRadius: 10 }} contentFit="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {(req.videos || []).map((url, i) => (
                <SellerRequestVideo key={i} uri={url} />
              ))}
            </View>
          ) : null}
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.border.default, paddingTop: 8, gap: 4 }}>
            <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Quantity: {req.quantity}</Text>
            <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Budget: {budget}</Text>
            <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Needed by: {req.neededBy ? new Date(req.neededBy).toLocaleString() : "Flexible"}</Text>
            <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Location: {[req.lga, req.state].filter(Boolean).join(", ") || req.address}</Text>
            <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Urgency: {req.urgency}</Text>
            {req.distanceKm != null ? <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Distance: {Math.round(req.distanceKm)} km</Text> : null}
          </View>
        </View>

        {myResponse ? (
          <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tokens.text.primary, fontWeight: "700", marginBottom: 4 }}>Your response ({myResponse.status})</Text>
            <Text style={{ color: tokens.text.primary, marginBottom: 4 }}>{myResponse.message}</Text>
            {myResponse.price != null ? <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Price: {formatNaira(myResponse.price)}</Text> : null}
            {myResponse.priceNote ? <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Note: {myResponse.priceNote}</Text> : null}
            {myResponse.etaText ? <Text style={{ color: tokens.text.muted, fontSize: 12 }}>ETA: {myResponse.etaText}</Text> : null}
          </View>
        ) : null}

        {isOpen ? (
          <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tokens.text.primary, fontWeight: "700", marginBottom: 8 }}>Send reply</Text>
            <TextInput value={message} onChangeText={setMessage} placeholder="Message" multiline placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, marginBottom: 8, borderWidth: 1, borderColor: tokens.border.default, minHeight: 80, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <TextInput value={price} onChangeText={setPrice} placeholder="Price" keyboardType="numeric" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
              <TextInput value={priceNote} onChangeText={setPriceNote} placeholder="Price note" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
            </View>
            <TextInput value={etaText} onChangeText={setEtaText} placeholder="ETA" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, marginBottom: 8, borderWidth: 1, borderColor: tokens.border.default }} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={submit} disabled={!message.trim() || respond.isPending} style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 10, alignItems: "center", opacity: !message.trim() || respond.isPending ? 0.7 : 1 }}>
                <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>Send response</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDeclineOpen(true)} style={{ flex: 1, backgroundColor: tokens.status.error, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {declineOpen ? (
          <View style={{ backgroundColor: tokens.status.errorSoft, padding: 12, borderRadius: 12 }}>
            <Text style={{ color: tokens.text.primary, marginBottom: 8 }}>Decline this request?</Text>
            <TouchableOpacity onPress={() => { decline.mutate(); setDeclineOpen(false); }} style={{ backgroundColor: tokens.status.error, paddingVertical: 10, borderRadius: 10, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Confirm decline</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, padding: 12, marginTop: 12 }}>
          <Text style={{ color: tokens.text.primary, fontWeight: "700", marginBottom: 4 }}>Customer</Text>
          <Text style={{ color: tokens.text.primary }}>{customerName}</Text>
          <Text style={{ color: tokens.text.muted, fontSize: 12 }}>{phone || "Phone revealed after acceptance"}</Text>
          <Text style={{ color: tokens.text.muted, fontSize: 12, marginTop: 4 }}>{req.address}</Text>
        </View>
      </ScrollView>

      <Modal visible={!!zoomUrl} transparent animationType="fade" onRequestClose={() => setZoomUrl(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }} onPress={() => setZoomUrl(null)}>
          {zoomUrl ? <Image source={{ uri: zoomUrl }} style={{ width: "92%", height: "70%" }} contentFit="contain" /> : null}
          <TouchableOpacity onPress={() => setZoomUrl(null)} style={{ position: "absolute", top: 50, right: 24, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const SellerRequestVideo = ({ uri }) => {
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