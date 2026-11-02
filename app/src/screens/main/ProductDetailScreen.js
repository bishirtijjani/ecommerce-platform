/**
 * ProductDetailScreen - full product page, replacing the old dead-end where
 * tapping a listing card went nowhere. Chat-commerce model throughout,
 * permanently: no cart/checkout, the primary action is ContactVendorSheet
 * (Call, Chat, or Request a callback - see that component for what's real
 * today). "Save to list" reuses the existing savedItemsSlice wishlist.
 *
 * Responsive: single column with a sticky bottom action bar under
 * DESKTOP_BREAKPOINT; two-column (image left w/ thumbnail strip, info right)
 * above it, actions inline instead of sticky - matches the desktop reference
 * comp rather than just stretching the phone layout.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Share, Pressable } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useVideoPlayer, VideoView } from "expo-video";
import { goBackOr } from "../../lib/goBack";
import { useTheme } from "../../theme";
import { useIsDesktop } from "../../lib/responsive";
import { toggleSaved } from "../../store/slices/savedItemsSlice";
import { fetchProductDetail, fetchProductsByCategory } from "../../store/slices/marketplaceSlice";
import { normalizeProduct, normalizeVendor } from "../../lib/normalizeMarketplace";
import { formatNaira } from "../../data/marketplace";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";
import ContactVendorSheet from "../../components/ContactVendorSheet";
import TrustBadgeRow from "../../components/product/TrustBadgeRow";
import RatingLine from "../../components/product/RatingLine";
import { conditionMeta } from "../../components/product/conditionBadge";
import ProductCard from "../../components/product/ProductCard";

const TRUST_ITEMS = [
  { icon: "shield-checkmark", title: "Verified Listing", subtitle: "Reviewed by my sooq" },
  { icon: "person-outline", title: "Direct from Seller", subtitle: "No middleman" },
  { icon: "lock-closed-outline", title: "Secure & Private", subtitle: "Your info stays safe" },
  { icon: "flag-outline", title: "Report Listing", subtitle: "Help us keep safe" },
];

// Sentinel for the product's optional inline video inside the image carousel.
const VIDEO_SLIDE = { video: true };

export default function ProductDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tokens } = useTheme();
  const condMeta = conditionMeta(tokens);
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();

  const productId = route?.params?.productId;
  const rawProduct = useSelector((s) => s.marketplace.productDetail.byId[productId]);
  const loadingProductId = useSelector((s) => s.marketplace.productDetail.loadingId);
  const loading = loadingProductId === productId && !rawProduct;

  // Refetch whenever the screen gains focus, so a product opened earlier in the
  // session can't keep showing a stale cached copy (e.g. images added later).
  useFocusEffect(
    useCallback(() => {
      if (productId) dispatch(fetchProductDetail(productId));
    }, [productId, dispatch]),
  );

  const product = useMemo(() => normalizeProduct(rawProduct), [rawProduct]);
  const vendor = useMemo(() => normalizeVendor(rawProduct?.vendor), [rawProduct]);

  // Related: other vendors' products in the same top-level category, fetched
  // (and cached) through the same category thunk CategoryScreen uses.
  const categoryPrefix = product ? (product.category || "").split(">")[0].trim() : null;
  const categoryProducts = useSelector((s) => s.marketplace.productsByCategory.byPrefix[categoryPrefix]);
  useEffect(() => {
    if (categoryPrefix && !categoryProducts) dispatch(fetchProductsByCategory(categoryPrefix));
  }, [categoryPrefix, categoryProducts, dispatch]);

  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0]?.name || null);
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[0] || null);
  const [detailsOpen, setDetailsOpen] = useState(isDesktop);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Pager: a horizontal paging ScrollView. On web this maps to CSS scroll-snap
  // (x mandatory) so the swipe is a real, momentum-driven scroll - smooth and
  // always settling exactly on a slide - instead of a hand-rolled PanResponder
  // translation that fought the browser's touch handling and could stall
  // between two images. Native gets the same snap via `pagingEnabled`.
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef(null);
  const widthRef = useRef(0);
  widthRef.current = containerWidth;
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeImage;

  // Reset to the first slide whenever we land on a different product.
  useEffect(() => {
    setActiveImage(0);
    activeIndexRef.current = 0;
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [productId]);

  // Arrows / dots / thumbnails call this: page to the chosen slide.
  const goToSlide = (index) => {
    const total = slides?.length;
    if (!total) return;
    const clamped = Math.max(0, Math.min(total - 1, index));
    setActiveImage(clamped);
    activeIndexRef.current = clamped;
    const w = widthRef.current;
    if (w) scrollRef.current?.scrollTo({ x: clamped * w, animated: true });
  };

  // Mirror the visible slide into `activeImage` as the user scrolls (drives the
  // dots, counter, arrows and video playback).
  const onCarouselScroll = (e) => {
    const w = widthRef.current;
    if (!w) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / w);
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveImage(idx);
    }
  };

  // Carousel slides: the product's images first, then its optional inline
  // video as the final slide (when present). Hooks are unconditional even
  // though `product` may be null while loading.
  const videoUrl = product ? product.videoUrl : null;
  const player = useVideoPlayer(videoUrl, (p) => {
    if (videoUrl) {
      p.loop = true;
      p.muted = true;
      p.timeUpdateEventInterval = 0.1;
    }
  });
  const videoSlideIndex = product ? product.images.length : -1;
  const slides = useMemo(() => {
    const imgs = product ? product.images : [];
    return videoUrl ? [...imgs, VIDEO_SLIDE] : imgs;
  }, [product, videoUrl]);

  // Re-align to the active slide whenever the box is (re)measured, so it stays
  // flush after a layout change (e.g. rotation / desktop resize).
  useEffect(() => {
    if (containerWidth) {
      scrollRef.current?.scrollTo({ x: activeIndexRef.current * containerWidth, animated: false });
    }
  }, [containerWidth]);

  // Play the video only while it's the active slide (ImageCarousel sets
  // activeImage to videoSlideIndex). Played after render so the VideoView is
  // mounted on web; see ShopHighlights for the same pattern.
  useEffect(() => {
    if (player && videoUrl) {
      if (activeImage === videoSlideIndex) player.play();
      else player.pause();
    }
  }, [player, videoUrl, activeImage, videoSlideIndex]);

  const savedIds = useSelector((s) => s.savedItems.items.map((i) => i.id));
  const isSaved = product ? savedIds.includes(product.id) : false;

  const related = useMemo(() => {
    if (!product || !categoryProducts) return [];
    return categoryProducts
      .filter((p) => p.id !== product.id && p.vendorId !== product.vendorId)
      .slice(0, 4)
      .map(normalizeProduct);
  }, [product, categoryProducts]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <TouchableOpacity onPress={() => goBackOr(navigation)} style={{ padding: 16 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonLoader.ProductDetail />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!product || !vendor) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <TouchableOpacity onPress={() => goBackOr(navigation)} style={{ padding: 16 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <EmptyState icon="cube-outline" title="Listing not found" subtitle="This product may have been removed." />
      </SafeAreaView>
    );
  }

  const onToggleSave = () =>
    dispatch(toggleSaved({ id: product.id, title: product.title, price: formatNaira(product.price), image: product.images[0] }));

  const onShare = () => {
    Share.share({ message: `${product.title} - ${formatNaira(product.price)} on my sooq (${vendor.name})` }).catch(() => {});
  };

  const goToVendor = () => navigation.navigate("VendorStorefront", { vendorId: vendor.id, vendorName: vendor.name });

  const Header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
      }}
    >
      <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>
        my <Text style={{ color: tokens.brand.default }}>sooq</Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <TouchableOpacity onPress={onToggleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isSaved ? "heart" : "heart-outline"} size={21} color={isSaved ? tokens.brand.default : tokens.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={21} color={tokens.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const isVideoSlide = activeImage === videoSlideIndex;
  // NOTE: a plain JSX element, NOT a component defined in render. Defining it
  // as `const ImageCarousel = () => (...)` gave it a new identity every render,
  // so React unmounted/remounted the paging ScrollView on every active-slide
  // change - resetting the scroll position to 0 mid-swipe (the "stuck between
  // two images" jank). A stable element keeps the same DOM node across renders.
  const imageCarousel = (
    <View>
      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={{ width: "100%", aspectRatio: 1, borderRadius: isDesktop ? 18 : 0, overflow: "hidden", backgroundColor: "#111" }}
      >
        {containerWidth > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onCarouselScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            style={{ height: "100%" }}
          >
            {slides.map((slide, i) => (
              <View key={i} style={{ width: containerWidth, height: "100%", alignItems: "center", justifyContent: "center" }}>
                {slide === VIDEO_SLIDE ? (
                  <VideoView
                    player={player}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                    nativeControls
                  />
                ) : (
                  <Image source={{ uri: slide }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {product.discountPercent && !isVideoSlide ? (
          <View style={{ position: "absolute", top: 14, left: 14, backgroundColor: tokens.status.error, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>-{product.discountPercent}%</Text>
          </View>
        ) : null}

        <View style={{ position: "absolute", top: 14, right: 14, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#111" }}>
            {activeImage + 1} / {slides?.length}
          </Text>
        </View>

        {slides?.length > 1 && (
          <>
            <TouchableOpacity
              disabled={activeImage === 0}
              onPress={() => goToSlide(activeImage - 1)}
              style={circleBtnStyle("left", activeImage === 0)}
            >
              <Ionicons name="chevron-back" size={18} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={activeImage === slides?.length - 1}
              onPress={() => goToSlide(activeImage + 1)}
              style={circleBtnStyle("right", activeImage === slides?.length - 1)}
            >
              <Ionicons name="chevron-forward" size={18} color="#111" />
            </TouchableOpacity>
          </>
        )}

        {!isVideoSlide && (
          <TouchableOpacity
            onPress={() => setZoomOpen(true)}
            style={{ position: "absolute", bottom: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="search" size={16} color="#111" />
          </TouchableOpacity>
        )}

        {!isDesktop && slides?.length > 1 && (
          <View style={{ position: "absolute", bottom: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={{ width: i === activeImage ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeImage ? tokens.brand.default : "rgba(255,255,255,0.85)" }}
              />
            ))}
          </View>
        )}
      </View>

      {isDesktop && slides?.length > 1 && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          {slides.map((slide, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToSlide(i)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                overflow: "hidden",
                borderWidth: 2,
                borderColor: i === activeImage ? tokens.brand.default : "transparent",
                backgroundColor: tokens.bg.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {slide === VIDEO_SLIDE ? (
                <Ionicons name="play-circle" size={30} color={tokens.brand.default} />
              ) : (
                <Image source={{ uri: slide }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const InfoBlock = () => (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: product.inStock ? tokens.status.successSoft : tokens.status.errorSoft,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: product.inStock ? tokens.status.success : tokens.status.error }} />
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: product.inStock ? tokens.status.successStrong : tokens.status.errorStrong }}>
            {product.inStock ? "In Stock" : "Out of Stock"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: condMeta.bg(product.condition),
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: "800",
              letterSpacing: 0.3,
              color: condMeta.text(product.condition),
            }}
          >
            {product.condition === "SECOND_HAND" ? "SECOND HAND" : condMeta.label(product.condition)}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 22, fontWeight: "900", color: tokens.text.primary, letterSpacing: -0.4 }}>{product.title}</Text>
      <View style={{ marginTop: 6 }}>
        <RatingLine rating={product.rating} reviewsCount={product.reviewsCount} sold={product.sold} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: tokens.brand.default }}>{formatNaira(product.price)}</Text>
        {product.was ? (
          <>
            <Text style={{ fontSize: 15, color: tokens.text.muted, textDecorationLine: "line-through" }}>{formatNaira(product.was)}</Text>
            <View style={{ backgroundColor: tokens.status.errorSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: tokens.status.errorStrong }}>{product.discountPercent}% OFF</Text>
            </View>
          </>
        ) : null}
      </View>

      <Text style={{ fontSize: 13.5, color: tokens.text.muted, lineHeight: 20, marginTop: 12 }}>{product.description}</Text>

      {product.colors ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginBottom: 8 }}>
            Color: <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>{selectedColor}</Text>
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {product.colors.map((c) => (
              <TouchableOpacity
                key={c.name}
                onPress={() => setSelectedColor(c.name)}
                accessibilityLabel={c.name}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: selectedColor === c.name ? 2 : 1,
                  borderColor: selectedColor === c.name ? tokens.brand.default : tokens.border.default,
                }}
              >
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.hex }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {product.sizes ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginBottom: 8 }}>
            Size: <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>{selectedSize}</Text>
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {product.sizes.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSelectedSize(s)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: selectedSize === s ? tokens.brand.default : tokens.border.default,
                  backgroundColor: selectedSize === s ? tokens.brand.soft : tokens.bg.surface,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: selectedSize === s ? tokens.brand.strong : tokens.text.primary }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {isDesktop && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
          <TouchableOpacity
            onPress={onToggleSave}
            style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: tokens.brand.default, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Ionicons name={isSaved ? "heart" : "heart-outline"} size={17} color={tokens.brand.default} />
            <Text style={{ color: tokens.brand.default, fontWeight: "800", fontSize: 13.5 }}>{isSaved ? "Saved" : "Save to list"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setContactOpen(true)}
            style={{ flex: 1.4, borderRadius: 12, backgroundColor: tokens.brand.default, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Ionicons name="chatbubbles" size={17} color={tokens.text.onBrand} />
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 13.5 }}>Contact Vendor</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        onPress={goToVendor}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: tokens.bg.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tokens.border.default,
          padding: 12,
          marginTop: 22,
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: vendor.logoBg, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: tokens.border.default }}>
          {vendor.logo ? (
            <Image source={vendor.logo} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 11, fontWeight: "900", color: tokens.text.primary, textAlign: "center" }} numberOfLines={2}>
              {vendor.name}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.text.primary }} numberOfLines={1}>
              {vendor.name}
            </Text>
            {vendor.verified && <Ionicons name="checkmark-circle" size={14} color={tokens.brand.default} />}
          </View>
          <Text style={{ fontSize: 11.5, color: tokens.text.muted, marginTop: 2 }} numberOfLines={1}>
            ★ {vendor.rating} ({vendor.reviewsCount}) · {vendor.productsCount} products
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: tokens.brand.soft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: tokens.brand.strong }}>View Shop</Text>
          <Ionicons name="chevron-forward" size={12} color={tokens.brand.strong} />
        </View>
      </TouchableOpacity>

      <View style={{ marginTop: 14 }}>
        <TrustBadgeRow items={TRUST_ITEMS} />
      </View>

      {product.details && (
      <View style={{ marginTop: 18 }}>
        <TouchableOpacity onPress={() => setDetailsOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }}>Product details</Text>
          <Ionicons name={detailsOpen ? "chevron-up" : "chevron-down"} size={18} color={tokens.text.muted} />
        </TouchableOpacity>
        {detailsOpen && (
          <View style={{ marginTop: 10, gap: 8 }}>
            {Object.entries(product.details).map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row" }}>
                <Text style={{ width: 100, fontSize: 12.5, color: tokens.text.muted }}>{k}</Text>
                <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: tokens.text.primary }}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      )}
    </View>
  );

  const RelatedRow = related.length > 0 && (
    <View style={{ marginTop: 26, paddingHorizontal: isDesktop ? 0 : 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.text.primary }}>You may also like</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {related.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            width={isDesktop ? 180 : "47%"}
            isSaved={savedIds.includes(p.id)}
            onToggleSave={() => dispatch(toggleSaved({ id: p.id, title: p.title, price: formatNaira(p.price), image: p.images[0] }))}
            onPress={() => navigation.push("ProductDetail", { productId: p.id })}
          />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {Header}
      <ScrollView contentContainerStyle={{ paddingBottom: isDesktop ? 40 : 100 }} showsVerticalScrollIndicator={false}>
        {isDesktop ? (
          <View style={{ maxWidth: 1100, alignSelf: "center", width: "100%", paddingHorizontal: 24 }}>
            <View style={{ flexDirection: "row", gap: 32 }}>
              <View style={{ flex: 1 }}>
                {imageCarousel}
              </View>
              <View style={{ flex: 1 }}>
                <InfoBlock />
              </View>
            </View>
            {RelatedRow}
          </View>
        ) : (
          <View>
            {imageCarousel}
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <InfoBlock />
            </View>
            {RelatedRow}
          </View>
        )}
      </ScrollView>

      {!isDesktop && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: tokens.bg.surface,
            borderTopWidth: 1,
            borderTopColor: tokens.border.default,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 22,
          }}
        >
          <View style={{ marginRight: "auto" }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.brand.default }}>{formatNaira(product.price)}</Text>
            <Text style={{ fontSize: 10.5, color: tokens.text.muted }} numberOfLines={1}>
              {product.title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onToggleSave}
            style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: tokens.brand.default, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name={isSaved ? "heart" : "heart-outline"} size={16} color={tokens.brand.default} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setContactOpen(true)}
            style={{ paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: tokens.brand.default, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Ionicons name="chatbubbles" size={16} color={tokens.text.onBrand} />
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 13 }}>Contact Vendor</Text>
          </TouchableOpacity>
        </View>
      )}

      <ContactVendorSheet
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
        vendor={vendor}
        productId={product.id}
        productName={product.title}
        productImage={product.images?.[0]}
      />

      <Modal visible={zoomOpen} transparent animationType="fade" onRequestClose={() => setZoomOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }} onPress={() => setZoomOpen(false)}>
          {!isVideoSlide && (
            <Image source={{ uri: product.images[activeImage] }} style={{ width: "92%", height: "70%" }} contentFit="contain" />
          )}
          <TouchableOpacity onPress={() => setZoomOpen(false)} style={{ position: "absolute", top: 50, right: 24, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const circleBtnStyle = (side, disabled) => ({
  position: "absolute",
  top: "45%",
  [side]: 12,
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: "rgba(255,255,255,0.92)",
  alignItems: "center",
  justifyContent: "center",
  opacity: disabled ? 0.35 : 1,
});
