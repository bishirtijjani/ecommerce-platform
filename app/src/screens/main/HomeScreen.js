import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import HScroll from "../../components/home/HScroll";
import ListingCard from "../../components/home/ListingCard";
import BannerCard from "../../components/home/BannerCard";
import BannerPill from "../../components/home/BannerPill";
import ShopCard from "../../components/home/ShopCard";
import CategoryTile from "../../components/category/CategoryTile";
import { ShopHighlightsBar, StoryViewer } from "../../components/home/ShopHighlights";
import SkeletonLoader from "../../components/SkeletonLoader";
import { FILTERS, BANNERS } from "../../components/home/homeData";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { fetchVendors, fetchFeaturedProducts } from "../../store/slices/marketplaceSlice";
import { fetchCategories, hydrateCategoriesFromCache } from "../../store/slices/categoriesSlice";
import { normalizeProduct, normalizeVendor, normalizeCategory } from "../../lib/normalizeMarketplace";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";

// Customer app home/browse screen (vendor-marketplace direction), styled
// with the Marketplace brand tokens. Listings, shops and categories all come from
// the real backend catalog (see store/slices/marketplaceSlice.js and
// categoriesSlice.js). "See all" opens the marketplace-style browse screen
// (CategoriesScreen), which any category tile deep-links into.

