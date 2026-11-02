import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme";

export default function SellerPendingScreen({ navigation }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.canvas, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>Pending review</Text>
      <Text style={{ color: tokens.text.muted, textAlign: "center", marginBottom: 16 }}>Your shop is under review. You can keep setting up your catalogue.</Text>
      <TouchableOpacity onPress={() => navigation.replace("SellerTabs")} style={{ backgroundColor: tokens.brand.default, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>Continue to dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}