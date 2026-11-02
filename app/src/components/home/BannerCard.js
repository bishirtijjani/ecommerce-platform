import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme";

export default function BannerCard({ banner, onPress }) {
  const { tokens } = useTheme();
  // Scrim follows the active surface color so the overlay stays legible (and
  // doesn't glow white) in dark mode. bg.surface is a 6-digit hex in both
  // palettes, so appending an alpha suffix is safe.
  const scrim = tokens.bg.surface;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="rounded-2xl overflow-hidden"
      style={{ flex: 1 }}
      onPress={onPress}
    >
      <Image
        source={banner.image}
        style={{ position: "absolute", width: "100%", height: "100%" }}
        contentFit="cover"
      />
      <LinearGradient
        colors={[`${scrim}CC`, `${scrim}CC`, `${scrim}00`]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />
      <View className="px-2.5 py-2.5">
        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{ backgroundColor: tokens.bg.surface }}
        >
          <Text style={{ fontSize: 12 }}>{banner.badge}</Text>
        </View>
        <View className="mt-2">
          <Text
            className="font-black text-[13px] leading-tight"
            style={{ color: tokens.text.primary }}
            numberOfLines={2}
          >
            {banner.title}
          </Text>
          <Text
            className="text-[9px] mt-1"
            style={{ color: tokens.text.muted, lineHeight: 12 }}
            numberOfLines={2}
          >
            {banner.subtitle}
          </Text>
          <View
            className="flex-row items-center self-start rounded-full pl-2.5 pr-1.5 py-1 mt-2.5"
            style={{ backgroundColor: banner.accent, gap: 3 }}
          >
            <Text className="text-white font-bold text-[9px]">{banner.cta}</Text>
            <Ionicons name="arrow-forward" size={10} color={tokens.text.onBrand} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}