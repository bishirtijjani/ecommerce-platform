/**
 * MarketplaceCategoryScreen - shared screen for category product listings
 * within China Market or Arab World marketplaces.
 *
 * Receives params: { categoryName, marketplace }
 * Fetches products filtered by category from the backend, falls back to
 * mock data if none found.
 */

import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";

import ListingCard from "../../components/home/ListingCard";
import { fetchFeaturedProducts } from "../../store/slices/marketplaceSlice";
import { normalizeProduct } from "../../lib/normalizeMarketplace";
import { formatNaira } from "../../data/marketplace";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { useTheme } from "../../theme";

export default function MarketplaceCategoryScreen({ route, navigation }) {
  const { categoryName, marketplace } = route.params || {};
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));
  const rawProducts = useSelector((s) => s.marketplace.featured.list);
  const loading = useSelector((s) => s.marketplace.featured.loading);

  useEffect(() => {
    dispatch(fetchFeaturedProducts());
  }, [dispatch]);

  // Filter products by category name match
  const products = useMemo(() => {
    if (!rawProducts || rawProducts.length === 0) return [];
    const q = (categoryName || "").toLowerCase();
    return rawProducts
      .map(normalizeProduct)
      .filter((p) => {
        if (!p) return false;
        const cat = (p.category || "").toLowerCase();
        const name = (p.title || "").toLowerCase();
        return cat.includes(q) || name.includes(q);
      })
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: formatNaira(p.price),
        was: p.was ? formatNaira(p.was) : undefined,
        badge: p.discountPercent ? `-${p.discountPercent}%` : undefined,
        condition: p.condition,
        image: p.images[0],
      }));
  }, [rawProducts, categoryName]);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    dispatch(fetchFeaturedProducts()).finally(() => setRefreshing(false));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tokens.bg.surface, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary, flex: 1 }}>{categoryName}</Text>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>{marketplace}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
      >
        {loading && products?.length === 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: "48%", height: 200, marginBottom: 12, borderRadius: 12, backgroundColor: tokens.bg.surfaceMuted }} />
            ))}
          </View>
        ) : products?.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Ionicons name="bag-outline" size={48} color={tokens.text.placeholder} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: tokens.text.muted, marginTop: 14 }}>No products in this category yet</Text>
            <Text style={{ fontSize: 12, color: tokens.text.placeholder, marginTop: 4 }}>Check back soon for new arrivals</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {products.map((item) => (
              <ListingCard
                key={item.id}
                item={item}
                isSaved={savedIds.includes(item.id)}
                onToggleSave={() => dispatch(toggleSaved(item))}
                onPress={() => navigation.navigate("ProductDetail", { productId: item.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
