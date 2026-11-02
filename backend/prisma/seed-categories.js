/**
 * Seed / refresh ALL vendor categories with their attributeSchema.
 *
 * Run with:   node prisma/seed-categories.js
 * Idempotent: upserts by `slug`, so re-running just updates the schemas.
 *
 * ── What attributeSchema means (plain English) ──────────────────────────────
 *   axes      → which "this product comes in versions" boxes the vendor's
 *               product form shows. Each axis becomes separate SKUs with their
 *               own price + stock. Only these names are understood by the form:
 *                   size | color | strength | form | capacity | flavor
 *   pack      → whether the form shows a "pack size + pack unit" input at all.
 *   packUnits → the MENU of units a vendor may choose from for THIS category.
 *               It is multi-select here because you're defining the allowed list;
 *               the vendor then picks exactly ONE unit per product. Valid units:
 *                   ML L G KG TABLET CAPSULE PIECE PAIR PACK BOTTLE SACHET CARTON
 *   sizeSystem→ optional label for the size axis (e.g. 'EU' for shoes).
 *
 * Rule of thumb used below:
 *   - "Comes in sizes/colours the shop stocks separately?"  → add an axis.
 *   - "Sold as a measured bundle (500 ml, 1 kg, 30 tablets)?" → pack: true.
 *   - When unsure, prefer FEWER axes - vendors can add per-product detail,
 *     and an over-asking form is what confuses people.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// All categories. Fixed UUIDs keep re-runs stable. The first six mirror the
// main seed exactly (pure superset); everything after is the expanded set.
const categories = [
  // ── Food & Fresh ──────────────────────────────────────────────────────────
  {
    id: '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c5',
    name: 'Food', slug: 'food', description: 'Snacks, small chops, sweets and soft drinks',
    icon: 'restaurant', color: '#EA580C', sortOrder: 10, hasPreparation: true,
    // Sizes (Small/Medium/Large) typed in directly; toppings/sides are add-ons.
    attributeSchema: { axes: ['size'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000020',
    name: 'Bakery', slug: 'bakery', description: 'Bread, cakes and pastries',
    icon: 'cake', color: '#D97706', sortOrder: 12, hasPreparation: true,
    // Cakes come in sizes; bread/pastries sold by the piece or pack.
    attributeSchema: { axes: ['size'], pack: true, packUnits: ['PIECE', 'PACK', 'CARTON'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000021',
    name: 'Drinks & Beverages', slug: 'drinks', description: 'Soft drinks, juices and more',
    icon: 'cup-soda', color: '#0EA5E9', sortOrder: 14, hasPreparation: false,
    // Flavour is the real variant; bottle/can volume is the pack.
    attributeSchema: { axes: ['flavor'], pack: true, packUnits: ['ML', 'L', 'BOTTLE', 'CARTON', 'PACK'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000022',
    name: 'Meat & Seafood', slug: 'meat-seafood', description: 'Fresh meat, poultry and fish',
    icon: 'beef', color: '#B91C1C', sortOrder: 16, hasPreparation: true,
    // Sold by weight or per piece; no version axes.
    attributeSchema: { axes: [], pack: true, packUnits: ['KG', 'G', 'PIECE'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000023',
    name: 'Fruits & Vegetables', slug: 'produce', description: 'Fresh farm produce',
    icon: 'apple', color: '#16A34A', sortOrder: 18, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['KG', 'G', 'PIECE', 'PACK'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000024',
    name: 'Water', slug: 'water', description: 'Bottled and sachet water',
    icon: 'droplet', color: '#0891B2', sortOrder: 19, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['ML', 'L', 'BOTTLE', 'SACHET', 'PACK', 'CARTON'] },
  },

  // ── Grocery & Household ───────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000002',
    name: 'Groceries', slug: 'grocery', description: 'Shop supermarkets, drinks and household',
    icon: 'basket', color: '#7C3AED', sortOrder: 20, hasPreparation: true,
    // One shop carries both dry and liquid, so the unit list is the union.
    attributeSchema: { axes: [], pack: true, packUnits: ['G', 'KG', 'PACK', 'SACHET', 'CARTON', 'ML', 'L', 'BOTTLE', 'PIECE'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000025',
    name: 'Household & Cleaning', slug: 'household', description: 'Detergents, tissue and home supplies',
    icon: 'spray-can', color: '#2563EB', sortOrder: 22, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['ML', 'L', 'G', 'KG', 'PIECE', 'PACK', 'SACHET', 'CARTON'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000026',
    name: 'Baby Products', slug: 'baby', description: 'Diapers, formula and baby care',
    icon: 'baby', color: '#F472B6', sortOrder: 24, hasPreparation: false,
    // Diapers come in sizes; formula/wipes sold by pack/weight/volume.
    attributeSchema: { axes: ['size'], pack: true, packUnits: ['PIECE', 'PACK', 'SACHET', 'G', 'ML'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000027',
    name: 'Pet Supplies', slug: 'pets', description: 'Pet food and accessories',
    icon: 'paw-print', color: '#92400E', sortOrder: 26, hasPreparation: false,
    attributeSchema: { axes: ['flavor'], pack: true, packUnits: ['KG', 'G', 'PACK', 'CARTON', 'PIECE'] },
  },

  // ── Health & Beauty ───────────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000003',
    name: 'Pharmacy', slug: 'pharmacy', description: 'Order medicines',
    icon: 'pill', color: '#059669', sortOrder: 30, hasPreparation: false,
    // strength (250mg/500mg) + form (tablet/syrup) are the genuine variants;
    // pack unit is how the box is measured (30 tablets, 100 ml).
    attributeSchema: { axes: ['strength', 'form'], pack: true, packUnits: ['TABLET', 'CAPSULE', 'ML', 'BOTTLE', 'SACHET'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000028',
    name: 'Health & Personal Care', slug: 'personal-care', description: 'Toiletries and wellness',
    icon: 'heart-pulse', color: '#10B981', sortOrder: 32, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['ML', 'L', 'G', 'PIECE', 'PACK', 'SACHET'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000029',
    name: 'Beauty & Cosmetics', slug: 'beauty', description: 'Makeup, skincare and fragrance',
    icon: 'sparkles', color: '#DB2777', sortOrder: 34, hasPreparation: false,
    // Shade is captured by the colour axis; volume/weight is the pack.
    attributeSchema: { axes: ['color'], pack: true, packUnits: ['ML', 'G', 'PIECE', 'PACK'] },
  },

  // ── Fashion & Accessories ─────────────────────────────────────────────────
  {
    id: 'd94b872d-bca8-43b8-b08d-6b108a243e40',
    name: 'Abaya', slug: 'abaya', description: 'Modest gowns and abayas',
    icon: 'shirt', color: '#DB2777', sortOrder: 40, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false },
  },
  {
    id: 'e471ecd6-5e5c-4c39-b69a-d4502f4940b4',
    name: 'Veil', slug: 'veil', description: 'Hijabs, veils and scarves',
    icon: 'shirt', color: '#C026D3', sortOrder: 41, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '549e7f79-9aee-4d1b-aa2d-b1811c23329a',
    name: 'Shadda', slug: 'shadda', description: 'Shadda fabric',
    icon: 'layers', color: '#C2410C', sortOrder: 42, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: 'eb6c6f1c-36bd-4cb3-81df-431c2e8fed3f',
    name: 'Yard', slug: 'yard', description: 'Fabric sold by the yard',
    icon: 'layers', color: '#9A3412', sortOrder: 43, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: 'c5dba097-f2e5-4c56-bbc4-551bada349e7',
    name: 'Voile', slug: 'voile', description: 'Voile fabric',
    icon: 'layers', color: '#0D9488', sortOrder: 44, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '03174ac2-854e-40de-8e2c-1f433d2328e0',
    name: 'Atamfa', slug: 'atamfa', description: 'Atamfa / Ankara wax fabric',
    icon: 'layers', color: '#B45309', sortOrder: 45, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '017ac190-b6f6-4ac4-ae53-da9d606339f9',
    name: 'Lace', slug: 'lace', description: 'Lace fabric',
    icon: 'layers', color: '#EC4899', sortOrder: 46, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: 'fd327273-e28c-46ff-8c27-c767d7aa53d7',
    name: 'Caps', slug: 'caps', description: 'Caps and headwear',
    icon: 'shirt', color: '#7C3AED', sortOrder: 47, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000006',
    name: 'Shoes', slug: 'shoes', description: 'Footwear',
    icon: 'footprints', color: '#A16207', sortOrder: 42, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false, sizeSystem: 'EU' },
  },
  {
    id: '00000000-0000-4000-a000-000000000030',
    name: 'Bags', slug: 'accessories', description: 'Bags, belts and accessories',
    icon: 'shopping-bag', color: '#9333EA', sortOrder: 44, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000031',
    name: 'Jewelry & Watches', slug: 'jewelry', description: 'Jewelry, watches and timepieces',
    icon: 'watch', color: '#CA8A04', sortOrder: 46, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },

  // ── Electronics & Home ────────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000007',
    name: 'Electronics', slug: 'electronics', description: 'Phones & accessories',
    icon: 'smartphone', color: '#475569', sortOrder: 50, hasPreparation: false,
    attributeSchema: { axes: ['capacity', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000032',
    name: 'Phone Accessories', slug: 'phone-accessories', description: 'Chargers, cases and cables',
    icon: 'cable', color: '#64748B', sortOrder: 52, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000033',
    name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Cookware, utensils and home goods',
    icon: 'cooking-pot', color: '#0D9488', sortOrder: 54, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000034',
    name: 'Furniture', slug: 'furniture', description: 'Home and office furniture',
    icon: 'armchair', color: '#7C2D12', sortOrder: 56, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },

  // ── Specialty ─────────────────────────────────────────────────────────────
  {
    id: '00000000-0000-4000-a000-000000000035',
    name: 'Books & Stationery', slug: 'books-stationery', description: 'Books, pens and office supplies',
    icon: 'book-open', color: '#1D4ED8', sortOrder: 60, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: true, packUnits: ['PIECE', 'PACK', 'CARTON'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000036',
    name: 'Toys & Games', slug: 'toys', description: 'Toys, games and hobbies',
    icon: 'gamepad-2', color: '#E11D48', sortOrder: 62, hasPreparation: false,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000037',
    name: 'Sports & Fitness', slug: 'sports', description: 'Sportswear and equipment',
    icon: 'dumbbell', color: '#15803D', sortOrder: 64, hasPreparation: false,
    attributeSchema: { axes: ['size', 'color'], pack: false },
  },
  {
    id: '00000000-0000-4000-a000-000000000038',
    name: 'Hardware & Building', slug: 'hardware', description: 'Tools and building materials',
    icon: 'wrench', color: '#57534E', sortOrder: 66, hasPreparation: false,
    attributeSchema: { axes: ['size'], pack: true, packUnits: ['PIECE', 'KG', 'PACK', 'CARTON', 'L'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000039',
    name: 'Agriculture & Farm', slug: 'agriculture', description: 'Seeds, feed and farm inputs',
    icon: 'sprout', color: '#65A30D', sortOrder: 68, hasPreparation: false,
    attributeSchema: { axes: [], pack: true, packUnits: ['KG', 'G', 'SACHET', 'L', 'ML', 'PACK'] },
  },
  {
    id: '00000000-0000-4000-a000-000000000040',
    name: 'Automotive', slug: 'automotive', description: 'Spare parts, oils and accessories',
    icon: 'car', color: '#334155', sortOrder: 70, hasPreparation: false,
    // Parts by the piece; oils/fluids by volume.
    attributeSchema: { axes: [], pack: true, packUnits: ['PIECE', 'L', 'ML'] },
  },

  // ── Vehicles (type-based, NOT brand-based) ─────────────────────────────────
  {
    id: 'dab43ced-9ddc-4c16-acd8-1f00c81aca1e',
    name: '4 door', slug: '4-door', description: 'Four-door saloon cars & hatchbacks',
    icon: 'car', color: '#334155', sortOrder: 71, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '6ef1369c-121a-4aba-b146-e53f729df3e6',
    name: 'SUVs', slug: 'suvs', description: 'SUVs, jeeps & crossovers',
    icon: 'car', color: '#334155', sortOrder: 72, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: 'c66309fe-a19a-433a-80c4-54470f2f1696',
    name: '2 door', slug: '2-door', description: 'Two-door coupes & sporty cars',
    icon: 'car', color: '#334155', sortOrder: 73, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '9580657f-bf59-41e3-9f76-3fc3e6560435',
    name: 'Pickups', slug: 'pickups', description: 'Pickup trucks with an open cargo bed',
    icon: 'truck', color: '#334155', sortOrder: 74, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: 'f60151e9-a105-439e-8683-53985a4667c2',
    name: 'Electric Cars', slug: 'electric-cars', description: 'Electric & hybrid cars',
    icon: 'car', color: '#334155', sortOrder: 75, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: 'd5fdb9e4-fd87-4b24-bf42-93840b461229',
    name: 'Sports Cars', slug: 'sports-cars', description: 'Sport & performance cars',
    icon: 'car', color: '#334155', sortOrder: 76, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '09ccf277-bd87-478e-a7aa-dce3cc44c55e',
    name: 'Buses & Vans', slug: 'buses-and-vans', description: 'Passenger buses, minivans & commercial vans',
    icon: 'bus', color: '#334155', sortOrder: 77, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: 'ed44f204-c8ad-4c9a-8a1e-e7fa1eba7642',
    name: 'Trucks', slug: 'trucks', description: 'Heavy-duty trucks & lorries',
    icon: 'truck', color: '#334155', sortOrder: 78, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '07ddcab3-b043-4ea5-951c-c9bcf85e8587',
    name: 'Motorcycles', slug: 'motorcycles', description: 'Motorcycles, scooters & bikes',
    icon: 'bike', color: '#334155', sortOrder: 79, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '69286eb7-c9d7-4274-b4e8-7b1ba58e8159',
    name: 'Power Bike', slug: 'power-bike', description: 'Power bikes & motorized motorbikes',
    icon: 'bike', color: '#334155', sortOrder: 80, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: 'db963b0f-31cf-4f06-a1c8-48823936312b',
    name: 'Trailers', slug: 'trailers', description: 'Trailers, tippers & articulated trucks',
    icon: 'truck', color: '#334155', sortOrder: 81, hasPreparation: false,
    attributeSchema: { axes: [], pack: false },
  },

  // ── Services (trades) ───────────────────────────────────────────────────────
  // Reverse-marketplace trades. A "service seller" is a Vendor whose industry
  // is one of these and who may have NO products - Requests match on this
  // categoryId. Kept as flat top-level trades (not one "Services" parent)
  // because Vendor.categoryId is a single top-level industry, so a precise
  // trade is what lets a mechanic request reach only mechanics.
  //
  // `service: true` tags these rows so the seed can be run for ONLY the trades
  // (node prisma/seed-categories.js --only=services) without re-upserting and
  // re-activating the rest of the catalog. `icon` values are real
  // MaterialCommunityIcons glyph names (the customer app resolves them
  // directly); the admin maps them to lucide equivalents in TaxonomyThumb.
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a1',
    name: 'Auto Repair', slug: 'auto-repair', description: 'Mechanics, panel beaters & auto electricians',
    icon: 'car-wrench', color: '#334155', sortOrder: 90, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a2',
    name: 'Tailoring', slug: 'tailoring', description: 'Tailors, fashion designers & alterations',
    icon: 'content-cut', color: '#7C3AED', sortOrder: 91, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a3',
    name: 'Plumbing', slug: 'plumbing', description: 'Plumbers & pipe fitters',
    icon: 'pipe-wrench', color: '#0EA5E9', sortOrder: 92, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a4',
    name: 'Electrical', slug: 'electrical', description: 'Electricians & wiring services',
    icon: 'electric-switch', color: '#F59E0B', sortOrder: 93, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a5',
    name: 'Cleaning', slug: 'cleaning', description: 'Home & office cleaning services',
    icon: 'broom', color: '#06B6D4', sortOrder: 94, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a6',
    name: 'Handyman', slug: 'handyman', description: 'Carpenters, painters & general repairs',
    icon: 'hammer-screwdriver', color: '#78716C', sortOrder: 95, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a7',
    name: 'Salon & Barber', slug: 'salon-barber', description: 'Haircuts, braiding, barbing & grooming',
    icon: 'hair-dryer', color: '#DB2777', sortOrder: 96, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a8',
    name: 'Beauty & Makeup', slug: 'beauty-services', description: 'Makeup artists, nails & beauty treatments',
    icon: 'face-woman', color: '#EC4899', sortOrder: 97, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000a9',
    name: 'Laundry & Dry Cleaning', slug: 'laundry', description: 'Wash, iron, dry cleaning & curtain care',
    icon: 'washing-machine', color: '#0D9488', sortOrder: 98, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000aa',
    name: 'Photography & Video', slug: 'photography', description: 'Photographers, videographers & editing',
    icon: 'camera', color: '#6366F1', sortOrder: 99, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000ab',
    name: 'Event Planning & Catering', slug: 'events-catering', description: 'Event planners, caterers & decorators',
    icon: 'party-popper', color: '#F43F5E', sortOrder: 100, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000ac',
    name: 'Tutoring & Lessons', slug: 'tutoring', description: 'Tutors, coaches & private lessons',
    icon: 'school', color: '#2563EB', sortOrder: 101, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000ad',
    name: 'Health & Wellness', slug: 'wellness', description: 'Spa, massage & wellness services',
    icon: 'spa', color: '#10B981', sortOrder: 102, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000ae',
    name: 'Transport & Logistics', slug: 'transport', description: 'Moving, haulage, delivery & dispatch',
    icon: 'truck-delivery', color: '#475569', sortOrder: 103, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000af',
    name: 'Car Wash & Detailing', slug: 'car-wash', description: 'Car wash, detailing & interior cleaning',
    icon: 'car-wash', color: '#0891B2', sortOrder: 104, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000b0',
    name: 'Solar & AC Installation', slug: 'solar-ac', description: 'Solar, inverter, AC & refrigeration fitting',
    icon: 'solar-panel', color: '#EAB308', sortOrder: 105, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000b1',
    name: 'Pest Control & Fumigation', slug: 'pest-control', description: 'Fumigation and pest control services',
    icon: 'bug', color: '#65A30D', sortOrder: 106, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '5f0a1b2c-3d4e-4f50-8a90-0000000000b2',
    name: 'Construction & Masonry', slug: 'construction', description: 'Builders, masons, tilers & plasterers',
    icon: 'wall', color: '#92400E', sortOrder: 107, hasPreparation: false, service: true,
    attributeSchema: { axes: [], pack: false },
  },

  // ── Additional product categories ───────────────────────────────────────────
  // Requested storefront categories that had no global counterpart. `extra: true`
  // lets them be seeded on their own with `--only=extra`.
  {
    id: '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c1',
    name: 'Education & Training', slug: 'education-training', description: 'Schools, training centres & vocational programmes',
    icon: 'school', color: '#2563EB', sortOrder: 120, hasPreparation: false, extra: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c2',
    name: 'Household Appliances', slug: 'household-appliances', description: 'Fridges, freezers, washing machines & small appliances',
    icon: 'fridge', color: '#0EA5E9', sortOrder: 121, hasPreparation: false, extra: true,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c3',
    name: 'Phones & Tablets', slug: 'phones-tablets', description: 'Smartphones, tablets and accessories',
    icon: 'cellphone', color: '#7C3AED', sortOrder: 122, hasPreparation: false, extra: true,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c4',
    name: 'Computers & Laptops', slug: 'computers-laptops', description: 'Laptops, desktops and computer accessories',
    icon: 'laptop', color: '#0F172A', sortOrder: 123, hasPreparation: false, extra: true,
    attributeSchema: { axes: ['color'], pack: false },
  },
  {
    id: '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c6',
    name: 'Bureau de Change', slug: 'bureau-de-change', description: 'Currency exchange and forex services',
    icon: 'cash-multiple', color: '#16A34A', sortOrder: 125, hasPreparation: false, extra: true,
    attributeSchema: { axes: [], pack: false },
  },
  {
    id: '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c7',
    name: 'Islamic Herbal', slug: 'islamic-herbal', description: 'Herbal remedies, oils and traditional Islamic medicine',
    icon: 'mortar-pestle', color: '#15803D', sortOrder: 126, hasPreparation: false, extra: true,
    attributeSchema: { axes: [], pack: true, packUnits: ['BOTTLE', 'ML', 'L', 'PIECE', 'PACK', 'SACHET'] },
  },
];

async function main() {
  // Optional scope: `--only=<tag>` upserts just the rows carrying that seed tag
  // (e.g. `--only=services` or `--only=extra`), leaving every other category
  // (and its isActive flag) untouched.
  const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
  const only = onlyArg ? onlyArg.split('=')[1] : null;
  const selected = only ? categories.filter((c) => c[only]) : categories;

  if (only && selected.length === 0) {
    console.log(`No categories matched --only=${only}.`);
    return;
  }

  console.log(`Seeding ${selected.length} vendor categories${only ? ` (--only=${only})` : ''}…\n`);

  for (const cat of selected) {
    // `service`/`extra` are seed-only grouping tags; strip them before handing
    // the row to Prisma.
    const data = { ...cat };
    delete data.service;
    delete data.extra;

    await prisma.vendorCategory.upsert({
      where: { id: data.id },
      update: {
        name: data.name, description: data.description, icon: data.icon, color: data.color,
        sortOrder: data.sortOrder, hasPreparation: data.hasPreparation, isActive: true,
        attributeSchema: data.attributeSchema,
      },
      create: data,
    });

    const s = data.attributeSchema;
    const axes = s.axes.length ? s.axes.join(', ') : '-';
    const pack = s.pack ? (s.packUnits || []).join('/') : 'no pack';
    console.log(`  ✓ ${data.name.padEnd(26)} axes: ${axes.padEnd(20)} pack: ${pack}`);
  }

  console.log(`\n✅ Seeded ${selected.length} categories with attributeSchema.`);
}

main()
  .catch((e) => {
    console.error('❌ Category seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
