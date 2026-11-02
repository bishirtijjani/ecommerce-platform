import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { conditionMeta } from "../product/conditionBadge";
import { withImageWidth } from "../../lib/imageUrl";

// Listing card used on Home/Marketplace rails. Reads `item.condition` and uses
// the shared conditionBadge helper so the pill matches ProductCard exactly in
// both light and dark mode.
export default function ListingCard({ item, isSaved, onToggleSave, onPress }) {
  const { tokens } = useTheme();
  const cond = conditionMeta(tokens);
  const condition =
    item.condition === "SECOND_HAND" ? "SECOND_HAND" : item.condition === "USED" ? "USED" : "NEW";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="w-40 mr-3 rounded-2xl overflow-hidden"
      style={{ backgroundColor: tokens.bg.surface, borderWidth: 1, borderColor: tokens.border.default }}
    >
      <View className="w-full h-32" style={{ backgroundColor: tokens.bg.surfaceMuted }}>
        <Image
          source={{ uri: withImageWidth(item.image, 400) }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
        {!!item.badge && item.badge.startsWith("-") && (
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: tokens.status.error,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontSize: 10, fontWeight: "700" }}>{item.badge}</Text>
          </View>
        )}
        {item.badge === "verified" && (
          <View
            className="absolute top-2 left-2 w-5 h-5 rounded-full items-center justify-center"
            style={{ backgroundColor: tokens.brand.default }}
          >
            <Ionicons name="checkmark" size={12} color={tokens.text.onBrand} />
          </View>
        )}
        <View
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            backgroundColor: cond.bg(condition),
            borderRadius: 999,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: cond.text(condition), fontSize: 9, fontWeight: "800", letterSpacing: 0.3 }}>
            {cond.label(condition)}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToggleSave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center"
          style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
        >
          <Ionicons
            name={isSaved ? "heart" : "heart-outline"}
            size={13}
            color={isSaved ? tokens.brand.default : tokens.text.primary}
          />
        </TouchableOpacity>
      </View>
      <View className="p-2.5">
        <Text className="font-bold text-[13px]" style={{ color: tokens.text.primary }} numberOfLines={1}>
          {item.title}
        </Text>
        <View className="flex-row items-center gap-1.5 mt-1">
          <Text className="font-black text-[14px]" style={{ color: tokens.brand.default }}>{item.price}</Text>
          {item.was ? (
            <Text className="text-[11px] line-through" style={{ color: tokens.text.muted }}>{item.was}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}