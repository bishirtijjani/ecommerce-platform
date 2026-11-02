import React, { useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { useVendorProducts, useDeleteProduct, useToggleProductAvailability } from "../hooks/useSeller";
import { Badge, Card, EmptyState, FilterChips, LoadingState, PageHeader, SearchField, Thumb } from "../components/ui";

const CONDITIONS = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "USED", label: "Used" },
  { value: "SECOND_HAND", label: "Second hand" },
];

const CONDITION_LABELS = { NEW: "New", USED: "Used", SECOND_HAND: "Second hand" };

export default function SellerProductsScreen() {
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const { data, isLoading, refetch } = useVendorProducts();
  const del = useDeleteProduct();
  const toggle = useToggleProductAvailability();

  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState("");

  const products = data?.data || data?.products || (Array.isArray(data) ? data : []);
  const total = data?.meta?.total ?? products.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (condition && (p.condition || "NEW") !== condition) return false;
      if (!q) return true;
      const category = [p.category?.name, p.subcategory?.name].filter(Boolean).join(" ").toLowerCase();
      return p.name?.toLowerCase().includes(q) || category.includes(q);
    });
  }, [products, search, condition]);

  const confirmDelete = (product) => {
    Alert.alert("Delete product", `Remove "${product.name}" from your shop?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate(product.id) },
    ]);
  };

  const renderProduct = ({ item }) => {
    const variants = item.variants || [];
    const categoryPath = [item.category?.name, item.subcategory?.name].filter(Boolean).join(" › ");
    const outOfStock = (item.stock ?? 0) <= 0;
    const lowStock = !outOfStock && (item.stock ?? 0) <= 5;

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("SellerProductForm", { productId: item.id })}>
        <Card style={{ marginBottom: 12, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Thumb uri={item.images?.[0] || item.imageUrl} size={62} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
              <Text
                numberOfLines={2}
                style={{ flex: 1, fontSize: 15, fontWeight: "700", color: tokens.text.primary, lineHeight: 20 }}
              >
                {item.name}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SellerProductForm", { productId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  backgroundColor: tokens.bg.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="create-outline" size={16} color={tokens.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  backgroundColor: tokens.status.errorSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" size={15} color={tokens.status.errorStrong} />
              </TouchableOpacity>
            </View>

            <Text numberOfLines={1} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 3 }}>
              {categoryPath || "Uncategorised"}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }}>
                {formatNaira(item.basePrice)}
              </Text>
              {(item.condition || "NEW") !== "NEW" ? (
                <Badge label={CONDITION_LABELS[item.condition] || item.condition} tone="neutral" />
              ) : null}
              {variants.length > 1 ? <Badge label={`${variants.length} variants`} tone="brand" /> : null}
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: tokens.border.default,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: item.isAvailable ? tokens.status.success : tokens.text.placeholder,
              }}
            />
            <Text style={{ fontSize: 12, color: tokens.text.muted }}>{item.isAvailable ? "Live" : "Hidden"}</Text>
            <Text style={{ fontSize: 12, color: tokens.text.placeholder }}>·</Text>
            <Text style={{ fontSize: 12, color: tokens.text.muted }}>{item.stock ?? 0} in stock</Text>
            {outOfStock ? <Badge label="Out of stock" tone="error" /> : lowStock ? <Badge label="Low stock" tone="warning" /> : null}
          </View>
          <Switch
            value={!!item.isAvailable}
            onValueChange={(v) => toggle.mutate({ productId: item.id, isAvailable: v })}
            trackColor={{ true: tokens.brand.default, false: tokens.border.strong }}
          />
        </View>
      </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <FlatList
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={renderProduct}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isLoading && products.length > 0} onRefresh={() => refetch()} tintColor={tokens.brand.default} />
        }
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Products"
              subtitle={`${total} ${total === 1 ? "product" : "products"} in your catalogue`}
              actionLabel="Add"
              onAction={() => navigation.navigate("SellerProductForm", {})}
            />
            <SearchField value={search} onChangeText={setSearch} placeholder="Search products or categories" />
            <View style={{ marginTop: 10, marginBottom: 14 }}>
              <FilterChips options={CONDITIONS} value={condition} onChange={setCondition} />
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState label="Loading your catalogue..." />
          ) : (
            <EmptyState
              icon="cube-outline"
              title={products.length ? "No matching products" : "No products yet"}
              subtitle={
                products.length
                  ? "Try a different search or condition filter."
                  : "Add your first product so customers can find your shop."
              }
              actionLabel={products.length ? undefined : "Add product"}
              onAction={() => navigation.navigate("SellerProductForm", {})}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
