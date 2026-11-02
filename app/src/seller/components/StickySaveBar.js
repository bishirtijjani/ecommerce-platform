import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "../../theme";
import { PrimaryButton } from "./ui";

export default function StickySaveBar({ dirty, saving, saveLabel = "Save", onSave, onCancel }) {
  const { tokens } = useTheme();
  if (!dirty) return null;
  return (
    <View
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: tokens.bg.surface,
        borderTopWidth: 1,
        borderTopColor: tokens.border.default,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        gap: 8,
      }}
    >
      <TouchableOpacity
        onPress={onCancel}
        style={{
          flex: 1,
          height: 46,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.border.default,
          backgroundColor: tokens.bg.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>Cancel</Text>
      </TouchableOpacity>
      <View style={{ flex: 2 }}>
        <PrimaryButton label={saveLabel} onPress={onSave} loading={saving} disabled={saving} />
      </View>
    </View>
  );
}