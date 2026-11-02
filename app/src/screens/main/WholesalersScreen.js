/**
 * WholesalersScreen - contact admin page for bulk/wholesale orders.
 * Shows a hero banner with admin phone and WhatsApp contact info.
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";

import { WHOLESALER_CONTACT } from "../../components/home/homeData";
import { useTheme } from "../../theme";
import { useIsDesktop } from "../../lib/responsive";

const BANNER_IMG = require("../../../assets/banners/warehouse.jpeg");

export default function WholesalersScreen({ navigation }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tokens.bg.surface, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>Wholesalers</Text>
      </View>

      {/* Hero Banner with Contact */}
      <View style={{ marginHorizontal: 16, marginTop: 20, borderRadius: 16, overflow: "hidden", height: isDesktop ? 200 : 180 }}>
        <Image source={BANNER_IMG} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.15)"]} style={{ position: "absolute", width: "100%", height: "100%" }} />

        {/* Heading — same style as the other market banners. */}
        <View style={{ position: "absolute", top: 16, left: 16, right: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#FFF" }}>Wholesalers</Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 16, marginTop: 4 }}>
            {WHOLESALER_CONTACT.tagline}
          </Text>
        </View>

        {/* Action button - in-app chat with the admin/team, anchored to the
            bottom within the banner. */}
        <TouchableOpacity
          onPress={() => navigation.navigate("SupportChat")}
          accessibilityRole="button"
          accessibilityLabel={t("support.chat.title")}
          style={{ position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: tokens.brand.default, borderRadius: 12, paddingVertical: 14 }}
        >
          <Ionicons name="chatbubbles" size={18} color="#FFF" />
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{t("support.chat.title")}</Text>
        </TouchableOpacity>
      </View>

      {/* Info section */}
      <View style={{ marginHorizontal: 16, marginTop: 24, backgroundColor: tokens.bg.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: tokens.border.default }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary, marginBottom: 10 }}>Why wholesale with us?</Text>
        {[
          "Competitive bulk pricing",
          "Verified and trusted suppliers",
          "Direct from manufacturers",
          "Quality guaranteed",
          "Fast nationwide shipping",
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.brand.default }} />
            <Text style={{ fontSize: 13, color: tokens.text.muted }}>{item}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
