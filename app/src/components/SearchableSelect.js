/**
 * SearchableSelect - a tap-to-open, type-to-filter single-select field.
 *
 * Built for the State / LGA pickers (774 LGAs is too many for a plain list).
 * The field shows the current value (or a placeholder); tapping opens a modal
 * with a search box and a filtered list. Controlled: the parent owns `value`.
 */
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

export default function SearchableSelect({
  label,
  value,
  onSelect,
  options = [],
  placeholder = "Select...",
  disabled = false,
  error,
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        accessibilityState={{ disabled }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: error ? tokens.status.error : tokens.border.default,
          backgroundColor: disabled ? tokens.bg.surfaceMuted : tokens.bg.surface,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 14,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 14,
            color: value ? tokens.text.primary : tokens.text.placeholder,
          }}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={tokens.text.muted} />
      </TouchableOpacity>

      {error ? (
        <Text style={{ fontSize: 12, color: tokens.status.error, marginTop: 4 }}>{error}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              maxHeight: "80%",
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: 20,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border.default }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.text.primary }}>
                {label || placeholder}
              </Text>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tokens.text.primary} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: tokens.bg.surfaceMuted,
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 44,
                marginBottom: 8,
              }}
            >
              <Ionicons name="search" size={16} color={tokens.text.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search..."
                placeholderTextColor={tokens.text.placeholder}
                autoFocus
                style={{ flex: 1, fontSize: 14, color: tokens.text.primary, outlineStyle: "none" }}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ fontSize: 13, color: tokens.text.muted, paddingVertical: 16, textAlign: "center" }}>
                  No matches
                </Text>
              }
              renderItem={({ item }) => {
                const active = item === value;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSelect(item);
                      close();
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
                      {item}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={19} color={tokens.brand.default} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
