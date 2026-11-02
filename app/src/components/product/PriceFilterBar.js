/**
 * PriceFilterBar - horizontal row of preset price-range chips used by the
 * product browse screens (SubcategoryScreen, VendorCategoryProductsScreen).
 *
 * `onSelect` receives the index into PRESET_RANGES (or null when "All" is
 * tapped). Each preset carries {min, max} where max === Infinity means "and
 * up". Filtering happens client-side in the consumer, mirroring search/sort.
 */
import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme";

export const PRESET_RANGES = [
  { min: 0, max: 5000, label: "₦0 – 5k" },
  { min: 5000, max: 20000, label: "₦5k – 20k" },
  { min: 20000, max: 50000, label: "₦20k – 50k" },
  { min: 50000, max: 100000, label: "₦50k – 100k" },
  { min: 100000, max: Infinity, label: "₦100k+" },
];

export const priceInRange = (price, index) => {
  if (!PRESET_RANGES[index]) return true;
  const { min, max } = PRESET_RANGES[index];
  return price >= min && (max === Infinity || price < max);
};

export default function PriceFilterBar({ activeIndex, onSelect, style }) {
  const { tokens } = useTheme();
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
      <TouchableOpacity
        onPress={() => onSelect(null)}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: activeIndex === null ? tokens.brand.default : tokens.border.default,
          backgroundColor: activeIndex === null ? tokens.brand.soft : tokens.bg.surfaceMuted,
        }}
      >
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: activeIndex === null ? "800" : "600",
            color: activeIndex === null ? tokens.brand.default : tokens.text.primary,
          }}
        >
          All prices
        </Text>
      </TouchableOpacity>
      {PRESET_RANGES.map((range, i) => {
        const active = activeIndex === i;
        return (
          <TouchableOpacity
            key={range.label}
            onPress={() => onSelect(active ? null : i)}
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
              {range.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
