import React, { useCallback, useEffect, useRef, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import { View, Text, TextInput, TouchableOpacity, StatusBar, FlatList, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import api from "../../services/api";
import EmptyState from "../../components/EmptyState";
import RefineBar from "../../components/product/RefineBar";
import { detectCurrentLocation } from "../../store/slices/locationSlice";
import { SEARCH_SORTS, DEFAULT_FILTERS, priceParams } from "../../lib/productFilters";
import { withImageWidth } from "../../lib/imageUrl";

/**
 * Real marketplace search (wired to GET /search), and the front door for
 * Requests: when a search comes up empty we offer "post a Request" so a
 * customer can broadcast the need to sellers instead of hitting a dead end.
 */
export default function SearchResultsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tokens, isDark } = useTheme();
  const dispatch = useDispatch();

  const { latitude, longitude } = useSelector((s) => s.location);

  const [query, setQuery] = useState(route.params?.q || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("relevance");
  const inputRef = useRef(null);
  // Last term actually searched, so changing a filter/sort re-runs the same
  // query instead of losing it.
  const lastTermRef = useRef("");

  const runSearch = useCallback(
    async (q) => {
      const term = (q || "").trim();
      if (!term) return;
      lastTermRef.current = term;
      setLoading(true);
      setError(null);
      try {
        const params = { q: term };
        // Geo is opt-in ("Near me"). Sending lat/lng unconditionally made the
        // API geo-filter BOTH vendors and products, so any user with a saved
        // location silently lost matches whose vendor is outside the radius
        // (e.g. searching "bedsheet" returned nothing). Only narrow by distance
        // when the user actually asks for it.
        if (filters.nearMe && latitude != null && longitude != null) {
          params.lat = latitude;
          params.lng = longitude;
          params.radius = filters.radiusKm;
        }
        if (filters.priceIndex != null) Object.assign(params, priceParams(filters.priceIndex));
        if (filters.condition) params.condition = filters.condition;
        if (filters.minRating != null) params.minRating = filters.minRating;
        if (sort && sort !== "relevance") params.sort = sort;

        const envelope = await api.get("/search", { params });
        setResults(envelope?.data?.results || []);
      } catch (err) {
        setError(err?.message || "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    },
    [latitude, longitude, filters, sort],
  );

  // Run on entry (route param) and re-run whenever the query OR the active
  // filters/sort change (runSearch identity changes with filters/sort).
  useEffect(() => {
    const q = lastTermRef.current || route.params?.q;
    if (q) runSearch(q);
  }, [route.params?.q, runSearch]);

  const onSubmit = () => runSearch(query);

  const onRequestLocation = useCallback(() => dispatch(detectCurrentLocation()), [dispatch]);

  const openResult = (item) => {
    // ProductDetail / VendorStorefront live in the Home tab's nested stack, but
    // this screen is registered on the ROOT stack - so a bare
    // navigate("ProductDetail") is unhandled and silently does nothing. Route
    // through MainTabs → HomeTab, the same nested form used by
    // ChatThread/pendingIntent.
    if (item.kind === "vendor") {
      navigation.navigate("MainTabs", {
        screen: "HomeTab",
        params: { screen: "VendorStorefront", params: { vendorId: item.id } },
      });
    } else if (item.kind === "product") {
      navigation.navigate("MainTabs", {
        screen: "HomeTab",
        params: { screen: "ProductDetail", params: { productId: item.id } },
      });
    }
  };

  const askSellers = () => navigation.navigate("RequestCompose", { q: query.trim() });

  const hasResults = results.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: tokens.bg.surface,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={18} color={tokens.text.muted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            placeholder="Search anything on my sooq..."
            placeholderTextColor={tokens.text.placeholder || tokens.text.muted}
            autoFocus={!route.params?.q}
            style={{ flex: 1, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={tokens.text.muted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onSubmit}
            accessibilityRole="button"
            accessibilityLabel="Search"
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.brand.default,
            }}
          >
            <Ionicons name="arrow-forward" size={16} color={tokens.text.onBrand} />
          </TouchableOpacity>
        </View>
      </View>

      {searched && !loading && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          <RefineBar
            filters={filters}
            onFiltersChange={setFilters}
            sort={sort}
            onSortChange={setSort}
            sections={["price", "condition", "location", "rating", "state"]}
            sortOptions={SEARCH_SORTS}
            location={{ latitude, longitude }}
            onRequestLocation={onRequestLocation}
          />
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={error}
          ctaLabel="Try again"
          onCta={onSubmit}
        />
      ) : searched && !hasResults ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="search-outline"
            title={`We couldn't find "${query.trim()}"`}
            subtitle="Post a Request and nearby sellers will come to you."
            ctaLabel="Post a Request"
            onCta={askSellers}
          />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          ListHeaderComponent={
            /* Subtle, always-there bridge from "searching" to "asking". */
            <TouchableOpacity
              onPress={askSellers}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: tokens.bg.surfaceMuted || tokens.bg.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginTop: 4,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="megaphone-outline" size={16} color={tokens.brand.strong} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: tokens.text.primary }}>
                  Can't find it? Ask sellers
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={tokens.brand.strong} />
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openResult(item)}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: tokens.bg.surface,
                borderWidth: 1,
                borderColor: tokens.border.default,
                borderRadius: 14,
                padding: 12,
                marginBottom: 10,
              }}
            >
              {item.imageUrl || item.logoUrl || item.images?.[0] ? (
                <Image
                  source={{ uri: withImageWidth(item.logoUrl || item.imageUrl || item.images?.[0], 120) }}
                  style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: tokens.bg.surfaceMuted }}
                />
              ) : (
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 10,
                    backgroundColor: tokens.bg.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={item.kind === "vendor" ? "storefront-outline" : "pricetag-outline"}
                    size={20}
                    color={tokens.text.muted}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }} numberOfLines={1}>
                  {item.kind === "vendor"
                    ? `Shop${item._distanceKm != null ? ` · ${Math.round(item._distanceKm)}km` : ""}`
                    : `${item.vendor?.name || "Product"}${
                        item._distanceKm != null ? ` · ${Math.round(item._distanceKm)}km` : ""
                      }`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
