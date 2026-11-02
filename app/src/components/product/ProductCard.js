/**
 * ProductCard - grid card used on the vendor storefront's Shop tab (and
 * "You may also like"). Whole card is the tap target to ProductDetail; the
 * heart toggles the wishlist without navigating (see savedItemsSlice).
 *
 * Supports two layouts:
 *  - variant="grid"  (default): vertical square card, used in multi-column grids.
 *  - variant="landscape": horizontal card, image on the left and info on the
 *    right, used for the marketplace list view.
 */
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { conditionMeta } from "./conditionBadge";
import { withImageWidth } from "../../lib/imageUrl";

export default function ProductCard({ product, isSaved, onToggleSave, onPress, width, variant = "grid" }) {
  const { tokens } = useTheme();
  const isLandscape = variant === "landscape";
  const cond = conditionMeta(tokens);

  // In the grid layout the image is a full-width banner at the top of the
  // card, so it must be 100% of the card - not the card's `width` prop (which
  // is often a percentage like "47%", and would wrongly size the image to
  // 47% of the card and leave it stranded in the corner). Only the landscape
  // (list) layout derives an image width from the card width, and only when
  // that width is a concrete pixel number.
  const imageWidth = useMemo(() => {
    if (!isLandscape) return "100%";
    if (typeof width !== "number") return 120;
    return Math.min(Math.max(Math.round(width * 0.35), 100), 140);
  }, [isLandscape, width]);

  const imageBlock = (
    <View style={{ width: imageWidth, aspectRatio: 1, backgroundColor: tokens.bg.surfaceMuted }}>
      <Image
        source={{ uri: withImageWidth(product.images[0], 400) }}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
      />
      {product.discountPercent ? (
        <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: tokens.status.error, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>-{product.discountPercent}%</Text>
        </View>
      ) : null}
      <View style={{ position: "absolute", bottom: 8, left: 8, backgroundColor: cond.bg(product.condition), borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
        <Text style={{ color: cond.text(product.condition), fontSize: 9, fontWeight: "800", letterSpacing: 0.3 }}>{cond.label(product.condition)}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggleSave}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: "rgba(255,255,255,0.92)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={isSaved ? "heart" : "heart-outline"} size={14} color={isSaved ? tokens.brand.default : "#201A16"} />
      </TouchableOpacity>
    </View>
  );

  const infoBlock = (
    <View style={{ flex: 1, padding: 10, justifyContent: "center" }}>
      <Text style={{ fontSize: 12, lineHeight: 15, fontWeight: "700", color: tokens.text.primary }} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: "900", color: tokens.brand.default, marginTop: 4 }}>
        {formatNaira(product.price)}
      </Text>
    </View>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        width,
        backgroundColor: tokens.bg.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.border.default,
        overflow: "hidden",
        flexDirection: isLandscape ? "row" : "column",
      }}
    >
      {imageBlock}
      {infoBlock}
    </TouchableOpacity>
  );
}
