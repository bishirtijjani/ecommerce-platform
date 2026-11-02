/**
 * Adapters from the real backend's vendor/product shapes (see
 * backend/prisma/schema.prisma Vendor/Product/ProductVariant, and the public
 * routes in backend/src/modules/vendor/vendor.routes.js) to the shape the
 * browsing screens were originally built against (app/src/data/marketplace.js
 * mock catalog). Keeping this one normalization boundary means ProductCard,
 * CategoryScreen, SubcategoryScreen, etc. don't need to know the backend
 * exists - they still consume `product.title`, `product.images[0]`, etc.
 *
 * The backend now seeds real content for vendor photos/policies/reviews
 * (Vendor.photos, Vendor.policies, and Rating rows attached to delivered
 * orders - see backend/prisma/seed.js) and real per-product `sold` counts
 * (summed from OrderItem quantities). Per-product rating/reviews and a
 * structured spec-sheet still have no backend equivalent (Rating is
 * per-order/vendor, not per-product) - those stay undefined/empty so
 * callers render an honest "not available yet" state rather than fake data.
 */
import { Image as RNImage } from "react-native";

// "2026-07-20T..." -> "3 weeks ago", matching the copy style ReviewRow was
// built to render (see VendorStorefrontScreen.js).
const timeAgo = (isoDate) => {
  if (!isoDate) return "";
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
};

// Matches the palette in the old mock catalog so seeded variant colors
// ("Blue", "Red", ...) still render as swatches; anything outside that set
// (a vendor-entered color the seed didn't use) falls back to a neutral grey.
const COLOR_HEX = {
  Blue: "#1D4ED8",
  Red: "#B91C1C",
  Green: "#166534",
  Gold: "#CA8A04",
  Black: "#18181B",
  White: "#F4F4F5",
  Brown: "#78350F",
};

const FALLBACK_PRODUCT_IMAGE =
  RNImage.resolveAssetSource(require("../../assets/product-placeholder.png"))?.uri || "";
// A few seeded catalogue rows point at the old dummyjson sample CDN, whose
// product-image paths now 404. Treat those as missing so cards show the
// placeholder instead of a permanently blank image.
const isUsableImageUrl = (url) =>
  typeof url === "string" && url.trim().length > 0 && !/cdn\.dummyjson\.com/i.test(url);

export const normalizeProduct = (p) => {
  if (!p) return null;
  const variants = p.variants || [];
  const colorNames = [...new Set(variants.map((v) => v.attributes?.color).filter(Boolean))];
  const sizeNames = [...new Set(variants.map((v) => v.attributes?.size).filter(Boolean))];

  // Products now carry an admin-managed category + subcategory relation. The
  // display `category` string keeps the "Top > Sub" shape the browsing screens
  // split on (CategoryScreen subcategory tiles, storefront shop tabs), built
  // from the real taxonomy names.
  const categoryName = p.category?.name;
  const subcategoryName = p.subcategory?.name;
  const displayCategory = [categoryName, subcategoryName].filter(Boolean).join(" > ");

  return {
    id: p.id,
    vendorId: p.vendorId || p.vendor?.id,
    vendor: p.vendor,
    title: p.name,
    category: displayCategory,
    categoryId: p.categoryId || p.category?.id,
    subcategoryId: p.subcategoryId || p.subcategory?.id,
    categoryName,
    subcategoryName,
    images: (() => {
      const candidates = p.images && p.images.length ? p.images : [p.imageUrl];
      const usable = candidates.filter(isUsableImageUrl);
      return usable.length ? usable : [FALLBACK_PRODUCT_IMAGE];
    })(),
    videoUrl: p.videoUrl || null,
    price: Number(p.basePrice),
    // New / pre-owned (Used) / Second Hand. Older payloads / mock rows have no
    // field → treat as NEW.
    condition:
      p.condition === "SECOND_HAND" ? "SECOND_HAND" : p.condition === "USED" ? "USED" : "NEW",
    // Second Hand location snapshot (State/LGA); null for NEW/USED.
    state: p.state ?? null,
    lga: p.lga ?? null,
    was: undefined,
    discountPercent: undefined,
    // No per-product review system yet - the vendor's own aggregate rating
    // is the closest honest signal (also what the mock data effectively
    // approximated with hand-picked per-product ratings).
    rating: p.vendor?.averageRating ?? null,
    reviewsCount: 0,
    sold: p.sold ?? 0,
    inStock: Boolean(p.isAvailable) && variants.some((v) => v.isAvailable && v.stock > 0),
    description: p.description,
    colors: colorNames?.length ? colorNames.map((name) => ({ name, hex: COLOR_HEX[name] || "#9CA3AF" })) : undefined,
    sizes: sizeNames?.length ? sizeNames : undefined,
    // No structured spec sheet from the backend - ProductDetailScreen hides
    // the "Product details" section when this is undefined.
    details: undefined,
  };
};

