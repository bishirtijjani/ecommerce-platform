/**
 * AllCategoriesScreen - the category directory, reached from Home's "See all"
 * in the Categories section. A search field at the top filters the category
 * cards by name; tapping a card opens that category's dedicated page
 * (CategoriesScreen), exactly like a Home category tile does.
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import CategoryTile from "../../components/category/CategoryTile";
import SkeletonLoader from "../../components/SkeletonLoader";
import EmptyState from "../../components/EmptyState";
import { goBackOr } from "../../lib/goBack";
import { useTheme } from "../../theme";
import { fetchCategories, hydrateCategoriesFromCache } from "../../store/slices/categoriesSlice";
import { normalizeCategory } from "../../lib/normalizeMarketplace";

export default function AllCategoriesScreen() {
  const navigation = useNavigation();
  const { tokens } = useTheme();
  const dispatch = useDispatch();

  const backendCategories = useSelector((s) => s.categories.list);
  const categoriesLoading = useSelector((s) => s.categories.loading);

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(hydrateCategoriesFromCache());
    dispatch(fetchCategories());
  }, [dispatch]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.resolve(dispatch(fetchCategories())).finally(() => setRefreshing(false));
  };

  // Categories with products first (by count), then the empty ones in the
  // backend's sort order - matching the Home grid's ordering.
  const categories = useMemo(() => {
    return (backendCategories || [])
      .map(normalizeCategory)
      .filter(Boolean)
      .map((c, index) => ({ c, index }))
      .sort((a, b) => {
        const aHas = a.c.productCount > 0 ? 1 : 0;
        const bHas = b.c.productCount > 0 ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        if (a.c.productCount !== b.c.productCount) return b.c.productCount - a.c.productCount;
        return a.index - b.index;
      })
      .map((entry) => entry.c);
  }, [backendCategories]);

  const q = searchQuery.trim().toLowerCase();
  const visibleCategories = useMemo(
    () => (q ? categories.filter((c) => c.label.toLowerCase().includes(q)) : categories),
    [categories, q]
  );

  const showSkeleton = categoriesLoading && categories.length === 0;

  const openCategory = (c) => navigation.push("AllCategories", { categoryId: c.id });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
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
        <Text style={{ flex: 1, fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>
          All Categories
        </Text>
      </View>

      {/* Search - filters the category cards below */}
      <View
        style={{
          marginHorizontal: 12,
          marginTop: 10,
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
          placeholder="Search categories..."
          placeholderTextColor={tokens.text.placeholder}
          style={{ flex: 1, marginLeft: 8, fontSize: 13, color: tokens.text.primary, outlineStyle: "none" }}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={tokens.text.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.brand.default}
            colors={[tokens.brand.default]}
          />
        }
      >
        {showSkeleton ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              paddingHorizontal: 12,
              paddingTop: 14,
              justifyContent: "flex-start",
              columnGap: "4%",
              rowGap: 14,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <SkeletonLoader key={i} width="22%" height={84} radius={16} />
            ))}
          </View>
        ) : visibleCategories.length === 0 ? (
          <EmptyState
            icon="grid-outline"
            title={q ? "No matching categories" : "No categories yet"}
            subtitle={q ? "Try a different search." : "Check back soon."}
            fill={false}
          />
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              paddingHorizontal: 12,
              paddingTop: 14,
              justifyContent: "flex-start",
              columnGap: "4%",
              rowGap: 14,
            }}
          >
            {visibleCategories.map((c) => (
              <CategoryTile
                key={c.id}
                category={c}
                width="22%"
                onPress={() => openCategory(c)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
