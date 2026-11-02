/**
 * RefineBar - the shared "refine" row shown at the top of every product browse
 * surface: [ Filters (n) ]  [ Sort: <label> ▾ ]. Owns the filter sheet and the
 * sort menu (opens/closes them) so screens only pass state + setters.
 *
 * Filters and sort are deliberately separate controls (multi-select narrowing
 * vs a single-choice view preference) but live together here.
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import FilterSheet from "./FilterSheet";
import SortMenu from "./SortMenu";
import { SORTS, countActiveFilters, sortLabel as sortLabelFor } from "../../lib/productFilters";

export default function RefineBar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  sections = ["location", "rating"],
  sortOptions = SORTS,
  location,
  onRequestLocation,
  style,
}) {
  const { tokens } = useTheme();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const activeCount = countActiveFilters(filters);
  const showFilters = sections && sections.length > 0;

  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
      {showFilters && (
        <TouchableOpacity
          onPress={() => setFiltersOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            height: 38,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: activeCount > 0 ? tokens.brand.default : tokens.border.default,
            backgroundColor: activeCount > 0 ? tokens.brand.soft : tokens.bg.surface,
          }}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={activeCount > 0 ? tokens.brand.default : tokens.text.primary}
          />
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: activeCount > 0 ? "800" : "600",
              color: activeCount > 0 ? tokens.brand.default : tokens.text.primary,
            }}
          >
            {activeCount > 0 ? `Filters (${activeCount})` : "Filters"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => setSortOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          height: 38,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: tokens.border.default,
          backgroundColor: tokens.bg.surface,
        }}
      >
        <Text style={{ fontSize: 12.5, color: tokens.text.muted }}>Sort:</Text>
        <Text style={{ fontSize: 12.5, fontWeight: "800", color: tokens.text.primary }}>
          {sortLabelFor(sort, sortOptions)}
        </Text>
        <Ionicons name="chevron-down" size={13} color={tokens.text.muted} />
      </TouchableOpacity>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onChange={onFiltersChange}
        sections={sections}
        location={location}
        onRequestLocation={onRequestLocation}
      />

      <SortMenu
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        options={sortOptions}
        value={sort}
        onSelect={onSortChange}
      />
    </View>
  );
}