// Admin-entered category icons are emoji (admin EmojiField), but the original
// seed rows in seed-categories.js stored Lucide icon names. Map those legacy
// names to emoji so both data shapes render, and fall back to a shopping-bag
// glyph for anything unrecognisable.
const CATEGORY_EMOJI_MAP = {
  apple: "🍎",
  armchair: "🛋️",
  baby: "👶",
  basket: "🧺",
  beef: "🥩",
  bike: "🚲",
  "book-open": "📖",
  broom: "🧹",
  bug: "🐛",
  bus: "🚌",
  cable: "🔌",
  cake: "🎂",
  camera: "📷",
  candy: "🍬",
  car: "🚗",
  "car-wash": "🚗",
  "car-wrench": "🔧",
  "cash-multiple": "💵",
  cellphone: "📱",
  "content-cut": "✂️",
  construct: "🛠️",
  "cooking-pot": "🍲",
  "cup-soda": "🥤",
  droplet: "💧",
  dumbbell: "🏋️",
  "electric-switch": "🔌",
  "face-woman": "💇‍♀️",
  footprints: "👟",
  fridge: "🧊",
  "gamepad-2": "🎮",
  "hair-dryer": "💇",
  "hammer-screwdriver": "🔨",
  "heart-pulse": "❤️",
  home: "🏠",
  laptop: "💻",
  layers: "🧵",
  "mortar-pestle": "⚗️",
  "party-popper": "🎉",
  "paw-print": "🐾",
  pill: "💊",
  "pipe-wrench": "🔧",
  restaurant: "🍽️",
  school: "🎓",
  shirt: "👕",
  "shopping-bag": "🛍️",
  smartphone: "📱",
  "solar-panel": "🔆",
  spa: "🌸",
  sparkles: "✨",
  "spray-can": "🧴",
  sprout: "🌱",
  truck: "🚚",
  "truck-delivery": "🚚",
  wall: "🧱",
  "washing-machine": "🫧",
  watch: "⌚",
  wrench: "🔧",
};

const CATEGORY_FALLBACK_EMOJI = "🛍️";
const CATEGORY_TILE_BG = "#F3F4F6";

// Turn an admin accent hex into a soft translucent background. Returns null for
// missing/malformed colors so the components can fall back to a brand token.
const hexToTint = (hex, alpha = 0.14) => {
  if (typeof hex !== "string") return null;
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const categoryEmoji = (icon) => {
  if (!icon) return CATEGORY_FALLBACK_EMOJI;
  if (CATEGORY_EMOJI_MAP[icon]) return CATEGORY_EMOJI_MAP[icon];
  // Legacy Lucide names are plain ascii words; if it isn't one, it's an
  // admin-entered emoji/symbol - render it as-is.
  return /^[a-z0-9-]+$/i.test(icon) ? CATEGORY_FALLBACK_EMOJI : icon;
};

export const normalizeSubcategory = (s, categoryId) => {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    imageUrl: s.imageUrl || null,
    productCount: s._count?.products ?? 0,
    categoryId: categoryId ?? s.categoryId ?? null,
  };
};

