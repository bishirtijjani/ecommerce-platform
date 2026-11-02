/**
 * ShopsScreen - all vendor shops grouped by industry, displayed vertically.
 * Reached from "More →" or "All shops →" on the home screen.
 *
 * Each group shows a horizontal row of ShopCard tiles (same component as
 * home). Groups are padded with "Coming Soon" placeholders so every section
 * has at least 4 cards.
 */

import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";

import ShopCard from "../../components/home/ShopCard";
import SkeletonLoader from "../../components/SkeletonLoader";
import { fetchVendors } from "../../store/slices/marketplaceSlice";
import { normalizeVendor } from "../../lib/normalizeMarketplace";

const CATEGORY_ORDER = ["Clothing & Fashion", "Vehicles & Automobiles", "Furniture", "Real Estate"];
const SHOP_ORDER = ["FMK Clothing", "Algazaru Abayas", "Furniture House", "VAVA Furniture"];
const HIDDEN_VENDORS = ["Mudatex", "El samad", "China Market", "Arab World", "Wholesalers", "Second Hand Items"];
const SHOPS_PER_ROW = 4;

export default function ShopsScreen({ navigation }) {
  const dispatch = useDispatch();
  const vendors = useSelector((s) => s.marketplace.vendors.list);
  const loading = useSelector((s) => s.marketplace.vendors.loading);

  useEffect(() => {
    if (vendors?.length === 0) dispatch(fetchVendors());
  }, [dispatch, vendors?.length]);

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
    groups.forEach((g) => {
      let filler = 0;
      while (g.shops.length < SHOPS_PER_ROW) {
        g.shops.push({ id: `${g.id}-coming-soon-${filler}`, name: "Coming Soon", comingSoon: true });
        filler += 1;
      }
    });
    return groups;
  }, [vendors]);

  const openStorefront = (shop) => {
    if (!shop.comingSoon) {
      navigation.navigate("VendorStorefront", { vendorId: shop.id, vendorName: shop.name });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Text className="text-primary font-black text-lg flex-1">All Shops</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading && vendors?.length === 0 ? (
          <View className="px-4 mt-4">
            {[1, 2, 3].map((i) => (
              <View key={i} className="mb-5">
                <SkeletonLoader width={120} height={14} radius={4} style={{ marginBottom: 10 }} />
                <View className="flex-row" style={{ columnGap: 10, rowGap: 12 }}>
                  {[1, 2, 3, 4].map((j) => (
                    <SkeletonLoader.ShopTile key={j} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          shopGroups.map((group) => (
            <View key={group.id} className="mt-6">
              <Text className="text-primary font-black text-[15px] mb-3 px-4">
                {group.title}
              </Text>
              <View className="flex-row flex-wrap px-4" style={{ columnGap: 10, rowGap: 12 }}>
                {group.shops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    onPress={() => openStorefront(shop)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
