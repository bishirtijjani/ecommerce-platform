/**
 * VendorStorefrontScreen - real shop page (cover, tabs, catalog, about,
 * reviews, policies), replacing the old "coming soon" stub. Chat-commerce
 * model, permanently: the primary CTA is ContactVendorSheet, not a cart.
 *
 * Two entry points share this screen:
 *  - A real vendor tap (Home/ProductDetail) passes `vendorId` - full
 *    storefront renders.
 *  - A category tap from ShopsScreen passes only `vendorName` (categories
 *    aren't vendors) - falls back to the old "coming soon" EmptyState
 *    rather than pretending a category is a shop.
 *
 * Responsive: single-column stack under DESKTOP_BREAKPOINT; category
 * sidebar + wider grid above it, matching the desktop reference comp.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, Share, RefreshControl, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { goBackOr } from "../../lib/goBack";
import { useTheme } from "../../theme";
import { useIsDesktop } from "../../lib/responsive";
import { fetchVendorDetail } from "../../store/slices/marketplaceSlice";
import { detectCurrentLocation } from "../../store/slices/locationSlice";
import { normalizeVendor } from "../../lib/normalizeMarketplace";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";
import ContactVendorSheet from "../../components/ContactVendorSheet";
import { ShopHighlightsBar, StoryViewer } from "../../components/home/ShopHighlights";
import ProductCard from "../../components/product/ProductCard";
import PriceFilterBar from "../../components/product/PriceFilterBar";
import ConditionFilterBar from "../../components/product/ConditionFilterBar";
import RefineBar from "../../components/product/RefineBar";
import useProductBrowse from "../../hooks/useProductBrowse";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "../../lib/productFilters";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { formatNaira } from "../../data/marketplace";

const TABS = ["Shop", "About", "Reviews", "Policies"];

export default function VendorStorefrontScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();
  const { width: windowWidth } = useWindowDimensions();

  const vendorId = route?.params?.vendorId;
  const rawVendor = useSelector((s) => (vendorId ? s.marketplace.vendorDetail.byId[vendorId] : null));
  const loadingVendorId = useSelector((s) => s.marketplace.vendorDetail.loadingId);
  const loading = vendorId && loadingVendorId === vendorId && !rawVendor;

  useEffect(() => {
    if (vendorId && !rawVendor) dispatch(fetchVendorDetail(vendorId));
  }, [vendorId, rawVendor, dispatch]);

  const vendor = useMemo(() => normalizeVendor(rawVendor), [rawVendor]);

  const [activeTab, setActiveTab] = useState("Shop");
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [viewerHighlight, setViewerHighlight] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);

  // Second Hand space: this shop's SECOND_HAND listings, shown in their own tab
  // (they're excluded from the normal catalogue by the backend).
  const [shSearch, setShSearch] = useState("");
  const [shFilters, setShFilters] = useState(DEFAULT_FILTERS);
  const [shSort, setShSort] = useState(DEFAULT_SORT);

  // Server-side product grid scoped to this vendor (facets + sort). Declared
  // before the early returns so the hook order is stable across renders.
  const location = useSelector((s) => s.location);
  const { products: shopProductsAll, loading: productsLoading, refetch: refetchProducts } = useProductBrowse({
    enabled: Boolean(vendorId),
    vendorId,
    filters,
    sort,
    limit: 300,
  });
  const { products: shProductsAll, loading: shLoading } = useProductBrowse({
    enabled: Boolean(vendorId),
    vendorId,
    condition: "SECOND_HAND",
    filters: shFilters,
    sort: shSort,
    limit: 300,
  });

  const openHighlight = (highlight) => setViewerHighlight(highlight);
  const closeViewer = () => setViewerHighlight(null);

  // MUST be declared here (above the early returns below) so the hook always
  // runs every render. Declaring it after the loading/vendor early returns
  // made the hook count vary between the skeleton and loaded renders, which
  // React rejects with the "Rendered more hooks than during the previous
  // render" error (#310) on the first (uncached) visit.
  // The shop's category list, derived from its available products in the
  // unified taxonomy (global + the vendor's own rows). Each category carries
  // its subcategories; tapping one opens the category's product listing.
  const shopCategories = useMemo(() => {
    const cards = (vendor?.categories || []).map((c) => ({
      id: c.id,
      label: c.name,
      count: 0,
      image: c.imageUrl,
      subcategories: c.subcategories || [],
    }));
    return cards.filter(
      (c) => !search.trim() || c.label.toLowerCase().includes(search.trim().toLowerCase())
    );
  }, [vendor, search]);

  const openCategory = (cat) =>
    navigation.navigate("VendorCategoryProducts", {
      vendorId: vendor?.id,
      vendorName: vendor?.name,
      categoryId: cat.id,
      categoryName: cat.label,
      subcategories: cat.subcategories,
    });

  // The shop's products come from the server-side browse endpoint (already
  // filtered + sorted); the in-shop search narrows the returned page.
  const shopProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shopProductsAll;
    return shopProductsAll.filter((p) => p.title.toLowerCase().includes(q));
  }, [shopProductsAll, search]);

  const shProducts = useMemo(() => {
    const q = shSearch.trim().toLowerCase();
    if (!q) return shProductsAll;
    return shProductsAll.filter((p) => p.title.toLowerCase().includes(q));
  }, [shProductsAll, shSearch]);

  // Tabs - the "Second Hand" space only appears once the shop has such items.
  const tabs = useMemo(
    () => ["Shop", ...(shProductsAll?.length > 0 ? ["Second Hand"] : []), "About", "Reviews", "Policies"],
    [shProductsAll?.length]
  );

  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));
  const onRequestLocation = useCallback(() => dispatch(detectCurrentLocation()), [dispatch]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    if (!vendorId) return;
    setRefreshing(true);
    Promise.all([dispatch(fetchVendorDetail(vendorId)), Promise.resolve(refetchProducts())]).finally(() =>
      setRefreshing(false)
    );
  }, [vendorId, dispatch, refetchProducts]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonLoader.StorefrontHeader />
          <SkeletonLoader.ProductGrid cardWidth={isDesktop ? 220 : "47%"} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!vendor) {
    const vendorName = route?.params?.vendorName || "This shop";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text style={{ marginLeft: 12, fontSize: 16, fontWeight: "800", color: tokens.text.primary }}>{vendorName}</Text>
        </View>
        <EmptyState icon="storefront-outline" title={`${vendorName}'s shops are coming soon`} subtitle="We're still building this category's shop directory." />
      </SafeAreaView>
    );
  }

  const onShare = () => Share.share({ message: `Check out ${vendor.name} on my sooq` }).catch(() => {});
  const onPolicyRow = (label, value) => Alert.alert(label, value);

  const contentMaxWidth = isDesktop ? 1100 : undefined;

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
      <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>
        my <Text style={{ color: tokens.brand.default }}>sooq</Text>
      </Text>
      <TouchableOpacity onPress={onShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="share-outline" size={21} color={tokens.text.primary} />
      </TouchableOpacity>
    </View>
  );

  const CoverBanner = (
    <View style={{ width: "100%", height: isDesktop ? 220 : 190, borderRadius: isDesktop ? 18 : 0, overflow: "hidden" }}>
      <Image source={{ uri: vendor.coverImage }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          flexDirection: "row",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: vendor.logoBg, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 3, borderColor: "#FFFFFF" }}>
          {vendor.logo ? (
            <Image source={vendor.logo} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 11, fontWeight: "900", color: tokens.text.primary, textAlign: "center" }} numberOfLines={2}>
              {vendor.name}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: "900", color: "#FFFFFF" }} numberOfLines={1}>
              {vendor.name}
            </Text>
            {vendor.verified && <Ionicons name="checkmark-circle" size={16} color="#5FDB9C" />}
          </View>
          <Text style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
            {vendor.verified ? "Verified vendor" : "Unverified vendor"}
          </Text>
          <Text style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
            ★ {vendor.rating} ({vendor.reviewsCount}) · {vendor.productsCount} products
          </Text>
          <Text style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
            {vendor.location}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setContactOpen(true)}
            style={{ backgroundColor: tokens.brand.default, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="chatbubbles" size={15} color={tokens.text.onBrand} />
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 12.5 }}>Contact Vendor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFollowing((v) => !v)}
            style={{ backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name={following ? "heart" : "heart-outline"} size={15} color={tokens.brand.default} />
            <Text style={{ color: tokens.brand.default, fontWeight: "800", fontSize: 12.5 }}>{following ? "Following" : "Follow shop"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const Tabs = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ borderBottomWidth: 1, borderBottomColor: tokens.border.default, marginTop: 14, flexGrow: 0 }}
    >
      {tabs.map((tab) => {
        const active = tab === activeTab;
        const label = tab === "Reviews" ? `Reviews (${vendor.reviewsCount})` : tab;
        return (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={{ paddingVertical: 10, marginRight: 24, borderBottomWidth: 2, borderBottomColor: active ? tokens.brand.default : "transparent" }}>
            <Text style={{ fontSize: 13.5, fontWeight: active ? "800" : "600", color: active ? tokens.brand.default : tokens.text.muted }}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const ShopHeader = (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, height: 42 }}>
          <Ionicons name="search" size={16} color={tokens.text.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search in this shop..."
            placeholderTextColor={tokens.text.placeholder}
            style={{ flex: 1, marginLeft: 8, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
          />
        </View>
      </View>

      {shopCategories.length === 0 && shopProductsAll.length === 0 && !productsLoading ? (
        <EmptyState icon="pricetags-outline" title="No categories yet" subtitle="This shop has no products yet - check back soon." fill={false} />
      ) : (
        <>
          {shopCategories.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
              {shopCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.8}
                  onPress={() => openCategory(cat)}
                  style={{
                    width: "30%",
                    backgroundColor: tokens.bg.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.border.default,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ width: "100%", aspectRatio: 1, backgroundColor: tokens.bg.surfaceMuted }}>
                    {cat.image ? (
                      <Image source={{ uri: cat.image }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="pricetags-outline" size={24} color={tokens.text.muted} />
                      </View>
                    )}
                  </View>
                  <View style={{ padding: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
                      {cat.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(shopProductsAll.length > 0 || productsLoading) && (
            <>
              <View style={{ marginTop: 22, marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "900", color: tokens.text.primary }}>Products</Text>
              </View>
              <RefineBar
                filters={filters}
                onFiltersChange={setFilters}
                sort={sort}
                onSortChange={setSort}
                sections={[]}
                location={location}
                onRequestLocation={onRequestLocation}
                style={{ marginBottom: 10 }}
              />
              <PriceFilterBar
                activeIndex={filters.priceIndex}
                onSelect={(i) => setFilters((f) => ({ ...f, priceIndex: i }))}
                style={{ marginBottom: 8 }}
              />
              <ConditionFilterBar
                value={filters.condition}
                onSelect={(v) => setFilters((f) => ({ ...f, condition: v }))}
                style={{ marginBottom: 14 }}
              />
              {productsLoading && shopProductsAll.length === 0 ? (
                <SkeletonLoader.ProductGrid cardWidth={isDesktop ? 220 : "47%"} />
              ) : shopProducts.length === 0 ? (
                <EmptyState icon="search-outline" title="No products found" subtitle="Try a different search or filter." fill={false} />
              ) : null}
            </>
          )}
        </>
      )}
    </View>
  );

  const SecondHandHeader = (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Ionicons name="refresh-circle-outline" size={18} color={tokens.brand.default} />
        <Text style={{ fontSize: 15, fontWeight: "900", color: tokens.text.primary }}>Second Hand</Text>
        {shProductsAll?.length > 0 ? (
          <Text style={{ fontSize: 12, color: tokens.text.muted }}>· {shProductsAll?.length}</Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 10 }}>
        Pre-owned items from this shop{vendor.state ? ` · ${vendor.state}${vendor.lga ? `, ${vendor.lga}` : ""}` : ""}.
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 10 }}>
        <Ionicons name="search" size={16} color={tokens.text.muted} />
        <TextInput
          value={shSearch}
          onChangeText={setShSearch}
          placeholder="Search second hand items..."
          placeholderTextColor={tokens.text.placeholder}
          style={{ flex: 1, marginLeft: 8, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
        />
      </View>

      <RefineBar
        filters={shFilters}
        onFiltersChange={setShFilters}
        sort={shSort}
        onSortChange={setShSort}
        sections={[]}
        location={location}
        onRequestLocation={onRequestLocation}
        style={{ marginBottom: 10 }}
      />
      <PriceFilterBar
        activeIndex={shFilters.priceIndex}
        onSelect={(i) => setShFilters((f) => ({ ...f, priceIndex: i }))}
        style={{ marginBottom: 14 }}
      />

      {shLoading && shProductsAll?.length === 0 ? (
        <SkeletonLoader.ProductGrid cardWidth={isDesktop ? 220 : "47%"} />
      ) : shProducts.length === 0 ? (
        <EmptyState icon="search-outline" title="No items found" subtitle="Try a different search or filter." fill={false} />
      ) : null}
    </View>
  );

  const AboutTab = (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary, marginBottom: 6 }}>About this shop</Text>
      <Text style={{ fontSize: 13, color: tokens.text.muted, lineHeight: 20 }}>{vendor.description}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
        <StatItem label="Member since" value={vendor.memberSince} />
        <StatItem label="Avg response" value={vendor.avgResponseTime} />
        <StatItem label="Products" value={String(vendor.productsCount)} />
        <StatItem label="Followers" value={vendor.followers} />
      </View>

      {vendor.photos.length > 0 && (
        <>
          <Text style={{ fontSize: 13.5, fontWeight: "800", color: tokens.text.primary, marginTop: 20, marginBottom: 10 }}>Shop photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {vendor.photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={{ width: 110, height: 110, borderRadius: 12 }} contentFit="cover" />
            ))}
          </ScrollView>
        </>
      )}

      {vendor.policies && (
        <View style={{ marginTop: 20, gap: 2 }}>
          <PolicyRow icon="rocket-outline" label="Shipping" value={vendor.policies.shipping} onPress={onPolicyRow} tokens={tokens} />
          <PolicyRow icon="refresh-outline" label="Return Policy" value={vendor.policies.returns} onPress={onPolicyRow} tokens={tokens} />
          <PolicyRow icon="card-outline" label="Payment" value={vendor.policies.payment} onPress={onPolicyRow} tokens={tokens} />
          <PolicyRow icon="document-text-outline" label="Shop Policies" value={vendor.policies.shopPolicies} onPress={onPolicyRow} tokens={tokens} />
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "800", color: tokens.text.primary }}>Top reviews</Text>
        <TouchableOpacity onPress={() => setActiveTab("Reviews")}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default }}>View all ({vendor.reviewsCount})</Text>
        </TouchableOpacity>
      </View>
      {vendor.reviews.length === 0 ? (
        <Text style={{ fontSize: 12.5, color: tokens.text.muted }}>No reviews yet.</Text>
      ) : (
        vendor.reviews.slice(0, 2).map((r, i) => <ReviewRow key={i} review={r} tokens={tokens} />)
      )}
    </View>
  );

  const ReviewsTab = (
    <View style={{ marginTop: 16 }}>
      {vendor.reviews.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No reviews yet" subtitle="Be the first to order and leave a review." fill={false} />
      ) : (
        vendor.reviews.map((r, i) => <ReviewRow key={i} review={r} tokens={tokens} />)
      )}
    </View>
  );

  const PoliciesTab = (
    <View style={{ marginTop: 16, gap: 2 }}>
      {vendor.policies ? (
        <>
          <PolicyRow icon="rocket-outline" label="Shipping" value={vendor.policies.shipping} onPress={onPolicyRow} tokens={tokens} expanded />
          <PolicyRow icon="refresh-outline" label="Return Policy" value={vendor.policies.returns} onPress={onPolicyRow} tokens={tokens} expanded />
          <PolicyRow icon="card-outline" label="Payment" value={vendor.policies.payment} onPress={onPolicyRow} tokens={tokens} expanded />
          <PolicyRow icon="document-text-outline" label="Shop Policies" value={vendor.policies.shopPolicies} onPress={onPolicyRow} tokens={tokens} expanded />
        </>
      ) : (
        <EmptyState icon="document-text-outline" title="Policies coming soon" subtitle="This vendor hasn't published shop policies yet." fill={false} />
      )}
    </View>
  );

  const columns = isDesktop ? 4 : 2;
  const horizontalPad = isDesktop ? 24 : 16;
  const gridWidth = Math.min(windowWidth, contentMaxWidth || 1100);
  const cardWidth = Math.floor((gridWidth - horizontalPad * 2 - 12 * (columns - 1)) / columns);
  const activeProducts =
    activeTab === "Shop" ? shopProducts : activeTab === "Second Hand" ? shProducts : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {Header}
      <FlatList
        key={`store-${columns}`}
        data={activeProducts}
        keyExtractor={(p) => p.id}
        numColumns={columns}
        renderItem={({ item: p }) => (
          <ProductCard
            product={p}
            width={cardWidth}
            isSaved={savedIds.includes(p.id)}
            onToggleSave={() => dispatch(toggleSaved({ id: p.id, title: p.title, price: formatNaira(p.price), image: p.images[0] }))}
            onPress={() => navigation.navigate("ProductDetail", { productId: p.id })}
          />
        )}
        ListHeaderComponent={
          <View style={{ maxWidth: contentMaxWidth, alignSelf: "center", width: "100%", paddingHorizontal: isDesktop ? 24 : 0 }}>
            {CoverBanner}
            <View style={{ paddingHorizontal: isDesktop ? 0 : 16, marginTop: 14 }}>
              <ShopHighlightsBar highlights={vendor.highlights} onHighlightPress={openHighlight} />
              {Tabs}
              {activeTab === "Shop" && ShopHeader}
              {activeTab === "Second Hand" && SecondHandHeader}
              {activeTab === "About" && AboutTab}
              {activeTab === "Reviews" && ReviewsTab}
              {activeTab === "Policies" && PoliciesTab}
            </View>
          </View>
        }
        columnWrapperStyle={{ gap: 12, paddingHorizontal: horizontalPad }}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={columns * 4}
        maxToRenderPerBatch={columns * 4}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.brand.default}
            colors={[tokens.brand.default]}
          />
        }
      />

      <StoryViewer
        visible={!!viewerHighlight}
        highlight={viewerHighlight}
        onClose={closeViewer}
        onOpenProduct={(productId) => navigation.navigate("ProductDetail", { productId })}
      />
      <ContactVendorSheet visible={contactOpen} onClose={() => setContactOpen(false)} vendor={vendor} />
    </SafeAreaView>
  );
}

function StatItem({ label, value }) {
  const { tokens } = useTheme();
  return (
    <View style={{ minWidth: 90 }}>
      <Text style={{ fontSize: 15, fontWeight: "900", color: tokens.text.primary }}>{value}</Text>
      <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function PolicyRow({ icon, label, value, onPress, tokens, expanded }) {
  return (
    <TouchableOpacity
      onPress={() => !expanded && onPress(label, value)}
      activeOpacity={expanded ? 1 : 0.6}
      style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}
    >
      <Ionicons name={icon} size={18} color={tokens.text.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: tokens.text.primary }}>{label}</Text>
        <Text style={{ fontSize: 11.5, color: tokens.text.muted, marginTop: 2 }} numberOfLines={expanded ? undefined : 1}>
          {value}
        </Text>
      </View>
      {!expanded && <Ionicons name="chevron-forward" size={16} color={tokens.text.muted} />}
    </TouchableOpacity>
  );
}

function ReviewRow({ review, tokens }) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.brand.soft, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.brand.strong }}>{review.name.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary }}>{review.name}</Text>
          <Text style={{ fontSize: 11, color: tokens.text.muted }}>{review.timeAgo}</Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons key={i} name={i < review.rating ? "star" : "star-outline"} size={11} color="#F5A623" />
          ))}
        </View>
        <Text style={{ fontSize: 12.5, color: tokens.text.muted, marginTop: 4, lineHeight: 18 }}>{review.comment}</Text>
      </View>
    </View>
  );
}
