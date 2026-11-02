import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";

export default function StatCard({ label, value, tone = "brand" }) {
  const { tokens } = useTheme();
  const color = tone === "success" ? tokens.status.success : tone === "info" ? tokens.status.info : tokens.brand.default;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: tokens.border.default }}>
      <Text style={{ color: tokens.text.muted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color, fontSize: 20, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}