/**
 * VendorCategoryProductsScreen - the drill-down page for one category inside a
 * vendor's shop. Reached by tapping a shop-category card (Shoes, Bags, Atamfa,
 * ...) on VendorStorefrontScreen's Shop tab.
 *
 * Products come from the server-side browse endpoint scoped to this vendor +
 * category (GET /vendors/products?vendorId=&categoryId=) with facets + sort via
 * useProductBrowse. The optional subcategory chips narrow the returned page
 * client-side (products with no subcategory are always kept, matching the old
 * behaviour).
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

export default function VendorCategoryProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();
  const location = useSelector((s) => s.location);

  const vendorId = route?.params?.vendorId;
  const vendorName = route?.params?.vendorName;
  const categoryId = route?.params?.categoryId;
  const categoryName = route?.params?.categoryName;
  const subcategories = route?.params?.subcategories || [];

  // A subcategory chip narrows the page client-side so products created
  // without a subcategory are never hidden.
  const [activeSubId, setActiveSubId] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { products, loading, refetch } = useProductBrowse({
    enabled: Boolean(vendorId),
    vendorId,
    categoryId,
    filters,
    sort,
    limit: 300,
  });

  // Reset state when the category changes so stale state never leaks over.
  useEffect(() => {
    setSearch("");
    setActiveSubId(null);
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
  }, [categoryId, vendorId]);

  const visible = useMemo(() => {
    let list = products;
    if (activeSubId) list = list.filter((p) => !p.subcategoryId || p.subcategoryId === activeSubId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    return list;
  }, [products, activeSubId, search]);

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
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.text.primary }} numberOfLines={1}>
          {categoryName}
        </Text>
        {vendorName ? <Text style={{ fontSize: 11, color: tokens.text.muted }} numberOfLines={1}>{vendorName}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={22} color={tokens.text.primary} />
      </TouchableOpacity>
    </View>
  );

  const contentMaxWidth = isDesktop ? 1100 : undefined;

  if (loading && products?.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {Header}
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ maxWidth: contentMaxWidth, alignSelf: "center", width: "100%", paddingHorizontal: 16 }}>
            <SkeletonLoader.ProductGrid cardWidth={isDesktop ? 220 : "47%"} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (products?.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {Header}
        <EmptyState icon="pricetags-outline" title={`${categoryName || "This category"} is empty`} subtitle="This shop has no products here yet - check back soon." />
      </SafeAreaView>
    );
  }

  const listHeader = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
        <View style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
          {products[0].images?.[0] ? (
            <Image source={{ uri: products[0].images[0] }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          ) : (
            <Ionicons name="pricetags-outline" size={22} color={tokens.text.muted} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>{categoryName}</Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>{products?.length} products</Text>
        </View>
      </View>

      {subcategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        >
          <TouchableOpacity
            onPress={() => setActiveSubId(null)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: activeSubId === null ? tokens.brand.default : tokens.border.default,
              backgroundColor: activeSubId === null ? tokens.brand.soft : tokens.bg.surface,
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: activeSubId === null ? "800" : "600",
                color: activeSubId === null ? tokens.brand.default : tokens.text.primary,
              }}
            >
              All
            </Text>
          </TouchableOpacity>
          {subcategories.map((s) => {
            const active = s.id === activeSubId;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => setActiveSubId(s.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? tokens.brand.default : tokens.border.default,
                  backgroundColor: active ? tokens.brand.soft : tokens.bg.surface,
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: active ? "800" : "600",
                    color: active ? tokens.brand.default : tokens.text.primary,
                  }}
                >
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surfaceMuted, borderRadius: 999, paddingHorizontal: 14, height: 44, gap: 8, marginTop: 14 }}>
        <Ionicons name="search" size={17} color={tokens.text.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={`Search in ${categoryName || "this category"}...`}
          placeholderTextColor={tokens.text.placeholder}
          style={{ flex: 1, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
        />
      </View>

      <RefineBar
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        sections={[]}
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
