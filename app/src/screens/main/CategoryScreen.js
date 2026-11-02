/**
 * CategoryScreen - category landing page (hero, subcategory grid, popular
 * items, top shops, trending), reached by tapping a category tile on Home.
 * Feeds into SubcategoryScreen (tap a subcategory) which feeds into
 * ProductDetail (tap a product) - a three-step drill-down matching the
 * reference comps.
 *
 * The category id arrives from Home/AllCategories; the taxonomy (name, image,
 * subcategories) is read from the backend /categories list. Categories with no
 * products in the catalog fall back to a "coming soon" EmptyState, same
 * convention as VendorStorefrontScreen's category fallback.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { goBackOr } from "../../lib/goBack";
import { useTheme } from "../../theme";
import { useIsDesktop } from "../../lib/responsive";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { fetchProductsByCategory } from "../../store/slices/marketplaceSlice";
import { fetchCategories } from "../../store/slices/categoriesSlice";
import { normalizeProduct, normalizeCategory } from "../../lib/normalizeMarketplace";
import { formatNaira } from "../../data/marketplace";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";
import ProductCard from "../../components/product/ProductCard";

export default function CategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));

  // The backend category is the source of truth: Home/AllCategories navigate
  // with its id and everything here (hero, subcategories, products) is derived
  // from the /categories taxonomy.
  const backendCategories = useSelector((s) => s.categories.list);
  const categoriesLoading = useSelector((s) => s.categories.loading);
  useEffect(() => {
    if (!backendCategories || backendCategories.length === 0) dispatch(fetchCategories());
  }, [backendCategories, dispatch]);
  const categoryId = route?.params?.categoryId;
  const category = (backendCategories || []).find((c) => c.id === categoryId);
  const tile = normalizeCategory(category);

  const rawProducts = useSelector((s) => s.marketplace.productsByCategory.byPrefix[categoryId]);
  const loadingPrefix = useSelector((s) => s.marketplace.productsByCategory.loadingPrefix);
  const loading = categoryId && loadingPrefix === categoryId && !rawProducts;

  useEffect(() => {
    if (categoryId && !rawProducts) dispatch(fetchProductsByCategory(categoryId));
  }, [categoryId, rawProducts, dispatch]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      dispatch(fetchCategories()),
      categoryId ? dispatch(fetchProductsByCategory(categoryId)) : Promise.resolve(),
    ]).finally(() => setRefreshing(false));
  }, [categoryId, dispatch]);

  const products = useMemo(() => (rawProducts || []).map(normalizeProduct), [rawProducts]);

  // Vendors selling in this category, derived from the product list itself
  // (dedup by vendor id) rather than a separate call - the product payload
  // already carries {id, name, logoUrl, averageRating} per vendor.
  const shops = useMemo(() => {
    const byId = new Map();
    (rawProducts || []).forEach((p) => {
      if (p.vendor && !byId.has(p.vendor.id)) byId.set(p.vendor.id, p.vendor);
    });
    return Array.from(byId.values()).sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  }, [rawProducts]);

  // Subcategories come from the admin-managed taxonomy (/categories), not from
  // parsing product paths. Counts + a sample image come from the loaded
  // products (by subcategoryId).
  const subcategories = useMemo(() => {
    const subById = new Map();
    products.forEach((p) => {
      if (!p.subcategoryId) return;
      const entry = subById.get(p.subcategoryId) || { id: p.subcategoryId, label: p.subcategoryName || "General", count: 0, image: p.images[0] };
      entry.count += 1;
      subById.set(p.subcategoryId, entry);
    });
    const seeded = (category?.subcategories || []).map((s) => subById.get(s.id) || { id: s.id, label: s.name, count: 0, image: tile?.image });
    const extras = Array.from(subById.values()).filter((s) => !(category?.subcategories || []).some((c) => c.id === s.id));
    return [...seeded, ...extras];
  }, [products, category, tile]);

  const popular = useMemo(() => [...products].sort((a, b) => b.sold - a.sold).slice(0, isDesktop ? 8 : 6), [products, isDesktop]);

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

  const contentMaxWidth = isDesktop ? 1100 : undefined;

  if (!tile) {
    if (categoriesLoading || (backendCategories || []).length === 0) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
          {Header}
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }}>
              <SkeletonLoader.ProductGrid cardWidth={isDesktop ? 220 : "47%"} />
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {Header}
        <EmptyState icon="grid-outline" title="Category not found" subtitle="This category may have moved." />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {Header}
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }}>
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
        <EmptyState icon="grid-outline" title={`${tile.label} is coming soon`} subtitle="No products in this category yet - check back soon." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {Header}
      <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} colors={[tokens.brand.default]} />}
        >
        <View style={{ maxWidth: contentMaxWidth, alignSelf: "center", width: "100%", paddingHorizontal: 16 }}>
          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surfaceMuted, borderRadius: 999, paddingHorizontal: 14, height: 44, gap: 8 }}>
            <Ionicons name="search" size={17} color={tokens.text.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search in ${tile.label}...`}
              placeholderTextColor={tokens.text.placeholder}
              style={{ flex: 1, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
            />
            <Ionicons name="options-outline" size={17} color={tokens.text.muted} />
          </View>

          {/* Hero */}
          <View
            style={{
              marginTop: 14,
              borderRadius: 20,
              backgroundColor: tile.bg,
              overflow: "hidden",
              flexDirection: "row",
              alignItems: "center",
              minHeight: 130,
            }}
          >
            <View style={{ flex: 1, padding: 18 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: tokens.text.primary }}>{tile.label}</Text>
              <Text style={{ fontSize: 12.5, color: tokens.text.muted, marginTop: 4, lineHeight: 18 }}>
                Explore the latest {tile.label.toLowerCase()} from trusted sellers
              </Text>
              <View style={{ marginTop: 12, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.75)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontSize: 11.5, fontWeight: "800", color: tokens.text.primary }}>{products?.length} products</Text>
              </View>
            </View>
            <Image source={{ uri: tile.image }} style={{ width: 110, height: 110, marginRight: 12, borderRadius: 14 }} contentFit="cover" />
          </View>

          {/* Shop by subcategory */}
          <SectionHeader title="Shop by subcategory" tokens={tokens} />
          <View style={isDesktop ? { flexDirection: "row", flexWrap: "wrap", gap: 14 } : undefined}>
            {isDesktop ? (
              subcategories.map((sub) => (
                <SubcategoryTile key={sub.label} sub={sub} tokens={tokens} width={140}
                  onPress={() => navigation.navigate("Subcategory", { categoryId, subcategoryId: sub.id, subcategory: sub.label })} />
              ))
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {subcategories.map((sub) => (
                  <SubcategoryTile key={sub.label} sub={sub} tokens={tokens} width={78}
                    onPress={() => navigation.navigate("Subcategory", { categoryId, subcategoryId: sub.id, subcategory: sub.label })} />
                ))}
              </ScrollView>
            )}
          </View>

          {/* Popular items */}
          <SectionHeader title={`Popular items in ${tile.label}`} tokens={tokens} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {popular.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                width={isDesktop ? 220 : "47%"}
                isSaved={savedIds.includes(p.id)}
                onToggleSave={() => dispatch(toggleSaved({ id: p.id, title: p.title, price: formatNaira(p.price), image: p.images[0] }))}
                onPress={() => navigation.push("ProductDetail", { productId: p.id })}
              />
            ))}
          </View>

          {/* Top shops */}
          {shops.length > 0 && (
            <>
              <SectionHeader title={`Top ${tile.label} Shops`} tokens={tokens} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {shops.map((shop) => (
                  <TouchableOpacity
                    key={shop.id}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate("VendorStorefront", { vendorId: shop.id, vendorName: shop.name })}
                    style={{ width: 128, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 12, alignItems: "center", backgroundColor: tokens.bg.surface }}
                  >
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {shop.logoUrl ? (
                        <Image source={{ uri: shop.logoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      ) : (
                        <Text style={{ fontSize: 9, fontWeight: "900", color: tokens.text.primary, textAlign: "center" }} numberOfLines={2}>{shop.name}</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 12.5, fontWeight: "800", color: tokens.text.primary, marginTop: 8, textAlign: "center" }} numberOfLines={1}>{shop.name}</Text>
                    <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>★ {shop.averageRating}</Text>
                    <View style={{ marginTop: 8, borderWidth: 1, borderColor: tokens.brand.default, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: "800", color: tokens.brand.default }}>View Shop</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Trending */}
          <SectionHeader title={`Trending in ${tile.label}`} tokens={tokens} />
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => subcategories[0] && navigation.navigate("Subcategory", { categoryId, subcategoryId: subcategories[0].id, subcategory: subcategories[0].label })}
            style={{ borderRadius: 18, backgroundColor: tokens.brand.soft, padding: 18, flexDirection: "row", alignItems: "center", marginBottom: 8 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "900", color: tokens.text.primary }}>New Arrivals</Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4, lineHeight: 17 }}>
                Check out the latest {tile.label.toLowerCase()} items added today
              </Text>
              <View style={{ marginTop: 12, alignSelf: "flex-start", backgroundColor: tokens.brand.default, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ fontSize: 11.5, fontWeight: "800", color: tokens.text.onBrand }}>Explore Now</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, tokens }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 12 }}>
      <Text style={{ fontSize: 15, fontWeight: "900", color: tokens.text.primary }}>{title}</Text>
    </View>
  );
}

function SubcategoryTile({ sub, tokens, width, onPress }) {
  const initial = (sub.label || "?").trim().charAt(0).toUpperCase();
  const size = width - 8;
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={{ width, alignItems: "center" }}>
      <View style={{ width: size, height: size, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
        {sub.image ? (
          <Image source={{ uri: sub.image }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
        ) : (
          <Text style={{ fontSize: 20, fontWeight: "900", color: tokens.brand.default }}>{initial}</Text>
        )}
      </View>
      <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.primary, marginTop: 6, textAlign: "center" }} numberOfLines={1}>{sub.label}</Text>
      <Text style={{ fontSize: 10.5, color: tokens.text.muted }}>{sub.count} products</Text>
    </TouchableOpacity>
  );
}
