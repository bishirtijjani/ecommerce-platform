/**
 * ContactVendorSheet - the primary "buy" action across product/vendor
 * screens. This marketplace is chat-commerce, permanently: browse, then
 * negotiate and transact directly with the vendor by phone or chat - there
 * is no cart or checkout anywhere in the app.
 *
 * Three real paths in:
 *
 *  - Call: opens the device dialer via `tel:` - vendor.phone is a real
 *    required field on the backend.
 *  - Chat: starts (or reopens) the buyer<->vendor conversation via POST
 *    /chats, then jumps straight into ChatThreadScreen - see chatSlice.
 *  - Request a callback: posts the customer's name + phone (and the product,
 *    if opened from a product page) to the backend, which emails the vendor
 *    directly so they can call back. No order/cart involved.
 *
 * Patterned after ThemeSheet (plain Modal, not the gorhom bottom sheet -
 * lighter weight, no extra library wiring for two rows).
 */

import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import api from "../services/api";
import { startConversation } from "../store/slices/chatSlice";
import { useTheme } from "../theme";

export default function ContactVendorSheet({ visible, onClose, vendor, productId, productName, productImage }) {
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.profile.profile);
  const { isAuthenticated } = useSelector((s) => s.auth);

  const [callbackOpen, setCallbackOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  if (!vendor) return null;

  const resetAndClose = () => {
    setCallbackOpen(false);
    onClose();
  };

  const handleCall = () => {
    resetAndClose();
    Linking.openURL(`tel:${vendor.phone}`).catch(() => {});
  };

  const handleChat = async () => {
    if (openingChat) return;
    if (!isAuthenticated) {
      resetAndClose();
      navigation.navigate("Login");
      return;
    }
    setOpeningChat(true);
    try {
      const conversation = await dispatch(
        startConversation({
          vendorId: vendor.id,
          ...(productId ? { productId } : {}),
          ...(productName ? { productName } : {}),
          ...(productImage ? { productImage } : {}),
        }),
      ).unwrap();
      resetAndClose();
      navigation.navigate("ChatThread", { conversationId: conversation.id, vendor: conversation.vendor || vendor });
    } catch (err) {
      Toast.show({ type: "error", text1: "Couldn't open chat", text2: err?.message || "Please try again." });
    } finally {
      setOpeningChat(false);
    }
  };

  const openCallbackForm = () => {
    setName(profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : "");
    setPhone(profile?.phone || "");
    setCallbackOpen(true);
  };

  const submitCallbackRequest = async () => {
    if (submitting) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2) {
      Toast.show({ type: "error", text1: "Please enter your name" });
      return;
    }
    if (trimmedPhone.length < 10) {
      Toast.show({ type: "error", text1: "Please enter a valid phone number" });
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/vendors/${vendor.id}/callback-request`, {
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        ...(productId ? { productId } : {}),
      });
      Toast.show({ type: "success", text1: "Request sent", text2: `${vendor.name} will call you back soon.` });
      resetAndClose();
    } catch (err) {
      Toast.show({ type: "error", text1: "Couldn't send your request", text2: "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={[styles.backdrop, { backgroundColor: tokens.overlay.scrim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={resetAndClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { backgroundColor: tokens.bg.surface }]}>
          <View style={[styles.grabber, { backgroundColor: tokens.border.default }]} />

          {!callbackOpen ? (
            <>
              <Text style={[styles.title, { color: tokens.text.primary }]}>Contact {vendor.name}</Text>
              <Text style={[styles.subtitle, { color: tokens.text.muted }]}>
                Reach out directly - my sooq doesn't take a cut, you deal with the vendor one-on-one.
              </Text>

              <TouchableOpacity
                onPress={handleCall}
                activeOpacity={0.7}
                style={[styles.row, { borderColor: tokens.border.default }]}
                accessibilityRole="button"
                accessibilityLabel={`Call ${vendor.name}`}
              >
                <View style={[styles.iconCircle, { backgroundColor: tokens.brand.soft }]}>
                  <Ionicons name="call" size={19} color={tokens.brand.default} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Call vendor</Text>
                  <Text style={[styles.rowSub, { color: tokens.text.muted }]}>{vendor.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleChat}
                activeOpacity={0.7}
                disabled={openingChat}
                style={[styles.row, { borderColor: tokens.border.default, opacity: openingChat ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${vendor.name}`}
                accessibilityState={{ busy: openingChat }}
              >
                <View style={[styles.iconCircle, { backgroundColor: tokens.brand.soft }]}>
                  <Ionicons name="chatbubbles" size={19} color={tokens.brand.default} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Chat with vendor</Text>
                  <Text style={[styles.rowSub, { color: tokens.text.muted }]}>
                    {productName ? `Ask about "${productName}"` : "Negotiate price, ask questions"}
                  </Text>
                </View>
                {openingChat ? (
                  <ActivityIndicator size="small" color={tokens.brand.default} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={openCallbackForm}
                activeOpacity={0.7}
                style={[styles.row, { borderColor: tokens.border.default, marginBottom: 0 }]}
                accessibilityRole="button"
                accessibilityLabel={`Request a callback from ${vendor.name}`}
              >
                <View style={[styles.iconCircle, { backgroundColor: tokens.bg.surfaceMuted }]}>
                  <Ionicons name="call-outline" size={19} color={tokens.text.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Request a callback</Text>
                  <Text style={[styles.rowSub, { color: tokens.text.muted }]}>They call you instead</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
              </TouchableOpacity>

              <TouchableOpacity onPress={resetAndClose} style={styles.dismiss} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={[styles.dismissText, { color: tokens.text.muted }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.formHeaderRow}>
                <TouchableOpacity onPress={() => setCallbackOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: tokens.text.primary, marginLeft: 10 }]}>Request a callback</Text>
              </View>
              <Text style={[styles.subtitle, { color: tokens.text.muted }]}>
                {vendor.name} will call this number{productName ? ` about "${productName}"` : ""}.
              </Text>

              <Text style={[styles.fieldLabel, { color: tokens.text.primary }]}>Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={tokens.text.muted}
                maxLength={120}
                style={[styles.input, { borderColor: tokens.border.default, color: tokens.text.primary }]}
              />

              <Text style={[styles.fieldLabel, { color: tokens.text.primary }]}>Phone number</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="08012345678"
                placeholderTextColor={tokens.text.muted}
                keyboardType="phone-pad"
                maxLength={20}
                style={[styles.input, { borderColor: tokens.border.default, color: tokens.text.primary, marginBottom: 20 }]}
              />

              <TouchableOpacity
                onPress={submitCallbackRequest}
                disabled={submitting}
                activeOpacity={0.8}
                style={[styles.submitBtn, { backgroundColor: tokens.brand.default, opacity: submitting ? 0.7 : 1 }]}
              >
                {submitting ? (
                  <ActivityIndicator color={tokens.text.onBrand} />
                ) : (
                  <Text style={[styles.submitBtnText, { color: tokens.text.onBrand }]}>Send request</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 18 },
  title: { fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 18, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  iconCircle: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 12, marginTop: 1 },
  dismiss: { marginTop: 8, paddingVertical: 12, alignItems: "center" },
  dismissText: { fontSize: 14, fontWeight: "700" },
  formHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 16 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  submitBtnText: { fontSize: 14, fontWeight: "800" },
});
