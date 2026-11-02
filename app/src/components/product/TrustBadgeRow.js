/**
 * TrustBadgeRow - the row of 4 reassurance icons under a cover/hero image
 * (product detail and vendor storefront both use it, different copy). Wraps
 * to 2x2 on narrow widths instead of squeezing 4 across.
 */
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

export default function TrustBadgeRow({ items, wrapWidth = "48%" }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        backgroundColor: tokens.bg.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.border.default,
        padding: 14,
        gap: 12,
      }}
    >
      {items.map((item, i) => (
        <View key={i} style={{ width: wrapWidth, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Ionicons name={item.icon} size={17} color={tokens.brand.default} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={{ fontSize: 10.5, color: tokens.text.muted, marginTop: 1 }} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