// Maps a backend VendorCategory (see /categories, backend category.service.js)
// to the tile shape the home/browse grids render: emoji, soft tint, product
// count and normalized subcategories. `sub` prefers the admin description,
// else a subcategory tally, so a tile never shows blank copy.
export const normalizeCategory = (c) => {
  if (!c) return null;
  const subcategories = (c.subcategories || []).map((s) => normalizeSubcategory(s, c.id)).filter(Boolean);
  return {
    id: c.id,
    label: c.name,
    sub: c.description || (subcategories.length ? `${subcategories.length} subcategories` : "Explore"),
    icon: categoryEmoji(c.icon),
    accent: c.color || null,
    tint: hexToTint(c.color),
    productCount: c._count?.products ?? 0,
    bg: CATEGORY_TILE_BG,
    image: c.imageUrl || null,
    subcategories,
  };
};

export const normalizeVendor = (v) => {
  if (!v) return null;
  const reviews = (v.reviews || []).map((r) => ({
    name: r.name,
    rating: r.rating,
    timeAgo: timeAgo(r.createdAt),
    comment: r.comment,
  }));

  // A shop's category list. From the single-storefront endpoint this is the
  // shop's OWN curated list (id, subcategoryId, name, imageUrl, sortOrder);
  // from the shops list it is the top-level categories the shop sells under
  // (id, name, slug, icon, color). Keep both shapes intact.
  const categories = Array.isArray(v.categories) && v.categories.length > 0
    ? v.categories
    : (v.category ? [v.category] : []);

  return {
    id: v.id,
    name: v.name,
    industry: v.industry ? v.industry.name : (categories[0]?.name ?? null),
    categoryLabel: categories[0]?.name,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      ...(c.slug ? { slug: c.slug, icon: c.icon ?? null, color: c.color ?? null } : {}),
      ...(c.subcategoryId !== undefined ? { subcategoryId: c.subcategoryId, sortOrder: c.sortOrder ?? 0 } : {}),
      imageUrl: c.imageUrl ?? null,
      ...(Array.isArray(c.subcategories)
        ? {
            subcategories: c.subcategories.map((s) => ({
              id: s.id,
              name: s.name,
              imageUrl: s.imageUrl ?? null,
              sortOrder: s.sortOrder ?? 0,
            })),
          }
        : {}),
    })),
    logo: v.logoUrl ? { uri: v.logoUrl } : null,
    logoBg: "#FFFFFF",
    verified: v.status === "APPROVED",
    rating: v.averageRating,
    reviewsCount: reviews?.length,
    productsCount: v.productsCount ?? (v.products ? v.products?.length : v._count?.products ?? 0),
    previewImages: (v.previewProducts || []).map((p) => p.imageUrl).filter(Boolean),
    location: v.address,
    state: v.state ?? null,
    lga: v.lga ?? null,
    phone: v.phone,
    description: v.description,
    memberSince: v.createdAt
      ? new Date(v.createdAt).toLocaleDateString("en-NG", { month: "short", year: "numeric" })
      : "-",
    avgResponseTime: "-",
    followers: "-",
    coverImage: v.coverImageUrl || `https://placehold.co/1200x400?text=${encodeURIComponent(v.name || "Shop")}`,
    photos: v.photos || [],
    policies: v.policies || null,
    reviews,
    highlights: (v.highlights || []).map((h) => ({
      id: h.id,
      name: h.name,
      // No synthetic placeholder - fall back to the first story's media so a
      // highlight always has a visible cover, else it's hidden client-side.
      coverImageUrl: h.coverImageUrl || (h.stories && h.stories[0]?.mediaUrl) || null,
      stories: (h.stories || []).map((s) => ({
        id: s.id,
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType || 'image',
        caption: s.caption || null,
        products: (s.products || []).map((sp) => ({
          id: sp.id,
          name: sp.name,
          price: Number(sp.price),
          imageUrl: sp.imageUrl,
        })),
      })),
    })),
    products: (v.products || []).map(normalizeProduct),
  };
};
