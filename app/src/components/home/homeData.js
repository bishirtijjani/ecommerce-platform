// Home-screen UI data (story filters, platform banners) that still has no
// backend equivalent - see HomeScreen.js for the parts that come from the real
// API (shops, featured listings, categories).

const BANNER_CHINA = require("../../../assets/banners/china-market.png");
const BANNER_ARAB = require("../../../assets/banners/arab-world.png");
const BANNER_WHOLESALE = require("../../../assets/banners/warehouse.jpeg");

// Placeholder photos sourced from dummyjson.com (a free fake-store/e-commerce
// mock API, MIT-licensed sample data) - stand-ins for real vendor photos until
// the backend/upload flow exists. Swap for real listing photos at build-out.
//
// Each FILTER is also an Instagram/WhatsApp-style story tile on the home
// screen: `image` is the circle cover, `stories` are the slides shown when the
// tile is tapped (rendered by ShopHighlightsBar + StoryViewer). All slides are
// image placeholders with promo copy - swap for real story media later.
export const FILTERS = [
  {
    id: "1", label: "Ankara", image: "https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp",
    stories: [
      { id: "1a", mediaUrl: "https://cdn.dummyjson.com/product-images/tops/blue-frock/1.webp", mediaType: "image", caption: "New Ankara drops just landed, vibrant prints for every occasion." },
      { id: "1b", mediaUrl: "https://cdn.dummyjson.com/product-images/tops/blue-frock/3.webp", mediaType: "image", caption: "Tailor-ready: brocade, lace & wax prints now in stock." },
    ],
  },
  {
    id: "2", label: "Ladies", image: "https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp",
    stories: [
      { id: "2a", mediaUrl: "https://cdn.dummyjson.com/product-images/tops/gray-dress/1.webp", mediaType: "image", caption: "The evening edit, dresses & two-pieces for the weekend." },
      { id: "2b", mediaUrl: "https://cdn.dummyjson.com/product-images/tops/gray-dress/2.webp", mediaType: "image", caption: "Modest wear: abayas, hijabs & elegant gowns, handpicked." },
    ],
  },
  {
    id: "3", label: "Toyota", image: "https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp",
    stories: [
      { id: "3a", mediaUrl: "https://cdn.dummyjson.com/product-images/vehicle/sportage/thumbnail.webp", mediaType: "image", caption: "Pre-owned Toyota clearance, verified and road-ready." },
      { id: "3b", mediaUrl: "https://cdn.dummyjson.com/product-images/vehicle/tucson/thumbnail.webp", mediaType: "image", caption: "SUVs & sedans. Best deals this month." },
    ],
  },
  {
    id: "4", label: "Fresh", image: "https://cdn.dummyjson.com/product-images/groceries/fish-steak/thumbnail.webp",
    stories: [
      { id: "4a", mediaUrl: "https://cdn.dummyjson.com/product-images/groceries/fish-steak/thumbnail.webp", mediaType: "image", caption: "Market-fresh staples, delivered to your door." },
      { id: "4b", mediaUrl: "https://cdn.dummyjson.com/product-images/groceries/fish-steak/thumbnail.webp", mediaType: "image", caption: "Weekly grocery deals, stock up and save." },
    ],
  },
  {
    id: "5", label: "Tech", image: "https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/thumbnail.webp",
    stories: [
      { id: "5a", mediaUrl: "https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/thumbnail.webp", mediaType: "image", caption: "Latest flagship phones, unlocked and sealed." },
      { id: "5b", mediaUrl: "https://cdn.dummyjson.com/product-images/smartphones/iphone-x/thumbnail.webp", mediaType: "image", caption: "Gadget drop: earbuds, wearables & accessories." },
    ],
  },
  {
    id: "6", label: "Home", image: "https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp",
    stories: [
      { id: "6a", mediaUrl: "https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp", mediaType: "image", caption: "Comfort meets style, sofas, beds & decor." },
      { id: "6b", mediaUrl: "https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp", mediaType: "image", caption: "Refresh your space this season." },
    ],
  },
];

