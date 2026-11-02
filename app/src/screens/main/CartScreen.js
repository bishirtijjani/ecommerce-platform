/**
 * CartScreen - saved/interested listings.
 *
 * Doubles as "Cart" and "Saved" by design: this marketplace is chat-commerce
 * (see ContactVendorSheet), not payment/delivery-based, so there's nothing to
 * check out here - "adding to cart" just means "save it, then contact the
 * vendor." Backed by `savedItemsSlice`, populated from the heart toggle on
 * listing cards.
 */

import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { removeSaved } from "../../store/slices/savedItemsSlice";
import EmptyState from "../../components/EmptyState";
import { useTheme } from "../../theme";

export default function CartScreen() {
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const items = useSelector((s) => s.savedItems.items);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>Cart</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="Nothing saved yet"
            subtitle="Tap the heart on a listing to save it here."
          />
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: tokens.bg.surface,
              borderRadius: 14,
              padding: 10,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: tokens.border.default,
            }}
          >
            <Image
              source={{ uri: item.image }}
              style={{ width: 56, height: 56, borderRadius: 10 }}
              contentFit="cover"
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontWeight: "700", color: tokens.text.primary, fontSize: 14 }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ color: tokens.brand.default, fontWeight: "800", fontSize: 13, marginTop: 2 }}>
                {item.price}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => dispatch(removeSaved(item.id))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 6 }}
            >
              <Ionicons name="trash-outline" size={18} color={tokens.text.muted} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
