/**
 * MarketScreen - shared layout for marketplace pages (China Market, Arab World,
 * Second Hand Items). Props: { navigation, vendorId, name, emoji, subtitle,
 * bannerImage, locationMode }.
 *
 * Layout: single full-width scroll containing hero banner + search, then a
 * content row where the category rail is position:sticky (top:0) — it stays
 * pinned while the page scrolls and scrolls internally when categories
 * overflow; the product grid sits beside it in the same row.
 * Native fallback: sticky is a no-op and the rail scrolls with the page.
 *
 * locationMode swaps the primary rail from product categories to Nigerian
 * states and renders the selected state's LGAs as a horizontal chip row under
 * the search bar; products are matched on their state/LGA names (see
 * data/nigeriaStatesLgas.js). Only Second Hand uses it.
 *
 * Rail sizing — DO NOT WIDEN: 80px below the desktop breakpoint (860px),
 * 116px at desktop. Labels wrap to 2 lines at fontSize 11 / lineHeight 14, left aligned.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ProductCard from "../../components/product/ProductCard";
import PriceFilterBar from "../../components/product/PriceFilterBar";
import ConditionFilterBar from "../../components/product/ConditionFilterBar";
import RefineBar from "../../components/product/RefineBar";
import SkeletonLoader from "../../components/SkeletonLoader";
import { fetchVendorDetail } from "../../store/slices/marketplaceSlice";
import { detectCurrentLocation } from "../../store/slices/locationSlice";
import { NIGERIA_STATES, LGAS_BY_STATE } from "../../data/nigeriaStatesLgas";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { useTheme } from "../../theme";
import { useIsDesktop } from "../../lib/responsive";
import useProductBrowse from "../../hooks/useProductBrowse";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "../../lib/productFilters";

// ── rail sizing — 80px mobile/tablet-portrait, 116px desktop; do not widen ──
const RAIL_MOBILE = 80;
const RAIL_DESKTOP = 116;

const CELL_HEIGHT = 44;
const FOR_YOU = "for-you";
const ALL_LGAS = "all";
const VIEW_MODE_STORAGE_KEY = "marketplace:viewMode";
const VALID_VIEW_MODES = ["grid", "landscape"];

export default function MarketScreen({
  navigation,
  vendorId,
  // Cross-vendor condition scope (e.g. the Second Hand marketplace passes
  // condition="SECOND_HAND" with no vendorId). Mutually usable with vendorId.
  condition,
  name,
  emoji,
  subtitle,
  bannerImage,
  // Location-based browsing (Second Hand): state rail + LGA secondary rail
  // instead of product categories. Off by default so China/Arab are unchanged.
  locationMode = false,
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();
  const { width, height: viewportHeight } = useWindowDimensions();
  const searchRef = useRef(null);

  const [activeCategory, setActiveCategory] = useState(FOR_YOU);
  const [activeLga, setActiveLga] = useState(ALL_LGAS);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const location = useSelector((s) => s.location);

  // Hydrate persisted view mode preference for this device.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored && VALID_VIEW_MODES.includes(stored)) {
          setViewMode(stored);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist view mode whenever it changes.
  useEffect(() => {
    AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode).catch(() => {});
  }, [viewMode]);

  const rawVendor = useSelector((s) =>
    vendorId ? s.marketplace.vendorDetail.byId[vendorId] : null
  );
  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));

  // Server-side product browse scoped to this vendor / condition (facets +
  // sort). The rail/category grouping below stays client-side over the page.
  const { products: allProducts, loading, refetch: refetchProducts } = useProductBrowse({
    enabled: Boolean(vendorId || condition),
    vendorId,
    condition,
    filters,
    sort,
    limit: 500,
  });

  // Primary rail. Location mode lists Nigerian states (full 37, so every state
  // is reachable even before it has listings); otherwise the vendor's own
  // storefront categories. "For You" stays the first entry in both modes.
  const categories = useMemo(() => {
    if (locationMode) {
      return [
        { id: FOR_YOU, name: "For You", sortOrder: -1 },
        ...NIGERIA_STATES.map((s, i) => ({ id: s.name, name: s.name, sortOrder: i })),
      ];
    }
    const cats = (rawVendor?.categories || [])
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder }));
    return [{ id: FOR_YOU, name: "For You", sortOrder: -1 }, ...cats];
  }, [rawVendor, locationMode]);

  // Products grouped by the active primary rail. Location mode keys on the
  // product's State; category mode on the category id.
  const productsByCategory = useMemo(() => {
    const map = {};
    allProducts.forEach((p) => {
      const key = locationMode ? p.state : p.categoryId || "other";
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [allProducts, locationMode]);

  // LGAs of the selected state (secondary rail). Empty while on "For You".
  const lgaOptions = useMemo(() => {
    if (!locationMode || activeCategory === FOR_YOU) return [];
    return [ALL_LGAS, ...(LGAS_BY_STATE[activeCategory] || [])];
  }, [locationMode, activeCategory]);

  const forYouProducts = useMemo(() => allProducts.slice(0, 15), [allProducts]);

  const activeProducts = useMemo(() => {
    let list =
      activeCategory === FOR_YOU
        ? forYouProducts
        : productsByCategory[activeCategory] || [];
    if (locationMode && activeLga !== ALL_LGAS) {
      list = list.filter((p) => p.lga === activeLga);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((p) => p.title.toLowerCase().includes(q));
  }, [activeCategory, activeLga, locationMode, searchQuery, forYouProducts, productsByCategory]);

  const activeLabel = useMemo(() => {
    if (activeCategory === FOR_YOU) return "For You";
    if (locationMode && activeLga !== ALL_LGAS) return `${activeCategory} · ${activeLga}`;
    return activeCategory;
  }, [activeCategory, activeLga, locationMode]);

  useEffect(() => {
    if (vendorId) dispatch(fetchVendorDetail(vendorId));
  }, [dispatch, vendorId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      vendorId ? dispatch(fetchVendorDetail(vendorId)) : Promise.resolve(),
      Promise.resolve(refetchProducts()),
    ]).finally(() =>
      setRefreshing(false)
    );
  }, [dispatch, vendorId, refetchProducts]);

  const onRequestLocation = useCallback(() => dispatch(detectCurrentLocation()), [dispatch]);

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
  }, []);

  // ── layout math ───────────────────────────────────────────────────────────
  const railWidth = isDesktop ? RAIL_DESKTOP : RAIL_MOBILE;

  const isLandscape = viewMode === "landscape";
  const columns = isLandscape ? 1 : isDesktop ? 4 : 2;
  const gridPadH = isDesktop ? 14 : 12;
  const cardGap = 12;
  const contentRowWidth = width - 32; // marginHorizontal 16 each side
  const availForGrid = contentRowWidth - railWidth - 1 - gridPadH * 2;
  const cardWidth = isLandscape
    ? availForGrid
    : Math.floor((availForGrid - cardGap * (columns - 1)) / columns);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top"]}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 6, marginRight: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: tokens.text.primary,
            }}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: tokens.text.muted }}
          >
            {subtitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("SupportChat")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Chat with support"
          style={{ padding: 6, marginLeft: 8 }}
        >
          <Ionicons
            name="headset-outline"
            size={22}
            color={tokens.text.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={focusSearch}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 6, marginLeft: 8 }}
        >
          <Ionicons
            name="search"
            size={22}
            color={tokens.text.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.brand.default}
          />
        }
      >
        {/* ── Hero Banner ─────────────────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            borderRadius: 16,
            overflow: "hidden",
            height: isDesktop ? 200 : 180,
          }}
        >
          <Image
            source={bannerImage}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.15)"]}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />
          <View style={{ position: "absolute", top: 16, left: 16, right: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
              <Text style={{ fontSize: isDesktop ? 22 : 18 }}>{emoji}</Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: isDesktop ? 22 : 18,
                  fontWeight: "900",
                  color: "#FFF",
                }}
              >
                {name}
              </Text>
            </View>
            {!locationMode && (
              <Text
                style={{
                  fontSize: isDesktop ? 22 : 18,
                  fontWeight: "900",
                  color: "#FFF",
                }}
              >
                Wholesalers
              </Text>
            )}
            <Text
              numberOfLines={2}
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 16,
                maxWidth: "70%",
                marginTop: 4,
              }}
            >
              {subtitle}
            </Text>
          </View>

          {/* Contact button — anchored to the bottom, within the banner. */}
          <TouchableOpacity
            onPress={() => navigation.navigate("SupportChat")}
            accessibilityRole="button"
            accessibilityLabel={t("support.chat.title")}
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: tokens.brand.default,
              borderRadius: 12,
              paddingVertical: 14,
            }}
          >
            <Ionicons name="chatbubbles" size={18} color="#FFF" />
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{t("support.chat.title")}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search ──────────────────────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: tokens.bg.surface,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: tokens.border.default,
          }}
        >
          <Ionicons name="search" size={16} color={tokens.text.placeholder} />
          <TextInput
            ref={searchRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search in ${activeLabel}...`}
            placeholderTextColor={tokens.text.placeholder}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 13,
              color: tokens.text.primary,
            }}
          />
        </View>

        {/* ── LGA chips (location mode) — horizontal scroll under search ─ */}
        {locationMode && lgaOptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}
          >
            {lgaOptions.map((lga) => {
              const isActive = lga === activeLga;
              return (
                <TouchableOpacity
                  key={lga}
                  onPress={() => {
                    setActiveLga(lga);
                    setSearchQuery("");
                  }}
                  accessibilityRole="button"
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: isActive ? tokens.brand.default : tokens.bg.surface,
                    borderWidth: 1,
                    borderColor: isActive ? tokens.brand.default : tokens.border.default,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? "800" : "600",
                      color: isActive ? "#FFF" : tokens.text.primary,
                    }}
                  >
                    {lga === ALL_LGAS ? "All LGAs" : lga}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Refine: filters (location + rating in the sheet) + sort ─── */}
        <RefineBar
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          sections={locationMode ? ["rating"] : ["location", "rating"]}
          location={location}
          onRequestLocation={onRequestLocation}
          style={{ marginHorizontal: 16, marginTop: 12 }}
        />

        <PriceFilterBar
          activeIndex={filters.priceIndex}
          onSelect={(i) => setFilters((f) => ({ ...f, priceIndex: i }))}
          style={{ marginHorizontal: 16, marginTop: 8 }}
        />

        {/* Condition filter is meaningless in a condition-scoped marketplace
            (Second Hand = all SECOND_HAND). */}
        {!condition && (
          <ConditionFilterBar
            value={filters.condition}
            onSelect={(v) => setFilters((f) => ({ ...f, condition: v }))}
            style={{ marginHorizontal: 16, marginTop: 4 }}
          />
        )}

        {/* ── Content area: rail + product grid ────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 12,
            marginHorizontal: 16,
          }}
        >
          {/* ── Rail / sidebar — sticky: stays put while the page scrolls ── */}
          <ScrollView
            style={{
              width: railWidth,
              maxWidth: railWidth,
              flexShrink: 0,
              alignSelf: "flex-start",
              height: viewportHeight,
              position: "sticky",
              top: 0,
              backgroundColor: tokens.bg.surface,
              borderRightWidth: 1,
              borderRightColor: tokens.border.default,
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {categories.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setActiveCategory(cat.id);
                    setActiveLga(ALL_LGAS);
                    setSearchQuery("");
                  }}
                  style={{
                    height: CELL_HEIGHT,
                    justifyContent: "center",
                    paddingHorizontal: 6,
                    backgroundColor: isActive
                      ? tokens.bg.canvas
                      : "transparent",
                    borderLeftWidth: isActive ? 3 : 0,
                    borderLeftColor: tokens.brand.default,
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 11,
                      lineHeight: 14,
                      textAlign: "left",
                      fontWeight: isActive ? "800" : "500",
                      color: isActive
                        ? tokens.brand.default
                        : tokens.text.primary,
                    }}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Product grid ───────────────────────────────────────────── */}
          <View style={{ flex: 1, minWidth: 0, paddingLeft: gridPadH, paddingRight: gridPadH }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: tokens.text.primary,
                }}
              >
                {activeLabel}
              </Text>
              <TouchableOpacity
                onPress={() => setViewMode((prev) => (prev === "grid" ? "landscape" : "grid"))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={
                  isLandscape ? "Switch to grid view" : "Switch to landscape list view"
                }
                style={{
                  padding: 6,
                  borderRadius: 10,
                  backgroundColor: tokens.bg.surface,
                  borderWidth: 1,
                  borderColor: tokens.border.default,
                }}
              >
                <Ionicons
                  name={isLandscape ? "grid-outline" : "list-outline"}
                  size={18}
                  color={tokens.text.primary}
                />
              </TouchableOpacity>
            </View>

            {loading && allProducts.length === 0 ? (
              <SkeletonLoader.ProductGrid
                columns={columns}
                count={8}
                cardWidth={cardWidth}
                variant={viewMode}
              />
            ) : activeProducts.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <Ionicons
                  name="bag-outline"
                  size={36}
                  color={tokens.text.placeholder}
                />
                <Text
                  style={{
                    fontSize: 13,
                    color: tokens.text.muted,
                    marginTop: 10,
                  }}
                >
                  No products yet
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: cardGap,
                }}
              >
                {activeProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    width={cardWidth}
                    variant={viewMode}
                    isSaved={savedIds.includes(p.id)}
                    onToggleSave={() =>
                      dispatch(
                        toggleSaved({
                          id: p.id,
                          title: p.title,
                          price: p.price,
                          image: p.images?.[0],
                        })
                      )
                    }
                    onPress={() =>
                      navigation.push("ProductDetail", { productId: p.id })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