// Platform-owned storefronts — each navigates to a dedicated marketplace page.
export const BANNERS = [
  {
    id: "china",
    title: "China Market",
    subtitle: "Quality products directly from trusted Chinese sellers",
    cta: "Visit Store",
    image: BANNER_CHINA,
    badge: "🇨🇳",
    accent: "#DC2626",
    route: "ChinaMarket",
    // Backing vendor (seed-markets.js). When this vendor is suspended/hidden
    // the banner is dropped from Home - see HomeScreen's activeBanners.
    vendorName: "China Market",
  },
  {
    id: "arab",
    title: "Arab World",
    subtitle: "Products from trusted sellers across the Arab world",
    cta: "Visit Store",
    image: BANNER_ARAB,
    badge: "🌍",
    accent: "#15803D",
    route: "ArabWorld",
    vendorName: "Arab World",
  },
  {
    id: "wholesale",
    title: "Wholesale",
    subtitle: "Bulk prices from trusted wholesalers and distributors",
    cta: "Contact Admin",
    image: BANNER_WHOLESALE,
    badge: "📦",
    accent: "#B45309",
    route: "Wholesalers",
    vendorName: "Wholesalers",
  },
  {
    id: "secondhand",
    title: "Second Hand Items",
    subtitle: "Quality pre-owned items at giveaway prices",
    cta: "Browse Deals",
    image: { uri: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=60" },
    badge: "🔄",
    accent: "#475569",
    route: "SecondHand",
    wide: true,
    vendorName: "Second Hand Items",
  },
];

// ─── Marketplace categories ────────────────────────────────────────────────
// Hardcoded per-marketplace taxonomies from inst.txt. Each category has mock
// products so the UI is populated before the backend seeds real data.

export const CHINA_MARKET_CATEGORIES = [
  { id: "cm-1", label: "For You", icon: "sparkles" },
  { id: "cm-2", label: "Jewelry & Accessories", icon: "gem" },
  { id: "cm-3", label: "Shoes", icon: "footsteps" },
  { id: "cm-4", label: "Bags", icon: "bag" },
  { id: "cm-5", label: "Electronics", icon: "laptop" },
  { id: "cm-6", label: "Home Appliances", icon: "home" },
  { id: "cm-7", label: "Kitchen", icon: "restaurant" },
  { id: "cm-8", label: "Phone & Accessories", icon: "phone-portrait" },
  { id: "cm-9", label: "Fashion & Clothing", icon: "shirt" },
  { id: "cm-10", label: "Toys & Games", icon: "game-controller" },
  { id: "cm-11", label: "Furniture", icon: "armchair" },
  { id: "cm-12", label: "Beauty & Health", icon: "flower" },
  { id: "cm-13", label: "Baby & Maternity", icon: "baby" },
  { id: "cm-14", label: "Tools & Hardware", icon: "build" },
  { id: "cm-15", label: "Bags & Travel", icon: "briefcase" },
  { id: "cm-16", label: "Sports & Fitness", icon: "fitness" },
];

export const ARAB_WORLD_CATEGORIES = [
  { id: "aw-1", label: "For You", icon: "sparkles" },
  { id: "aw-2", label: "Islamic Products", icon: "moon" },
  { id: "aw-3", label: "Arab Perfumes & Fragrance", icon: "flask" },
  { id: "aw-4", label: "Abaya", icon: "shirt" },
  { id: "aw-5", label: "Jalabiya", icon: "shirt" },
  { id: "aw-6", label: "Shoes", icon: "footsteps" },
  { id: "aw-7", label: "Bags", icon: "bag" },
  { id: "aw-8", label: "Gold Jewelry & Accessories", icon: "gem" },
  { id: "aw-9", label: "Arab Food & Groceries", icon: "restaurant" },
  { id: "aw-10", label: "Furniture", icon: "armchair" },
  { id: "aw-11", label: "Beauty & Health", icon: "flower" },
  { id: "aw-12", label: "Travel & Luggage", icon: "airplane" },
];

// Mock product data for marketplace categories. Uses dummyjson images as
// stand-ins. Each product has shape compatible with normalizeProduct output.
// Replace with real backend data once marketplace vendors seed products.
const mkMock = (id, name, price, image, tag) => ({
  id, title: name, price, image, tag, rating: 4.5, sold: Math.floor(Math.random() * 200) + 10,
  vendorId: null, category: "", categoryId: null, subcategoryId: null,
  categoryName: "", subcategoryName: "",
  images: [image], was: undefined, discountPercent: undefined,
  reviewsCount: 0, inStock: true, description: name,
  colors: undefined, sizes: undefined, details: undefined,
});

export const CHINA_MOCK_PRODUCTS = {
  "cm-1": [ // For You
    mkMock("cfy-1", "Wireless Earbuds", 15000, "https://cdn.dummyjson.com/product-images/mobile-accessories/airpods-pro/thumbnail.webp", "Trending"),
    mkMock("cfy-2", "Smartphone Case", 3500, "https://cdn.dummyjson.com/product-images/mobile-accessories/iphone-case/thumbnail.webp", "Reliable Sellers"),
    mkMock("cfy-3", "Laptop Stand", 12000, "https://cdn.dummyjson.com/product-images/mobile-accessories/magsafe-battery-pack/thumbnail.webp", "Fast Shipping"),
    mkMock("cfy-4", "USB-C Hub Adapter", 8500, "https://cdn.dummyjson.com/product-images/mobile-accessories/apple-magic-keyboard/thumbnail.webp", "Trending"),
    mkMock("cfy-5", "Bluetooth Speaker", 18000, "https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/thumbnail.webp", "Reliable Sellers"),
  ],
  "cm-2": [
    mkMock("cj-1", "Crystal Necklace Set", 7500, "https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp", "Trending"),
    mkMock("cj-2", "Stainless Steel Bracelet", 4500, "https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp", ""),
    mkMock("cj-3", "Pearl Earrings", 6000, "https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp", "New"),
    mkMock("cj-4", "Fashion Rings Pack", 3000, "https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp", ""),
  ],
  "cm-3": [
    mkMock("cs-1", "Running Sneakers", 12000, "https://cdn.dummyjson.com/product-images/mens-shoes/airmax-95/thumbnail.webp", "Trending"),
    mkMock("cs-2", "Formal Leather Shoes", 18000, "https://cdn.dummyjson.com/product-images/mens-shoes/airmax-90/thumbnail.webp", ""),
    mkMock("cs-3", "Women Heels", 9500, "https://cdn.dummyjson.com/product-images/womens-shoes/booties/thumbnail.webp", "New"),
    mkMock("cs-4", "Sports Sandals", 6000, "https://cdn.dummyjson.com/product-images/mens-shoes/airjordan/thumbnail.webp", ""),
  ],
  "cm-4": [
    mkMock("cb-1", "Travel Duffel Bag", 15000, "https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp", "Fast Shipping"),
    mkMock("cb-2", "Crossbody Sling Bag", 5500, "https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp", ""),
    mkMock("cb-3", "Laptop Backpack", 8000, "https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp", "Trending"),
    mkMock("cb-4", "Mini Clutch Purse", 3500, "https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp", ""),
  ],
  "cm-5": [
    mkMock("ce-1", "Wireless Earbuds Pro", 22000, "https://cdn.dummyjson.com/product-images/mobile-accessories/airpods-pro/thumbnail.webp", "Trending"),
    mkMock("ce-2", "Smart Watch", 35000, "https://cdn.dummyjson.com/product-images/mobile-accessories/apple-watch-7/thumbnail.webp", "Reliable Sellers"),
    mkMock("ce-3", "Portable Charger", 8500, "https://cdn.dummyjson.com/product-images/mobile-accessories/magsafe-battery-pack/thumbnail.webp", ""),
    mkMock("ce-4", "Mechanical Keyboard", 28000, "https://cdn.dummyjson.com/product-images/mobile-accessories/apple-magic-keyboard/thumbnail.webp", "Fast Shipping"),
  ],
  "cm-6": [
    mkMock("cha-1", "Robot Vacuum Cleaner", 65000, "https://cdn.dummyjson.com/product-images/home/decorative-pillow/thumbnail.webp", "Trending"),
    mkMock("cha-2", "Air Purifier", 42000, "https://cdn.dummyjson.com/product-images/home/kitchen-chair/thumbnail.webp", ""),
    mkMock("cha-3", "Electric Fan", 15000, "https://cdn.dummyjson.com/product-images/home/comforter/thumbnail.webp", "New"),
    mkMock("cha-4", "Humidifier", 18000, "https://cdn.dummyjson.com/product-images/home/pillow/thumbnail.webp", ""),
  ],
  "cm-7": [
    mkMock("ck-1", "Air Fryer", 32000, "https://cdn.dummyjson.com/product-images/kitchen/paper-towels/thumbnail.webp", "Trending"),
    mkMock("ck-2", "Blender Set", 15000, "https://cdn.dummyjson.com/product-images/kitchen/silver-faucet/thumbnail.webp", ""),
    mkMock("ck-3", "Knife Set", 8000, "https://cdn.dummyjson.com/product-images/kitchen/dish-plate/thumbnail.webp", "New"),
    mkMock("ck-4", "Electric Kettle", 6500, "https://cdn.dummyjson.com/product-images/kitchen/chopping-board/thumbnail.webp", ""),
  ],
  "cm-8": [
    mkMock("cp-1", "iPhone 15 Pro Case", 4500, "https://cdn.dummyjson.com/product-images/mobile-accessories/iphone-case/thumbnail.webp", ""),
    mkMock("cp-2", "Screen Protector Pack", 2000, "https://cdn.dummyjson.com/product-images/mobile-accessories/case/thumbnail.webp", "Trending"),
    mkMock("cp-3", "Car Phone Mount", 3500, "https://cdn.dummyjson.com/product-images/mobile-accessories/charger/thumbnail.webp", ""),
    mkMock("cp-4", "Wireless Charger Pad", 6000, "https://cdn.dummyjson.com/product-images/mobile-accessories/cable/thumbnail.webp", "Fast Shipping"),
  ],
  "cm-9": [
    mkMock("cf-1", "Graphic T-Shirt Pack", 5500, "https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp", "Trending"),
    mkMock("cf-2", "Denim Jacket", 15000, "https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp", ""),
    mkMock("cf-3", "Cotton Casual Shirt", 7000, "https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp", "New"),
    mkMock("cf-4", "Summer Dress", 9500, "https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp", ""),
  ],
  "cm-10": [
    mkMock("ct-1", "Building Blocks Set", 8000, "https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp", "Trending"),
    mkMock("ct-2", "Remote Control Car", 12000, "https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp", ""),
    mkMock("ct-3", "Puzzle Board Game", 4500, "https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp", ""),
    mkMock("ct-4", "Plush Teddy Bear", 3500, "https://cdn.dummyjson.com/product-images/fragrance/chanel-n-5/thumbnail.webp", "New"),
  ],
  "cm-11": [
    mkMock("cfur-1", "Office Chair Ergonomic", 45000, "https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp", "Trending"),
    mkMock("cfur-2", "Modern Coffee Table", 28000, "https://cdn.dummyjson.com/product-images/furniture/charme-terracotta-sofa/thumbnail.webp", ""),
    mkMock("cfur-3", "Floating Shelf Set", 6500, "https://cdn.dummyjson.com/product-images/furniture/podium-shelf/thumbnail.webp", ""),
    mkMock("cfur-4", "Bookshelf Organizer", 18000, "https://cdn.dummyjson.com/product-images/furniture/marble-table/thumbnail.webp", "New"),
  ],
  "cm-12": [
    mkMock("cbh-1", "Skincare Set", 12000, "https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp", "Trending"),
    mkMock("cbh-2", "Hair Dryer Professional", 18000, "https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp", ""),
    mkMock("cbh-3", "Perfume Collection", 9500, "https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp", "New"),
    mkMock("cbh-4", "Makeup Brush Set", 5000, "https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp", ""),
  ],
  "cm-13": [
    mkMock("cbm-1", "Baby Stroller Compact", 35000, "https://cdn.dummyjson.com/product-images/groceries/avocado/thumbnail.webp", "Trending"),
    mkMock("cbm-2", "Diaper Bag Backpack", 8500, "https://cdn.dummyjson.com/product-images/groceries/baguette/thumbnail.webp", ""),
    mkMock("cbm-3", "Baby Monitor", 22000, "https://cdn.dummyjson.com/product-images/groceries/boiled-eggs/thumbnail.webp", "New"),
    mkMock("cbm-4", "Feeding Bottle Set", 3500, "https://cdn.dummyjson.com/product-images/groceries/bread-with-green-salad/thumbnail.webp", ""),
  ],
  "cm-14": [
    mkMock("cth-1", "Power Drill Set", 25000, "https://cdn.dummyjson.com/product-images/groceries/blueberry/thumbnail.webp", "Trending"),
    mkMock("cth-2", "Socket Wrench Kit", 12000, "https://cdn.dummyjson.com/product-images/groceries/chocolate-cake/thumbnail.webp", ""),
    mkMock("cth-3", "Tape Measure Digital", 4500, "https://cdn.dummyjson.com/product-images/groceries/corn-dog/thumbnail.webp", ""),
    mkMock("cth-4", "LED Work Light", 6000, "https://cdn.dummyjson.com/product-images/groceries/croissant/thumbnail.webp", "New"),
  ],
  "cm-15": [
    mkMock("cbt-1", "Carry-On Luggage", 28000, "https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp", "Trending"),
    mkMock("cbt-2", "Packing Cubes Set", 5500, "https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp", ""),
    mkMock("cbt-3", "Neck Pillow Travel", 3500, "https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp", ""),
    mkMock("cbt-4", "Passport Holder", 2000, "https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp", "New"),
  ],
  "cm-16": [
    mkMock("csf-1", "Yoga Mat Premium", 8500, "https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp", "Trending"),
    mkMock("csf-2", "Resistance Bands Set", 4500, "https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp", ""),
    mkMock("csf-3", "Dumbbells Adjustable", 35000, "https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp", ""),
    mkMock("csf-4", "Jump Rope Speed", 2500, "https://cdn.dummyjson.com/product-images/fragrance/chanel-n-5/thumbnail.webp", "New"),
  ],
};

export const ARAB_MOCK_PRODUCTS = {
  "aw-1": [ // For You
    mkMock("afy-1", "Prayer Mat Premium", 8500, "https://cdn.dummyjson.com/product-images/fragrance/perfume/thumbnail.webp", "Trending"),
    mkMock("afy-2", "Oud Perfume 50ml", 25000, "https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp", "Reliable Sellers"),
    mkMock("afy-3", "Silk Abaya", 35000, "https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp", "New"),
    mkMock("afy-4", "Arabic Coffee Set", 12000, "https://cdn.dummyjson.com/product-images/kitchen/silver-faucet/thumbnail.webp", ""),
    mkMock("afy-5", "Gold Bangle", 45000, "https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp", "Trending"),
  ],
  "aw-2": [
    mkMock("aip-1", "Tasbih 33 Beads", 2500, "https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp", "Trending"),
    mkMock("aip-2", "Prayer Mat Embroidered", 6000, "https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp", ""),
    mkMock("aip-3", "Qur'an Gold Frame", 15000, "https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp", "New"),
    mkMock("aip-4", "Qur'an Stand Wooden", 8000, "https://cdn.dummyjson.com/product-images/fragrance/chanel-n-5/thumbnail.webp", ""),
    mkMock("aip-5", "Islamic Wall Art", 4500, "https://cdn.dummyjson.com/product-images/fragrance/perfume/thumbnail.webp", ""),
    mkMock("aip-6", "Prayer Clothes Set", 3500, "https://cdn.dummyjson.com/product-images/fragrance/unscented/thumbnail.webp", ""),
    mkMock("aip-7", "Islamic Books Collection", 7000, "https://cdn.dummyjson.com/product-images/fragrance/musk/thumbnail.webp", ""),
  ],
  "aw-3": [
    mkMock("apf-1", "Oud Oil Premium", 35000, "https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp", "Trending"),
    mkMock("apf-2", "Bakhoor Set", 12000, "https://cdn.dummyjson.com/product-images/fragrance/perfume/thumbnail.webp", ""),
    mkMock("apf-3", "Arabic Attar 12ml", 8500, "https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp", "New"),
    mkMock("apf-4", "Perfume Gift Box", 22000, "https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp", ""),
  ],
  "aw-4": [
    mkMock("aa-1", "Black Embroidered Abaya", 25000, "https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp", "Trending"),
    mkMock("aa-2", "Navy Blue Abaya", 20000, "https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp", ""),
    mkMock("aa-3", "White Lace Abaya", 30000, "https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp", "New"),
    mkMock("aa-4", "Casual Everyday Abaya", 15000, "https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp", ""),
  ],
  "aw-5": [
    mkMock("aj-1", "Embroidered Jalabiya", 28000, "https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp", "Trending"),
    mkMock("aj-2", "Silk Jalabiya", 35000, "https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp", "New"),
    mkMock("aj-3", "Cotton Jalabiya", 18000, "https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp", ""),
    mkMock("aj-4", "Formal Jalabiya", 42000, "https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp", ""),
  ],
  "aw-6": [
    mkMock("ash-1", "Leather Sandals", 12000, "https://cdn.dummyjson.com/product-images/mens-shoes/airmax-95/thumbnail.webp", ""),
    mkMock("ash-2", "Embellished Heels", 18000, "https://cdn.dummyjson.com/product-images/womens-shoes/booties/thumbnail.webp", "Trending"),
    mkMock("ash-3", "Classic Loafers", 15000, "https://cdn.dummyjson.com/product-images/mens-shoes/airmax-90/thumbnail.webp", ""),
    mkMock("ash-4", "Canvas Sneakers", 8000, "https://cdn.dummyjson.com/product-images/mens-shoes/airjordan/thumbnail.webp", "New"),
  ],
  "aw-7": [
    mkMock("abg-1", "Leather Tote Bag", 18000, "https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp", "Trending"),
    mkMock("abg-2", "Clutch Evening Bag", 9500, "https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp", ""),
    mkMock("abg-3", "Backpack Canvas", 7500, "https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp", ""),
    mkMock("abg-4", "Crossbody Mini", 5500, "https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp", "New"),
  ],
  "aw-8": [
    mkMock("agj-1", "Gold Necklace 21K", 120000, "https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp", "Trending"),
    mkMock("agj-2", "Gold Ring Set", 65000, "https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp", ""),
    mkMock("agj-3", "Silver Bracelet", 15000, "https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp", ""),
    mkMock("agj-4", "Pearl Earrings", 22000, "https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp", "New"),
  ],
  "aw-9": [
    mkMock("aaf-1", "Arabic Dates Box", 5500, "https://cdn.dummyjson.com/product-images/groceries/avocado/thumbnail.webp", "Trending"),
    mkMock("aaf-2", "Halal Snack Box", 3500, "https://cdn.dummyjson.com/product-images/groceries/baguette/thumbnail.webp", ""),
    mkMock("aaf-3", "Saffron Threads 5g", 8000, "https://cdn.dummyjson.com/product-images/groceries/boiled-eggs/thumbnail.webp", "New"),
    mkMock("aaf-4", "Za'atar Mix", 2500, "https://cdn.dummyjson.com/product-images/groceries/bread-with-green-salad/thumbnail.webp", ""),
  ],
  "aw-10": [
    mkMock("afu-1", "Arabic Majlis Sofa Set", 180000, "https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp", "Trending"),
    mkMock("afu-2", "Carved Wood Table", 45000, "https://cdn.dummyjson.com/product-images/furniture/marble-table/thumbnail.webp", ""),
    mkMock("afu-3", "Floor Cushion Set", 12000, "https://cdn.dummyjson.com/product-images/furniture/podium-shelf/thumbnail.webp", ""),
    mkMock("afu-4", "Decorative Lantern", 8500, "https://cdn.dummyjson.com/product-images/furniture/charme-terracotta-sofa/thumbnail.webp", "New"),
  ],
  "aw-11": [
    mkMock("abh-1", "Hammam Soap Set", 4500, "https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp", "Trending"),
    mkMock("abh-2", "Argan Oil 100ml", 6000, "https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp", ""),
    mkMock("abh-3", "Kohl Eyeliner", 2500, "https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp", ""),
    mkMock("abh-4", "Rose Water Toner", 3000, "https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp", "New"),
  ],
  "aw-12": [
    mkMock("atl-1", "Hardside Luggage Set", 55000, "https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp", "Trending"),
    mkMock("atl-2", "Travel Toiletry Bag", 4500, "https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp", ""),
    mkMock("atl-3", "Neck Pillow Memory Foam", 3500, "https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp", ""),
    mkMock("atl-4", "Luggage Scale Digital", 2500, "https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp", "New"),
  ],
};

// Admin contact for Wholesalers page
export const WHOLESALER_CONTACT = {
  tagline: "Bulk orders & wholesale inquiries",
};

// Backend vendor IDs for marketplace entities (seeded by seed-markets.js)
export const MARKET_VENDORS = {
  china: "00000000-0000-4000-b000-000000000001",
  arab: "00000000-0000-4000-b000-000000000002",
  wholesale: "00000000-0000-4000-b000-000000000003",
  secondHand: "00000000-0000-4000-b000-000000000004",
};

export const MARKET_VENDOR_IDS = Object.values(MARKET_VENDORS);
