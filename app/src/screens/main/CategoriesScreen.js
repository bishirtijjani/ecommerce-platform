/**
 * CategoriesScreen - the dedicated page for ONE category, reached by tapping a
 * category tile on Home (or a card on AllCategoriesScreen). It is always opened
 * with a `categoryId`; the whole-category directory lives on AllCategoriesScreen.
 *
 * Layout: a fixed header + search + refine row, then a two-pane area that fills
 * the rest of the screen. The left rail lists THIS category's subcategories
 * (from the admin taxonomy, plus a leading "For You" row); the right panel is a
 * windowed FlatList showing the category's products.
 *
 * Products come from the server-side browse endpoint (GET /vendors/products
 * with categoryId/subcategoryId + facets + sort) via useProductBrowse; the
 * search box narrows the returned page client-side.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput,
  RefreshControl, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ProductCard from "../../components/product/ProductCard";
import SkeletonLoader from "../../components/SkeletonLoader";
import EmptyState from "../../components/EmptyState";
import PriceFilterBar from "../../components/product/PriceFilterBar";
import ConditionFilterBar from "../../components/product/ConditionFilterBar";
import RefineBar from "../../components/product/RefineBar";
import { goBackOr } from "../../lib/goBack";
import { useTheme } from "../../theme";
import { useIsDesktop } from "../../lib/responsive";
import { fetchCategories, hydrateCategoriesFromCache } from "../../store/slices/categoriesSlice";
import { detectCurrentLocation } from "../../store/slices/locationSlice";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { normalizeCategory } from "../../lib/normalizeMarketplace";
import useProductBrowse from "../../hooks/useProductBrowse";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "../../lib/productFilters";

const FOR_YOU_ID = "for-you";

// Rail sizing mirrors MarketScreen — 80px below the desktop breakpoint, 116px
// at desktop. DO NOT WIDEN: labels wrap to 2 lines at fontSize 11 / lineHeight 14.
const RAIL_MOBILE = 80;
const RAIL_DESKTOP = 116;
const CELL_HEIGHT = 44;

// Shared with MarketScreen so the grid/list preference carries across screens.
const VIEW_MODE_STORAGE_KEY = "marketplace:viewMode";
const VALID_VIEW_MODES = ["grid", "landscape"];

export default function CategoriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();
  const { width } = useWindowDimensions();
  const listRef = useRef(null);
  // Toggling grid/list changes numColumns, which requires remounting the
  // FlatList (RN forbids changing numColumns on the fly) - remember where we
  // were and restore it after the remount so the list doesn't jump to the top.
  const scrollOffsetRef = useRef(0);
  const restoreOffsetRef = useRef(null);

  const backendCategories = useSelector((s) => s.categories.list);
  const categoriesLoading = useSelector((s) => s.categories.loading);
  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));
  const location = useSelector((s) => s.location);

  const categoryId = route?.params?.categoryId;
  const category = useMemo(
    () => (backendCategories || []).find((c) => c.id === categoryId) || null,
    [backendCategories, categoryId]
  );
  const tile = useMemo(() => normalizeCategory(category), [category]);
  const categoryLabel = tile?.label || "";

  // The left rail's active row: "For You" (whole category) or a subcategory id.
  const [activeId, setActiveId] = useState(FOR_YOU_ID);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);

  const isForYou = activeId === FOR_YOU_ID;

  const { products, loading: productsLoading, refetch: refetchProducts } = useProductBrowse({
    enabled: Boolean(categoryId),
    categoryId,
    subcategoryId: isForYou ? undefined : activeId,
    filters,
    sort,
    limit: 300,
  });

  // Hydrate persisted view mode preference for this device.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && stored && VALID_VIEW_MODES.includes(stored)) {
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

  useEffect(() => {
    dispatch(hydrateCategoriesFromCache());
    dispatch(fetchCategories());
  }, [dispatch]);

  // Re-select "For You" and clear refinement when deep-linked to a new category.
  useEffect(() => {
    setActiveId(FOR_YOU_ID);
    setSearchQuery("");
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
  }, [categoryId]);

  // Subcategories from the admin taxonomy (counts included by the backend).
  const subcategories = useMemo(() => tile?.subcategories || [], [tile]);

  const q = searchQuery.trim().toLowerCase();

  // The server already scoped to the active subcategory and applied facets +
  // sort; the search box narrows the returned page by title.
  const visibleProducts = useMemo(
    () => (q ? products.filter((p) => p.title.toLowerCase().includes(q)) : products),
    [products, q]
  );

  // Jump back to the top whenever the active row changes.
  useEffect(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [activeId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      dispatch(fetchCategories()),
      Promise.resolve(refetchProducts()),
    ]).finally(() => setRefreshing(false));
  }, [dispatch, refetchProducts]);

  const onRequestLocation = useCallback(() => dispatch(detectCurrentLocation()), [dispatch]);

  const toggleViewMode = () => {
    restoreOffsetRef.current = scrollOffsetRef.current;
    setViewMode((prev) => (prev === "grid" ? "landscape" : "grid"));
  };

  // After the grid <-> list remount, put the list back where it was.
  const handleContentSizeChange = useCallback(() => {
    if (restoreOffsetRef.current == null) return;
    const offset = restoreOffsetRef.current;
    restoreOffsetRef.current = null;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset?.({ offset, animated: false });
    });
  }, []);

  // ── layout math (mirrors MarketScreen) ─────────────────────────────────────
  const railWidth = isDesktop ? RAIL_DESKTOP : RAIL_MOBILE;
  const isLandscape = viewMode === "landscape";
  const columns = isLandscape ? 1 : isDesktop ? 4 : 2;
  const hPad = 12;
  const gridPadH = isDesktop ? 10 : 8;
  const cardGap = 10;
  const contentRowWidth = width - hPad * 2;
  const availForGrid = contentRowWidth - railWidth - 1 - gridPadH * 2;
  const cardWidth = isLandscape
    ? availForGrid
    : Math.floor((availForGrid - cardGap * (columns - 1)) / columns);

  const showContentSkeleton = productsLoading && products?.length === 0;

  const listHeader = (
    <View>
      {/* No heading - the category title in the header + the rail already say
          where the user is. Just the grid/list toggle, right-aligned. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          marginBottom: 6,
        }}
      >
        <TouchableOpacity
          onPress={toggleViewMode}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={isLandscape ? "Switch to grid view" : "Switch to landscape list view"}
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
    </View>
  );

  const notFound = !categoryId || (!categoriesLoading && (backendCategories || []).length > 0 && !tile);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: hPad,
          paddingVertical: 8,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4, marginRight: 6 }}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>
          {categoryLabel || "Category"}
        </Text>
      </View>

      {notFound ? (
        <EmptyState icon="grid-outline" title="Category not found" subtitle="This category may have moved." />
      ) : (
        <>
          {/* Search */}
          <View
            style={{
              marginHorizontal: hPad,
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: tokens.bg.surface,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: tokens.border.default,
            }}
          >
            <Ionicons name="search" size={16} color={tokens.text.placeholder} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${categoryLabel || "this category"}...`}
              placeholderTextColor={tokens.text.placeholder}
              style={{ flex: 1, marginLeft: 8, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
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
            style={{ marginHorizontal: hPad, marginTop: 10 }}
          />

          <PriceFilterBar
            activeIndex={filters.priceIndex}
            onSelect={(i) => setFilters((f) => ({ ...f, priceIndex: i }))}
            style={{ marginHorizontal: hPad, marginTop: 8 }}
          />

          <ConditionFilterBar
            value={filters.condition}
            onSelect={(v) => setFilters((f) => ({ ...f, condition: v }))}
            style={{ marginHorizontal: hPad, marginTop: 4, marginBottom: 4 }}
          />

          {/* Rail + content - both panes scroll independently inside this row */}
          <View style={{ flex: 1, minHeight: 0, flexDirection: "row", marginTop: 4, marginHorizontal: hPad }}>
            {/* Persistent rail - this category's For You + subcategories */}
            <ScrollView
              style={{
                width: railWidth,
                maxWidth: railWidth,
                flexShrink: 0,
                backgroundColor: tokens.bg.surface,
                borderRightWidth: 1,
                borderRightColor: tokens.border.default,
              }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16, paddingTop: 4 }}
            >
              <TouchableOpacity
                onPress={() => {
                  setActiveId(FOR_YOU_ID);
                  setSearchQuery("");
                }}
                style={{
                  height: CELL_HEIGHT,
                  justifyContent: "center",
                  paddingHorizontal: 6,
                  backgroundColor: isForYou ? tokens.bg.canvas : "transparent",
                  borderLeftWidth: isForYou ? 3 : 0,
                  borderLeftColor: tokens.brand.default,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 11,
                    lineHeight: 14,
                    textAlign: "left",
                    fontWeight: isForYou ? "800" : "500",
                    color: isForYou ? tokens.brand.default : tokens.text.primary,
                  }}
                >
                  For You
                </Text>
              </TouchableOpacity>

              {subcategories.map((sub) => {
                const isActive = sub.id === activeId;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    onPress={() => {
                      setActiveId(sub.id);
                      setSearchQuery("");
                    }}
                    style={{
                      height: CELL_HEIGHT,
                      justifyContent: "center",
                      paddingHorizontal: 6,
                      backgroundColor: isActive ? tokens.bg.canvas : "transparent",
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
                        color: isActive ? tokens.brand.default : tokens.text.primary,
                      }}
                    >
                      {sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Content panel - windowed product list */}
            <View style={{ flex: 1, minWidth: 0, paddingLeft: gridPadH, paddingRight: gridPadH }}>
              {showContentSkeleton ? (
                <SkeletonLoader.ProductGrid
                  columns={columns}
                  count={6}
                  cardWidth={cardWidth}
                  variant={viewMode}
                />
              ) : (
                <FlatList
                  ref={listRef}
                  key={`cat-${columns}`}
                  data={visibleProducts}
                  keyExtractor={(p) => p.id}
                  numColumns={columns}
                  renderItem={({ item: p }) => (
                    <ProductCard
                      product={p}
                      width={cardWidth}
                      variant={viewMode}
                      isSaved={savedIds.includes(p.id)}
                      onToggleSave={() =>
                        dispatch(toggleSaved({ id: p.id, title: p.title, price: p.price, image: p.images?.[0] }))
                      }
                      onPress={() => navigation.push("ProductDetail", { productId: p.id })}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  onScroll={(e) => {
                    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                  }}
                  scrollEventThrottle={16}
                  onContentSizeChange={handleContentSizeChange}
                  columnWrapperStyle={columns > 1 ? { gap: cardGap } : undefined}
                  contentContainerStyle={{ paddingBottom: 20, gap: cardGap }}
                  ListHeaderComponent={listHeader}
                  ListEmptyComponent={
                    <EmptyState
                      icon="cube-outline"
                      title={q ? "No matches" : "No products yet"}
                      subtitle={q ? "Try a different search." : "Check back soon."}
                      fill={false}
                    />
                  }
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={tokens.brand.default}
                      colors={[tokens.brand.default]}
                    />
                  }
                />
              )}
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