export default function HomeScreen({ navigation }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [viewerHighlight, setViewerHighlight] = useState(null);
  const dispatch = useDispatch();
  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));

  const vendors = useSelector((s) => s.marketplace.vendors.list);
  const vendorsLoading = useSelector((s) => s.marketplace.vendors.loading);
  const rawFeatured = useSelector((s) => s.marketplace.featured.list);
  const featuredLoading = useSelector((s) => s.marketplace.featured.loading);
  const backendCategories = useSelector((s) => s.categories.list);
  const categoriesLoading = useSelector((s) => s.categories.loading);
  const homeCategorySetting = useSelector((s) => s.settings.values?.["home.categories"]);

  useEffect(() => {
    if (vendors?.length === 0) dispatch(fetchVendors());
    dispatch(fetchFeaturedProducts());
    dispatch(hydrateCategoriesFromCache());
    dispatch(fetchCategories());
  }, [dispatch]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      dispatch(fetchVendors()),
      dispatch(fetchFeaturedProducts()),
      dispatch(fetchCategories()),
    ]).finally(() => setRefreshing(false));
  }, [dispatch]);

  // The category grid is curated by the admin on the "Home categories" page
  // (admin dashboard) and delivered via the `home.categories` public setting as
  // an ordered list of { id, featured }. We render the featured ones in that
  // order. When the admin hasn't saved a layout yet, we fall back to the legacy
  // heuristic: categories with products first, then a fixed pinned set.
  const HOME_CATEGORY_TILES = 8;
  const PINNED_CATEGORY_NAMES = [
    "Small Chops",
    "Provision & Groceries",
    "Building & Construction",
    "Services",
    "Baby Products",
    "Farm Products",
    "Pharmacy",
    "Islamic Herbal",
  ];
  const categoryTiles = useMemo(() => {
    const tiles = (backendCategories || []).map(normalizeCategory).filter(Boolean);

    const curated = Array.isArray(homeCategorySetting?.items)
      ? homeCategorySetting.items.filter((i) => i && i.featured && i.id)
      : [];
    if (curated.length) {
      const byId = new Map(tiles.map((c) => [c.id, c]));
      return curated.map((i) => byId.get(i.id)).filter(Boolean);
    }

    const pinnedSet = new Set(PINNED_CATEGORY_NAMES);
    const auto = tiles
      .filter((c) => !pinnedSet.has(c.label))
      .map((c, index) => ({ c, index }))
      .sort((a, b) => (b.c.productCount - a.c.productCount) || (a.index - b.index))
      .slice(0, HOME_CATEGORY_TILES)
      .map((entry) => entry.c);
    const byName = new Map(tiles.map((c) => [c.label, c]));
    const pinned = PINNED_CATEGORY_NAMES.map((name) => byName.get(name)).filter(Boolean);
    return [...auto, ...pinned];
  }, [backendCategories, homeCategorySetting]);

  const featuredListings = useMemo(
    () =>
      rawFeatured.map(normalizeProduct).map((p) => ({
        id: p.id,
        title: p.title,
        price: formatNaira(p.price),
        was: p.was ? formatNaira(p.was) : undefined,
        badge: p.discountPercent ? `-${p.discountPercent}%` : undefined,
        condition: p.condition,
        image: p.images[0],
      })),
    [rawFeatured]
  );

  // Platform promo story tiles (Instagram/WhatsApp-style) built from the
  // placeholder FILTERS data. Each tile's `image` is the circle cover and its
  // `stories` are the slides opened by StoryViewer - swap both for real media
  // once vendor story content lands (see homeData.js).
  const storyHighlights = useMemo(
    () =>
      FILTERS.map((f) => ({
        id: f.id,
        name: f.label,
        coverImageUrl: f.image,
        stories: f.stories,
      })),
    []
  );

  // Marketplace banners are only shown while their backing vendor is live.
  // `/vendors` already excludes suspended/hidden vendors (status/isActive/
  // adminActiveOverride), so a marketplace suspended in admin drops off Home
  // the same way it drops out of the shop lists.
  const activeVendorNames = useMemo(
    () => new Set((vendors || []).map((v) => v.name)),
    [vendors]
  );
  const activeBanners = useMemo(
    () => BANNERS.filter((b) => !b.vendorName || activeVendorNames.has(b.vendorName)),
    [activeVendorNames]
  );

  // Shops grouped by their fixed top-level industry, in a curated display
  // order. Each shop's industry is its single explicit category (source of
  // truth for marketplace grouping), so a shop appears under exactly one group
  // even when its catalog spans several subcategories. Category groups are
  // shown in CATEGORY_ORDER (Clothing & Fashion, then Vehicles & Automobiles,
  // then Furniture, then Real Estate); shops inside each group follow
  // SHOP_ORDER. Thin groups are padded with "Coming Soon" placeholder cards.
  const CATEGORY_ORDER = ["Clothing & Fashion", "Vehicles & Automobiles", "Furniture", "Real Estate"];
  const SHOP_ORDER = ["FMK Clothing", "Algazaru Abayas", "Furniture House", "VAVA Furniture"];
  const HIDDEN_VENDORS = ["Mudatex", "El samad", "China Market", "Arab World", "Wholesalers", "Second Hand Items"];
  const shopGroups = useMemo(() => {
    const byCategory = new Map();
    vendors.forEach((raw) => {
      const v = normalizeVendor(raw);
      if (!v) return;
      if (HIDDEN_VENDORS.includes(v.name)) return;
      const title = v.industry || (v.categories.length > 0 ? v.categories[0].name : "Other");
      const group = byCategory.get(title) || { id: title, title, shops: [] };
      group.shops.push(v);
      byCategory.set(title, group);
    });
    const groups = Array.from(byCategory.values());
    const rank = (list, key) => {
      const i = list.indexOf(key);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    groups.sort((a, b) => rank(CATEGORY_ORDER, a.title) - rank(CATEGORY_ORDER, b.title));
    groups.forEach((g) =>
      g.shops.sort((a, b) => rank(SHOP_ORDER, a.name) - rank(SHOP_ORDER, b.name))
    );
    // Pad thin groups (Furniture, Real Estate, etc.) with "Coming Soon"
    // placeholders so every section shows a full row of at least 4 cards.
    const SHOPS_PER_ROW = 4;
    groups.forEach((g) => {
      let filler = 0;
      while (g.shops.length < SHOPS_PER_ROW) {
        g.shops.push({ id: `${g.id}-coming-soon-${filler}`, name: "Coming Soon", comingSoon: true });
        filler += 1;
      }
    });
    return groups;
  }, [vendors]);

  const openStorefront = (shop) => navigation.navigate("VendorStorefront", { vendorId: shop.id, vendorName: shop.name });
  const openProduct = (productId) => navigation.navigate("ProductDetail", { productId });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <View className="flex-row items-center gap-2">
          <Image source={require("../../../assets/brand-logo.png")} style={{ width: 28, height: 28 }} contentFit="contain" />
          <Text className="text-[22px] font-black tracking-tight" style={{ color: tokens.brand.default }}>
            my <Text style={{ color: tokens.brand.default }}>sooq</Text>
          </Text>
        </View>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity
            onPress={() => navigation.navigate("SupportChat")}
            accessibilityRole="button"
            accessibilityLabel={t("support.chat.title")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View>
              <Ionicons name="headset-outline" size={22} color={tokens.text.primary} />
              <View
                style={{
                  position: "absolute",
                  top: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: tokens.status.error,
                  borderWidth: 1.5,
                  borderColor: tokens.bg.canvas,
                }}
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("MainTabs", { screen: "CartTab" })}
            accessibilityRole="button"
            accessibilityLabel="Saved items"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="heart-outline" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("NotificationCenter")}
            accessibilityRole="button"
            accessibilityLabel={t("notificationCenter.title")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View>
              <Ionicons name="notifications-outline" size={22} color={tokens.text.primary} />
              <View className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ backgroundColor: tokens.brand.default }} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} colors={[tokens.brand.default]} />}
      >
        {/* Search - the front door for both browsing and Requests. Tapping it
            opens the real search screen; the "Ask" chip jumps straight to
            posting a Request (the reverse-marketplace path). */}
        <View className="px-4 flex-row items-center" style={{ gap: 8 }}>
          <View className="flex-row items-center rounded-full pl-4 pr-1.5 py-1.5 gap-2 flex-1" style={{ backgroundColor: tokens.bg.surface }}>
            <Ionicons name="search" size={18} color={tokens.text.placeholder} />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("SearchResults", {})}
              accessibilityRole="button"
              accessibilityLabel="Search"
              className="flex-1"
            >
              <Text className="text-[13px]" style={{ color: tokens.text.muted }}>Search or ask for anything...</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("SearchResults", {})}
              accessibilityRole="button"
              accessibilityLabel="Go to search"
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: tokens.brand.default }}
            >
              <Ionicons name="arrow-forward" size={16} color={tokens.text.onBrand} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("RequestCompose")}
            accessibilityRole="button"
            accessibilityLabel="Ask sellers"
            className="flex-row items-center rounded-full px-3 py-3 gap-1"
            style={{ backgroundColor: tokens.brand.soft }}
          >
            <Ionicons name="megaphone-outline" size={16} color={tokens.brand.strong} />
            <Text className="text-[12px] font-bold" style={{ color: tokens.brand.strong }}>
              Ask
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stories - platform promo tiles (Instagram/WhatsApp style). Each
            circle opens StoryViewer with placeholder slides; swap the
            homeData FILTERS stories for real media later.
            HIDDEN: home story/highlight row intentionally disabled for now.
            Code kept intact - uncomment the line below to bring it back. */}
        {/* <ShopHighlightsBar highlights={storyHighlights} onHighlightPress={setViewerHighlight} /> */}

        {/* Platform storefronts - links out to the platform owners' own shops */}
        <View className="flex-row px-4 mt-6" style={{ gap: 12 }}>
          {activeBanners.filter((b) => !b.wide).map((b) => (
            <BannerCard key={b.id} banner={b} onPress={() => navigation.navigate(b.route)} />
          ))}
        </View>

        {/* Wide banners - full-width pills, same design family, button height */}
        <View className="px-4 mt-2.5" style={{ gap: 10 }}>
          {activeBanners.filter((b) => b.wide).map((b) => (
            <BannerPill key={b.id} banner={b} onPress={() => navigation.navigate(b.route)} />
          ))}
        </View>

        {/* Categories - cover image (or initial) + name, tap deep-links in */}
        <View className="flex-row items-center justify-between px-4 mt-7 mb-4">
          <Text className="font-black text-lg" style={{ color: tokens.brand.default }}>Categories</Text>
          <TouchableOpacity onPress={() => navigation.navigate("AllCategoriesList")}>
            <Text className="font-bold text-[12px]" style={{ color: tokens.brand.default }}>See all →</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row flex-wrap px-3" style={{ justifyContent: "flex-start", columnGap: "2%", rowGap: 8 }}>
          {categoriesLoading && categoryTiles.length === 0
            ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((i) => (
                <SkeletonLoader key={i} width="23%" height={100} radius={16} />
              ))
            : categoryTiles.map((c) => (
                <CategoryTile
                  key={c.id}
                  category={c}
                  width="23%"
                  onPress={() => navigation.navigate("AllCategories", { categoryId: c.id })}
                />
              ))}
        </View>

        {/* Shops - directory of vendors, grouped by industry. Hidden entirely
            when there are no active shops to show (e.g. all hidden/suspended),
            so we don't render an empty header + "All shops" button.

            HIDDEN: the Shops directory section is intentionally disabled for
            now (may be brought back later). Code kept intact - uncomment the
            block below to restore it. Entry points that also need re-enabling:
            the ChatsScreen empty-state CTA (screens/main/ChatsScreen.js) and
            the `shops` intent in lib/pendingIntent.js. The `Shops` route in
            navigation/HomeStackNavigator.js is deliberately left registered so
            restoring is a one-line change.

        {((vendorsLoading && vendors?.length === 0) || shopGroups.length > 0) && (
          <>
            <View className="flex-row items-center justify-between px-4 mt-7 mb-4">
              <Text className="text-primary font-black text-lg">Shops</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Shops")}>
                <Text className="text-primary font-bold text-[12px]">More →</Text>
              </TouchableOpacity>
            </View>
            {vendorsLoading && vendors?.length === 0 ? (
              <View className="mb-5">
                <SkeletonLoader width={100} height={13} radius={4} style={{ marginBottom: 10, marginLeft: 16 }} />
                <View className="flex-row flex-wrap px-4 my-2" style={{ justifyContent: "flex-start", columnGap: 10, rowGap: 12 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <SkeletonLoader.ShopTile key={i} />
                  ))}
                </View>
              </View>
            ) : (
              shopGroups.map((group) => (
                <View key={group.id} className="mb-5">
                  <Text className="text-primary font-black text-[14px] mb-2 px-4">
                    {group.title}
                  </Text>
                  <View className="flex-row flex-wrap px-4 my-2" style={{ justifyContent: "flex-start", columnGap: 10, rowGap: 12 }}>
                    {group.shops.map((shop) => (
                      <ShopCard
                        key={shop.id}
                        shop={shop}
                        onPress={() => !shop.comingSoon && openStorefront(shop)}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate("Shops")}
              className="mx-4 my-2 rounded-xl items-center justify-center py-3"
              style={{ backgroundColor: tokens.brand.soft, borderWidth: 1, borderColor: tokens.brand.softBorder }}
            >
              <Text className="font-bold text-[13px]" style={{ color: tokens.brand.strong }}>All shops →</Text>
            </TouchableOpacity>
          </>
        )}
        */}

        {/* Featured listings - horizontal scroll */}
        <View className="px-4 mt-7 mb-4">
          <Text className="font-black text-lg" style={{ color: tokens.brand.default }}>Featured listings</Text>
        </View>
        {featuredLoading && featuredListings.length === 0 ? (
          <HScroll contentContainerStyle={{ paddingHorizontal: 16 }}>
            {[1, 2, 3].map((i) => <SkeletonLoader.ListingCard key={i} />)}
          </HScroll>
        ) : (
          <HScroll
            contentContainerStyle={{ paddingHorizontal: 16 }}
            data={featuredListings}
            keyExtractor={(item) => String(item.id)}
            renderItem={(item) => (
              <ListingCard
                item={item}
                isSaved={savedIds.includes(item.id)}
                onToggleSave={() => dispatch(toggleSaved(item))}
                onPress={() => openProduct(item.id)}
              />
            )}
          />
        )}
      </ScrollView>

      <StoryViewer
        visible={!!viewerHighlight}
        highlight={viewerHighlight}
        onClose={() => setViewerHighlight(null)}
        onOpenProduct={(productId) => navigation.navigate("ProductDetail", { productId })}
      />
    </SafeAreaView>
  );
}
