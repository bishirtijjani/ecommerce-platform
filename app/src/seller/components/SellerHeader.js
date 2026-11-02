import React, { useState } from "react";
import { View, Text, TouchableOpacity, Switch, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { useVendorProfile, useToggleShopStatus } from "../hooks/useSeller";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import { logout } from "../../store/slices/authSlice";
import { useNavigation } from "@react-navigation/native";

export default function SellerHeader({ navigation, route, options }) {
  const { tokens, mode, setMode } = useTheme();
  const { data: vendor } = useVendorProfile();
  const toggle = useToggleShopStatus();
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const title = options?.title || route?.name || "Seller";

  return (
    <View style={{ paddingTop: insets.top, height: 56 + insets.top, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: tokens.border.default, backgroundColor: tokens.bg.surface }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "column", alignItems: "center", marginRight: 12, paddingVertical: 4 }}>
        <Ionicons name="home" size={16} color={tokens.text.primary} />
        <Ionicons name="arrow-back" size={14} color={tokens.text.primary} style={{ marginTop: 2 }} />
      </TouchableOpacity>
      <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: tokens.text.primary }} numberOfLines={1}>{title}</Text>

      {vendor && vendor.status === "APPROVED" ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginRight: 10, backgroundColor: tokens.bg.canvas, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: tokens.border.default }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: vendor.isOpen ? tokens.status.success : tokens.text.placeholder, marginRight: 6 }} />
          <Text style={{ color: tokens.text.primary, fontSize: 12, fontWeight: "600", marginRight: 6 }}>{vendor.isOpen ? "Open" : "Closed"}</Text>
          <Switch value={!!vendor.isOpen} onValueChange={(v) => toggle.mutate(v)} trackColor={{ true: tokens.brand.default }} style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }} />
        </View>
      ) : null}

      <TouchableOpacity onPress={() => navigation.navigate("SellerSupport")} style={{ flexDirection: "column", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, marginRight: 4 }}>
        <View>
          <Ionicons name="headset-outline" size={20} color={tokens.text.primary} />
          <View style={{ position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.status.error, borderWidth: 1.5, borderColor: tokens.bg.canvas }} />
        </View>
        <Text style={{ fontSize: 10, color: tokens.text.primary, marginTop: 2, fontWeight: "600" }}>Support</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ flexDirection: "column", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 }}>
        <Ionicons name="person-circle-outline" size={22} color={tokens.text.primary} />
        <Text style={{ fontSize: 10, color: tokens.text.primary, marginTop: 2, fontWeight: "600" }}>Account</Text>
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={{ position: "absolute", top: 60 + insets.top, right: 12, backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 8, minWidth: 200, borderWidth: 1, borderColor: tokens.border.default }}>
            <TouchableOpacity onPress={() => { setMenuOpen(false); navigation.navigate("SellerSettings"); }} style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
              <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMenuOpen(false); navigation.navigate("SellerShopProfile"); }} style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
              <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>Shop profile</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 }}>
              {["light", "dark", "system"].map((m) => (
                <TouchableOpacity key={m} onPress={() => setMode(m)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: mode === m ? tokens.brand.default : tokens.bg.surfaceMuted }}>
                  <Text style={{ color: mode === m ? tokens.text.onBrand : tokens.text.primary, fontSize: 11, fontWeight: "600" }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => { setMenuOpen(false); dispatch(logout()); }} style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
              <Text style={{ color: tokens.status.error, fontWeight: "600" }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}