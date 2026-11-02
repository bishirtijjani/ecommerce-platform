import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

export default function RatingLine({ rating, reviewsCount, sold, size = 13 }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
      <Ionicons name="star" size={size} color="#F5A623" />
      <Text style={{ fontSize: size, fontWeight: "800", color: tokens.text.primary, marginLeft: 4 }}>
        {rating}
      </Text>
      {reviewsCount != null && (
        <Text style={{ fontSize: size - 1, color: tokens.text.muted, marginLeft: 4 }}>
          ({reviewsCount} reviews)
        </Text>
      )}
      {sold != null && (
        <>
          <Text style={{ fontSize: size - 1, color: tokens.text.muted, marginHorizontal: 6 }}>|</Text>
          <Text style={{ fontSize: size - 1, color: tokens.text.muted }}>{sold}+ sold</Text>
        </>
      )}
    </View>
  );
}
