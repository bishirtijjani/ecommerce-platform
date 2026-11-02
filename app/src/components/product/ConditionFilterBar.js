/**
 * ConditionFilterBar - horizontal chip row for filtering product listings by
 * condition (New / Used). Mirrors PriceFilterBar's contract: `onSelect`
 * receives "NEW" / "USED", or null for "All". Filtering is client-side in the
 * consumer, matching search/sort/price.
 */
import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme";

export const CONDITION_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "USED", label: "Used" },
];

export const matchesCondition = (product, value) =>
  !value || (product?.condition || "NEW") === value;

export default function ConditionFilterBar({ value, onSelect, style }) {
  const { tokens } = useTheme();
  const chip = (label, active, onPress, key) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? tokens.brand.default : tokens.border.default,
        backgroundColor: active ? tokens.brand.soft : tokens.bg.surfaceMuted,
      }}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: active ? "800" : "600",
          color: active ? tokens.brand.default : tokens.text.primary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4, alignItems: "center" }}
      // flexGrow:0 is required on web: react-native-web's ScrollView defaults to
      // flex-grow:1, so a horizontal bar placed directly in a bounded column
      // (e.g. the category screen) stretches to fill the leftover height and
      // starves the content below it - which also traps the scroll wheel.
      style={[{ flexGrow: 0, flexShrink: 0 }, style]}
    >
      {chip("All", !value, () => onSelect(null), "all")}
      {CONDITION_OPTIONS.map((opt) =>
        chip(opt.label, value === opt.value, () => onSelect(value === opt.value ? null : opt.value), opt.value)
      )}
    </ScrollView>
  );
}
