import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../theme";

// Brand identity shown atop the auth screens (login / register).
export default function AuthBrandMark({ style }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", marginBottom: 28 },
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="MySooq"
    >
      <Image
        source={require("../../assets/brand-logo.png")}
        style={{ width: 44, height: 44, marginRight: 10 }}
        contentFit="contain"
      />
      <Text
        style={{
          fontSize: 22,
          fontWeight: "900",
          color: tokens.text.primary,
          letterSpacing: -0.5,
        }}
      >
        MySooq
      </Text>
    </View>
  );
}
