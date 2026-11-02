import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Switch } from "react-native";
import { useTheme } from "../../theme";

export const emptyGroup = () => ({ key: `g-${Date.now()}`, name: "", selectionRule: "OPTIONAL_ONE", maxSelect: 1, items: [] });
const emptyItem = () => ({ key: `i-${Date.now()}`, name: "", priceDelta: "0", isDefault: false, isAvailable: true });

const ruleDefaults = (rule) => {
  switch (rule) {
    case "REQUIRED_ONE": return { minSelect: 1, maxSelect: 1 };
    case "OPTIONAL_ONE": return { minSelect: 0, maxSelect: 1 };
    case "REQUIRED_MULTIPLE": return { minSelect: 1, maxSelect: 2 };
    default: return { minSelect: 0, maxSelect: 2 };
  }
};

export const buildOptionGroupsPayload = (groups) =>
  (groups || [])
    .filter((g) => g.name.trim())
    .map((g) => ({
      ...(g.id && { id: g.id }),
      name: g.name.trim(),
      selectionRule: g.selectionRule,
      minSelect: ruleDefaults(g.selectionRule).minSelect,
      maxSelect: g.selectionRule.includes("MULTIPLE") ? g.maxSelect : ruleDefaults(g.selectionRule).maxSelect,
      items: (g.items || [])
        .filter((i) => i.name.trim())
        .map((i) => ({
          ...(i.id && { id: i.id }),
          name: i.name.trim(),
          priceDelta: Number(i.priceDelta) || 0,
          isDefault: i.isDefault,
          isAvailable: i.isAvailable,
        })),
    }));

export default function OptionGroupsEditor({ groups, onChange }) {
  const { tokens } = useTheme();
  const updateGroup = (key, patch) => onChange(groups.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const removeGroup = (key) => onChange(groups.filter((g) => g.key !== key));
  const addItem = (key) => onChange(groups.map((g) => (g.key === key ? { ...g, items: [...g.items, emptyItem()] } : g)));
  const updateItem = (gKey, iKey, patch) =>
    onChange(groups.map((g) => (g.key === gKey ? { ...g, items: g.items.map((i) => (i.key === iKey ? { ...i, ...patch } : i)) } : g)));
  const removeItem = (gKey, iKey) =>
    onChange(groups.map((g) => (g.key === gKey ? { ...g, items: g.items.filter((i) => i.key !== iKey) } : g)));

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 12, color: tokens.text.muted }}>Option groups (toppings, sizes, extras)</Text>
      {groups.map((g) => (
        <View key={g.key} style={{ borderWidth: 1, borderColor: tokens.border.default, borderRadius: 12, padding: 10 }}>
          <TextInput
            value={g.name}
            onChangeText={(t) => updateGroup(g.key, { name: t })}
            placeholder="Group name"
            placeholderTextColor={tokens.text.placeholder}
            style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, marginBottom: 8 }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => updateGroup(g.key, { selectionRule: "OPTIONAL_ONE", maxSelect: 1 })}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: g.selectionRule === "OPTIONAL_ONE" ? tokens.brand.default : tokens.bg.surfaceMuted }}
            >
              <Text style={{ color: g.selectionRule === "OPTIONAL_ONE" ? tokens.text.onBrand : tokens.text.primary, fontSize: 11, fontWeight: "700" }}>Optional one</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateGroup(g.key, { selectionRule: "REQUIRED_ONE", maxSelect: 1 })}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: g.selectionRule === "REQUIRED_ONE" ? tokens.brand.default : tokens.bg.surfaceMuted }}
            >
              <Text style={{ color: g.selectionRule === "REQUIRED_ONE" ? tokens.text.onBrand : tokens.text.primary, fontSize: 11, fontWeight: "700" }}>Required one</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateGroup(g.key, { selectionRule: "OPTIONAL_MULTIPLE", maxSelect: g.maxSelect || 2 })}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: g.selectionRule.includes("MULTIPLE") ? tokens.brand.default : tokens.bg.surfaceMuted }}
            >
              <Text style={{ color: g.selectionRule.includes("MULTIPLE") ? tokens.text.onBrand : tokens.text.primary, fontSize: 11, fontWeight: "700" }}>Multiple</Text>
            </TouchableOpacity>
          </View>
          {g.selectionRule.includes("MULTIPLE") ? (
            <TextInput
              value={String(g.maxSelect)}
              onChangeText={(t) => updateGroup(g.key, { maxSelect: Number(t) || 1 })}
              placeholder="Max picks"
              keyboardType="numeric"
              placeholderTextColor={tokens.text.placeholder}
              style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, marginBottom: 8 }}
            />
          ) : null}
          {g.items.map((item) => (
            <View key={item.key} style={{ flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <TextInput
                value={item.name}
                onChangeText={(t) => updateItem(g.key, item.key, { name: t })}
                placeholder="Option name"
                placeholderTextColor={tokens.text.placeholder}
                style={{ flex: 2, backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }}
              />
              <TextInput
                value={String(item.priceDelta)}
                onChangeText={(t) => updateItem(g.key, item.key, { priceDelta: t })}
                placeholder="Price delta"
                keyboardType="numeric"
                placeholderTextColor={tokens.text.placeholder}
                style={{ flex: 1, backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }}
              />
              <Switch value={item.isAvailable} onValueChange={(v) => updateItem(g.key, item.key, { isAvailable: v })} trackColor={{ true: tokens.brand.default }} />
              <TouchableOpacity onPress={() => removeItem(g.key, item.key)}>
                <Text style={{ color: tokens.status.error, fontWeight: "700" }}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => addItem(g.key)} style={{ backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 8, borderRadius: 8, alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: tokens.text.primary, fontWeight: "600", fontSize: 12 }}>+ Add option</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeGroup(g.key)}>
            <Text style={{ color: tokens.status.error, fontWeight: "600", fontSize: 12 }}>Remove group</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={() => onChange([...groups, emptyGroup()])} style={{ backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 10, borderRadius: 10, alignItems: "center" }}>
        <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>+ Add option group</Text>
      </TouchableOpacity>
    </View>
  );
}