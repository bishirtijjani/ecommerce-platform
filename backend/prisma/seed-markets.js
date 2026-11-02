/**
 * Seed marketplace data — China Market, Arab World, Wholesalers, Second Hand Items.
 * Creates standalone vendor rows (no User accounts) with categories and products.
 * Run: npm run db:seed:markets
 *
 * Idempotent: re-runs skip existing products by vendorId+name.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Nigerian states + their LGAs. Shared naming contract with the customer app's
// location rail (app/src/data/nigeriaStatesLgas.js) - keep the two in sync.
const NIGERIA_STATES = require('./nigeria-states-lgas.json');

// ─── Fixed UUIDs ────────────────────────────────────────────────────────
const VENDORS = {
  china:     '00000000-0000-4000-b000-000000000001',
  arab:      '00000000-0000-4000-b000-000000000002',
  wholesale: '00000000-0000-4000-b000-000000000003',
  secondHand:'00000000-0000-4000-b000-000000000004',
};

// China categories (cm-2 … cm-16)
const CC = {
  cm2:  '00000000-0000-4000-b100-000000000002',
  cm3:  '00000000-0000-4000-b100-000000000003',
  cm4:  '00000000-0000-4000-b100-000000000004',
  cm5:  '00000000-0000-4000-b100-000000000005',
  cm6:  '00000000-0000-4000-b100-000000000006',
  cm7:  '00000000-0000-4000-b100-000000000007',
  cm8:  '00000000-0000-4000-b100-000000000008',
  cm9:  '00000000-0000-4000-b100-000000000009',
  cm10: '00000000-0000-4000-b100-000000000010',
  cm11: '00000000-0000-4000-b100-000000000011',
  cm12: '00000000-0000-4000-b100-000000000012',
  cm13: '00000000-0000-4000-b100-000000000013',
  cm14: '00000000-0000-4000-b100-000000000014',
  cm15: '00000000-0000-4000-b100-000000000015',
  cm16: '00000000-0000-4000-b100-000000000016',
};

// Arab categories (aw-2 … aw-12)
const AC = {
  aw2:  '00000000-0000-4000-b200-000000000002',
  aw3:  '00000000-0000-4000-b200-000000000003',
  aw4:  '00000000-0000-4000-b200-000000000004',
  aw5:  '00000000-0000-4000-b200-000000000005',
  aw6:  '00000000-0000-4000-b200-000000000006',
  aw7:  '00000000-0000-4000-b200-000000000007',
  aw8:  '00000000-0000-4000-b200-000000000008',
  aw9:  '00000000-0000-4000-b200-000000000009',
  aw10: '00000000-0000-4000-b200-000000000010',
  aw11: '00000000-0000-4000-b200-000000000011',
  aw12: '00000000-0000-4000-b200-000000000012',
};

// Islamic Products subcategories
const ISLAMIC_SUBS = {
  prayerMats:  '00000000-0000-4000-b200-000000000101',
  tasbih:      '00000000-0000-4000-b200-000000000102',
  quran:       '00000000-0000-4000-b200-000000000103',
  quranStands: '00000000-0000-4000-b200-000000000104',
  decorations: '00000000-0000-4000-b200-000000000105',
  prayerClothes: '00000000-0000-4000-b200-000000000106',
  books:       '00000000-0000-4000-b200-000000000107',
};

// Second Hand is location-based: each Nigerian state is a vendor category and
// each of its LGAs a subcategory. IDs are derived deterministically from
// (state index, LGA index) so re-running the seed stays idempotent.
const hex = (n, len) => n.toString(16).padStart(len, '0');
const stateCategoryId = (stateIdx) => `00000000-0000-4000-e100-${hex(stateIdx, 12)}`;
const lgaSubcategoryId = (stateIdx, lgaIdx) => `00000000-0000-4000-e200-${hex(stateIdx, 4)}${hex(lgaIdx, 8)}`;

// ─── Helpers ────────────────────────────────────────────────────────────

async function upsertVendor({ id, name, description, phone }) {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (existing) { console.log(`  ℹ  Vendor "${name}" already exists, skipping`); return existing; }
  return prisma.vendor.create({
    data: {
      id, name, description, phone, email: null,
      address: 'Katsina, Nigeria', lat: 12.9905, lng: 7.6017,
      status: 'APPROVED', isActive: true, isOpen: true, adminActiveOverride: true,
      averageRating: 4.5, photos: [], policies: null,
      logoUrl: null, coverImageUrl: null, categoryId: null,
    },
  });
}

async function resolveCategory({ id, name, slug, icon, color, sortOrder, globalName, vendorId }) {
  if (globalName) {
    const g = await prisma.vendorCategory.findFirst({ where: { name: globalName, vendorId: null } });
    if (g) { console.log(`  ✓  Reusing global category "${globalName}" (${g.id})`); return g.id; }
  }
  await prisma.vendorCategory.upsert({
    where: { id },
    update: { name, slug, icon: icon || null, color: color || null, sortOrder, isActive: true, vendorId, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    create: { id, name, slug, icon: icon || null, color: color || null, sortOrder, isActive: true, vendorId, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
  });
  console.log(`  +  Custom category "${name}" → ${id}`);
  return id;
}

async function seedProduct({ vendorId, categoryId, subcategoryId, title, price, image }) {
  const existing = await prisma.product.findFirst({ where: { vendorId, name: title } });
  if (existing) return existing;
  const product = await prisma.product.create({
    data: {
      vendor: { connect: { id: vendorId } },
      category: { connect: { id: categoryId } },
      ...(subcategoryId ? { subcategory: { connect: { id: subcategoryId } } } : {}),
      name: title, description: title,
      basePrice: price, stock: 0,
      imageUrl: image, images: [image], isAvailable: true,
    },
  });
  await prisma.productVariant.create({
    data: { productId: product.id, sku: `${product.id}-STD`, attributes: {}, price, stock: 50, isAvailable: true },
  });
  return product;
}

async function seedSubcategory({ id, categoryId, vendorId, name, sortOrder }) {
  const existing = await prisma.subcategory.findFirst({ where: { categoryId, vendorId, name } });
  if (existing) return existing;
  return prisma.subcategory.create({
    data: { id, categoryId, vendorId, name, sortOrder, isActive: true },
  });
}

// Second-hand listings are location-tagged. Idempotency keys on
// (vendorId, name, subcategoryId) so the same title can appear under different
// states/LGAs without being skipped on a re-run.
async function seedLocationProduct({ vendorId, categoryId, subcategoryId, state, lga, title, price, image }) {
  const existing = await prisma.product.findFirst({ where: { vendorId, name: title, subcategoryId } });
  if (existing) return existing;
  const product = await prisma.product.create({
    data: {
      vendor: { connect: { id: vendorId } },
      category: { connect: { id: categoryId } },
      subcategory: { connect: { id: subcategoryId } },
      name: title, description: title,
      basePrice: price, stock: 0,
      imageUrl: image, images: [image], isAvailable: true,
      // Second Hand listings are located by the seller's State/LGA; the seed's
      // state/LGA taxonomy rows double as that snapshot.
      condition: 'SECOND_HAND',
      state: state || null,
      lga: lga || null,
    },
  });
  await prisma.productVariant.create({
    data: { productId: product.id, sku: `${product.id}-STD`, attributes: {}, price, stock: 5, isAvailable: true },
  });
  return product;
}

// Build the Second Hand market as a location taxonomy: 37 state categories,
// every LGA as a subcategory, and 3 sample listings per state. Replaces the
// old category-based second-hand seed, so it first clears any prior
// second-hand catalogue (skipping anything already tied to an order).
async function seedSecondHandMarket() {
  console.log('\n📂 Building Second Hand state / LGA taxonomy...');

  await prisma.product.deleteMany({ where: { vendorId: VENDORS.secondHand, orderItems: { none: {} } } });
  await prisma.subcategory.deleteMany({ where: { vendorId: VENDORS.secondHand, products: { none: {} } } });
  await prisma.vendorCategory.deleteMany({ where: { vendorId: VENDORS.secondHand, products: { none: {} } } });

  const stateCategoryIds = [];
  for (let si = 0; si < NIGERIA_STATES.length; si++) {
    const state = NIGERIA_STATES[si];
    const categoryId = stateCategoryId(si);
    await resolveCategory({
      id: categoryId, name: state.name, slug: `second-hand-${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      icon: 'location', color: null, sortOrder: si, globalName: null, vendorId: VENDORS.secondHand,
    });
    stateCategoryIds.push(categoryId);
  }
  console.log(`  + ${stateCategoryIds.length} state categories`);

  let lgaCount = 0;
  for (let si = 0; si < NIGERIA_STATES.length; si++) {
    const state = NIGERIA_STATES[si];
    for (let li = 0; li < state.lgas.length; li++) {
      await seedSubcategory({
        id: lgaSubcategoryId(si, li), categoryId: stateCategoryIds[si],
        vendorId: VENDORS.secondHand, name: state.lgas[li], sortOrder: li,
      });
      lgaCount++;
    }
  }
  console.log(`  + ${lgaCount} LGA subcategories`);

  console.log('\n🏷️  Seeding Second Hand listings...');
  let productCount = 0;
  for (let si = 0; si < NIGERIA_STATES.length; si++) {
    const state = NIGERIA_STATES[si];
    for (let k = 0; k < 3; k++) {
      const [title, price, image] = SECOND_HAND_POOL[(si * 3 + k) % SECOND_HAND_POOL.length];
      const li = (si + k) % state.lgas.length;
      await seedLocationProduct({
        vendorId: VENDORS.secondHand,
        categoryId: stateCategoryIds[si],
        subcategoryId: lgaSubcategoryId(si, li),
        state: state.name,
        lga: state.lgas[li],
        title, price, image,
      });
      productCount++;
    }
  }
  console.log(`  ✅ ${productCount} Second Hand listings processed`);

  return { states: stateCategoryIds.length, lgas: lgaCount, products: productCount };
}

// ─── Category definitions ───────────────────────────────────────────────
// globalName = match & reuse a global category by exact name; null = create custom

const CHINA_CATEGORIES = [
  { key: 'cm2',  name: 'Jewelry & Accessories', slug: 'jewelry-accessories', icon: 'gem',         color: '#D4AF37', sortOrder: 10, globalName: null },
  { key: 'cm3',  name: 'Shoes',                 slug: 'shoes',               icon: 'footsteps',    color: '#8B4513', sortOrder: 20, globalName: 'Shoes' },
  { key: 'cm4',  name: 'Bags',                  slug: 'bags',                icon: 'bag',          color: '#6B4226', sortOrder: 30, globalName: 'Bags' },
  { key: 'cm5',  name: 'Electronics',            slug: 'electronics',         icon: 'laptop',       color: '#2563EB', sortOrder: 40, globalName: 'Electronics' },
  { key: 'cm6',  name: 'Home Appliances',        slug: 'home-appliances',     icon: 'home',         color: '#059669', sortOrder: 50, globalName: null },
  { key: 'cm7',  name: 'Kitchen',                slug: 'kitchen',             icon: 'restaurant',   color: '#EA580C', sortOrder: 60, globalName: null },
  { key: 'cm8',  name: 'Phone & Accessories',    slug: 'phone-accessories',   icon: 'phone-portrait',color: '#7C3AED', sortOrder: 70, globalName: null },
  { key: 'cm9',  name: 'Fashion & Clothing',     slug: 'fashion-clothing',    icon: 'shirt',        color: '#DB2777', sortOrder: 80, globalName: null },
  { key: 'cm10', name: 'Toys & Games',           slug: 'toys-games',          icon: 'game-controller',color: '#F59E0B', sortOrder: 90, globalName: 'Toys & Games' },
  { key: 'cm11', name: 'Furniture',              slug: 'furniture',           icon: 'armchair',     color: '#7C2D12', sortOrder: 100, globalName: 'Furniture' },
  { key: 'cm12', name: 'Beauty & Health',        slug: 'beauty-health',       icon: 'flower',       color: '#EC4899', sortOrder: 110, globalName: null },
  { key: 'cm13', name: 'Baby & Maternity',       slug: 'baby-maternity',      icon: 'baby',         color: '#8B5CF6', sortOrder: 120, globalName: null },
  { key: 'cm14', name: 'Tools & Hardware',       slug: 'tools-hardware',      icon: 'build',        color: '#64748B', sortOrder: 130, globalName: null },
  { key: 'cm15', name: 'Bags & Travel',          slug: 'bags-travel',         icon: 'briefcase',    color: '#0D9488', sortOrder: 140, globalName: null },
  { key: 'cm16', name: 'Sports & Fitness',       slug: 'sports-fitness',      icon: 'fitness',      color: '#16A34A', sortOrder: 150, globalName: 'Sports & Fitness' },
];

const ARAB_CATEGORIES = [
  { key: 'aw2',  name: 'Islamic Products',           slug: 'islamic-products',        icon: 'moon',         color: '#15803D', sortOrder: 10, globalName: null },
  { key: 'aw3',  name: 'Arab Perfumes & Fragrance',  slug: 'arab-perfumes-fragrance', icon: 'flask',        color: '#9333EA', sortOrder: 20, globalName: null },
  { key: 'aw4',  name: 'Abaya',                      slug: 'abaya-marketplace',       icon: 'shirt',        color: '#1E293B', sortOrder: 30, globalName: 'Abaya' },
  { key: 'aw5',  name: 'Jalabiya',                   slug: 'jalabiya',                icon: 'shirt',        color: '#4A1D96', sortOrder: 40, globalName: null },
  { key: 'aw6',  name: 'Shoes',                      slug: 'shoes-arab',              icon: 'footsteps',    color: '#8B4513', sortOrder: 50, globalName: 'Shoes' },
  { key: 'aw7',  name: 'Bags',                       slug: 'bags-arab',               icon: 'bag',          color: '#6B4226', sortOrder: 60, globalName: 'Bags' },
  { key: 'aw8',  name: 'Gold Jewelry & Accessories', slug: 'gold-jewelry-accessories',icon: 'gem',          color: '#D4AF37', sortOrder: 70, globalName: null },
  { key: 'aw9',  name: 'Arab Food & Groceries',      slug: 'arab-food-groceries',     icon: 'restaurant',   color: '#EA580C', sortOrder: 80, globalName: null },
  { key: 'aw10', name: 'Furniture',                   slug: 'furniture-arab',          icon: 'armchair',     color: '#7C2D12', sortOrder: 90, globalName: 'Furniture' },
  { key: 'aw11', name: 'Beauty & Health',             slug: 'beauty-health-arab',      icon: 'flower',       color: '#EC4899', sortOrder: 100, globalName: null },
  { key: 'aw12', name: 'Travel & Luggage',            slug: 'travel-luggage',          icon: 'airplane',     color: '#0D9488', sortOrder: 110, globalName: null },
];

// Second Hand no longer seeds product categories - its rail is Nigerian
// states + LGAs, built from NIGERIA_STATES in main() below.

// ─── Product data ───────────────────────────────────────────────────────
// Format per entry: [title, price, imageUrl]

const CHINA_PRODUCTS = {
  cm2: [
    ['Crystal Necklace Set',        7500,  'https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp'],
    ['Stainless Steel Bracelet',    4500,  'https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp'],
    ['Pearl Earrings',              6000,  'https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp'],
    ['Fashion Rings Pack',          3000,  'https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp'],
  ],
  cm3: [
    ['Running Sneakers',            12000, 'https://cdn.dummyjson.com/product-images/mens-shoes/airmax-95/thumbnail.webp'],
    ['Formal Leather Shoes',        18000, 'https://cdn.dummyjson.com/product-images/mens-shoes/airmax-90/thumbnail.webp'],
    ['Women Heels',                 9500,  'https://cdn.dummyjson.com/product-images/womens-shoes/booties/thumbnail.webp'],
    ['Sports Sandals',              6000,  'https://cdn.dummyjson.com/product-images/mens-shoes/airjordan/thumbnail.webp'],
  ],
  cm4: [
    ['Travel Duffel Bag',           15000, 'https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp'],
    ['Crossbody Sling Bag',         5500,  'https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp'],
    ['Laptop Backpack',             8000,  'https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp'],
    ['Mini Clutch Purse',           3500,  'https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp'],
  ],
  cm5: [
    ['Wireless Earbuds Pro',        22000, 'https://cdn.dummyjson.com/product-images/mobile-accessories/airpods-pro/thumbnail.webp'],
    ['Smart Watch',                 35000, 'https://cdn.dummyjson.com/product-images/mobile-accessories/apple-watch-7/thumbnail.webp'],
    ['Portable Charger',            8500,  'https://cdn.dummyjson.com/product-images/mobile-accessories/magsafe-battery-pack/thumbnail.webp'],
    ['Mechanical Keyboard',         28000, 'https://cdn.dummyjson.com/product-images/mobile-accessories/apple-magic-keyboard/thumbnail.webp'],
  ],
  cm6: [
    ['Robot Vacuum Cleaner',        65000, 'https://cdn.dummyjson.com/product-images/home/decorative-pillow/thumbnail.webp'],
    ['Air Purifier',                42000, 'https://cdn.dummyjson.com/product-images/home/kitchen-chair/thumbnail.webp'],
    ['Electric Fan',                15000, 'https://cdn.dummyjson.com/product-images/home/comforter/thumbnail.webp'],
    ['Humidifier',                  18000, 'https://cdn.dummyjson.com/product-images/home/pillow/thumbnail.webp'],
  ],
  cm7: [
    ['Air Fryer',                   32000, 'https://cdn.dummyjson.com/product-images/kitchen/paper-towels/thumbnail.webp'],
    ['Blender Set',                 15000, 'https://cdn.dummyjson.com/product-images/kitchen/silver-faucet/thumbnail.webp'],
    ['Knife Set',                   8000,  'https://cdn.dummyjson.com/product-images/kitchen/dish-plate/thumbnail.webp'],
    ['Electric Kettle',             6500,  'https://cdn.dummyjson.com/product-images/kitchen/chopping-board/thumbnail.webp'],
  ],
  cm8: [
    ['iPhone 15 Pro Case',          4500,  'https://cdn.dummyjson.com/product-images/mobile-accessories/iphone-case/thumbnail.webp'],
    ['Screen Protector Pack',       2000,  'https://cdn.dummyjson.com/product-images/mobile-accessories/case/thumbnail.webp'],
    ['Car Phone Mount',             3500,  'https://cdn.dummyjson.com/product-images/mobile-accessories/charger/thumbnail.webp'],
    ['Wireless Charger Pad',        6000,  'https://cdn.dummyjson.com/product-images/mobile-accessories/cable/thumbnail.webp'],
  ],
  cm9: [
    ['Graphic T-Shirt Pack',        5500,  'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp'],
    ['Denim Jacket',                15000, 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp'],
    ['Cotton Casual Shirt',         7000,  'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp'],
    ['Summer Dress',                9500,  'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp'],
  ],
  cm10: [
    ['Building Blocks Set',         8000,  'https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp'],
    ['Remote Control Car',          12000, 'https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp'],
    ['Puzzle Board Game',           4500,  'https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp'],
    ['Plush Teddy Bear',            3500,  'https://cdn.dummyjson.com/product-images/fragrance/chanel-n-5/thumbnail.webp'],
  ],
  cm11: [
    ['Office Chair Ergonomic',      45000, 'https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp'],
    ['Modern Coffee Table',         28000, 'https://cdn.dummyjson.com/product-images/furniture/charme-terracotta-sofa/thumbnail.webp'],
    ['Floating Shelf Set',          6500,  'https://cdn.dummyjson.com/product-images/furniture/podium-shelf/thumbnail.webp'],
    ['Bookshelf Organizer',         18000, 'https://cdn.dummyjson.com/product-images/furniture/marble-table/thumbnail.webp'],
  ],
  cm12: [
    ['Skincare Set',                12000, 'https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp'],
    ['Hair Dryer Professional',     18000, 'https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp'],
    ['Perfume Collection',          9500,  'https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp'],
    ['Makeup Brush Set',            5000,  'https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp'],
  ],
  cm13: [
    ['Baby Stroller Compact',       35000, 'https://cdn.dummyjson.com/product-images/groceries/avocado/thumbnail.webp'],
    ['Diaper Bag Backpack',         8500,  'https://cdn.dummyjson.com/product-images/groceries/baguette/thumbnail.webp'],
    ['Baby Monitor',                22000, 'https://cdn.dummyjson.com/product-images/groceries/boiled-eggs/thumbnail.webp'],
    ['Feeding Bottle Set',          3500,  'https://cdn.dummyjson.com/product-images/groceries/bread-with-green-salad/thumbnail.webp'],
  ],
  cm14: [
    ['Power Drill Set',             25000, 'https://cdn.dummyjson.com/product-images/groceries/blueberry/thumbnail.webp'],
    ['Socket Wrench Kit',           12000, 'https://cdn.dummyjson.com/product-images/groceries/chocolate-cake/thumbnail.webp'],
    ['Tape Measure Digital',        4500,  'https://cdn.dummyjson.com/product-images/groceries/corn-dog/thumbnail.webp'],
    ['LED Work Light',              6000,  'https://cdn.dummyjson.com/product-images/groceries/croissant/thumbnail.webp'],
  ],
  cm15: [
    ['Carry-On Luggage',            28000, 'https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp'],
    ['Packing Cubes Set',           5500,  'https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp'],
    ['Neck Pillow Travel',          3500,  'https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp'],
    ['Passport Holder',             2000,  'https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp'],
  ],
  cm16: [
    ['Yoga Mat Premium',            8500,  'https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp'],
    ['Resistance Bands Set',        4500,  'https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp'],
    ['Dumbbells Adjustable',        35000, 'https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp'],
    ['Jump Rope Speed',             2500,  'https://cdn.dummyjson.com/product-images/fragrance/chanel-n-5/thumbnail.webp'],
  ],
};

const ARAB_PRODUCTS = {
  aw2: [
    ['Tasbih 33 Beads',             2500,  'https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp'],
    ['Prayer Mat Embroidered',      6000,  'https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp'],
    ["Qur'an Gold Frame",           15000, 'https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp'],
    ["Qur'an Stand Wooden",         8000,  'https://cdn.dummyjson.com/product-images/fragrance/chanel-n-5/thumbnail.webp'],
    ['Islamic Wall Art',            4500,  'https://cdn.dummyjson.com/product-images/fragrance/perfume/thumbnail.webp'],
    ['Prayer Clothes Set',          3500,  'https://cdn.dummyjson.com/product-images/fragrance/unscented/thumbnail.webp'],
    ['Islamic Books Collection',    7000,  'https://cdn.dummyjson.com/product-images/fragrance/musk/thumbnail.webp'],
  ],
  aw3: [
    ['Oud Oil Premium',             35000, 'https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp'],
    ['Bakhoor Set',                 12000, 'https://cdn.dummyjson.com/product-images/fragrance/perfume/thumbnail.webp'],
    ['Arabic Attar 12ml',           8500,  'https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp'],
    ['Perfume Gift Box',            22000, 'https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp'],
  ],
  aw4: [
    ['Black Embroidered Abaya',     25000, 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp'],
    ['Navy Blue Abaya',             20000, 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp'],
    ['White Lace Abaya',            30000, 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp'],
    ['Casual Everyday Abaya',       15000, 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp'],
  ],
  aw5: [
    ['Embroidered Jalabiya',        28000, 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp'],
    ['Silk Jalabiya',               35000, 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp'],
    ['Cotton Jalabiya',             18000, 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp'],
    ['Formal Jalabiya',             42000, 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp'],
  ],
  aw6: [
    ['Leather Sandals',             12000, 'https://cdn.dummyjson.com/product-images/mens-shoes/airmax-95/thumbnail.webp'],
    ['Embellished Heels',           18000, 'https://cdn.dummyjson.com/product-images/womens-shoes/booties/thumbnail.webp'],
    ['Classic Loafers',             15000, 'https://cdn.dummyjson.com/product-images/mens-shoes/airmax-90/thumbnail.webp'],
    ['Canvas Sneakers',             8000,  'https://cdn.dummyjson.com/product-images/mens-shoes/airjordan/thumbnail.webp'],
  ],
  aw7: [
    ['Leather Tote Bag',            18000, 'https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp'],
    ['Clutch Evening Bag',          9500,  'https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp'],
    ['Backpack Canvas',             7500,  'https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp'],
    ['Crossbody Mini',              5500,  'https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp'],
  ],
  aw8: [
    ['Gold Necklace 21K',           120000, 'https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp'],
    ['Gold Ring Set',               65000, 'https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp'],
    ['Silver Bracelet',             15000, 'https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp'],
    ['Pearl Earrings',              22000, 'https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp'],
  ],
  aw9: [
    ['Arabic Dates Box',            5500,  'https://cdn.dummyjson.com/product-images/groceries/avocado/thumbnail.webp'],
    ['Halal Snack Box',             3500,  'https://cdn.dummyjson.com/product-images/groceries/baguette/thumbnail.webp'],
    ['Saffron Threads 5g',          8000,  'https://cdn.dummyjson.com/product-images/groceries/boiled-eggs/thumbnail.webp'],
    ["Za'atar Mix",                 2500,  'https://cdn.dummyjson.com/product-images/groceries/bread-with-green-salad/thumbnail.webp'],
  ],
  aw10: [
    ['Arabic Majlis Sofa Set',      180000, 'https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp'],
    ['Carved Wood Table',           45000,  'https://cdn.dummyjson.com/product-images/furniture/marble-table/thumbnail.webp'],
    ['Floor Cushion Set',           12000,  'https://cdn.dummyjson.com/product-images/furniture/podium-shelf/thumbnail.webp'],
    ['Decorative Lantern',          8500,   'https://cdn.dummyjson.com/product-images/furniture/charme-terracotta-sofa/thumbnail.webp'],
  ],
  aw11: [
    ['Hammam Soap Set',             4500,  'https://cdn.dummyjson.com/product-images/beauty/lip-gloss/thumbnail.webp'],
    ['Argan Oil 100ml',             6000,  'https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp'],
    ['Kohl Eyeliner',               2500,  'https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp'],
    ['Rose Water Toner',            3000,  'https://cdn.dummyjson.com/product-images/beauty/nail-polish/thumbnail.webp'],
  ],
  aw12: [
    ['Hardside Luggage Set',        55000, 'https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp'],
    ['Travel Toiletry Bag',         4500,  'https://cdn.dummyjson.com/product-images/bags/airpods/thumbnail.webp'],
    ['Neck Pillow Memory Foam',     3500,  'https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp'],
    ['Luggage Scale Digital',       2500,  'https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp'],
  ],
};

// Pool of sample pre-owned listings. The seed puts 3 per state (so every state
// has content) by cycling through this flat list; idempotency keys on
// (vendorId, name, subcategoryId), so a title may recur across different states.
const SECOND_HAND_POOL = [
  ['Pre-owned Bluetooth Speaker', 8000,  'https://cdn.dummyjson.com/product-images/mobile-accessories/airpods-pro/thumbnail.webp'],
  ['Used LED Smart TV 32"',       85000, 'https://cdn.dummyjson.com/product-images/mobile-accessories/airpods/thumbnail.webp'],
  ['Secondhand Gaming Console',   120000,'https://cdn.dummyjson.com/product-images/mobile-accessories/apple-watch-7/thumbnail.webp'],
  ['Refurbished Microwave Oven',  35000, 'https://cdn.dummyjson.com/product-images/home/decorative-pillow/thumbnail.webp'],
  ['Gently Used Jacket',          12000, 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp'],
  ['Thrift Denim Jeans',          8000,  'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp'],
  ['Secondhand Evening Dress',    9500,  'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp'],
  ['Pre-owned Sneakers',          15000, 'https://cdn.dummyjson.com/product-images/mens-shoes/airmax-95/thumbnail.webp'],
  ['Used iPhone 11 64GB',         180000,'https://cdn.dummyjson.com/product-images/smartphones/iphone-x/thumbnail.webp'],
  ['Secondhand Samsung A23',      90000, 'https://cdn.dummyjson.com/product-images/smartphones/iphone-x/thumbnail.webp'],
  ['Refurbished iPad Mini',       160000,'https://cdn.dummyjson.com/product-images/mobile-accessories/apple-watch-7/thumbnail.webp'],
  ['Old Nokia Keypad Phone',      15000, 'https://cdn.dummyjson.com/product-images/mobile-accessories/iphone-case/thumbnail.webp'],
  ['Pre-owned Sofa Set',          70000, 'https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp'],
  ['Used Dining Table',           45000, 'https://cdn.dummyjson.com/product-images/furniture/marble-table/thumbnail.webp'],
  ['Secondhand Wardrobe',         38000, 'https://cdn.dummyjson.com/product-images/furniture/podium-shelf/thumbnail.webp'],
  ['Old Wooden Bed Frame',        50000, 'https://cdn.dummyjson.com/product-images/furniture/charme-terracotta-sofa/thumbnail.webp'],
  ['Used Toyota Corolla 2008',    2400000,'https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp'],
  ['Secondhand Bajaj Motorcycle', 650000, 'https://cdn.dummyjson.com/product-images/vehicle/sportage/thumbnail.webp'],
  ['Pre-owned Kia Sportage',      3800000,'https://cdn.dummyjson.com/product-images/vehicle/sportage/thumbnail.webp'],
  ['Okaada Keke (Tricycle)',      450000, 'https://cdn.dummyjson.com/product-images/smartphones/iphone-x/thumbnail.webp'],
  ['Gently Used Baby Pram',       18000, 'https://cdn.dummyjson.com/product-images/groceries/avocado/thumbnail.webp'],
  ['Secondhand Crib',             25000, 'https://cdn.dummyjson.com/product-images/groceries/boiled-eggs/thumbnail.webp'],
  ['Used Kids Bicycle',           15000, 'https://cdn.dummyjson.com/product-images/groceries/baguette/thumbnail.webp'],
  ['Pre-owned Baby Clothes Pack', 6000,  'https://cdn.dummyjson.com/product-images/groceries/bread-with-green-salad/thumbnail.webp'],
  ['Secondhand Novel Collection', 8000,  'https://cdn.dummyjson.com/product-images/fragrance/cologne/thumbnail.webp'],
  ['Used Board Games',            8500,  'https://cdn.dummyjson.com/product-images/fragrance/dior-sauvage/thumbnail.webp'],
  ['Pre-owned Storybooks',        5000,  'https://cdn.dummyjson.com/product-images/fragrance/love-phrase/thumbnail.webp'],
  ['Old Action Figures',          6500,  'https://cdn.dummyjson.com/product-images/fragrance/chanel-n-5/thumbnail.webp'],
  ['Pre-owned Leather Bag',       12000, 'https://cdn.dummyjson.com/product-images/bags/airpods-pro/thumbnail.webp'],
  ['Used Travel Backpack',        9000,  'https://cdn.dummyjson.com/product-images/bags/airtag/thumbnail.webp'],
  ['Secondhand Sunglasses',       3500,  'https://cdn.dummyjson.com/product-images/bags/baseballcap/thumbnail.webp'],
  ['Vintage Wristwatch',          25000, 'https://cdn.dummyjson.com/product-images/beauty/perfume/thumbnail.webp'],
];

// Islamic Products → subcategory mapping (product title → subcategory key)
const ISLAMIC_PRODUCT_MAP = {
  'Prayer Mat Embroidered':  ISLAMIC_SUBS.prayerMats,
  'Tasbih 33 Beads':         ISLAMIC_SUBS.tasbih,
  "Qur'an Gold Frame":       ISLAMIC_SUBS.quran,
  "Qur'an Stand Wooden":     ISLAMIC_SUBS.quranStands,
  'Islamic Wall Art':        ISLAMIC_SUBS.decorations,
  'Prayer Clothes Set':      ISLAMIC_SUBS.prayerClothes,
  'Islamic Books Collection':ISLAMIC_SUBS.books,
};

// ─── Main seed ──────────────────────────────────────────────────────────

async function main() {
  console.log('🌍 Seeding marketplaces...\n');

  // ── 1. Create vendors ─────────────────────────────────────────────────
  console.log('📦 Creating market vendors...');
  await upsertVendor({
    id: VENDORS.china, name: 'China Market',
    description: 'Quality products directly from trusted Chinese sellers',
    phone: '+234 810 0229 505',
  });
  await upsertVendor({
    id: VENDORS.arab, name: 'Arab World',
    description: 'Products from trusted sellers across the Arab world',
    phone: '+234 810 0229 505',
  });
  await upsertVendor({
    id: VENDORS.wholesale, name: 'Wholesalers',
    description: 'Bulk orders and wholesale deals, contact +234 810 0229 505',
    phone: '+234 810 0229 505',
  });
  await upsertVendor({
    id: VENDORS.secondHand, name: 'Second Hand Items',
    description: 'Quality pre-owned items at giveaway prices',
    phone: '+234 810 0229 505',
  });

  // ── 2. Resolve categories ─────────────────────────────────────────────
  console.log('\n📂 Resolving China Market categories...');
  const chinaCatIds = {};
  for (const cat of CHINA_CATEGORIES) {
    chinaCatIds[cat.key] = await resolveCategory({
      id: CC[cat.key], name: cat.name, slug: cat.slug, icon: cat.icon, color: cat.color,
      sortOrder: cat.sortOrder, globalName: cat.globalName, vendorId: VENDORS.china,
    });
  }

  console.log('\n📂 Resolving Arab World categories...');
  const arabCatIds = {};
  for (const cat of ARAB_CATEGORIES) {
    arabCatIds[cat.key] = await resolveCategory({
      id: AC[cat.key], name: cat.name, slug: cat.slug, icon: cat.icon, color: cat.color,
      sortOrder: cat.sortOrder, globalName: cat.globalName, vendorId: VENDORS.arab,
    });
  }

  // ── 3. Seed China Market products ─────────────────────────────────────
  console.log('\n🏷️  Seeding China Market products...');
  let chinaCount = 0;
  for (const [catKey, products] of Object.entries(CHINA_PRODUCTS)) {
    const categoryId = chinaCatIds[catKey] || CC[catKey];
    for (const [title, price, image] of products) {
      await seedProduct({ vendorId: VENDORS.china, categoryId, title, price, image });
      chinaCount++;
    }
  }
  console.log(`  ✅ ${chinaCount} China Market products processed`);

  // ── 4. Seed Arab World products + Islamic Products subcategories ──────
  console.log('\n🏷️  Seeding Arab World products...');
  let arabCount = 0;

  // Create Islamic Products subcategories first
  console.log('  📂 Creating Islamic Products subcategories...');
  const islamicCatId = arabCatIds.aw2 || AC.aw2;
  const islamicSubIds = {};
  const subDefs = [
    [ISLAMIC_SUBS.prayerMats,   'Prayer Mats',     10],
    [ISLAMIC_SUBS.tasbih,       'Tasbih',           20],
    [ISLAMIC_SUBS.quran,        "Qur'an",           30],
    [ISLAMIC_SUBS.quranStands,  "Qur'an Stands",    40],
    [ISLAMIC_SUBS.decorations,  'Islamic Decorations', 50],
    [ISLAMIC_SUBS.prayerClothes,'Prayer Clothes',   60],
    [ISLAMIC_SUBS.books,        'Islamic Books',    70],
  ];
  for (const [id, name, sortOrder] of subDefs) {
    const sub = await seedSubcategory({ id, categoryId: islamicCatId, vendorId: VENDORS.arab, name, sortOrder });
    islamicSubIds[name] = sub.id;
    console.log(`    + Subcategory "${name}" → ${sub.id}`);
  }

  for (const [catKey, products] of Object.entries(ARAB_PRODUCTS)) {
    const categoryId = arabCatIds[catKey] || AC[catKey];
    for (const [title, price, image] of products) {
      const subcategoryId = ISLAMIC_PRODUCT_MAP[title] || null;
      await seedProduct({ vendorId: VENDORS.arab, categoryId, subcategoryId, title, price, image });
      arabCount++;
    }
  }
  console.log(`  ✅ ${arabCount} Arab World products processed`);

  // ── 5. Seed Second Hand (states + LGAs location market) ───────────────
  const secondHand = await seedSecondHandMarket();

  console.log('\n🌍 Marketplace seeding complete!');
  console.log(`   China Market: ${Object.values(CHINA_PRODUCTS).reduce((s, a) => s + a.length, 0)} products`);
  console.log(`   Arab World:   ${Object.values(ARAB_PRODUCTS).reduce((s, a) => s + a.length, 0)} products`);
  console.log(`   Second Hand:  ${secondHand.states} states / ${secondHand.lgas} LGAs / ${secondHand.products} products`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
