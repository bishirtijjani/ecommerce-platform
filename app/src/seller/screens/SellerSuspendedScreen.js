import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";

export default function SellerSuspendedScreen() {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.canvas, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>Shop suspended</Text>
      <Text style={{ color: tokens.text.muted, textAlign: "center" }}>Contact support to restore your shop.</Text>
    </View>
  );
}