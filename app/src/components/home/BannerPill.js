import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme";

export default function BannerPill({ banner, onPress }) {
  const { tokens } = useTheme();
  // See BannerCard: the scrim tracks bg.surface so it works in both modes.
  const scrim = tokens.bg.surface;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="rounded-2xl overflow-hidden"
      style={{ width: "100%", height: 58 }}
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
      <View className="flex-row items-center flex-1 px-2.5">
        <View
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: tokens.bg.surface }}
        >
          <Text style={{ fontSize: 16 }}>{banner.badge}</Text>
        </View>
        <View className="flex-1 mx-2.5">
          <Text
            className="font-black text-[13px]"
            style={{ color: tokens.text.primary }}
            numberOfLines={1}
          >
            {banner.title}
          </Text>
          <Text
            className="text-[10px]"
            style={{ color: tokens.text.muted, lineHeight: 13 }}
            numberOfLines={1}
          >
            {banner.subtitle}
          </Text>
        </View>
        <View
          className="flex-row items-center rounded-full pl-3 pr-2 py-1.5"
          style={{ backgroundColor: banner.accent, gap: 4 }}
        >
          <Text className="text-white font-bold text-[10px]">{banner.cta}</Text>
          <Ionicons name="arrow-forward" size={11} color={tokens.text.onBrand} />
        </View>
      </View>
    </TouchableOpacity>
  );
}