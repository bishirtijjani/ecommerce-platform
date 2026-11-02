/**
 * SkeletonLoader - pulsing-grey placeholder for content that is loading.
 *
 * Replaces ad-hoc <ActivityIndicator> spinners on primary lists. The "pulse"
 * makes a 1–2s load feel ~3× faster than a spinner because the user sees the
 * shape of the content arriving, not just an indeterminate wait.
 *
 * Usage:
 *   <SkeletonLoader width="80%" height={16} />
 *   <SkeletonLoader.OrderRow />
 *   <SkeletonLoader.MerchantCard />
 *
 * Driven by a single shared `Animated.Value` so dozens of skeletons on one
 * screen don't each spin up their own RAF loop.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

const Shimmer = ({ style }) => {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  // Pulse between a clearly-visible floor and full opacity. The old 0.4 floor
  // combined with the near-invisible fill (border.default) made skeletons
  // disappear; the base fill is now bg.skeleton (distinctly darker than the
  // canvas) so even the low end of the pulse reads as present.
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  // accessibilityElementsHidden hides skeletons from screen readers so the
  // user doesn't hear "image" announcements while content is loading.
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, style, { opacity }]}
    />
  );
};

const SkeletonLoader = ({ width = '100%', height = 16, radius = 8, style }) => (
  <Shimmer style={[{ width, height, borderRadius: radius }, style]} />
);

/** A typical row in the Orders list. */
SkeletonLoader.OrderRow = function OrderRow() {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={styles.cardRow}>
      <SkeletonLoader width={44} height={44} radius={22} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <SkeletonLoader width="60%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonLoader width="40%" height={12} />
      </View>
      <SkeletonLoader width={56} height={20} radius={10} />
    </View>
  );
};

/** A shop card in the Home "Shops" grid (matches home/ShopCard.js). */
SkeletonLoader.ShopTile = function ShopTile() {
  const { tokens } = useTheme();
  return (
    <View style={{ width: "22%", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.subtle, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 6 }}>
      <SkeletonLoader width={48} height={48} radius={8} />
      <SkeletonLoader width="75%" height={10} radius={4} style={{ marginTop: 8 }} />
    </View>
  );
};

/** A listing card in a horizontal rail (matches home/ListingCard.js). */
SkeletonLoader.ListingCard = function ListingCardSkeleton() {
  return (
    <View style={{ width: 160, marginRight: 12 }}>
      <SkeletonLoader width="100%" height={128} radius={16} />
      <SkeletonLoader width="80%" height={13} radius={4} style={{ marginTop: 8 }} />
      <SkeletonLoader width="40%" height={13} radius={4} style={{ marginTop: 6 }} />
    </View>
  );
};

/** A square product card in a grid (matches product/ProductCard.js). */
SkeletonLoader.ProductCard = function ProductCardSkeleton({ width }) {
  return (
    <View style={{ width }}>
      <View style={{ width: '100%', aspectRatio: 1 }}>
        <SkeletonLoader width="100%" height="100%" radius={16} />
      </View>
      <SkeletonLoader width="85%" height={12} radius={4} style={{ marginTop: 8 }} />
      <SkeletonLoader width="45%" height={13} radius={4} style={{ marginTop: 6 }} />
    </View>
  );
};

/** A landscape/list product card (matches product/ProductCard.js variant="landscape"). */
SkeletonLoader.ProductCardLandscape = function ProductCardLandscapeSkeleton({ width }) {
  const imageWidth = Math.min(Math.max(Math.round(width * 0.35), 100), 140);
  return (
    <View style={{ width, flexDirection: "row", alignItems: "center" }}>
      <SkeletonLoader width={imageWidth} height={imageWidth} radius={16} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonLoader width="85%" height={13} radius={4} style={{ marginBottom: 10 }} />
        <SkeletonLoader width="35%" height={15} radius={4} style={{ marginBottom: 10 }} />
        <SkeletonLoader width="45%" height={11} radius={4} />
      </View>
    </View>
  );
};

/** A full product grid (search bar + N product cards), for category/subcategory screens. */
SkeletonLoader.ProductGrid = function ProductGridSkeleton({ columns = 2, count = 6, cardWidth, variant = "grid" }) {
  const isLandscape = variant === "landscape";
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      <SkeletonLoader height={44} radius={999} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: isLandscape ? undefined : "space-between" }}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={{ width: cardWidth, marginBottom: 16 }}>
            {isLandscape ? (
              <SkeletonLoader.ProductCardLandscape width={cardWidth} />
            ) : (
              <SkeletonLoader.ProductCard width={cardWidth} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

/** Vendor storefront header (cover, avatar, name, stats row). */
SkeletonLoader.StorefrontHeader = function StorefrontHeaderSkeleton() {
  const { tokens } = useTheme();
  return (
    <View>
      <SkeletonLoader width="100%" height={140} radius={0} />
      <View style={{ paddingHorizontal: 16, marginTop: -32 }}>
        <SkeletonLoader width={72} height={72} radius={36} style={{ borderWidth: 3, borderColor: tokens.bg.surface }} />
        <SkeletonLoader width="50%" height={18} radius={4} style={{ marginTop: 12 }} />
        <SkeletonLoader width="30%" height={12} radius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
};

/** Product detail screen (image, title, price, description lines). */
SkeletonLoader.ProductDetail = function ProductDetailSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      <SkeletonLoader width="100%" height={320} radius={16} />
      <SkeletonLoader width="70%" height={20} radius={4} style={{ marginTop: 16 }} />
      <SkeletonLoader width="35%" height={22} radius={4} style={{ marginTop: 10 }} />
      <SkeletonLoader width="100%" height={13} radius={4} style={{ marginTop: 16 }} />
      <SkeletonLoader width="90%" height={13} radius={4} style={{ marginTop: 8 }} />
      <SkeletonLoader width="60%" height={13} radius={4} style={{ marginTop: 8 }} />
    </View>
  );
};

/** A row in the Chats conversation list (avatar, name + preview, timestamp). */
SkeletonLoader.ChatRow = function ChatRow() {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={styles.cardRow}>
      <SkeletonLoader width={48} height={48} radius={24} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <SkeletonLoader width="45%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonLoader width="70%" height={12} />
      </View>
      <SkeletonLoader width={30} height={10} style={{ marginLeft: 8 }} />
    </View>
  );
};

/** A merchant card in the browse grid. */
SkeletonLoader.MerchantCard = function MerchantCard() {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={styles.merchantCard}>
      <SkeletonLoader width="100%" height={140} radius={0} />
      <View style={styles.merchantCardInfo}>
        <SkeletonLoader width={48} height={48} radius={12} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <SkeletonLoader width="60%" height={15} style={{ marginBottom: 7 }} />
          <SkeletonLoader width="40%" height={12} style={{ marginBottom: 7 }} />
          <SkeletonLoader width="75%" height={12} />
        </View>
      </View>
    </View>
  );
};

const makeStyles = (tokens) => StyleSheet.create({
  base: {
    backgroundColor: tokens.bg.skeleton,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: tokens.bg.surface,
    borderRadius: 14,
    marginBottom: 10,
  },
  merchantCard: {
    backgroundColor: tokens.bg.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  merchantCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
});

export default SkeletonLoader;
