import React, { useState } from "react";
import { Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useSupportTickets } from "../hooks/useSeller";
import { createSupportTicket } from "../api/vendorApi";
import { Badge, Card, EmptyState, PageHeader, PrimaryButton } from "../components/ui";

// Must match the backend's TICKET_CATEGORIES enum
// (backend/src/modules/support/support.validator.js). Anything else is a 400.
const TICKET_CATEGORIES = ["ACCOUNT", "PAYMENT", "ORDER", "DELIVERY", "PRODUCT", "TECHNICAL", "OTHER"];

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

export default function SellerSupportScreen() {
  const { tokens } = useTheme();
  const { data, isLoading, refetch } = useSupportTickets();
  const tickets = Array.isArray(data) ? data : data?.data || [];
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setBusy(true);
    try {
      // The backend expects `description` (not `message`) and a `category`
      // from its fixed enum - sending anything else is a 400.
      await createSupportTicket({ category, subject: subject.trim(), description: message.trim() });
      setSubject("");
      setMessage("");
      setOpen(false);
      await refetch();
    } catch (e) {}
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={tokens.brand.default} />}
      >
        <PageHeader
          title="Support"
          subtitle="Questions about orders, payouts or your shop? We're here."
          actionLabel="New ticket"
          onAction={() => setOpen(true)}
        />

        <View style={{ paddingHorizontal: 16 }}>
          {tickets.length === 0 ? (
            <Card>
              <EmptyState
                icon="headset-outline"
                title="No support tickets"
                subtitle="Open a ticket and our team will get back to you."
                actionLabel="Open a ticket"
                onAction={() => setOpen(true)}
              />
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} style={{ padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: tokens.brand.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="headset-outline" size={17} color={tokens.brand.default} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }}>
                      {ticket.subject}
                    </Text>
                    <Text numberOfLines={2} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 3, lineHeight: 17 }}>
                      {ticket.description || ticket.lastMessage || ""}
                    </Text>
                  </View>
                  <Badge
                    label={ticket.status || "OPEN"}
                    tone={ticket.status === "CLOSED" ? "neutral" : "success"}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border.default,
                  }}
                >
                  <Text style={{ fontSize: 11, color: tokens.text.muted }}>{ticket.category || "OTHER"}</Text>
                  <Text style={{ fontSize: 11, color: tokens.text.placeholder }}>
                    {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: tokens.overlay.scrimSoft }} activeOpacity={1} onPress={() => setOpen(false)} />
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: 28,
              maxHeight: "88%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border.strong }} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: "900", color: tokens.text.primary, marginBottom: 4 }}>
              New support ticket
            </Text>
            <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 14 }}>
              Tell us what happened and we'll follow up.
            </Text>

            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {TICKET_CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: active ? tokens.brand.default : tokens.bg.surfaceMuted,
                      borderWidth: 1,
                      borderColor: active ? tokens.brand.default : tokens.border.default,
                    }}
                  >
                    <Text style={{ color: active ? tokens.text.onBrand : tokens.text.primary, fontSize: 11.5, fontWeight: "600" }}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Short summary"
              placeholderTextColor={tokens.text.placeholder}
              style={[inputStyle(tokens), { marginBottom: 10 }]}
            />

            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="What can we help with?"
              multiline
              placeholderTextColor={tokens.text.placeholder}
              style={[inputStyle(tokens), { minHeight: 110, textAlignVertical: "top", marginBottom: 16 }]}
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <PrimaryButton label="Cancel" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <PrimaryButton
                label="Submit ticket"
                onPress={submit}
                disabled={!subject.trim() || !message.trim()}
                loading={busy}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
