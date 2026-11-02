import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { withImageWidth } from "../../lib/imageUrl";

export default function ShopCard({ shop, onPress }) {
  const { tokens } = useTheme();
  const comingSoon = !!shop.comingSoon;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={comingSoon ? undefined : onPress}
      style={{
        width: "22%",
        backgroundColor: comingSoon ? tokens.bg.surfaceMuted : tokens.bg.surface,
        borderRadius: 12,
        borderWidth: comingSoon ? 1.5 : 1,
        borderStyle: comingSoon ? "dashed" : "solid",
        borderColor: comingSoon ? tokens.border.strong : tokens.border.default,
        alignItems: "center",
        paddingTop: 10,
        paddingBottom: 8,
        paddingHorizontal: 6,
      }}
    >
      <View
        className="w-12 h-12 rounded-lg items-center justify-center overflow-hidden p-1"
        style={{ backgroundColor: comingSoon ? tokens.bg.surfaceStrong : tokens.bg.surfaceMuted }}
      >
        {comingSoon ? (
          <Ionicons name="hourglass-outline" size={20} color={tokens.text.placeholder} />
        ) : shop.logo ? (
          <Image
            source={{ uri: withImageWidth(shop.logo.uri, 200) }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
        ) : (
          <Text className="font-black text-[16px]" style={{ color: tokens.brand.default }}>
            {(shop.name || "?").charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <Text
        className="text-center w-full mt-1.5 text-[10px]"
        style={{
          color: comingSoon ? tokens.text.placeholder : tokens.text.primary,
          fontWeight: comingSoon ? "500" : "700",
        }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {comingSoon ? "Coming soon" : shop.name}
      </Text>
    </TouchableOpacity>
  );
}