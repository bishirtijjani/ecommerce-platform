import React from "react";
import { FlatList, Platform, RefreshControl, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme";

// Shared windowed product grid. Using FlatList instead of mapping inside a
// ScrollView means only the visible rows (plus a small buffer) mount, so a
// 300-product category doesn't kick off 300 image downloads at once.
const MAX_CONTENT_WIDTH = 1100;

export default function ProductGrid({
  data,
  renderItem,
  header,
  empty,
  refreshing,
  onRefresh,
  contentContainerStyle,
  gap = 12,
  horizontalPadding = 16,
}) {
  const { width } = useWindowDimensions();
  const { tokens } = useTheme();
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const columns = contentWidth >= 768 ? 4 : 2;
  const cardWidth = Math.floor(
    (contentWidth - horizontalPadding * 2 - gap * (columns - 1)) / columns
  );

  return (
    <FlatList
      data={data}
      key={`product-grid-${columns}`}
      keyExtractor={(item) => String(item.id)}
      numColumns={columns}
      renderItem={({ item }) => renderItem(item, cardWidth)}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={columns > 1 ? { gap } : undefined}
      contentContainerStyle={[
        { paddingHorizontal: horizontalPadding, paddingBottom: 32 },
        contentContainerStyle,
      ]}
      style={{ width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === "android"}
      initialNumToRender={columns * 4}
      maxToRenderPerBatch={columns * 4}
      windowSize={7}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.brand.default}
            colors={[tokens.brand.default]}
          />
        ) : undefined
      }
    />
  );
}
