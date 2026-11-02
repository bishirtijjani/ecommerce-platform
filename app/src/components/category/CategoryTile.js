/**
 * CategoryTile - media-led category card used by the Home grid (and available
 * to the browse rail). Shows the category's cover image when it has one, else
 * a tinted disc with the category initial, over the category name. No supply
 * hint / item count - the tile is intentionally compact with small text.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../../theme";
import { withImageWidth } from "../../lib/imageUrl";

export default function CategoryTile({ category, onPress, width, compact = false }) {
  const { tokens } = useTheme();
  if (!category) return null;

  const initial = (category.label || "?").trim().charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.label}
      style={{
        width,
        borderRadius: 16,
        backgroundColor: tokens.bg.surfaceMuted,
        borderWidth: 1,
        borderColor: tokens.border.default,
        overflow: "hidden",
        minHeight: compact ? 92 : 100,
      }}
    >
      <View
        style={{
          // A square media box keeps the image's box in step with the tile's
          // own (percentage) width. A fixed pixel height here made the box
          // wider-than-tall on larger screens, so `contain` shrank the image
          // into a tiny strip with big empty margins.
          width: "100%",
          aspectRatio: 1,
          backgroundColor: category.image ? "transparent" : category.tint || tokens.bg.surfaceStrong,
          alignItems: "center",
          justifyContent: "center",
          padding: category.image ? (compact ? 8 : 10) : 0,
        }}
      >
        {category.image ? (
          <Image
            source={{ uri: withImageWidth(category.image, 300) }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
        ) : (
          <Text style={{ fontSize: compact ? 18 : 20, fontWeight: "900", color: category.accent || tokens.brand.default }}>
            {initial}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 6, paddingTop: 6, paddingBottom: 8 }}>
        <Text
          numberOfLines={2}
          style={{ fontSize: 10, lineHeight: 13, fontWeight: "800", letterSpacing: 0.2, color: tokens.text.primary, textAlign: "center" }}
        >
          {category.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
