/**
 * SubcategoryScreen - product browse page for one subcategory (e.g.
 * "Clothing & Fashion" > "Women"): search, filters, sort, responsive grid.
 * Reached from CategoryScreen's subcategory tiles; feeds into ProductDetail.
 *
 * Products come from the server-side browse endpoint (GET /vendors/products
 * with subcategoryId + facets + sort) via useProductBrowse; the in-page search
 * narrows the returned page client-side.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { goBackOr } from "../../lib/goBack";
import { useTheme } from "../../theme";
import { useIsDesktop } from "../../lib/responsive";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { detectCurrentLocation } from "../../store/slices/locationSlice";
import { formatNaira } from "../../data/marketplace";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";
import ProductCard from "../../components/product/ProductCard";
import ProductGrid from "../../components/product/ProductGrid";
import PriceFilterBar from "../../components/product/PriceFilterBar";
import ConditionFilterBar from "../../components/product/ConditionFilterBar";
import RefineBar from "../../components/product/RefineBar";
import useProductBrowse from "../../hooks/useProductBrowse";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "../../lib/productFilters";

export default function SubcategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();
  const location = useSelector((s) => s.location);

  const categoryId = route?.params?.categoryId;
  const subcategoryId = route?.params?.subcategoryId;
  const subcategory = route?.params?.subcategory;

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { products, loading, refetch } = useProductBrowse({
    enabled: Boolean(categoryId),
    categoryId,
    subcategoryId,
    filters,
    sort,
    limit: 300,
  });

  // Reset search/sort/filter when the subcategory changes.
  useEffect(() => {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
  }, [subcategoryId, categoryId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.title.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.resolve(refetch()).finally(() => setRefreshing(false));
  }, [refetch]);

  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));
  const onRequestLocation = useCallback(() => dispatch(detectCurrentLocation()), [dispatch]);

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
      <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>
        my <Text style={{ color: tokens.brand.default }}>sooq</Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate("MainTabs", { screen: "CartTab" })}
          accessibilityRole="button"
          accessibilityLabel="Saved items"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="heart-outline" size={21} color={tokens.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("NotificationCenter")}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="notifications-outline" size={21} color={tokens.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (categoryId && loading && products?.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {Header}
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ maxWidth: isDesktop ? 1100 : undefined, alignSelf: "center", width: "100%" }}>
            <SkeletonLoader.ProductGrid cardWidth={isDesktop ? 220 : "47%"} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!subcategory || products?.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {Header}
        <EmptyState icon="pricetags-outline" title={`${subcategory || "This subcategory"} is empty`} subtitle="No products here yet - check back soon." />
      </SafeAreaView>
    );
  }

  const listHeader = (
    <>
      {/* Subcategory info row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
        <View style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
          {products[0].images?.[0] ? (
            <Image source={{ uri: products[0].images[0] }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          ) : (
            <Ionicons name="pricetags-outline" size={22} color={tokens.text.muted} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>{subcategory}</Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>{products?.length} products</Text>
        </View>
      </View>

      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surfaceMuted, borderRadius: 999, paddingHorizontal: 14, height: 44, gap: 8, marginTop: 14 }}>
        <Ionicons name="search" size={17} color={tokens.text.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={`Search in ${subcategory}...`}
          placeholderTextColor={tokens.text.placeholder}
          style={{ flex: 1, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
        />
      </View>

      {/* Refine: filters (location + rating in the sheet) + sort */}
      <RefineBar
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        sections={["location", "rating", "state"]}
        location={location}
        onRequestLocation={onRequestLocation}
        style={{ marginTop: 16 }}
      />

      <PriceFilterBar
        activeIndex={filters.priceIndex}
        onSelect={(i) => setFilters((f) => ({ ...f, priceIndex: i }))}
        style={{ marginTop: 10, marginBottom: 8 }}
      />

      <ConditionFilterBar
        value={filters.condition}
        onSelect={(v) => setFilters((f) => ({ ...f, condition: v }))}
        style={{ marginBottom: 14 }}
      />
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {Header}
      <ProductGrid
        data={visible}
        header={listHeader}
        refreshing={refreshing}
        onRefresh={onRefresh}
        empty={
          <EmptyState icon="search-outline" title="No products found" subtitle="Try a different search or filter." fill={false} />
        }
        renderItem={(p, cardWidth) => (
          <ProductCard
            product={p}
            width={cardWidth}
            isSaved={savedIds.includes(p.id)}
            onToggleSave={() => dispatch(toggleSaved({ id: p.id, title: p.title, price: formatNaira(p.price), image: p.images[0] }))}
            onPress={() => navigation.push("ProductDetail", { productId: p.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}
