/**
 * SortMenu - bottom sheet listing the product sort options. Separate from the
 * filters (single-choice view preference vs multi-select narrowing) but opened
 * from the same RefineBar. Controlled: the parent owns the selected key.
 */
import React from "react";
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

export default function SortMenu({ visible, onClose, options, value, onSelect, title = "Sort by" }) {
  const { tokens } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: tokens.bg.surface,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                paddingHorizontal: 20,
                paddingTop: 14,
                paddingBottom: Platform.OS === "ios" ? 34 : 20,
              }}
            >
              <View style={{ alignItems: "center", marginBottom: 10 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border.default }} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.text.primary, marginBottom: 8 }}>
                {title}
              </Text>
              {options.map((opt) => {
                const active = opt.key === value;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      onSelect(opt.key);
                      onClose();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 13,
                      borderBottomWidth: 1,
                      borderBottomColor: tokens.border.subtle,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14.5,
                        fontWeight: active ? "800" : "600",
                        color: active ? tokens.brand.default : tokens.text.primary,
                      }}
                    >
                      {opt.label}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={19} color={tokens.brand.default} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
