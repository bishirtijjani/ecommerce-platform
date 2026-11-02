/**
 * FilterSheet - bottom sheet holding the "secondary" product facets (the ones
 * that don't fit inline). Controlled: the parent owns the filter state and
 * receives an updated copy on every change. `sections` lets each screen choose
 * which facets apply (e.g. no location/rating inside a single shop).
 *
 * Inline facets (price/condition) can be rendered by the screen itself via the
 * existing PriceFilterBar/ConditionFilterBar; pass sections={["location","rating"]}
 * there so the sheet doesn't duplicate them.
 */
import React from "react";
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { PRESET_RANGES } from "./PriceFilterBar";
import { CONDITION_OPTIONS } from "./ConditionFilterBar";
import { RATING_OPTIONS, RADIUS_OPTIONS, countActiveFilters, DEFAULT_FILTERS } from "../../lib/productFilters";
import { NIGERIA_STATES } from "../../data/nigeriaStatesLgas";

const LGAS_BY_STATE = Object.fromEntries(NIGERIA_STATES.map((s) => [s.name, s.lgas]));

function Chip({ label, active, onPress, tokens }) {
  return (
    <TouchableOpacity
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
}

function SectionTitle({ children, tokens }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: "900", color: tokens.text.primary, marginTop: 18, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

export default function FilterSheet({
  visible,
  onClose,
  value,
  onChange,
  sections = ["price", "condition", "rating", "state", "location"],
  location,
  onRequestLocation,
}) {
  const { tokens } = useTheme();
  const f = value || DEFAULT_FILTERS;
  const set = (patch) => onChange({ ...f, ...patch });
  const hasSections = sections && sections.length > 0;
  const activeCount = countActiveFilters(f);

  const handleNearMe = () => {
    const next = !f.nearMe;
    if (next && (location?.latitude == null || location?.longitude == null)) {
      onRequestLocation && onRequestLocation();
    }
    set({ nearMe: next });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: tokens.bg.surface,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                maxHeight: "82%",
                paddingHorizontal: 20,
                paddingTop: 14,
                paddingBottom: Platform.OS === "ios" ? 34 : 20,
              }}
            >
              <View style={{ alignItems: "center", marginBottom: 6 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border.default }} />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={{ fontSize: 17, fontWeight: "900", color: tokens.text.primary }}>Filters</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  {activeCount > 0 && (
                    <TouchableOpacity onPress={() => onChange({ ...DEFAULT_FILTERS })}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.brand.default }}>Clear all</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color={tokens.text.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                {sections.includes("price") && (
                  <>
                    <SectionTitle tokens={tokens}>Price</SectionTitle>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Chip
                        label="All prices"
                        active={f.priceIndex == null}
                        onPress={() => set({ priceIndex: null })}
                        tokens={tokens}
                      />
                      {PRESET_RANGES.map((r, i) => (
                        <Chip
                          key={r.label}
                          label={r.label}
                          active={f.priceIndex === i}
                          onPress={() => set({ priceIndex: f.priceIndex === i ? null : i })}
                          tokens={tokens}
                        />
                      ))}
                    </View>
                  </>
                )}

                {sections.includes("condition") && (
                  <>
                    <SectionTitle tokens={tokens}>Condition</SectionTitle>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Chip
                        label="Any"
                        active={!f.condition}
                        onPress={() => set({ condition: null })}
                        tokens={tokens}
                      />
                      {CONDITION_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          label={o.label}
                          active={f.condition === o.value}
                          onPress={() => set({ condition: f.condition === o.value ? null : o.value })}
                          tokens={tokens}
                        />
                      ))}
                    </View>
                  </>
                )}

                {sections.includes("rating") && (
                  <>
                    <SectionTitle tokens={tokens}>Rating</SectionTitle>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Chip
                        label="Any"
                        active={f.minRating == null}
                        onPress={() => set({ minRating: null })}
                        tokens={tokens}
                      />
                      {RATING_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          label={o.label}
                          active={f.minRating === o.value}
                          onPress={() => set({ minRating: f.minRating === o.value ? null : o.value })}
                          tokens={tokens}
                        />
                      ))}
                    </View>
                  </>
                )}

                {sections.includes("state") && (
                  <>
                    <SectionTitle tokens={tokens}>State</SectionTitle>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Chip
                        label="Any"
                        active={!f.state}
                        onPress={() => set({ state: null, lga: null })}
                        tokens={tokens}
                      />
                      {NIGERIA_STATES.map((s) => (
                        <Chip
                          key={s.name}
                          label={s.name}
                          active={f.state === s.name}
                          onPress={() => set({ state: f.state === s.name ? null : s.name, lga: null })}
                          tokens={tokens}
                        />
                      ))}
                    </View>

                    {f.state && (LGAS_BY_STATE[f.state] || []).length > 0 && (
                      <>
                        <SectionTitle tokens={tokens}>LGA</SectionTitle>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Chip
                            label="All LGAs"
                            active={!f.lga}
                            onPress={() => set({ lga: null })}
                            tokens={tokens}
                          />
                          {(LGAS_BY_STATE[f.state] || []).map((l) => (
                            <Chip
                              key={l}
                              label={l}
                              active={f.lga === l}
                              onPress={() => set({ lga: f.lga === l ? null : l })}
                              tokens={tokens}
                            />
                          ))}
                        </View>
                      </>
                    )}
                  </>
                )}

                {sections.includes("location") && (
                  <>
                    <SectionTitle tokens={tokens}>Location</SectionTitle>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <Chip
                        label={f.nearMe ? "Near me ✓" : "Near me"}
                        active={!!f.nearMe}
                        onPress={handleNearMe}
                        tokens={tokens}
                      />
                      {f.nearMe &&
                        RADIUS_OPTIONS.map((r) => (
                          <Chip
                            key={r}
                            label={`${r} km`}
                            active={f.radiusKm === r}
                            onPress={() => set({ radiusKm: r })}
                            tokens={tokens}
                          />
                        ))}
                    </View>
                    {f.nearMe && (location?.latitude == null || location?.longitude == null) && (
                      <Text style={{ fontSize: 11.5, color: tokens.text.muted, marginTop: 8 }}>
                        Set your location to filter by distance.
                      </Text>
                    )}
                  </>
                )}

                {!hasSections && (
                  <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 16 }}>
                    No additional filters for this view.
                  </Text>
                )}
              </ScrollView>

              <TouchableOpacity
                onPress={onClose}
                style={{
                  marginTop: 12,
                  backgroundColor: tokens.brand.default,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
                  {activeCount > 0 ? `Show results (${activeCount})` : "Show results"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
