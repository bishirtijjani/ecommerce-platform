/**
 * Database seeder - creates a realistic development dataset that mirrors
 * the customer app's marketplace model (see app/src/data/marketplace.js):
 * a general local marketplace (clothing, vehicles, real estate - not a
 * food-delivery app), chat-commerce first (browse -> contact vendor),
 * no restaurant-style prep/hours.
 *
 * Run with: npm run db:seed
 *
 * Creates:
 * - 1 admin, 2 customers (with saved addresses)
 * - 3 vendor categories matching the customer app's seeded categories
 *   (Clothing & Fashion, Vehicles & Automobiles, Real Estate)
 * - 6 vendors (the real client-supplied businesses) across those categories
 * - 15 products with variants, matching the customer app's mock catalog
 * - 2 discount codes (1 platform-wide, 1 vendor-specific)
 * - 2 banners and platform settings
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin ────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ecommerce.test' },
    update: {},
    create: {
      phone: '09000000001',
      firstName: 'Platform',
      lastName: 'Admin',
      email: 'admin@ecommerce.test',
      passwordHash: await bcrypt.hash('admin123456', SALT_ROUNDS),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // ─── Customers ────────────────────────────────────────────────────────────
  const customer1 = await prisma.user.upsert({
    where: { email: 'aisha@ecommerce.test' },
    update: {},
    create: {
      phone: '08012345678',
      firstName: 'Aisha',
      lastName: 'Bello',
      email: 'aisha@ecommerce.test',
      passwordHash: await bcrypt.hash('customer123', SALT_ROUNDS),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  });
  await prisma.savedAddress.upsert({
    where: { id: '00000000-0000-4000-b000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-b000-000000000001',
      userId: customer1.id,
      label: 'Home',
      address: '14 Kofar Kaura Road, Katsina',
      lat: 13.0059,
      lng: 7.6017,
      isDefault: true,
    },
  });
  console.log(`✅ Customer created: ${customer1.email} (1 saved address)`);

  const customer2 = await prisma.user.upsert({
    where: { email: 'chidi@ecommerce.test' },
    update: {},
    create: {
      phone: '08087654321',
      firstName: 'Chidi',
      lastName: 'Okafor',
      email: 'chidi@ecommerce.test',
      passwordHash: await bcrypt.hash('customer123', SALT_ROUNDS),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  });
  await prisma.savedAddress.upsert({
    where: { id: '00000000-0000-4000-b000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-b000-000000000002',
      userId: customer2.id,
      label: 'Home',
      address: '22 Nagogo Road, Katsina',
      lat: 13.0093,
      lng: 7.6005,
      isDefault: true,
    },
  });
  console.log(`✅ Customer created: ${customer2.email} (1 saved address)`);

  const customer3 = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      phone: '08011122233',
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@test.com',
      passwordHash: await bcrypt.hash('customer123', SALT_ROUNDS),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  });
  await prisma.savedAddress.upsert({
    where: { id: '00000000-0000-4000-b000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-4000-b000-000000000003',
      userId: customer3.id,
      label: 'Home',
      address: '10 Ahmadu Bello Way, Katsina',
      lat: 13.0059,
      lng: 7.6017,
      isDefault: true,
    },
  });
  console.log(`✅ Customer created: ${customer3.email} (1 saved address)`);

  // ─── Vendor categories ───────────────────────────────────────────────────
  // Names match the `categoryPrefix` values used in the customer app's mock
  // catalog (app/src/data/marketplace.js PRODUCTS[].category paths), so the
  // real backend catalog lines up with what CategoryScreen/SubcategoryScreen
  // already filter on. Only categories with real seeded vendors are created
  // here - the app's other home-tile categories (Electronics, Home & Garden,
  // Food & Drinks, Services, Beauty & Healthcare) stay "coming soon" until
  // real vendors exist for them.
  // IDs use the a000-0000000000{50,51,52} range - deliberately outside the
  // 001-040 range used by seed-categories.js's expanded 24-category set, so
  // both scripts can be run in either order without a fixed-id collision
  // (upserts are keyed by slug, but a shared id under a different slug would
  // hit the id's own unique constraint).
  const categories = [
    {
      id: '00000000-0000-4000-a000-000000000050',
      name: 'Clothing & Fashion', slug: 'clothing-fashion', description: 'Clothing, textiles and fashion accessories',
      icon: 'shirt', color: '#DB2777', sortOrder: 10, hasPreparation: false,
      attributeSchema: { axes: ['size', 'color'], pack: false },
    },
    {
      id: '00000000-0000-4000-a000-000000000051',
      name: 'Vehicles & Automobiles', slug: 'vehicles-automobiles', description: 'New and used cars from verified dealers',
      icon: 'car', color: '#475569', sortOrder: 20, hasPreparation: false,
      attributeSchema: { axes: [], pack: false },
    },
    {
      id: '00000000-0000-4000-a000-000000000053',
      name: 'Furniture', slug: 'furniture', description: 'Home and office furniture',
      icon: 'armchair', color: '#7C2D12', sortOrder: 25, hasPreparation: false,
      attributeSchema: { axes: ['color'], pack: false },
    },
    {
      id: '00000000-0000-4000-a000-000000000052',
      name: 'Real Estate', slug: 'real-estate', description: 'Residential and commercial properties',
      icon: 'home', color: '#152142', sortOrder: 30, hasPreparation: false,
      attributeSchema: { axes: [], pack: false },
    },
    // ── Fine-grained item categories (storefront cards), one per product line
    // ── Furniture items
    { id: '00000000-0000-4000-a000-000000000060', name: 'Sofa', slug: 'sofa', description: 'Sofas and lounge seating', icon: 'armchair', color: '#9A3412', sortOrder: 61, hasPreparation: false, attributeSchema: { axes: ['color'], pack: false } },
    { id: '00000000-0000-4000-a000-000000000061', name: 'Bed', slug: 'bed', description: 'Beds and mattresses', icon: 'bed', color: '#7C2D12', sortOrder: 62, hasPreparation: false, attributeSchema: { axes: ['size'], pack: false } },
    { id: '00000000-0000-4000-a000-000000000062', name: 'Bed Frames', slug: 'bed-frames', description: 'Bed frames and bases', icon: 'bed', color: '#92400E', sortOrder: 63, hasPreparation: false, attributeSchema: { axes: ['size'], pack: false } },
    { id: '00000000-0000-4000-a000-000000000063', name: 'Dining Table', slug: 'dining-table', description: 'Dining tables and sets', icon: 'tv', color: '#92400E', sortOrder: 64, hasPreparation: false, attributeSchema: { axes: ['size'], pack: false } },
    { id: '00000000-0000-4000-a000-000000000064', name: 'Chair', slug: 'chair', description: 'Seating for home and office', icon: 'armchair', color: '#78350F', sortOrder: 65, hasPreparation: false, attributeSchema: { axes: ['color'], pack: false } },
    { id: '00000000-0000-4000-a000-000000000076', name: 'TV Stand', slug: 'tv-stand', description: 'TV stands and media units', icon: 'tv', color: '#57534E', sortOrder: 66, hasPreparation: false, attributeSchema: { axes: ['color'], pack: false } },
    { id: '00000000-0000-4000-a000-000000000077', name: 'Wardrobe', slug: 'wardrobe', description: 'Wardrobes and storage', icon: 'door-open', color: '#78350F', sortOrder: 67, hasPreparation: false, attributeSchema: { axes: ['size'], pack: false } },
    // ── Vehicle brands
    { id: '00000000-0000-4000-a000-000000000065', name: 'Toyota', slug: 'toyota', description: 'Toyota vehicles', icon: 'car', color: '#334155', sortOrder: 31, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000066', name: 'Hyundai', slug: 'hyundai', description: 'Hyundai vehicles', icon: 'car', color: '#475569', sortOrder: 32, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000067', name: 'BYD', slug: 'byd', description: 'BYD electric vehicles', icon: 'car', color: '#0F172A', sortOrder: 33, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000068', name: 'Honda', slug: 'honda', description: 'Honda vehicles', icon: 'car', color: '#334155', sortOrder: 34, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000069', name: 'Kia', slug: 'kia', description: 'Kia vehicles', icon: 'car', color: '#1E293B', sortOrder: 35, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000075', name: 'Dodge', slug: 'dodge', description: 'Dodge vehicles', icon: 'car', color: '#1C1917', sortOrder: 36, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    // ── Real estate listing types
    { id: '00000000-0000-4000-a000-000000000070', name: 'Land', slug: 'land', description: 'Plots and land for sale', icon: 'map', color: '#365314', sortOrder: 71, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000071', name: 'Shop', slug: 'shop', description: 'Shops and commercial spaces', icon: 'store', color: '#166534', sortOrder: 72, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000072', name: 'Apartment', slug: 'apartment', description: 'Apartments for rent and sale', icon: 'building-2', color: '#152142', sortOrder: 73, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000073', name: 'House', slug: 'house', description: 'Houses for rent and sale', icon: 'home', color: '#1E3A8A', sortOrder: 74, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
    { id: '00000000-0000-4000-a000-000000000074', name: 'Self Contain', slug: 'self-contain', description: 'Self-contained rooms', icon: 'home', color: '#1E40AF', sortOrder: 75, hasPreparation: false, attributeSchema: { axes: [], pack: false } },
  ];
  for (const cat of categories) {
    // Reuse an existing global category by slug when one is present (the
    // expanded seed-categories.js also defines Furniture/Vehicles/Real Estate/
    // Clothing & Fashion). upsert by slug-first avoids creating a second
    // same-slug global row (which caused a duplicate "Furniture" in the public
    // taxonomy when both scripts ran).
    const existing = await prisma.vendorCategory.findFirst({ where: { slug: cat.slug, vendorId: null } });
    if (existing) {
      await prisma.vendorCategory.update({
        where: { id: existing.id },
        data: {
          name: cat.name, description: cat.description, icon: cat.icon, color: cat.color,
          sortOrder: cat.sortOrder, hasPreparation: cat.hasPreparation, isActive: true,
          attributeSchema: cat.attributeSchema,
        },
      });
      continue;
    }
    await prisma.vendorCategory.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name, description: cat.description, icon: cat.icon, color: cat.color,
        sortOrder: cat.sortOrder, hasPreparation: cat.hasPreparation, isActive: true,
        attributeSchema: cat.attributeSchema,
      },
      create: cat,
    });
  }
  console.log(`✅ Seeded ${categories.length} global categories (incl. fine-grained sofa/bed/brand/land/etc. storefront tiles)`);

  // ─── Admin-managed subcategories (per top-level category) ────────────────
  // Products pick one category + one subcategory from these dropdowns at
  // creation time. Upserted by (categoryId, slug) so re-runs stay idempotent.
  // Each subcategory carries an explicit `imageUrl` - a curated placeholder
  // (used as the fallback for a shop category that picks this global
  // subcategory), so shop category cards always show a representative
  // picture, not a product borrow.
  const ph = (label, bg = 'f0f0f0', color = '666') =>
    `https://placehold.co/600x600/${bg}/${color}/png?text=${encodeURIComponent(label)}`;
  // Real category photos hosted on Cloudinary (client account `dgxzel81z`),
  // keyed "<categorySlug>/<subSlug>". Uploaded once; the seed just points the
  // DB at them so re-runs stay stable (server-side transforms handle sizing).
  const CLD = {
    'clothing-fashion/general': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273313/ecommerce/categories/clothing-fashion/general.jpg',
    'clothing-fashion/women': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273315/ecommerce/categories/clothing-fashion/women.jpg',
    'clothing-fashion/men': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273316/ecommerce/categories/clothing-fashion/men.jpg',
    'clothing-fashion/kids': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273318/ecommerce/categories/clothing-fashion/kids.jpg',
    'clothing-fashion/accessories': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273319/ecommerce/categories/clothing-fashion/accessories.jpg',
    'clothing-fashion/abaya-gowns': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273320/ecommerce/categories/clothing-fashion/abaya-gowns.jpg',
    'clothing-fashion/jalabiya': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273322/ecommerce/categories/clothing-fashion/jalabiya.jpg',
    'clothing-fashion/veil': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273323/ecommerce/categories/clothing-fashion/veil.jpg',
    'clothing-fashion/cap': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273324/ecommerce/categories/clothing-fashion/cap.jpg',
    'vehicles-automobiles/general': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273326/ecommerce/categories/vehicles-automobiles/general.jpg',
    'vehicles-automobiles/cars': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273327/ecommerce/categories/vehicles-automobiles/cars.jpg',
    'vehicles-automobiles/trucks-vans': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273329/ecommerce/categories/vehicles-automobiles/trucks-vans.jpg',
    'vehicles-automobiles/bikes-tricycles': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273330/ecommerce/categories/vehicles-automobiles/bikes-tricycles.jpg',
    'vehicles-automobiles/parts-accessories': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273332/ecommerce/categories/vehicles-automobiles/parts-accessories.jpg',
    'vehicles-automobiles/sedans': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273333/ecommerce/categories/vehicles-automobiles/sedans.jpg',
    'vehicles-automobiles/suvs-4x4': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273334/ecommerce/categories/vehicles-automobiles/suvs-4x4.jpg',
    'vehicles-automobiles/pickup-trucks': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273335/ecommerce/categories/vehicles-automobiles/pickup-trucks.jpg',
    'vehicles-automobiles/buses-minivans': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273337/ecommerce/categories/vehicles-automobiles/buses-minivans.jpg',
    'vehicles-automobiles/motorcycles': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273338/ecommerce/categories/vehicles-automobiles/motorcycles.jpg',
    'vehicles-automobiles/tricycles-keke': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273340/ecommerce/categories/vehicles-automobiles/tricycles-keke.jpg',
    'vehicles-automobiles/tires-wheels': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273342/ecommerce/categories/vehicles-automobiles/tires-wheels.jpg',
    'vehicles-automobiles/auto-parts': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273343/ecommerce/categories/vehicles-automobiles/auto-parts.jpg',
    'vehicles-automobiles/car-accessories': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273344/ecommerce/categories/vehicles-automobiles/car-accessories.jpg',
    'vehicles-automobiles/electronics-batteries': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273346/ecommerce/categories/vehicles-automobiles/electronics-batteries.jpg',
    'furniture/living-room': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273347/ecommerce/categories/furniture/living-room.jpg',
    'furniture/bedroom': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273349/ecommerce/categories/furniture/bedroom.jpg',
    'furniture/office': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273350/ecommerce/categories/furniture/office.jpg',
    'furniture/kitchen': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273351/ecommerce/categories/furniture/kitchen.jpg',
    'furniture/home-decor': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273353/ecommerce/categories/furniture/home-decor.jpg',
    'furniture/bed-frames': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273354/ecommerce/categories/furniture/bed-frames.jpg',
    'furniture/fabric-sofa': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273355/ecommerce/categories/furniture/fabric-sofa.jpg',
    'furniture/leather-sofa': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273356/ecommerce/categories/furniture/leather-sofa.jpg',
    'furniture/royal-sofa': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273357/ecommerce/categories/furniture/royal-sofa.jpg',
    'furniture/dining-table': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273359/ecommerce/categories/furniture/dining-table.jpg',
    'furniture/center-table': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273360/ecommerce/categories/furniture/center-table.jpg',
    'furniture/office-furniture': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273361/ecommerce/categories/furniture/office-furniture.jpg',
    'furniture/tv-stand': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273363/ecommerce/categories/furniture/tv-stand.jpg',
    'real-estate/general': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273364/ecommerce/categories/real-estate/general.jpg',
    'real-estate/residential': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273365/ecommerce/categories/real-estate/residential.jpg',
    'real-estate/land': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273367/ecommerce/categories/real-estate/land.jpg',
    'real-estate/commercial': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273368/ecommerce/categories/real-estate/commercial.jpg',
    'real-estate/plots': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273370/ecommerce/categories/real-estate/plots.jpg',
    'real-estate/houses': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273371/ecommerce/categories/real-estate/houses.jpg',
    'real-estate/apartments': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273373/ecommerce/categories/real-estate/apartments.jpg',
    'fabric-textile/atamfa': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273374/ecommerce/categories/fabric-textile/atamfa.jpg',
    'fabric-textile/lace': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273376/ecommerce/categories/fabric-textile/lace.jpg',
    'fabric-textile/voile': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273377/ecommerce/categories/fabric-textile/voile.jpg',
    'fabric-textile/shadda': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273379/ecommerce/categories/fabric-textile/shadda.jpg',
    'fabric-textile/wasse': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273380/ecommerce/categories/fabric-textile/wasse.jpg',
    'fabric-textile/yard': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273381/ecommerce/categories/fabric-textile/yard.jpg',
    'accessories/boxes': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273383/ecommerce/categories/accessories/boxes.jpg',
    'accessories/travelling-bags': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273384/ecommerce/categories/accessories/travelling-bags.jpg',
    'home-kitchen/kitchenware': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273385/ecommerce/categories/home-kitchen/kitchenware.jpg',
    'home-kitchen/bedsheets': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273387/ecommerce/categories/home-kitchen/bedsheets.jpg',
  };
  // Shop-specific custom categories (subcategoryId null) carry their own photo.
  const SHOPIMG = {
    fmk: {
      'Lefe collection': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273395/ecommerce/categories/shop/fmk/lefe-collection.jpg',
      Bag: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273397/ecommerce/categories/shop/fmk/bag.jpg',
      Shoes: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273399/ecommerce/categories/shop/fmk/shoes.jpg',
    },
    mudatex: {
      'Perfume & cosmetics': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273400/ecommerce/categories/shop/mudatex/perfume-cosmetics.jpg',
      Furnitures: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273402/ecommerce/categories/shop/mudatex/furnitures.jpg',
      Bag: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273403/ecommerce/categories/shop/mudatex/bag.jpg',
      Shoes: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273404/ecommerce/categories/shop/mudatex/shoes.jpg',
      Bags: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273406/ecommerce/categories/shop/mudatex/bags.jpg',
    },
    elSamad: {
      Shoes: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273390/ecommerce/categories/shop/elsamad/shoes.jpg',
      Bag: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273391/ecommerce/categories/shop/elsamad/bag.jpg',
      'Abaya and gown': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273392/ecommerce/categories/shop/elsamad/abaya-and-gown.jpg',
    },
    algazaru: {
      Abaya: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273388/ecommerce/categories/shop/elsamad/abaya.jpg',
    },
    wasse: {
      Hijab: 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273420/ecommerce/categories/shop/wasse/hijab.jpg',
    },
    danmama: {
      'Smart Homes': 'https://res.cloudinary.com/dgxzel81z/image/upload/v1788273394/ecommerce/categories/shop/danmama/smart-homes.jpg',
    },
  };
  const subcategorySeeds = [
    { categorySlug: 'clothing-fashion', name: 'Women', slug: 'women', sortOrder: 10, imageUrl: ph('Women') },
    { categorySlug: 'clothing-fashion', name: 'Men', slug: 'men', sortOrder: 20, imageUrl: ph('Men') },
    { categorySlug: 'clothing-fashion', name: 'Kids', slug: 'kids', sortOrder: 30, imageUrl: ph('Kids') },
    { categorySlug: 'clothing-fashion', name: 'Accessories', slug: 'accessories', sortOrder: 40, imageUrl: ph('Accessories') },
    { categorySlug: 'clothing-fashion', name: 'Abaya & Gowns', slug: 'abaya-gowns', sortOrder: 50, imageUrl: ph('Abaya & Gowns') },
    { categorySlug: 'clothing-fashion', name: 'Jalabiya', slug: 'jalabiya', sortOrder: 60, imageUrl: ph('Jalabiya') },
    { categorySlug: 'clothing-fashion', name: 'Veil', slug: 'veil', sortOrder: 70, imageUrl: ph('Veil') },
    { categorySlug: 'clothing-fashion', name: 'Cap', slug: 'cap', sortOrder: 80, imageUrl: ph('Cap') },
    // ── Fine-grained subcategories under the new storefront-card categories ──
    // Furniture items
    { categorySlug: 'sofa', name: 'Fabric Sofa', slug: 'sofa-fabric', sortOrder: 10, imageUrl: ph('Fabric Sofa') },
    { categorySlug: 'sofa', name: 'Leather Sofa', slug: 'sofa-leather', sortOrder: 20, imageUrl: ph('Leather Sofa') },
    { categorySlug: 'sofa', name: 'Sectional Sofa', slug: 'sofa-sectional', sortOrder: 30, imageUrl: ph('Sectional') },
    { categorySlug: 'sofa', name: 'Loveseat', slug: 'sofa-loveseat', sortOrder: 40, imageUrl: ph('Loveseat') },
    { categorySlug: 'bed', name: 'Double Bed', slug: 'bed-double', sortOrder: 10, imageUrl: ph('Double Bed') },
    { categorySlug: 'bed', name: 'Queen Bed', slug: 'bed-queen', sortOrder: 20, imageUrl: ph('Queen Bed') },
    { categorySlug: 'bed', name: 'King Bed', slug: 'bed-king', sortOrder: 30, imageUrl: ph('King Bed') },
    { categorySlug: 'bed', name: 'Kids Bed', slug: 'bed-kids', sortOrder: 40, imageUrl: ph('Kids Bed') },
    { categorySlug: 'bed', name: 'Bunk Bed', slug: 'bed-bunk', sortOrder: 50, imageUrl: ph('Bunk Bed') },
    { categorySlug: 'bed-frames', name: 'Metal Frame', slug: 'bf-metal', sortOrder: 10, imageUrl: ph('Metal Frame') },
    { categorySlug: 'bed-frames', name: 'Wooden Frame', slug: 'bf-wooden', sortOrder: 20, imageUrl: ph('Wooden Frame') },
    { categorySlug: 'bed-frames', name: 'Upholstered Frame', slug: 'bf-upholstered', sortOrder: 30, imageUrl: ph('Upholstered Frame') },
    { categorySlug: 'dining-table', name: '4-Seater', slug: 'dt-4', sortOrder: 10, imageUrl: ph('4-Seater') },
    { categorySlug: 'dining-table', name: '6-Seater', slug: 'dt-6', sortOrder: 20, imageUrl: ph('6-Seater') },
    { categorySlug: 'dining-table', name: 'Round Table', slug: 'dt-round', sortOrder: 30, imageUrl: ph('Round Table') },
    { categorySlug: 'dining-table', name: 'Extendable Table', slug: 'dt-extendable', sortOrder: 40, imageUrl: ph('Extendable') },
    { categorySlug: 'chair', name: 'Dining Chair', slug: 'chair-dining', sortOrder: 10, imageUrl: ph('Dining Chair') },
    { categorySlug: 'chair', name: 'Accent Chair', slug: 'chair-accent', sortOrder: 20, imageUrl: ph('Accent Chair') },
    { categorySlug: 'chair', name: 'Office Chair', slug: 'chair-office', sortOrder: 30, imageUrl: ph('Office Chair') },
    { categorySlug: 'chair', name: 'Recliner', slug: 'chair-recliner', sortOrder: 40, imageUrl: ph('Recliner') },
    { categorySlug: 'chair', name: 'Bar Stool', slug: 'chair-bar', sortOrder: 50, imageUrl: ph('Bar Stool') },
    { categorySlug: 'tv-stand', name: 'Wall-Mounted', slug: 'tv-wall', sortOrder: 10, imageUrl: ph('Wall-Mounted') },
    { categorySlug: 'tv-stand', name: 'Floor Standing', slug: 'tv-floor', sortOrder: 20, imageUrl: ph('Floor Standing') },
    { categorySlug: 'tv-stand', name: 'Corner Unit', slug: 'tv-corner', sortOrder: 30, imageUrl: ph('Corner Unit') },
    { categorySlug: 'wardrobe', name: '2-Door', slug: 'ward-2door', sortOrder: 10, imageUrl: ph('2-Door') },
    { categorySlug: 'wardrobe', name: '3-Door', slug: 'ward-3door', sortOrder: 20, imageUrl: ph('3-Door') },
    { categorySlug: 'wardrobe', name: 'Sliding Door', slug: 'ward-sliding', sortOrder: 30, imageUrl: ph('Sliding Door') },
    // Vehicle brands
    { categorySlug: 'toyota', name: 'Sedans', slug: 'toyota-sedans', sortOrder: 10, imageUrl: ph('Toyota Sedan') },
    { categorySlug: 'toyota', name: 'SUVs', slug: 'toyota-suvs', sortOrder: 20, imageUrl: ph('Toyota SUV') },
    { categorySlug: 'toyota', name: 'Pickup Trucks', slug: 'toyota-pickup', sortOrder: 30, imageUrl: ph('Toyota Pickup') },
    { categorySlug: 'toyota', name: 'Hatchbacks', slug: 'toyota-hatch', sortOrder: 40, imageUrl: ph('Toyota Hatch') },
    { categorySlug: 'hyundai', name: 'Sedans', slug: 'hyundai-sedans', sortOrder: 10, imageUrl: ph('Hyundai Sedan') },
    { categorySlug: 'hyundai', name: 'SUVs', slug: 'hyundai-suvs', sortOrder: 20, imageUrl: ph('Hyundai SUV') },
    { categorySlug: 'hyundai', name: 'Hatchbacks', slug: 'hyundai-hatch', sortOrder: 30, imageUrl: ph('Hyundai Hatch') },
    { categorySlug: 'byd', name: 'Sedans', slug: 'byd-sedans', sortOrder: 10, imageUrl: ph('BYD Sedan') },
    { categorySlug: 'byd', name: 'SUVs', slug: 'byd-suvs', sortOrder: 20, imageUrl: ph('BYD SUV') },
    { categorySlug: 'byd', name: 'Electric', slug: 'byd-electric', sortOrder: 30, imageUrl: ph('BYD Electric') },
    { categorySlug: 'honda', name: 'Sedans', slug: 'honda-sedans', sortOrder: 10, imageUrl: ph('Honda Sedan') },
    { categorySlug: 'honda', name: 'SUVs', slug: 'honda-suvs', sortOrder: 20, imageUrl: ph('Honda SUV') },
    { categorySlug: 'honda', name: 'Hatchbacks', slug: 'honda-hatch', sortOrder: 30, imageUrl: ph('Honda Hatch') },
    { categorySlug: 'kia', name: 'Sedans', slug: 'kia-sedans', sortOrder: 10, imageUrl: ph('Kia Sedan') },
    { categorySlug: 'kia', name: 'SUVs', slug: 'kia-suvs', sortOrder: 20, imageUrl: ph('Kia SUV') },
    { categorySlug: 'kia', name: 'Hatchbacks', slug: 'kia-hatch', sortOrder: 30, imageUrl: ph('Kia Hatch') },
    { categorySlug: 'dodge', name: 'Sedans', slug: 'dodge-sedans', sortOrder: 10, imageUrl: ph('Dodge Sedan') },
    { categorySlug: 'dodge', name: 'SUVs', slug: 'dodge-suvs', sortOrder: 20, imageUrl: ph('Dodge SUV') },
    { categorySlug: 'dodge', name: 'Muscle Cars', slug: 'dodge-muscle', sortOrder: 30, imageUrl: ph('Dodge Muscle') },
    // Real estate listing types
    { categorySlug: 'land', name: 'Residential Plot', slug: 'land-res', sortOrder: 10, imageUrl: ph('Residential Plot') },
    { categorySlug: 'land', name: 'Commercial Plot', slug: 'land-com', sortOrder: 20, imageUrl: ph('Commercial Plot') },
    { categorySlug: 'land', name: 'Agricultural Land', slug: 'land-agri', sortOrder: 30, imageUrl: ph('Agricultural Land') },
    { categorySlug: 'shop', name: 'Retail Shop', slug: 'shop-retail', sortOrder: 10, imageUrl: ph('Retail Shop') },
    { categorySlug: 'shop', name: 'Shop in Mall', slug: 'shop-mall', sortOrder: 20, imageUrl: ph('Shop in Mall') },
    { categorySlug: 'shop', name: 'Storefront', slug: 'shop-storefront', sortOrder: 30, imageUrl: ph('Storefront') },
    { categorySlug: 'apartment', name: 'Studio', slug: 'apt-studio', sortOrder: 10, imageUrl: ph('Studio') },
    { categorySlug: 'apartment', name: '1-Bedroom', slug: 'apt-1br', sortOrder: 20, imageUrl: ph('1-Bedroom') },
    { categorySlug: 'apartment', name: '2-Bedroom', slug: 'apt-2br', sortOrder: 30, imageUrl: ph('2-Bedroom') },
    { categorySlug: 'apartment', name: '3-Bedroom', slug: 'apt-3br', sortOrder: 40, imageUrl: ph('3-Bedroom') },
    { categorySlug: 'house', name: 'Terraced', slug: 'house-terraced', sortOrder: 10, imageUrl: ph('Terraced') },
    { categorySlug: 'house', name: 'Detached', slug: 'house-detached', sortOrder: 20, imageUrl: ph('Detached') },
    { categorySlug: 'house', name: 'Semi-Detached', slug: 'house-semi', sortOrder: 30, imageUrl: ph('Semi-Detached') },
    { categorySlug: 'house', name: 'Duplex', slug: 'house-duplex', sortOrder: 40, imageUrl: ph('Duplex') },
    { categorySlug: 'self-contain', name: 'Single Room', slug: 'sc-single', sortOrder: 10, imageUrl: ph('Self Contain') },
    { categorySlug: 'self-contain', name: 'Shared Compound', slug: 'sc-shared', sortOrder: 20, imageUrl: ph('Shared Compound') },
    // Fabric & Textile - the granular names the fashion/textile vendors list
    // (FMK, Mudassir, El samad, Al gazaru) use in their user stories.
    { categorySlug: 'fabric-textile', name: 'Atamfa', slug: 'atamfa', sortOrder: 10, imageUrl: ph('Atamfa') },
    { categorySlug: 'fabric-textile', name: 'Lace', slug: 'lace', sortOrder: 20, imageUrl: ph('Lace') },
    { categorySlug: 'fabric-textile', name: 'Voile', slug: 'voile', sortOrder: 30, imageUrl: ph('Voile') },
    { categorySlug: 'fabric-textile', name: 'Shadda', slug: 'shadda', sortOrder: 40, imageUrl: ph('Shadda') },
    { categorySlug: 'fabric-textile', name: 'Wasse', slug: 'wasse', sortOrder: 50, imageUrl: ph('Wasse') },
    { categorySlug: 'fabric-textile', name: 'Yard', slug: 'yard', sortOrder: 60, imageUrl: ph('Yard') },
    // Home & Kitchen extras + the remaining vendor-listed items.
    { categorySlug: 'home-kitchen', name: 'Kitchenware', slug: 'kitchenware', sortOrder: 10, imageUrl: ph('Kitchenware') },
    { categorySlug: 'home-kitchen', name: 'Bedsheets', slug: 'bedsheets', sortOrder: 20, imageUrl: ph('Bedsheets') },
    { categorySlug: 'accessories', name: 'Boxes', slug: 'boxes', sortOrder: 10, imageUrl: ph('Boxes') },
    { categorySlug: 'accessories', name: 'Travelling Bags', slug: 'travelling-bags', sortOrder: 20, imageUrl: ph('Travelling Bags') },
    // Food & Groceries
    { categorySlug: 'food', name: 'Nigerian', slug: 'f-nigerian', sortOrder: 10, imageUrl: ph('Nigerian') },
    { categorySlug: 'food', name: 'Rice & Swallow', slug: 'f-rice-swallow', sortOrder: 20, imageUrl: ph('Swallow') },
    { categorySlug: 'food', name: 'Grills & BBQ', slug: 'f-grills', sortOrder: 30, imageUrl: ph('Grills') },
    { categorySlug: 'food', name: 'Snacks & Small Chops', slug: 'f-snacks', sortOrder: 40, imageUrl: ph('Snacks') },
    { categorySlug: 'bakery', name: 'Bread', slug: 'b-bread', sortOrder: 10, imageUrl: ph('Bread') },
    { categorySlug: 'bakery', name: 'Cakes', slug: 'b-cakes', sortOrder: 20, imageUrl: ph('Cakes') },
    { categorySlug: 'bakery', name: 'Pastries', slug: 'b-pastries', sortOrder: 30, imageUrl: ph('Pastries') },
    { categorySlug: 'drinks', name: 'Soft Drinks', slug: 'd-soft', sortOrder: 10, imageUrl: ph('Soft Drinks') },
    { categorySlug: 'drinks', name: 'Juices & Smoothies', slug: 'd-juices', sortOrder: 20, imageUrl: ph('Juices') },
    { categorySlug: 'drinks', name: 'Energy & Malt', slug: 'd-energy', sortOrder: 30, imageUrl: ph('Energy') },
    { categorySlug: 'meat-seafood', name: 'Beef & Goat', slug: 'm-beef', sortOrder: 10, imageUrl: ph('Beef') },
    { categorySlug: 'meat-seafood', name: 'Chicken', slug: 'm-chicken', sortOrder: 20, imageUrl: ph('Chicken') },
    { categorySlug: 'meat-seafood', name: 'Fish & Seafood', slug: 'm-fish', sortOrder: 30, imageUrl: ph('Fish') },
    { categorySlug: 'produce', name: 'Vegetables', slug: 'p-veggies', sortOrder: 10, imageUrl: ph('Vegetables') },
    { categorySlug: 'produce', name: 'Fruits', slug: 'p-fruits', sortOrder: 20, imageUrl: ph('Fruits') },
    { categorySlug: 'water', name: 'Table Water', slug: 'w-table', sortOrder: 10, imageUrl: ph('Table Water') },
    { categorySlug: 'water', name: 'Sachet Water', slug: 'w-sachet', sortOrder: 20, imageUrl: ph('Sachet Water') },
    { categorySlug: 'grocery', name: 'Pantry Staples', slug: 'g-pantry', sortOrder: 10, imageUrl: ph('Pantry') },
    { categorySlug: 'grocery', name: 'Condiments & Spices', slug: 'g-condiments', sortOrder: 20, imageUrl: ph('Spices') },
    { categorySlug: 'grocery', name: 'Imported Foods', slug: 'g-imported', sortOrder: 30, imageUrl: ph('Imported') },
    // Household & Cleaning
    { categorySlug: 'household', name: 'Detergents', slug: 'hh-detergent', sortOrder: 10, imageUrl: ph('Detergents') },
    { categorySlug: 'household', name: 'Cleaning Supplies', slug: 'hh-cleaning', sortOrder: 20, imageUrl: ph('Cleaning') },
    { categorySlug: 'household', name: 'Tissue & Toiletries', slug: 'hh-tissue', sortOrder: 30, imageUrl: ph('Tissue') },
    // Baby Products
    { categorySlug: 'baby', name: 'Diapers', slug: 'baby-diapers', sortOrder: 10, imageUrl: ph('Diapers') },
    { categorySlug: 'baby', name: 'Formula & Food', slug: 'baby-formula', sortOrder: 20, imageUrl: ph('Formula') },
    { categorySlug: 'baby', name: 'Baby Care', slug: 'baby-care', sortOrder: 30, imageUrl: ph('Baby Care') },
    { categorySlug: 'baby', name: 'Clothing & Accessories', slug: 'baby-clothes', sortOrder: 40, imageUrl: ph('Baby Clothes') },
    // Pet Supplies
    { categorySlug: 'pets', name: 'Pet Food', slug: 'pet-food', sortOrder: 10, imageUrl: ph('Pet Food') },
    { categorySlug: 'pets', name: 'Pet Care & Health', slug: 'pet-care', sortOrder: 20, imageUrl: ph('Pet Care') },
    { categorySlug: 'pets', name: 'Pet Accessories', slug: 'pet-accessories', sortOrder: 30, imageUrl: ph('Pet Accessories') },
    // Pharmacy
    { categorySlug: 'pharmacy', name: 'Over-the-Counter', slug: 'phx-otc', sortOrder: 10, imageUrl: ph('OTC') },
    { categorySlug: 'pharmacy', name: 'Prescription', slug: 'phx-prescription', sortOrder: 20, imageUrl: ph('Prescription') },
    { categorySlug: 'pharmacy', name: 'Vitamins & Supplements', slug: 'phx-vitamins', sortOrder: 30, imageUrl: ph('Vitamins') },
    // Health & Personal Care
    { categorySlug: 'personal-care', name: 'Bath & Body', slug: 'pc-bath', sortOrder: 10, imageUrl: ph('Bath & Body') },
    { categorySlug: 'personal-care', name: 'Skin Care', slug: 'pc-skin', sortOrder: 20, imageUrl: ph('Skin Care') },
    { categorySlug: 'personal-care', name: 'Hair Care', slug: 'pc-hair', sortOrder: 30, imageUrl: ph('Hair Care') },
    { categorySlug: 'personal-care', name: 'Oral & Feminine Care', slug: 'pc-oral', sortOrder: 40, imageUrl: ph('Oral Care') },
    // Beauty & Cosmetics
    { categorySlug: 'beauty', name: 'Makeup', slug: 'cb-makeup', sortOrder: 10, imageUrl: ph('Makeup') },
    { categorySlug: 'beauty', name: 'Fragrance', slug: 'cb-fragrance', sortOrder: 20, imageUrl: ph('Fragrance') },
    { categorySlug: 'beauty', name: 'Skincare & Nails', slug: 'cb-skin', sortOrder: 30, imageUrl: ph('Skincare') },
    // Fashion
    { categorySlug: 'fashion', name: 'Women', slug: 'fs-women', sortOrder: 10, imageUrl: ph('Women') },
    { categorySlug: 'fashion', name: 'Men', slug: 'fs-men', sortOrder: 20, imageUrl: ph('Men') },
    { categorySlug: 'fashion', name: 'Kids', slug: 'fs-kids', sortOrder: 30, imageUrl: ph('Kids') },
    { categorySlug: 'fashion', name: 'Footwear', slug: 'fs-footwear', sortOrder: 40, imageUrl: ph('Footwear') },
    // Shoes
    { categorySlug: 'shoes', name: 'Men', slug: 'sh-men', sortOrder: 10, imageUrl: ph('Men') },
    { categorySlug: 'shoes', name: 'Women', slug: 'sh-women', sortOrder: 20, imageUrl: ph('Women') },
    { categorySlug: 'shoes', name: 'Kids', slug: 'sh-kids', sortOrder: 30, imageUrl: ph('Kids') },
    { categorySlug: 'shoes', name: 'Sneakers & Sandals', slug: 'sh-sneakers', sortOrder: 40, imageUrl: ph('Sneakers') },
    // Jewelry & Watches
    { categorySlug: 'jewelry', name: 'Necklaces & Chains', slug: 'j-necklaces', sortOrder: 10, imageUrl: ph('Necklaces') },
    { categorySlug: 'jewelry', name: 'Rings & Earrings', slug: 'j-rings', sortOrder: 20, imageUrl: ph('Rings') },
    { categorySlug: 'jewelry', name: 'Watches', slug: 'j-watches', sortOrder: 30, imageUrl: ph('Watches') },
    { categorySlug: 'jewelry', name: 'Bangles & Bracelets', slug: 'j-bangles', sortOrder: 40, imageUrl: ph('Bangles') },
    // Electronics
    { categorySlug: 'electronics', name: 'Phones & Tablets', slug: 'e-phones', sortOrder: 10, imageUrl: ph('Phones') },
    { categorySlug: 'electronics', name: 'Laptops & Computers', slug: 'e-laptops', sortOrder: 20, imageUrl: ph('Laptops') },
    { categorySlug: 'electronics', name: 'TVs & Sound', slug: 'e-tvs', sortOrder: 30, imageUrl: ph('TVs') },
    { categorySlug: 'electronics', name: 'Home Appliances', slug: 'e-appliances', sortOrder: 40, imageUrl: ph('Appliances') },
    // Phone Accessories
    { categorySlug: 'phone-accessories', name: 'Chargers & Cables', slug: 'pa-chargers', sortOrder: 10, imageUrl: ph('Chargers') },
    { categorySlug: 'phone-accessories', name: 'Cases & Covers', slug: 'pa-cases', sortOrder: 20, imageUrl: ph('Cases') },
    { categorySlug: 'phone-accessories', name: 'Earpieces & Headphones', slug: 'pa-earpieces', sortOrder: 30, imageUrl: ph('Earpieces') },
    { categorySlug: 'phone-accessories', name: 'Power Banks', slug: 'pa-powerbanks', sortOrder: 40, imageUrl: ph('Power Banks') },
    // Phones & Tablets
    { categorySlug: 'phones-tablets', name: 'Smartphones', slug: 'pt-smartphones', sortOrder: 10, imageUrl: ph('Smartphones') },
    { categorySlug: 'phones-tablets', name: 'Tablets', slug: 'pt-tablets', sortOrder: 20, imageUrl: ph('Tablets') },
    { categorySlug: 'phones-tablets', name: 'Feature Phones', slug: 'pt-feature', sortOrder: 30, imageUrl: ph('Feature Phones') },
    { categorySlug: 'phones-tablets', name: 'Phone Accessories', slug: 'pt-phone-accessories', sortOrder: 40, imageUrl: ph('Phone Accessories') },
    { categorySlug: 'phones-tablets', name: 'Tablet Accessories', slug: 'pt-tablet-accessories', sortOrder: 50, imageUrl: ph('Tablet Accessories') },
    // Computers & Laptops
    { categorySlug: 'computers-laptops', name: 'Laptops', slug: 'cl-laptops', sortOrder: 10, imageUrl: ph('Laptops') },
    { categorySlug: 'computers-laptops', name: 'Desktops', slug: 'cl-desktops', sortOrder: 20, imageUrl: ph('Desktops') },
    { categorySlug: 'computers-laptops', name: 'Monitors', slug: 'cl-monitors', sortOrder: 30, imageUrl: ph('Monitors') },
    { categorySlug: 'computers-laptops', name: 'Printers & Scanners', slug: 'cl-printers', sortOrder: 40, imageUrl: ph('Printers') },
    { categorySlug: 'computers-laptops', name: 'Computer Accessories', slug: 'cl-accessories', sortOrder: 50, imageUrl: ph('Computer Accessories') },
    { categorySlug: 'computers-laptops', name: 'Storage & Drives', slug: 'cl-storage', sortOrder: 60, imageUrl: ph('Storage') },
    { categorySlug: 'computers-laptops', name: 'Networking', slug: 'cl-networking', sortOrder: 70, imageUrl: ph('Networking') },
    // Islamic Herbal
    { categorySlug: 'islamic-herbal', name: 'Herbal Medicine', slug: 'ih-herbal-medicine', sortOrder: 10, imageUrl: ph('Herbal Medicine') },
    { categorySlug: 'islamic-herbal', name: 'Islamic Oils & Balms', slug: 'ih-oils', sortOrder: 20, imageUrl: ph('Oils & Balms') },
    { categorySlug: 'islamic-herbal', name: 'Honey & Natural Remedies', slug: 'ih-honey', sortOrder: 30, imageUrl: ph('Honey') },
    { categorySlug: 'islamic-herbal', name: 'Islamic Books & Supplies', slug: 'ih-books', sortOrder: 40, imageUrl: ph('Islamic Books') },
    { categorySlug: 'islamic-herbal', name: 'Ruqyah & Wellbeing', slug: 'ih-ruqyah', sortOrder: 50, imageUrl: ph('Wellbeing') },
    // Books & Stationery
    { categorySlug: 'books-stationery', name: 'Books & Literature', slug: 'bs-books', sortOrder: 10, imageUrl: ph('Books') },
    { categorySlug: 'books-stationery', name: 'School & Office Supplies', slug: 'bs-office', sortOrder: 20, imageUrl: ph('Stationery') },
    { categorySlug: 'books-stationery', name: 'Art & Craft', slug: 'bs-art', sortOrder: 30, imageUrl: ph('Art & Craft') },
    { categorySlug: 'books-stationery', name: 'Magazine & Newspapers', slug: 'bs-magazines', sortOrder: 40, imageUrl: ph('Magazines') },
    // Toys & Games
    { categorySlug: 'toys', name: 'Outdoor & Ride-On', slug: 't-outdoor', sortOrder: 10, imageUrl: ph('Outdoor Toys') },
    { categorySlug: 'toys', name: 'Building & Construction', slug: 't-building', sortOrder: 20, imageUrl: ph('Building Toys') },
    { categorySlug: 'toys', name: 'Dolls & Figures', slug: 't-dolls', sortOrder: 30, imageUrl: ph('Dolls') },
    { categorySlug: 'toys', name: 'Board & Card Games', slug: 't-board', sortOrder: 40, imageUrl: ph('Board Games') },
    // Sports & Fitness
    { categorySlug: 'sports', name: 'Football', slug: 'sp-football', sortOrder: 10, imageUrl: ph('Football') },
    { categorySlug: 'sports', name: 'Gym & Fitness', slug: 'sp-gym', sortOrder: 20, imageUrl: ph('Gym') },
    { categorySlug: 'sports', name: 'Sportswear', slug: 'sp-sportswear', sortOrder: 30, imageUrl: ph('Sportswear') },
    { categorySlug: 'sports', name: 'Outdoor Equipment', slug: 'sp-outdoor', sortOrder: 40, imageUrl: ph('Outdoor') },
    // Hardware & Building
    { categorySlug: 'hardware', name: 'Power Tools', slug: 'hw-power', sortOrder: 10, imageUrl: ph('Power Tools') },
    { categorySlug: 'hardware', name: 'Hand Tools', slug: 'hw-hand', sortOrder: 20, imageUrl: ph('Hand Tools') },
    { categorySlug: 'hardware', name: 'Building Materials', slug: 'hw-building', sortOrder: 30, imageUrl: ph('Building Materials') },
    { categorySlug: 'hardware', name: 'Paint & Finishes', slug: 'hw-paint', sortOrder: 40, imageUrl: ph('Paint') },
    // Agriculture & Farm
    { categorySlug: 'agriculture', name: 'Seeds & Seedlings', slug: 'ag-seeds', sortOrder: 10, imageUrl: ph('Seeds') },
    { categorySlug: 'agriculture', name: 'Fertilizers & Feeds', slug: 'ag-fertilizers', sortOrder: 20, imageUrl: ph('Fertilizers') },
    { categorySlug: 'agriculture', name: 'Farm Tools', slug: 'ag-tools', sortOrder: 30, imageUrl: ph('Farm Tools') },
    { categorySlug: 'agriculture', name: 'Poultry & Livestock', slug: 'ag-poultry', sortOrder: 40, imageUrl: ph('Poultry') },
    // Automotive
    { categorySlug: 'automotive', name: 'Spare Parts', slug: 'au-parts', sortOrder: 10, imageUrl: ph('Spare Parts') },
    { categorySlug: 'automotive', name: 'Oils & Lubricants', slug: 'au-oils', sortOrder: 20, imageUrl: ph('Oils') },
    { categorySlug: 'automotive', name: 'Car Accessories', slug: 'au-accessories', sortOrder: 30, imageUrl: ph('Car Accessories') },
    { categorySlug: 'automotive', name: 'Care & Cleaning', slug: 'au-care', sortOrder: 40, imageUrl: ph('Car Care') },
  ];
  for (const sub of subcategorySeeds) {
    const cat = await prisma.vendorCategory.findFirst({ where: { slug: sub.categorySlug, vendorId: null } });
    if (!cat) continue;
    const img = CLD[`${sub.categorySlug}/${sub.slug}`] || sub.imageUrl;
    const existing = await prisma.subcategory.findFirst({
      where: { categoryId: cat.id, name: sub.name, vendorId: null },
    });
    if (existing) {
      await prisma.subcategory.update({
        where: { id: existing.id },
        data: { sortOrder: sub.sortOrder, isActive: true, imageUrl: img, slug: sub.slug },
      });
    } else {
      await prisma.subcategory.create({
        data: { categoryId: cat.id, name: sub.name, slug: sub.slug, sortOrder: sub.sortOrder, isActive: true, imageUrl: img, vendorId: null },
      });
    }
  }
  console.log(`✅ Seeded ${subcategorySeeds.length} subcategories`);

  // Helper: create a vendor user + vendor row. Vendors are always orderable
  // (no restaurant-style opening hours), so isOpen defaults true. A shop's
  // categories are derived from its products - no category is chosen here.
  const createVendor = async ({
    email, phone, firstName, lastName, name, description,
    address, lat, lng, averageRating, photos, policies, logoUrl, coverImageUrl,
    categorySlug,
  }) => {
    // The shop's explicit top-level industry (a VendorCategory slug). Resolved
    // to its id so a shop is always grouped under its own industry on the
    // marketplace/home, even with zero products.
    const industryCat = categorySlug
      ? await prisma.vendorCategory.findFirst({ where: { slug: categorySlug, vendorId: null } })
      : null;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        phone, firstName, lastName, email,
        passwordHash: await bcrypt.hash(`${firstName.toLowerCase().replace(/\s+/g, '')}123`, SALT_ROUNDS),
        role: 'VENDOR',
        status: 'ACTIVE',
        vendor: {
          create: {
            name, description, phone, email, address, lat, lng,
            status: 'APPROVED',
            isOpen: true,
            isActive: true,
            averageRating,
            photos: photos || [],
            policies: policies || null,
            logoUrl: logoUrl || null,
            coverImageUrl: coverImageUrl || null,
            ...(industryCat ? { categoryId: industryCat.id } : {}),
          },
        },
      },
      include: { vendor: true },
    });

    const vendor = user.vendor ?? (await prisma.vendor.findUnique({ where: { userId: user.id } }));
    // The user upsert's `update: {}` branch skips the nested vendor create
    // on reruns (user already existed), so logoUrl/coverImageUrl/categoryId
    // would never land on an already-seeded vendor without this explicit
    // update.
    return prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        photos: photos || [], policies: policies || null,
        logoUrl: logoUrl || null, coverImageUrl: coverImageUrl || null,
        ...(industryCat ? { categoryId: industryCat.id } : {}),
      },
    });
  };

  // Custom (vendor-owned) categories are created by seedOneCustomCategory, which
  // runs before products are filed under them. The old flat-list seeding that
  // turned global subcategory names (Atamfa, Shoes...) into private rows was
  // removed - storefront tiles now come from the products under the correct
  // global cat/sub.

  // Give one of a shop's categories vendor-owned subcategory leaves, then file
  // matching products under each leaf. `catName` resolves to a global category
  // first, else this vendor's own private category. Each leaf is a vendor-owned
  // Subcategory (vendorId set) so it shows only on this shop; products are
  // remapped to the unified categoryId + subcategoryId.
  const seedShopSubcategories = async (vendorId, catName, leaves) => {
    const cat = await prisma.vendorCategory.findFirst({
      where: { name: catName, vendorId: null },
    }) ?? await prisma.vendorCategory.findFirst({
      where: { name: catName, vendorId },
    });
    if (!cat) { console.log(`⚠️  Category "${catName}" not found for leaf seeding`); return; }
    let created = 0;
    for (const leaf of leaves) {
      const sub = await prisma.subcategory.upsert({
        where: { categoryId_vendorId_name: { categoryId: cat.id, vendorId, name: leaf.name } },
        update: {},
        create: { categoryId: cat.id, vendorId, name: leaf.name, imageUrl: leaf.imageUrl || null, sortOrder: created++ },
      });
      if (leaf.productTitles && leaf.productTitles.length) {
        await prisma.product.updateMany({
          where: { vendorId, name: { in: leaf.productTitles } },
          data: { categoryId: cat.id, subcategoryId: sub.id },
        });
      }
    }
    console.log(`✅ Seeded ${leaves.length} subcategor${leaves.length === 1 ? 'y' : 'ies'} under "${catName}"`);
  };

  // Helper: create/reuse a review author. Deterministic email + phone (derived
  // from the reviewer's name) so re-running the seed never collides on the
  // unique fields - even when a later run adds new shops whose reviewers would
  // otherwise reuse an earlier run's generated phone.
  const reviewerPhone = (fullName) => {
    let h = 0;
    const s = fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    const digits = String(Math.abs(h)).padStart(8, '0').slice(0, 8);
    return `0805${digits}`;
  };
  const createReviewer = async (fullName) => {
    const [firstName, ...rest] = fullName.replace('.', '').split(' ');
    const lastName = rest.join(' ') || 'Customer';
    const email = `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@ecommerce.test`;
    // Deterministic phone, bumped on the (rare) 8-digit hash collision against
    // an already-seeded reviewer so new shops can always be fully seeded.
    let phone = reviewerPhone(fullName);
    for (let attempt = 0; attempt < 25; attempt += 1) {
      try {
        return await prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            phone,
            firstName, lastName, email,
            passwordHash: await bcrypt.hash('reviewer123', SALT_ROUNDS),
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });
      } catch (e) {
        const target = String(e?.meta?.target || '');
        if (e?.code === 'P2002' && target.includes('phone')) {
          phone = `0${BigInt(phone) + 1n}`;
          continue;
        }
        throw e;
      }
    }
    throw new Error(`Could not allocate a unique phone for reviewer ${fullName}`);
  };

  // "2 weeks ago" / "1 month ago" / "5 days ago" -> an actual past Date, so
  // seeded reviews/orders have realistic, spread-out timestamps instead of
  // all landing at exactly `now`.
  const parseTimeAgo = (text) => {
    const m = text.match(/(\d+)\s+(day|week|month)s?\s+ago/);
    if (!m) return new Date();
    const n = parseInt(m[1], 10);
    const days = m[2] === 'day' ? n : m[2] === 'week' ? n * 7 : n * 30;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  };

  // Helper: seed a DELIVERED order + Rating per review (customer ->
  // Rating.vendorScore/vendorComment is the real review system - see
  // schema.prisma Rating model), then recompute the vendor's averageRating
  // from what was actually seeded rather than hand-picking a number.
  const seedVendorReviews = async (vendor, products, reviews) => {
    if ((await prisma.rating.count({ where: { order: { vendorId: vendor.id } } })) > 0) return;

    for (let i = 0; i < reviews.length; i += 1) {
      const r = reviews[i];
      const reviewer = await createReviewer(r.name);
      const shippingAddress = await prisma.savedAddress.create({
        data: {
          userId: reviewer.id, label: 'Home', address: vendor.address,
          lat: vendor.lat, lng: vendor.lng, isDefault: true,
        },
      });
      const product = products[i % products.length];
      const createdAt = parseTimeAgo(r.timeAgo);

      const order = await prisma.order.create({
        data: {
          customerId: reviewer.id, vendorId: vendor.id, shippingAddressId: shippingAddress.id,
          status: 'DELIVERED', subtotal: product.basePrice, tax: 0, total: product.basePrice,
          deliveredAt: createdAt, createdAt,
          items: {
            create: [{
              productId: product.id, name: product.name, description: product.description,
              unitPrice: product.basePrice, quantity: 1, lineTotal: product.basePrice,
            }],
          },
        },
      });

      await prisma.rating.create({
        data: { orderId: order.id, customerId: reviewer.id, vendorScore: r.rating, vendorComment: r.comment, createdAt },
      });
    }

    const ratings = await prisma.rating.findMany({ where: { order: { vendorId: vendor.id } }, select: { vendorScore: true } });
    const avg = ratings.reduce((sum, r) => sum + (r.vendorScore || 0), 0) / ratings.length;
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { averageRating: Math.round(avg * 10) / 10, totalOrders: ratings.length },
    });
    console.log(`✅ Seeded ${reviews.length} reviews on ${vendor.name} (averageRating -> ${Math.round(avg * 10) / 10})`);
  };

  // ─── Vendors (the real client-supplied businesses) ──────────────────────
  const fmkClothing = await createVendor({
    email: 'fmkclothing@ecommerce.test', phone: '2348012345671',
    categorySlug: 'clothing-fashion',
    firstName: 'FMK', lastName: 'Clothing',
    name: 'FMK Clothing',
    description: "FMK Clothing is a premium fashion brand offering quality men's and women's wear that blends style, comfort and culture.",
    address: 'Abuja, Nigeria', lat: 9.0765, lng: 7.3986, averageRating: 4.8,
    logoUrl: 'https://api.marketplace.ng/shop-logos/fmk-clothing.jpeg?v=2',
    coverImageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=70',
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=70',
      'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=500&q=70',
    ],
    policies: {
      shipping: 'Seller arranges delivery (outside my sooq)',
      returns: 'Returns accepted (7 days)',
      payment: 'Pay directly to the seller',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${fmkClothing.name} (Clothing & Fashion, APPROVED)`);

  const algazaruAbayas = await createVendor({
    email: 'algazaruabayas@ecommerce.test', phone: '2348012345672',
    categorySlug: 'clothing-fashion',
    firstName: 'Algazaru', lastName: 'Abayas',
    name: 'Algazaru Abayas',
    description: 'Algazaru Abayas specializes in elegant abayas and modest wear, handpicked for quality fabric and finishing.',
    address: 'Kano, Nigeria', lat: 12.0022, lng: 8.5920, averageRating: 4.6,
    logoUrl: 'https://images.unsplash.com/photo-1583846717393-dc2412c95ed7?w=200&h=200&fit=crop&q=70',
    coverImageUrl: 'https://images.unsplash.com/photo-1583846717393-dc2412c95ed7?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1583846717393-dc2412c95ed7?w=500&q=70',
      'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=500&q=70',
    ],
    policies: {
      shipping: 'Seller arranges delivery (outside my sooq)',
      returns: 'Returns accepted (3 days)',
      payment: 'Pay directly to the seller',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${algazaruAbayas.name} (Clothing & Fashion, APPROVED)`);

  const mudatex = await createVendor({
    email: 'mudatex@ecommerce.test', phone: '2348012345673',
    categorySlug: 'clothing-fashion',
    firstName: 'Mudatex', lastName: 'Textiles',
    name: 'Mudatex',
    description: 'Mudatex is a textile and fabric house supplying premium Ankara, lace and brocade for tailors and everyday shoppers alike.',
    address: 'Kaduna, Nigeria', lat: 10.5105, lng: 7.4165, averageRating: 4.7,
    logoUrl: 'https://api.marketplace.ng/shop-logos/mudatex.png?v=2',
    coverImageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=500&q=70',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=500&q=70',
    ],
    policies: {
      shipping: 'Seller arranges delivery (outside my sooq)',
      returns: 'Returns accepted (7 days)',
      payment: 'Pay directly to the seller',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${mudatex.name} (Clothing & Fashion, APPROVED)`);

  const sarkinMotaAutos = await createVendor({
    email: 'sarkinmotaautos@ecommerce.test', phone: '2348012345674',
    categorySlug: 'vehicles-automobiles',
    firstName: 'Sarkin', lastName: 'Mota Autos',
    name: 'Sarkin Mota Autos',
    description: 'Sarkin Mota Autos deals in clean, verified foreign and Nigerian-used vehicles with full inspection before sale.',
    address: 'Kano, Nigeria', lat: 12.0022, lng: 8.5920, averageRating: 4.9,
    logoUrl: 'https://api.marketplace.ng/shop-logos/sarkin-mota-autos.jpg?v=2',
    coverImageUrl: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=500&q=70',
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&q=70',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500&q=70',
    ],
    policies: {
      shipping: 'Buyer arranges pickup or logistics',
      returns: 'Inspection before purchase - no returns after sale',
      payment: 'Pay directly to the seller',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${sarkinMotaAutos.name} (Vehicles & Automobiles, APPROVED)`);

  const wasseInvestments = await createVendor({
    email: 'wasseinvestments@ecommerce.test', phone: '2348012345679',
    categorySlug: 'clothing-fashion',
    firstName: 'Wasse', lastName: 'Investments',
    name: 'Wasse Investments',
    description: 'Wasse Investments is a textile and fabric house trading in premium wasse, brocade and lace for fashion and tailoring.',
    address: 'Kano, Nigeria', lat: 12.0022, lng: 8.5920, averageRating: 4.7,
    logoUrl: 'https://api.marketplace.ng/shop-logos/wasse-investments.png?v=2',
    coverImageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=70',
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=70',
      'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=500&q=70',
    ],
    policies: {
      shipping: 'Seller arranges delivery (outside my sooq)',
      returns: 'Returns accepted (5 days)',
      payment: 'Pay directly to the seller',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${wasseInvestments.name} (Clothing & Fashion, APPROVED)`);

  const eliteCycleConstruction = await createVendor({
    email: 'elitecycleconstruction@ecommerce.test', phone: '2348012345680',
    categorySlug: 'real-estate',
    firstName: 'Elite', lastName: 'Cycle',
    name: 'Elite Cycle Construction',
    description: 'Elite Cycle Construction builds and sells residential and commercial properties, with land and plots across Abuja.',
    address: 'Abuja, Nigeria', lat: 9.0410, lng: 7.4910, averageRating: 4.6,
    logoUrl: 'https://api.marketplace.ng/shop-logos/elite-cycle-construction.png?v=2',
    coverImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=500&q=70',
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&q=70',
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=500&q=70',
    ],
    policies: {
      shipping: 'Not applicable - property inspection by appointment',
      returns: 'Not applicable',
      payment: 'Flexible payment plans available - discuss with seller',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${eliteCycleConstruction.name} (Real Estate, APPROVED)`);

  const danmamaSmartHomes = await createVendor({
    email: 'danmamasmarthomes@ecommerce.test', phone: '2348012345681',
    categorySlug: 'real-estate',
    firstName: 'Danmama', lastName: 'Smart Homes',
    name: 'Danmama Smart Homes',
    description: 'Danmama Smart Homes offers smart-fitted residential properties, houses and apartments across Abuja and beyond.',
    address: 'Abuja, Nigeria', lat: 9.0579, lng: 7.4951, averageRating: 4.9,
    logoUrl: 'https://api.marketplace.ng/shop-logos/danmama-smart-homes.png?v=2',
    coverImageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=70',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=500&q=70',
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&q=70',
    ],
    policies: {
      shipping: 'Not applicable - property inspection by appointment',
      returns: 'Not applicable',
      payment: 'Flexible payment plans or bank transfer',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${danmamaSmartHomes.name} (Real Estate, APPROVED)`);

  // El samad - renamed from the legacy "Green House Katsina" vendor row (same
  // industry + products). Preserve the existing row (and its products,
  // reviews, highlights) by renaming in place when migrating, or create it
  // fresh on a clean DB. No "Green House" trace is left anywhere.
  const elSamadEmail = 'elsamad@ecommerce.test';
  let elSamadUser = await prisma.user.findUnique({
    where: { email: elSamadEmail },
    include: { vendor: true },
  });
  if (!elSamadUser) {
    const legacy = await prisma.user.findUnique({
      where: { email: 'greenhousekatsina@ecommerce.test' },
      include: { vendor: true },
    });
    if (legacy?.vendor) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: legacy.id },
          data: { email: elSamadEmail, firstName: 'El samad', lastName: 'Fashion' },
        }),
        prisma.vendor.update({
          where: { id: legacy.vendor.id },
          data: {
            email: elSamadEmail,
            name: 'El samad',
            description: 'El samad offers ready-to-wear traditional and casual outfits for the whole family, sourced locally.',
            categoryId: (
              await prisma.vendorCategory.findFirst({ where: { slug: 'clothing-fashion', vendorId: null } })
            ).id,
          },
        }),
      ]);
      elSamadUser = await prisma.user.findUnique({
        where: { email: elSamadEmail },
        include: { vendor: true },
      });
    } else {
      elSamadUser = await createVendor({
        email: elSamadEmail, phone: '2348012345676',
        categorySlug: 'clothing-fashion',
        firstName: 'El samad', lastName: 'Fashion',
        name: 'El samad',
        description: 'El samad offers ready-to-wear traditional and casual outfits for the whole family, sourced locally.',
        address: 'Katsina, Nigeria', lat: 13.0059, lng: 7.6017, averageRating: 4.5,
        logoUrl: 'https://api.marketplace.ng/shop-logos/el-samad.jpg?v=2',
        coverImageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&h=400&fit=crop&q=70',
        photos: [
          'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=70',
          'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=500&q=70',
        ],
        policies: {
          shipping: 'Seller arranges delivery (outside my sooq)',
          returns: 'Returns accepted (5 days)',
          payment: 'Pay directly to the seller',
          shopPolicies: 'Read shop terms and conditions',
        },
      });
    }
  }
  const elSamad = elSamadUser.vendor ?? (await prisma.vendor.findUnique({ where: { userId: elSamadUser.id } }));
  // Always pin El samad to its industry regardless of which path above ran
  // (fresh create, legacy rename, or an already-existing row on a live DB).
  await prisma.vendor.update({
    where: { id: elSamad.id },
    data: { categoryId: (await prisma.vendorCategory.findFirst({ where: { slug: 'clothing-fashion', vendorId: null } })).id },
  });
  console.log(`✅ Vendor created: ${elSamad.name} (Clothing & Fashion, APPROVED)`);

  // ─── Vendor-owned custom categories ──────────────────────────────────────
  // Genuinely private categories (vendorId set) that the 5 fashion/textile
  // shops claim as their own headline tiles. These must exist BEFORE products
  // are seeded (ensureCustomProduct files under them). Everything else the
  // shops list is global and needs no private row.
  const seedOneCustomCategory = async (vendorId, name, imageUrl, sortOrder) => {
    await prisma.vendorCategory.upsert({
      where: { vendorId_name: { vendorId, name } },
      update: { imageUrl: imageUrl || null },
      create: { vendorId, name, imageUrl: imageUrl || null, sortOrder },
    });
  };
  await seedOneCustomCategory(fmkClothing.id, 'Lefe collection', SHOPIMG.fmk['Lefe collection'], 0);
  await seedOneCustomCategory(mudatex.id, 'Perfume & cosmetics', SHOPIMG.mudatex['Perfume & cosmetics'], 0);
  await seedOneCustomCategory(elSamad.id, 'Abaya and gown', SHOPIMG.elSamad['Abaya and gown'], 0);
  await seedOneCustomCategory(algazaruAbayas.id, 'Abaya', SHOPIMG.algazaru['Abaya'], 0);
  await seedOneCustomCategory(danmamaSmartHomes.id, 'Smart Homes', SHOPIMG.danmama['Smart Homes'], 0);

  // Helper: create a product plus its variants. `category` / `subcategory`
  // are admin-managed taxonomy names ("Clothing & Fashion" / "Women") resolved
  // to their FK ids (both seeded/upserted above). Every product must pick one
  // of each - never free text.
  //
  // Variant strategy: cross a size axis against a cycled color axis when
  // both exist (mirrors real per-size/color SKUs without exploding into a
  // full cartesian product); one variant per color when only color varies;
  // a single no-attribute variant for vehicles/real estate where neither
  // axis applies.
  const createProduct = async ({ vendorId, title, category, subcategory, images, price, description, details, colors, sizes }) => {
    const cat = await prisma.vendorCategory.findFirst({ where: { name: category, vendorId: null } });
    if (!cat) throw new Error(`Category not found: ${category}`);
    // subcategory is OPTIONAL (my sooq allows category-only products) - only
    // resolve the subcategory id when one was provided.
    let sub = null;
    if (subcategory) {
      sub = await prisma.subcategory.findFirst({ where: { categoryId: cat.id, name: subcategory } });
      if (!sub) throw new Error(`Subcategory not found: ${subcategory} (in ${category})`);
    }

    const fullDescription = details
      ? `${description}\n\n${Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(' · ')}`
      : description;

    const product = await prisma.product.create({
      data: {
        vendorId, name: title, description: fullDescription,
        categoryId: cat.id, subcategoryId: sub ? sub.id : null,
        basePrice: price, stock: 0, imageUrl: images[0], isAvailable: true,
      },
    });

    let variants;
    if (sizes && colors) {
      variants = sizes.map((size, i) => ({
        productId: product.id,
        sku: `${product.id}-${size}-${colors[i % colors.length].name}`.toUpperCase().replace(/\s+/g, '-'),
        attributes: { size, color: colors[i % colors.length].name },
        price, stock: 12 + i * 4, isAvailable: true,
      }));
    } else if (colors) {
      variants = colors.map((color, i) => ({
        productId: product.id,
        sku: `${product.id}-${color.name}`.toUpperCase().replace(/\s+/g, '-'),
        attributes: { color: color.name },
        price, stock: 15 + i * 5, isAvailable: true,
      }));
    } else if (sizes) {
      variants = sizes.map((size, i) => ({
        productId: product.id,
        sku: `${product.id}-${size}`.toUpperCase().replace(/\s+/g, '-'),
        attributes: { size },
        price, stock: 12 + i * 4, isAvailable: true,
      }));
    } else {
      variants = [{ productId: product.id, sku: `${product.id}-STD`, attributes: {}, price, stock: 5, isAvailable: true }];
    }
    await prisma.productVariant.createMany({ data: variants });

    return product;
  };

  // Idempotent add: skip if this vendor already has a product with this exact
  // title. Used to expand a shop's catalog on top of an already-seeded DB
  // without clobbering existing products (createProduct above only runs when
  // the vendor has zero products).
  const ensureProduct = async (args) => {
    const existing = await prisma.product.findFirst({
      where: { vendorId: args.vendorId, name: args.title },
    });
    if (existing) return existing;
    return createProduct(args);
  };

  // File a product under a vendor-OWNED custom category directly (no global
  // subcategory) - e.g. Algazaru's "Abaya", FMK's "Lefe collection", El samad's
  // "Abaya and gown" headline tiles. Skips if a product with this title already
  // exists for the vendor.
  const ensureCustomProduct = async ({ vendorId, categoryName, title, images, price, description, details, colors, sizes }) => {
    const existing = await prisma.product.findFirst({ where: { vendorId, name: title } });
    if (existing) return existing;
    const cat = await prisma.vendorCategory.findFirst({ where: { name: categoryName, vendorId } });
    if (!cat) throw new Error(`Custom category not found: ${categoryName}`);
    const fullDescription = details
      ? `${description}\n\n${Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(' · ')}`
      : description;
    const product = await prisma.product.create({
      data: {
        vendorId, name: title, description: fullDescription,
        categoryId: cat.id, subcategoryId: null,
        basePrice: price, stock: 0, imageUrl: images[0], isAvailable: true,
      },
    });
    let variants;
    if (sizes && colors) {
      variants = sizes.map((size, i) => ({
        productId: product.id,
        sku: `${product.id}-${size}-${colors[i % colors.length].name}`.toUpperCase().replace(/\s+/g, '-'),
        attributes: { size, color: colors[i % colors.length].name },
        price, stock: 12 + i * 4, isAvailable: true,
      }));
    } else if (colors) {
      variants = colors.map((color, i) => ({
        productId: product.id, sku: `${product.id}-${color.name}`.toUpperCase().replace(/\s+/g, '-'),
        attributes: { color: color.name }, price, stock: 15 + i * 5, isAvailable: true,
      }));
    } else if (sizes) {
      variants = sizes.map((size, i) => ({
        productId: product.id, sku: `${product.id}-${size}`.toUpperCase().replace(/\s+/g, '-'),
        attributes: { size }, price, stock: 12 + i * 4, isAvailable: true,
      }));
    } else {
      variants = [{ productId: product.id, sku: `${product.id}-STD`, attributes: {}, price, stock: 5, isAvailable: true }];
    }
    await prisma.productVariant.createMany({ data: variants });
    return product;
  };


  const COLORS = {
    blue: { name: 'Blue' }, red: { name: 'Red' }, green: { name: 'Green' },
    gold: { name: 'Gold' }, black: { name: 'Black' }, white: { name: 'White' }, brown: { name: 'Brown' },
  };

  // Helper: seed a shop's Instagram-style highlight collections. Idempotent by
  // (vendor, highlight name) - re-runs skip highlights that already exist, so
  // anything the vendor later edits is never overwritten. Every story uses a
  // real image and may link up to 2 of the vendor's own products (indexes into
  // the `products` array).
  const seedShopHighlights = async (vendor, products, highlights) => {
    let seeded = 0;
    for (const h of highlights) {
      const existing = await prisma.highlight.findFirst({ where: { vendorId: vendor.id, name: h.name } });
      if (existing) continue;

      const highlight = await prisma.highlight.create({
        data: {
          vendorId: vendor.id,
          name: h.name,
          coverImageUrl: h.coverImageUrl || null,
          sortOrder: h.sortOrder ?? 0,
          isActive: true,
        },
      });

      let storyIndex = 0;
      for (const s of h.stories) {
        const productIds = (s.productIds || []).map((idx) => products[idx]?.id).filter(Boolean).slice(0, 2);
        await prisma.highlightStory.create({
          data: {
            highlightId: highlight.id,
            mediaUrl: s.mediaUrl || s.imageUrl,
            mediaType: s.mediaType || 'image',
            caption: s.caption || null,
            sortOrder: storyIndex,
            products: {
              create: productIds.map((pid, i) => ({ productId: pid, sortOrder: i })),
            },
          },
        });
        storyIndex += 1;
      }
      seeded += 1;
    }
    if (seeded > 0) console.log(`✅ Seeded ${seeded} highlight collection(s) on ${vendor.name}`);
  };

  // ─── Products: FMK Clothing ──────────────────────────────────────────────
  if ((await prisma.product.count({ where: { vendorId: fmkClothing.id } })) === 0) {
    await createProduct({
      vendorId: fmkClothing.id, title: 'Ankara Maxi Dress',       category: 'Clothing & Fashion', subcategory: 'Women',
      images: ['https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp'],
      price: 12500, description: 'Beautiful and stylish Ankara maxi dress perfect for casual outings, events and special occasions.',
      details: { Material: 'Ankara (African Wax Print)', Occasion: 'Casual, Party, Church, Events', Style: 'Maxi Dress' },
      colors: [COLORS.blue, COLORS.red, COLORS.green, COLORS.gold], sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    });
    await createProduct({
      vendorId: fmkClothing.id, title: "Men's Kaftan Set",       category: 'Clothing & Fashion', subcategory: 'Men',
      images: ['https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp'],
      price: 18500, description: 'Premium men\'s kaftan set, tailored fit with fine embroidery detail.',
      details: { Material: 'Cotton blend', Occasion: 'Traditional, Party', Style: 'Kaftan' },
      colors: [COLORS.brown, COLORS.black, COLORS.white], sizes: ['M', 'L', 'XL', 'XXL'],
    });
    await createProduct({
      vendorId: fmkClothing.id, title: 'Premium Polo Shirt',       category: 'Clothing & Fashion', subcategory: 'Men',
      images: ['https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/1.webp'],
      price: 9500, description: 'Everyday premium polo shirt, breathable fabric with a tailored fit.',
      details: { Material: 'Pique cotton', Style: 'Polo' },
      colors: [COLORS.black, COLORS.white, COLORS.blue], sizes: ['S', 'M', 'L', 'XL'],
    });
    console.log('✅ Seeded 3 products on FMK Clothing');
  }
  const fmkProducts = await prisma.product.findMany({ where: { vendorId: fmkClothing.id } });
  await seedVendorReviews(fmkClothing, fmkProducts, [
    { name: 'Amina S.', rating: 5, timeAgo: '2 weeks ago', comment: 'Amazing quality and fast response. The kaftan is even better in person!' },
    { name: 'Musa K.', rating: 5, timeAgo: '1 month ago', comment: 'Great customer service and genuine products. Highly recommended.' },
    { name: 'Ibrahim M.', rating: 5, timeAgo: '3 weeks ago', comment: 'Very professional and reliable seller. Will definitely buy again.' },
  ]);
  await seedShopHighlights(fmkClothing, fmkProducts, [
    {
      name: 'New Arrivals', sortOrder: 0,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp', caption: 'New Ankara maxi dress in stock', productIds: [0] },
        { imageUrl: "https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp", caption: "Men's kaftan set just landed", productIds: [1] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/1.webp', caption: 'Premium polos back in every colour', productIds: [2] },
      ],
    },
    {
      name: 'Wedding Season', sortOrder: 1,
      coverImageUrl: "https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp",
      stories: [
        { imageUrl: "https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp", caption: 'Traditional wear for the big day', productIds: [1] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp', caption: 'Bridal party inspo', productIds: [0] },
      ],
    },
  ]);

  // ─── Products: FMK Clothing (expanded catalog) ──────────────────────────
  // FMK's tiles (per the shop's canonical list) map to global subs + Bags +
  // Shoes + Lefe collection (custom). Each tile gets enough real items.
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Premium Atamfa Fabric (6 Yards)', category: 'Fabric & Textile', subcategory: 'Atamfa',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Atamfa+Fabric'],
    price: 42000, description: 'Premium atamfa fabric, rich sheen and smooth drape - the staple yard for traditional tailoring.',
    details: { Type: 'Atamfa', Length: '6 yards', Material: 'High-twist cotton' }, colors: [COLORS.black, COLORS.gold, COLORS.brown] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Atamfa Kaftan Fabric (4 Yards)', category: 'Fabric & Textile', subcategory: 'Atamfa',
    images: ['https://placehold.co/600x600/7C2D12/ff?text=Atamfa+4yds'],
    price: 28500, description: 'Medium-weight atamfa ideal for kaftans, senators and agbadas with a subtle waxy finish.',
    details: { Type: 'Atamfa', Length: '4 yards', Material: 'Cotton blend' }, colors: [COLORS.blue, COLORS.green, COLORS.white] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Atamfa Brocade - Embroidered', category: 'Fabric & Textile', subcategory: 'Atamfa',
    images: ['https://placehold.co/600x600/7C2D12/ff?text=Brocade'],
    price: 56000, description: 'Exquisitely embroidered atamfa brocade for weddings and special occasions.',
    details: { Type: 'Atamfa', Embellishment: 'Embroidered', Length: '6 yards' }, colors: [COLORS.gold, COLORS.red, COLORS.black] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Fine Embroidery Lace (5 Yards)', category: 'Fabric & Textile', subcategory: 'Lace',
    images: ['https://placehold.co/600x600/9A3412/fff?text=Lace'],
    price: 68000, description: 'Delicate embroidered lace with a soft scalloped edge, perfect for evening and party wear.',
    details: { Type: 'Lace', Length: '5 yards', Material: 'Polyester + cotton' }, colors: [COLORS.white, COLORS.gold, COLORS.red] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'French Lace (8 Yards)', category: 'Fabric & Textile', subcategory: 'Lace',
    images: ['https://placehold.co/600x600/9A3412/fff?text=French+Lace'],
    price: 115000, description: 'High-end French lace with intricate floral embroidery and weighty luxurious feel.',
    details: { Type: 'Lace', Length: '8 yards', Origin: 'French' }, colors: [COLORS.white, COLORS.black, COLORS.blue] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Chiffon Lace Trim Pack', category: 'Fabric & Textile', subcategory: 'Lace',
    images: ['https://placehold.co/600x600/9A3412/fff?text=Lace+Trim'],
    price: 9500, description: 'Assorted chiffon lace trims for hems, sleeves and finishing touches.',
    details: { Type: 'Lace', Pack: '2 yards', Use: 'Finishing' }, colors: [COLORS.gold, COLORS.white, COLORS.green] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Soft Voile (6 Yards)', category: 'Fabric & Textile', subcategory: 'Voile',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Voile'],
    price: 16000, description: 'Lightweight breathable voile, smooth texture ideal for hijabs, shirts and soft tailoring.',
    details: { Type: 'Voile', Length: '6 yards', Material: 'Cotton voile' }, colors: [COLORS.white, COLORS.blue, COLORS.green] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Plain Voile - Everyday (10 Yards)', category: 'Fabric & Textile', subcategory: 'Voile',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Plain+Voile'],
    price: 22000, description: 'Versatile plain voile for everyday blouses, headwraps and kaftan linings.',
    details: { Type: 'Voile', Length: '10 yards', Material: 'Cotton' }, colors: [COLORS.black, COLORS.white, COLORS.brown] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Shadda Fabric (6 Yards)', category: 'Fabric & Textile', subcategory: 'Shadda',
    images: ['https://placehold.co/600x600/065F46/fff?text=Shadda'],
    price: 34000, description: 'Traditional shadda fabric with a soft hand and elegant drape, a festive favorite.',
    details: { Type: 'Shadda', Length: '6 yards', Material: 'Cotton blend' }, colors: [COLORS.green, COLORS.gold, COLORS.red] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Premium Shadda Wrap (4 Yards)', category: 'Fabric & Textile', subcategory: 'Shadda',
    images: ['https://placehold.co/600x600/065F46/fff?text=Shadda+Wrap'],
    price: 19500, description: 'Premium shadda wrap in deep ceremonial colors for parties and gatherings.',
    details: { Type: 'Shadda', Length: '4 yards', Finish: 'Soft sheen' }, colors: [COLORS.red, COLORS.green, COLORS.brown] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Chiffon Veil - Classic', category: 'Clothing & Fashion', subcategory: 'Veil',
    images: ['https://placehold.co/600x600/DB2777/fff?text=Veil'],
    price: 7800, description: 'Classic chiffon veil with a soft, breathable finish for everyday and prayer wear.',
    details: { Material: 'Chiffon', Style: 'Classic' }, colors: [COLORS.black, COLORS.white, COLORS.gold] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Embroidery Veil (2-Pack)', category: 'Clothing & Fashion', subcategory: 'Veil',
    images: ['https://placehold.co/600x600/DB2777/fff?text=Embroidery+Veil'],
    price: 14500, description: 'Two elegant embroidered veils with fine border detailing.',
    details: { Material: 'Crinkle chiffon', Pack: '2' }, colors: [COLORS.blue, COLORS.gold, COLORS.green] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Gift Box Set - Large (Set of 3)', category: 'Bags', subcategory: 'Boxes',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Gift+Boxes'],
    price: 6500, description: 'Rigid decorative gift box set in assorted sizes, ideal for packaging gifts and keepsakes.',
    details: { Pack: '3 sizes', Use: 'Gifting / storage' }, colors: [COLORS.brown, COLORS.gold, COLORS.white] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Premium Storage Boxes (Set of 4)', category: 'Bags', subcategory: 'Boxes',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Storage+Boxes'],
    price: 9800, description: 'Fabric-lined storage boxes for wardrobe and shelf organization.',
    details: { Pack: '4', Material: 'Fabric board' }, colors: [COLORS.black, COLORS.brown] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Leather Tote Handbag', category: 'Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Tote+Bag'],
    price: 18500, description: 'Structured leather-look tote with ample room and inner pockets for daily use.',
    details: { Material: 'PU leather', Pockets: '3' }, colors: [COLORS.black, COLORS.brown] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Ankara Shoulder Bag', category: 'Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Ankara+Bag'],
    price: 12800, description: 'Bold Ankara print shoulder bag, handmade with fabric handles.',
    details: { Material: 'Ankara + lining', Style: 'Shoulder' }, colors: [COLORS.gold, COLORS.green, COLORS.red] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Men\'s Leather Loafers', category: 'Shoes', subcategory: 'Men',
    images: ['https://placehold.co/600x600/A16207/fff?text=Loafers'],
    price: 26000, description: 'Classic men\'s leather loafers with cushioned insole - smart casual essential.',
    details: { Material: 'Faux leather', Style: 'Loafer' }, sizes: ['EU41', 'EU42', 'EU43', 'EU44'] });
  await ensureProduct({ vendorId: fmkClothing.id, title: 'Women\'s Sandals - Comfort', category: 'Shoes', subcategory: 'Women',
    images: ['https://placehold.co/600x600/A16207/fff?text=Sandals'],
    price: 14800, description: 'Comfortable women\'s flat sandals with soft strap and padded footbed.',
    details: { Material: 'PU', Style: 'Flat sandal' }, sizes: ['EU36', 'EU37', 'EU38', 'EU39', 'EU40'] });
  console.log('✅ Expanded FMK catalog');

  // ─── Products: Algazaru Abayas ───────────────────────────────────────────
  if ((await prisma.product.count({ where: { vendorId: algazaruAbayas.id } })) === 0) {
    await createProduct({
      vendorId: algazaruAbayas.id, title: 'Embroidered Abaya',       category: 'Clothing & Fashion', subcategory: 'Women',
      images: ['https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp'],
      price: 16000, description: 'Elegant embroidered abaya with soft flowing fabric, lightly lined.',
      details: { Material: 'Nida fabric', Occasion: 'Everyday, Prayer, Events' },
      colors: [COLORS.black, COLORS.brown], sizes: ['S', 'M', 'L', 'XL'],
    });
    await createProduct({
      vendorId: algazaruAbayas.id, title: 'Printed Hijab Set (3-Pack)',       category: 'Clothing & Fashion', subcategory: 'Women',
      images: ['https://cdn.dummyjson.com/product-images/womens-bags/black-handbag/thumbnail.webp'],
      price: 7500, description: 'Set of 3 lightweight printed hijabs, soft chiffon finish.',
      details: { Material: 'Chiffon' },
      colors: [COLORS.black, COLORS.gold, COLORS.green],
    });
    console.log('✅ Seeded 2 products on Algazaru Abayas');
  }
  const algazaruProducts = await prisma.product.findMany({ where: { vendorId: algazaruAbayas.id } });
  await seedVendorReviews(algazaruAbayas, algazaruProducts, [
    { name: 'Zainab U.', rating: 5, timeAgo: '5 days ago', comment: 'Beautiful abaya, exactly as pictured.' },
    { name: 'Hadiza B.', rating: 4, timeAgo: '2 months ago', comment: 'Good quality, delivery took a bit long.' },
  ]);
  await seedShopHighlights(algazaruAbayas, algazaruProducts, [
    {
      name: 'Modest Wear', sortOrder: 0,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp', caption: 'Embroidered abayas in soft Nida fabric', productIds: [0] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/womens-bags/black-handbag/thumbnail.webp', caption: 'Printed hijab sets - 3 packs', productIds: [1] },
      ],
    },
    {
      name: 'New In', sortOrder: 1,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/womens-bags/black-handbag/thumbnail.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/womens-bags/black-handbag/thumbnail.webp', caption: 'Fresh chiffon hijabs just arrived', productIds: [1] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp', caption: 'Everyday abayas restocked', productIds: [0] },
      ],
    },
  ]);
  // Algazaru's canonical tiles: Abaya (custom), Jalabiya (CF sub),
  // Travelling bags (Bags sub), Bedsheets (Home & Kitchen sub).
  await ensureCustomProduct({ vendorId: algazaruAbayas.id, categoryName: 'Abaya', title: 'Classic Black Abaya', images: ['https://placehold.co/600x600/111/fff?text=Black+Abaya'],
    price: 16500, description: 'Essential everyday black abaya in soft flowing Nida, lightly lined and modest by design.',
    details: { Material: 'Nida fabric', Occasion: 'Everyday, Prayer' }, colors: [COLORS.black], sizes: ['S', 'M', 'L', 'XL'] });
  await ensureCustomProduct({ vendorId: algazaruAbayas.id, categoryName: 'Abaya', title: 'Embroidered Cuff Abaya', images: ['https://placehold.co/600x600/0f172a/fff?text=Embroidered+Abaya'],
    price: 23500, description: 'Elegant abaya with fine embroidery on the cuffs and hem, made for events and Eid.',
    details: { Material: 'Crepe Nida', Embellishment: 'Hand-embroidery' }, colors: [COLORS.black, COLORS.gold], sizes: ['S', 'M', 'L'] });
  await ensureCustomProduct({ vendorId: algazaruAbayas.id, categoryName: 'Abaya', title: 'Khaki Modest Abaya', images: ['https://placehold.co/600x600/556B2F/fff?text=Khaki+Abaya'],
    price: 19000, description: 'Relaxed-fit khaki abaya with side pockets and a clean minimal cut.',
    details: { Material: 'Cotton blend', Fit: 'Relaxed' }, colors: [COLORS.brown, COLORS.green], sizes: ['S', 'M', 'L', 'XL'] });
  await ensureCustomProduct({ vendorId: algazaruAbayas.id, categoryName: 'Abaya', title: 'Two-Tone Eid Abaya', images: ['https://placehold.co/600x600/7C3AED/fff?text=Eid+Abaya'],
    price: 29000, description: 'Statement two-tone abaya with a tasteful colour-block design for festive occasions.',
    details: { Material: 'Nida', Occasion: 'Eid, Weddings' }, colors: [COLORS.gold, COLORS.black, COLORS.green], sizes: ['M', 'L', 'XL'] });
  await ensureProduct({ vendorId: algazaruAbayas.id, title: 'Jalabiya with Embroidery', category: 'Clothing & Fashion', subcategory: 'Jalabiya',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Jalabiya'],
    price: 21000, description: 'Flowing jalabiya robe with delicate neckline embroidery, breathable cotton blend.',
    details: { Material: 'Cotton blend', Style: 'Jalabiya' }, colors: [COLORS.white, COLORS.blue, COLORS.green], sizes: ['S', 'M', 'L', 'XL'] });
  await ensureProduct({ vendorId: algazaruAbayas.id, title: 'Premium Jalabiya - Party', category: 'Clothing & Fashion', subcategory: 'Jalabiya',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Party+Jalabiya'],
    price: 28000, description: 'Elevated jalabiya for gatherings with subtle sheen and a fitted flowing cut.',
    details: { Material: 'Crepe', Occasion: 'Party, Gathering' }, colors: [COLORS.red, COLORS.gold, COLORS.black], sizes: ['M', 'L', 'XL'] });
  await ensureProduct({ vendorId: algazaruAbayas.id, title: 'Weekender Travel Duffle', category: 'Bags', subcategory: 'Travelling Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Travel+Duffle'],
    price: 21000, description: 'Large weekender duffle with padded handles and a durable water-resistant shell.',
    details: { Material: 'Oxford + PU', Capacity: '45L' }, colors: [COLORS.black, COLORS.brown] });
  await ensureProduct({ vendorId: algazaruAbayas.id, title: 'Hard-Shell Carry-On (20")', category: 'Bags', subcategory: 'Travelling Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Carry-On'],
    price: 54000, description: '20-inch hard-shell carry-on case with smooth 360° spinner wheels and TSA lock.',
    details: { Material: 'ABS', Capacity: '37L' }, colors: [COLORS.black, COLORS.blue, COLORS.red] });
  await ensureProduct({ vendorId: algazaruAbayas.id, title: 'Fitted Cotton Bedsheet', category: 'Home & Kitchen', subcategory: 'Bedsheets',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Bedsheet'],
    price: 18500, description: 'Deep-pocket fitted cotton bedsheet, soft thread count with an all-round elastic.',
    details: { Material: '100% cotton', Size: 'King' }, colors: [COLORS.white, COLORS.blue, COLORS.green] });
  await ensureProduct({ vendorId: algazaruAbayas.id, title: 'Printed Bedsheet Set (2-Pack)', category: 'Home & Kitchen', subcategory: 'Bedsheets',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Bedsheet+Set'],
    price: 24000, description: 'Two patterned microfibre bedsheets with pillowcases, soft and easy to wash.',
    details: { Material: 'Microfibre', Pack: '2 sheets', Size: 'Queen' }, colors: [COLORS.gold, COLORS.brown, COLORS.green] });
  console.log('✅ Expanded Algazaru catalog');

  // ─── Products: Mudatex ───────────────────────────────────────────────────
  if ((await prisma.product.count({ where: { vendorId: mudatex.id } })) === 0) {
    await createProduct({
      vendorId: mudatex.id, title: 'Ankara Print Shirt',       category: 'Clothing & Fashion', subcategory: 'Men',
      images: ['https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp'],
      price: 12500, description: 'Bold Ankara print shirt, long sleeve, tailored fit.',
      details: { Material: 'Ankara (African Wax Print)', Style: 'Long Sleeve' },
      colors: [COLORS.gold, COLORS.black], sizes: ['S', 'M', 'L', 'XL'],
    });
    await createProduct({
      vendorId: mudatex.id, title: 'Senator Wear',       category: 'Clothing & Fashion', subcategory: 'Men',
      images: ['https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/3.webp'],
      price: 20000, description: 'Classic senator wear, sharp tailoring for formal and traditional occasions.',
      details: { Material: 'Cashmere blend', Style: 'Senator' },
      colors: [COLORS.white, COLORS.black, COLORS.brown], sizes: ['M', 'L', 'XL', 'XXL'],
    });
    await createProduct({
      vendorId: mudatex.id, title: 'Leather Belt',       category: 'Clothing & Fashion', subcategory: 'Men',
      images: ['https://cdn.dummyjson.com/product-images/womens-bags/black-handbag/1.webp'],
      price: 6000, description: 'Genuine leather belt with a classic buckle.',
      details: { Material: 'Genuine leather' },
      colors: [COLORS.brown, COLORS.black],
    });
    console.log('✅ Seeded 3 products on Mudatex');
  }
  const mudatexProducts = await prisma.product.findMany({ where: { vendorId: mudatex.id } });
  await seedVendorReviews(mudatex, mudatexProducts, [
    { name: 'Grace O.', rating: 5, timeAgo: '1 week ago', comment: 'Fabric quality is top notch, will order again.' },
    { name: 'Chidi N.', rating: 4, timeAgo: '3 weeks ago', comment: 'Good prices for the quality.' },
  ]);
  await seedShopHighlights(mudatex, mudatexProducts, [
    {
      name: 'Fabrics & Ankara', sortOrder: 0,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp', caption: 'Ankara print shirts, long sleeve', productIds: [0] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/womens-bags/black-handbag/1.webp', caption: 'Genuine leather belts', productIds: [2] },
      ],
    },
    {
      name: 'Senator & More', sortOrder: 1,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/3.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/3.webp', caption: 'Classic senator wear, sharp tailoring', productIds: [1] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp', caption: 'Bold prints restocked', productIds: [0] },
      ],
    },
  ]);
  // Mudatex's canonical tiles: Perfume & cosmetics (custom), Kitchenware/
  // Bedsheets (Home & Kitchen subs), Furnitures -> global Furniture, Bag/Bags ->
  // global Bags, Shoes -> global Shoes, Atamfa/Shadda/Lace (Fabric & Textile
  // subs), Veil (CF sub).
  await ensureCustomProduct({ vendorId: mudatex.id, categoryName: 'Perfume & cosmetics', title: 'Premium Oud Perfume (50ml)', images: ['https://placehold.co/600x600/7C3AED/fff?text=Oud+Perfume'],
    price: 32000, description: 'Rich woody oud perfume with warm amber and musk notes, long-lasting projection.',
    details: { Type: 'EDP', Size: '50ml', Notes: 'Oud, amber, musk' }, colors: [COLORS.black] });
  await ensureCustomProduct({ vendorId: mudatex.id, categoryName: 'Perfume & cosmetics', title: 'Eau De Parfum Set (3-Box)', images: ['https://placehold.co/600x600/7C3AED/fff?text=Perfume+Set'],
    price: 28500, description: 'Curated set of three eau de parfum bottles for varied moods - floral, fruity and woody.',
    details: { Pack: '3 x 30ml', Notes: 'Floral, fruity, woody' }, colors: [COLORS.gold, COLORS.red, COLORS.blue] });
  await ensureCustomProduct({ vendorId: mudatex.id, categoryName: 'Perfume & cosmetics', title: 'Rose & Musk Roll-On (30ml)', images: ['https://placehold.co/600x600/7C3AED/fff?text=Rose+Musk'],
    price: 14500, description: 'Gentle rose and musk roll-on perfume oil, perfect for daily wear.',
    details: { Type: 'Oil', Size: '30ml', Notes: 'Rose, musk' }, colors: [COLORS.red, COLORS.white] });
  await ensureProduct({ vendorId: mudatex.id, title: '2-Side Rolling Kitchen Rack', category: 'Home & Kitchen', subcategory: 'Kitchenware',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Kitchen+Rack'],
    price: 26000, description: 'Multi-tier rolling kitchen rack for pots, pans and utensils, stable steel frame.',
    details: { Material: 'Steel', Tiers: '2' }, colors: [COLORS.black, COLORS.white] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Stainless Cooking Pot Set (5-Piece)', category: 'Home & Kitchen', subcategory: 'Kitchenware',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Pot+Set'],
    price: 48000, description: 'Five-piece stainless steel cookware set with tight-fitting tempered glass lids.',
    details: { Material: 'Stainless steel', Pack: '5 pieces' }, colors: [COLORS.black, COLORS.gold] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Non-Stick Frying Pans (3-Pack)', category: 'Home & Kitchen', subcategory: 'Kitchenware',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Frying+Pans'],
    price: 18000, description: 'Set of three non-stick frying pans in varied sizes with even heat distribution.',
    details: { Material: 'Aluminium + non-stick', Pack: '3 sizes' }, colors: [COLORS.black, COLORS.red] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Premium Ankara Atamfa (6 Yards)', category: 'Fabric & Textile', subcategory: 'Atamfa',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Ankara+Atamfa'],
    price: 38000, description: 'Trade-grade Ankara atamfa with crisp wax print - perfect for tailors and volume buyers.',
    details: { Type: 'Atamfa', Length: '6 yards', Material: 'Cotton wax' }, colors: [COLORS.gold, COLORS.green, COLORS.red] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Shadda Super (5 Yards)', category: 'Fabric & Textile', subcategory: 'Shadda',
    images: ['https://placehold.co/600x600/065F46/fff?text=Shadda+Super'],
    price: 26500, description: 'Premium shadda super in rich ceremonial tones, soft to the touch.',
    details: { Type: 'Shadda', Length: '5 yards' }, colors: [COLORS.brown, COLORS.green, COLORS.gold] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Guipure Lace (6 Yards)', category: 'Fabric & Textile', subcategory: 'Lace',
    images: ['https://placehold.co/600x600/9A3412/fff?text=Guipure+Lace'],
    price: 75000, description: 'Structured guipure lace with raised floral motifs for couture and special-occasion wear.',
    details: { Type: 'Lace', Length: '6 yards' }, colors: [COLORS.white, COLORS.gold, COLORS.red] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Brocade & Chiffon Veil Set', category: 'Clothing & Fashion', subcategory: 'Veil',
    images: ['https://placehold.co/600x600/DB2777/fff?text=Veil+Set'],
    price: 12000, description: 'Two-piece brocade and chiffon veil set with patterned borders.',
    details: { Material: 'Chiffon + brocade', Pack: '2' }, colors: [COLORS.gold, COLORS.black, COLORS.green] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Wooden Dining Bench', category: 'Chair', subcategory: 'Dining Chair',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Dining+Bench'],
    price: 24000, description: 'Solid wood dining bench that seats two, a space-saving addition to the dining area.',
    details: { Material: 'Rubberwood', Seats: '2' }, colors: [COLORS.brown, COLORS.black] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Bathroom Storage Cabinet', category: 'Wardrobe', subcategory: '2-Door',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Storage+Cabinet'],
    price: 36500, description: 'Tall slim storage cabinet with shelves and a compact footprint for tight spaces.',
    details: { Material: 'MDF + veneer', Shelves: '3' }, colors: [COLORS.white, COLORS.brown] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Structured Tote Handbag', category: 'Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Tote'],
    price: 15500, description: 'Structured everyday tote with magnetic closure and roomy interior.',
    details: { Material: 'PU leather', Closure: 'Magnetic' }, colors: [COLORS.black, COLORS.brown, COLORS.blue] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Crossbody Sling Bag', category: 'Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Sling+Bag'],
    price: 9800, description: 'Compact crossbody sling bag with adjustable strap and multiple compartments.',
    details: { Material: 'Nylon + PU', Straps: 'Adjustable' }, colors: [COLORS.black, COLORS.green, COLORS.gold] });
  await ensureProduct({ vendorId: mudatex.id, title: 'Men\'s Casual Sneakers', category: 'Shoes', subcategory: 'Men',
    images: ['https://placehold.co/600x600/A16207/fff?text=Sneakers'],
    price: 22000, description: 'Comfortable fresh sneakers with cushioned sole and breathable upper.',
    details: { Material: 'Mesh + PU', Style: 'Sneaker' }, sizes: ['EU40', 'EU41', 'EU42', 'EU43', 'EU44'] });
  console.log('✅ Expanded Mudatex catalog');

  // ─── Products: Sarkin Mota Autos (vehicles - one product per brand card) ─
  if ((await prisma.product.count({ where: { vendorId: sarkinMotaAutos.id } })) === 0) {
    await createProduct({ vendorId: sarkinMotaAutos.id, title: 'Toyota Camry 2015', category: 'Toyota', subcategory: 'Sedans',
      images: ['https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp'],
      price: 9800000, description: 'Clean Toyota Camry 2015, foreign used, full option, accident-free.',
      details: { Make: 'Toyota', Model: 'Camry', Year: '2015', Mileage: '62,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });
    await createProduct({ vendorId: sarkinMotaAutos.id, title: 'Dodge Charger SXT', category: 'Dodge', subcategory: 'Muscle Cars',
      images: ['https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp'],
      price: 14500000, description: 'Sporty Dodge Charger SXT, low mileage, well maintained.',
      details: { Make: 'Dodge', Model: 'Charger SXT', Year: '2018', Mileage: '38,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });
    const VIMAGE = {
      hyundai: 'https://cdn.dummyjson.com/product-images/vehicle/tucson/thumbnail.webp',
      byd: 'https://cdn.dummyjson.com/product-images/vehicle/seal/thumbnail.webp',
      honda: 'https://cdn.dummyjson.com/product-images/vehicle/civic/thumbnail.webp',
      kia: 'https://cdn.dummyjson.com/product-images/vehicle/sportage/thumbnail.webp',
    };
    await createProduct({ vendorId: sarkinMotaAutos.id, title: 'Hyundai Tucson 2021', category: 'Hyundai', subcategory: 'SUVs', images: [VIMAGE.hyundai], price: 16500000, description: 'Mid-size Hyundai Tucson SUV, clean interior and full service history.', details: { Make: 'Hyundai', Model: 'Tucson', Year: '2021', Mileage: '28,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });
    await createProduct({ vendorId: sarkinMotaAutos.id, title: 'BYD Seal (Electric)', category: 'BYD', subcategory: 'Electric', images: [VIMAGE.byd], price: 28500000, description: 'All-electric BYD Seal sedan, long range and fast charging.', details: { Make: 'BYD', Model: 'Seal', Year: '2023', Range: '570 km', Drive: 'Electric', Condition: 'New' } });
    await createProduct({ vendorId: sarkinMotaAutos.id, title: 'Honda Civic 2020', category: 'Honda', subcategory: 'Sedans', images: [VIMAGE.honda], price: 12500000, description: 'Well-kept Honda Civic sedan, economical and reliable.', details: { Make: 'Honda', Model: 'Civic', Year: '2020', Mileage: '41,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });
    await createProduct({ vendorId: sarkinMotaAutos.id, title: 'Kia Sportage 2022', category: 'Kia', subcategory: 'SUVs', images: [VIMAGE.kia], price: 17500000, description: 'Compact Kia Sportage SUV with a roomy, modern cabin.', details: { Make: 'Kia', Model: 'Sportage', Year: '2022', Mileage: '19,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });
    console.log('✅ Seeded brand products on Sarkin Mota Autos');
  }
  const sarkinProducts = await prisma.product.findMany({ where: { vendorId: sarkinMotaAutos.id } });
  await seedVendorReviews(sarkinMotaAutos, sarkinProducts, [
    { name: 'Tunde A.', rating: 5, timeAgo: '4 days ago', comment: 'Car was exactly as described, smooth transaction.' },
    { name: 'Emeka I.', rating: 5, timeAgo: '2 weeks ago', comment: 'Trusted dealer, no hidden issues.' },
  ]);
  await seedShopHighlights(sarkinMotaAutos, sarkinProducts, [
    {
      name: 'Current Stock', sortOrder: 0,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp', caption: 'Toyota Camry 2015 - full option', productIds: [0] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp', caption: 'Dodge Charger SXT, low mileage', productIds: [1] },
      ],
    },
    {
      name: 'Just Landed', sortOrder: 1,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp', caption: 'Sporty charger freshly cleared', productIds: [1] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp', caption: 'Camry for immediate pickup', productIds: [0] },
      ],
    },
  ]);

  // ─── Products: Wasse Investments (clothing & fashion) ────────────────
  if ((await prisma.product.count({ where: { vendorId: wasseInvestments.id } })) === 0) {
    await createProduct({
      vendorId: wasseInvestments.id, title: 'Premium Wasse Fabric (6 Yards)', category: 'Clothing & Fashion', subcategory: 'Women',
      images: ['https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=800&q=70'],
      price: 45000, description: 'High-quality premium wasse fabric, rich in texture and colour for traditional and modern tailoring.',
      details: { Type: 'Wasse', Length: '6 yards', Material: 'Cotton' },
    });
    await createProduct({
      vendorId: wasseInvestments.id, title: 'Embroidered Lace & Veil Set', category: 'Clothing & Fashion', subcategory: 'Veil',
      images: ['https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=70'],
      price: 38000, description: 'Delicate embroidered lace and chiffon veil set for special occasion outfits.',
      details: { Type: 'Lace/Veil', Material: 'Chiffon & lace' },
    });
    await createProduct({
      vendorId: wasseInvestments.id, title: 'Voile Hijab & Scarves Pack', category: 'Clothing & Fashion', subcategory: 'Accessories',
      images: ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=70'],
      price: 12500, description: 'Soft lightweight voile hijabs and scarves - breathable and perfect for everyday wear.',
      details: { Type: 'Voile', Pack: '3-piece set' },
    });
    await createProduct({
      vendorId: wasseInvestments.id, title: "Men's Atamfa Studio Set", category: 'Clothing & Fashion', subcategory: 'Men',
      images: ['https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=800&q=70'],
      price: 32000, description: 'Classic atamfa fabric with a rich sheen - the staple of elegant traditional dressing.',
      details: { Type: 'Atamfa', Length: '6 yards' },
    });
    console.log('✅ Seeded 4 products on Wasse Investments');
  }
  const wasseProducts = await prisma.product.findMany({ where: { vendorId: wasseInvestments.id } });
  await seedVendorReviews(wasseInvestments, wasseProducts, [
    { name: 'Amina K.', rating: 5, timeAgo: '2 weeks ago', comment: 'Authentic wasse, exactly as described. Delivery was quick.' },
    { name: 'Zainab B.', rating: 5, timeAgo: '1 month ago', comment: 'Best fabric prices in town, and the quality speaks for itself.' },
    { name: 'Halima S.', rating: 4, timeAgo: '2 months ago', comment: 'Nice selection of lace and voile. Would buy again.' },
  ]);
  await seedShopHighlights(wasseInvestments, wasseProducts, [
    {
      name: 'Wasse & Lace', sortOrder: 0,
      coverImageUrl: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=600&q=70', caption: 'Premium wasse, 6 yards', productIds: [0] },
        { imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=70', caption: 'Lace & veil for the big day', productIds: [1] },
      ],
    },
    {
      name: 'Tailoring Favourites', sortOrder: 1,
      coverImageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=70', caption: 'Voile hijabs & scarves', productIds: [2] },
        { imageUrl: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=600&q=70', caption: "Men's atamfa sets", productIds: [3] },
      ],
    },
  ]);
  // Wasse's canonical tiles map to Fabric & Textile subs (Atamfa/Shadda/Lace/
  // Voile/Yard), Clothing & Fashion Cap, Shoes and Bags - all global.
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Royal Atamfa Brocade (6 Yards)', category: 'Fabric & Textile', subcategory: 'Atamfa',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Royal+Atamfa'],
    price: 47000, description: 'Royal atamfa brocade with an embossed weave, ideal for agbadas and inauguration wear.',
    details: { Type: 'Atamfa', Length: '6 yards', Weave: 'Brocade' }, colors: [COLORS.gold, COLORS.black, COLORS.green] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Classic Atamfa (6 Yards)', category: 'Fabric & Textile', subcategory: 'Atamfa',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Classic+Atamfa'],
    price: 39000, description: 'Classic atamfa with a signature smooth sheen and firm hand for structured outfits.',
    details: { Type: 'Atamfa', Length: '6 yards' }, colors: [COLORS.black, COLORS.brown, COLORS.blue] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Embroidered Shadda (6 Yards)', category: 'Fabric & Textile', subcategory: 'Shadda',
    images: ['https://placehold.co/600x600/065F46/fff?text=Embroidered+Shadda'],
    price: 29000, description: 'Shadda with delicate edge embroidery, a festive favourite for wrappers and boubous.',
    details: { Type: 'Shadda', Length: '6 yards', Embellishment: 'Embroidery' }, colors: [COLORS.red, COLORS.green, COLORS.gold] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Premium Guipure Lace (5 Yards)', category: 'Fabric & Textile', subcategory: 'Lace',
    images: ['https://placehold.co/600x600/9A3412/fff?text=Guipure+Lace'],
    price: 69000, description: 'Structured guipure lace with bold florals, striking for gowns and cocktail wear.',
    details: { Type: 'Lace', Length: '5 yards' }, colors: [COLORS.white, COLORS.gold, COLORS.red] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Voile Fabric Roll (5 Yards)', category: 'Fabric & Textile', subcategory: 'Voile',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Voile+Roll'],
    price: 14500, description: 'Fine cotton voile roll, breathable and soft - great for shirts, blouses and linings.',
    details: { Type: 'Voile', Length: '5 yards' }, colors: [COLORS.white, COLORS.blue, COLORS.green] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Luxury Brocade Yard (Per Yard)', category: 'Fabric & Textile', subcategory: 'Yard',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Brocade+Yard'],
    price: 9500, description: 'Premium brocade sold by the yard - buy exactly what your tailoring needs.',
    details: { Sold: 'Per yard', Material: 'Brocade' }, colors: [COLORS.gold, COLORS.red, COLORS.green] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Classic Kufi Cap', category: 'Clothing & Fashion', subcategory: 'Cap',
    images: ['https://placehold.co/600x600/DB2777/fff?text=Kufi+Cap'],
    price: 4500, description: 'Classic men\'s kufi cap in soft woven cotton, comfortable everyday wear.',
    details: { Material: 'Cotton', Fit: 'One size' }, colors: [COLORS.black, COLORS.white, COLORS.brown] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Embroidered Fila Cap', category: 'Clothing & Fashion', subcategory: 'Cap',
    images: ['https://placehold.co/600x600/DB2777/fff?text=Fila+Cap'],
    price: 7000, description: 'Traditional fila cap with fine embroidery, a polished finish for parties.',
    details: { Material: 'Cotton blend', Embellishment: 'Embroidery' }, colors: [COLORS.gold, COLORS.green, COLORS.black] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Men\'s Loafers - Brown', category: 'Shoes', subcategory: 'Men',
    images: ['https://placehold.co/600x600/A16207/fff?text=Loafers'],
    price: 24000, description: 'Men\'s leather-look loafers with a low heel and roomy square toe.',
    details: { Material: 'Faux leather', Style: 'Loafer' }, sizes: ['EU41', 'EU42', 'EU43', 'EU44'] });
  await ensureProduct({ vendorId: wasseInvestments.id, title: 'Canvas Tote Shopping Bag', category: 'Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Canvas+Tote'],
    price: 8000, description: 'Durable canvas tote with reinforced handles for shopping and everyday errands.',
    details: { Material: 'Canvas', Capacity: 'Large' }, colors: [COLORS.white, COLORS.black, COLORS.green] });
  console.log('✅ Expanded Wasse catalog');

  // ─── Products: Elite Cycle Construction (real estate - listing-type cards) ──
  if ((await prisma.product.count({ where: { vendorId: eliteCycleConstruction.id } })) === 0) {
    await createProduct({ vendorId: eliteCycleConstruction.id, title: 'Two-Storey Duplex - Jabi', category: 'House', subcategory: 'Duplex',
      images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70'],
      price: 95000000, description: 'Brand-new two-storey duplex in a quiet Jabi estate, finished to a high standard.',
      details: { Type: 'Duplex', Bedrooms: '4', Location: 'Jabi, Abuja', Title: 'C of O', Status: 'Available' } });
    await createProduct({ vendorId: eliteCycleConstruction.id, title: 'Land - 400 sqm, Idu', category: 'Land', subcategory: 'Commercial Plot',
      images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70'],
      price: 26000000, description: '400 sqm dry land in the Idu industrial area, perfect for development.',
      details: { Type: 'Land', Size: '400 sqm', Location: 'Idu, Abuja', Title: 'R of O', Status: 'Available' } });
    await createProduct({ vendorId: eliteCycleConstruction.id, title: 'Residential Plot - Katampe', category: 'Land', subcategory: 'Residential Plot',
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=70'],
      price: 18000000, description: 'Residential plot in the fast-growing Katampe district, close to new roads.',
      details: { Type: 'Plot', Size: '300 sqm', Location: 'Katampe, Abuja', Title: 'R of O', Status: 'Available' } });
    await createProduct({ vendorId: eliteCycleConstruction.id, title: 'Detached 5-Bedroom House - Kado', category: 'House', subcategory: 'Detached',
      images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70'],
      price: 185000000, description: 'Detached 5-bedroom family house with a garden and fitted kitchen.',
      details: { Type: 'Detached', Bedrooms: '5', Location: 'Kado, Abuja', Title: 'C of O', Status: 'Available' } });
    await createProduct({ vendorId: eliteCycleConstruction.id, title: 'Commercial Plot - Guzape', category: 'Land', subcategory: 'Commercial Plot',
      images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70'],
      price: 42000000, description: 'Commercial plot along a busy road in Guzape for retail or offices.',
      details: { Type: 'Plot', Size: '450 sqm', Location: 'Guzape, Abuja', Title: 'R of O', Status: 'Available' } });
    await createProduct({ vendorId: eliteCycleConstruction.id, title: 'Retail Shop - Wuse Market', category: 'Shop', subcategory: 'Retail Shop',
      images: ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=70'],
      price: 65000000, description: 'Prime retail shop within Wuse Market for sale.',
      details: { Type: 'Shop', Size: '35 sqm', Location: 'Wuse, Abuja', Title: 'Certified', Status: 'Available' } });
    console.log('✅ Seeded real-estate listing products on Elite Cycle Construction');
  }
  const eliteProducts = await prisma.product.findMany({ where: { vendorId: eliteCycleConstruction.id } });
  await seedVendorReviews(eliteCycleConstruction, eliteProducts, [
    { name: 'Ibrahim M.', rating: 5, timeAgo: '3 weeks ago', comment: 'Transparent process and genuine documents.' },
    { name: 'Grace O.', rating: 4, timeAgo: '1 month ago', comment: 'Built house delivered on schedule, minor finish issues.' },
    { name: 'Yusuf A.', rating: 5, timeAgo: '2 months ago', comment: 'Great construction quality, highly recommended.' },
  ]);
  await seedShopHighlights(eliteCycleConstruction, eliteProducts, [
    {
      name: 'Properties', sortOrder: 0,
      coverImageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=70', caption: 'Two-storey duplex, Jabi', productIds: [0] },
        { imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=70', caption: 'Dry land, Idu', productIds: [1] },
      ],
    },
    {
      name: 'Plots & Land', sortOrder: 1,
      coverImageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=70', caption: 'Residential plot, Katampe', productIds: [2] },
        { imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=70', caption: 'Ready-to-move-in duplex', productIds: [0] },
      ],
    },
  ]);

  // ─── Products: Danmama Smart Homes (real estate - listing cards + custom) ──
  if ((await prisma.product.count({ where: { vendorId: danmamaSmartHomes.id } })) === 0) {
    await createProduct({ vendorId: danmamaSmartHomes.id, title: 'Smart-Fitted 3-Bedroom House - Maitama', category: 'House', subcategory: 'Detached',
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=70'],
      price: 120000000, description: 'Fully smart-fitted 3-bedroom house with automated lighting, security and climate control.',
      details: { Type: 'House', Bedrooms: '3', Location: 'Maitama, Abuja', Smart: 'Automated lighting & security', Title: 'C of O', Status: 'Available' } });
    await createProduct({ vendorId: danmamaSmartHomes.id, title: '2-Bedroom Smart Apartment - Gwarinpa', category: 'Apartment', subcategory: '2-Bedroom',
      images: ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=70'],
      price: 55000000, description: 'Modern 2-bedroom smart apartment in Gwarinpa with home automation and backup power.',
      details: { Type: 'Apartment', Bedrooms: '2', Location: 'Gwarinpa, Abuja', Smart: 'Home automation', Title: 'C of O', Status: 'Available' } });
    await createProduct({ vendorId: danmamaSmartHomes.id, title: 'Land - 600 sqm, Lokogoma', category: 'Land', subcategory: 'Residential Plot',
      images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70'],
      price: 40000000, description: '600 sqm prime land in Lokogoma, ideal for a smart home build.',
      details: { Type: 'Land', Size: '600 sqm', Location: 'Lokogoma, Abuja', Title: 'R of O', Status: 'Available' } });
    await createProduct({ vendorId: danmamaSmartHomes.id, title: 'Studio Smart Apartment - Jahi', category: 'Apartment', subcategory: 'Studio',
      images: ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=70'],
      price: 38000000, description: 'Smart-fitted studio apartment with automation and backup power.',
      details: { Type: 'Apartment', Size: 'Studio', Location: 'Jahi, Abuja', Smart: 'Home automation', Status: 'Available' } });
    await createProduct({ vendorId: danmamaSmartHomes.id, title: 'Self Contain - Lugbe', category: 'Self Contain', subcategory: 'Single Room',
      images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=70'],
      price: 6500000, description: 'Self-contained single room with private bathroom and kitchen.',
      details: { Type: 'Self Contain', Rooms: 'Single', Location: 'Lugbe, Abuja', Status: 'Available' } });
    await ensureCustomProduct({ vendorId: danmamaSmartHomes.id, categoryName: 'Smart Homes', title: 'Smart Security Bundle',
      images: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=70'], price: 2500000,
      description: 'Home security bundle - smart locks, cameras and a video doorbell for your smart home.',
      details: { Type: 'Security', Includes: 'Smart lock, camera, doorbell' } });
    console.log('✅ Seeded real-estate listing + smart products on Danmama Smart Homes');
  }
  const danmamaProducts = await prisma.product.findMany({ where: { vendorId: danmamaSmartHomes.id } });
  await seedVendorReviews(danmamaSmartHomes, danmamaProducts, [
    { name: 'Ngozi C.', rating: 5, timeAgo: '1 week ago', comment: 'Lovely smart home experience - the automation is seamless.' },
    { name: 'Tunde B.', rating: 5, timeAgo: '3 weeks ago', comment: 'Top-tier apartments with reliable backup power.' },
    { name: 'Hadiza R.', rating: 4, timeAgo: '1 month ago', comment: 'Beautiful property, commissioning took a little long.' },
  ]);
  await seedShopHighlights(danmamaSmartHomes, danmamaProducts, [
    {
      name: 'Smart Homes', sortOrder: 0,
      coverImageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=70', caption: 'Smart-fitted 3-bed house, Maitama', productIds: [0] },
        { imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=70', caption: 'Smart apartment, Gwarinpa', productIds: [1] },
      ],
    },
    {
      name: 'Featured Listings', sortOrder: 1,
      coverImageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=70', caption: 'Prime land, Lokogoma', productIds: [2] },
        { imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=70', caption: 'Move-in-ready smart home', productIds: [0] },
      ],
    },
  ]);

  // ─── Products: El samad ───────────────────────────────────────
  if ((await prisma.product.count({ where: { vendorId: elSamad.id } })) === 0) {
    await createProduct({
      vendorId: elSamad.id, title: 'Boubou Gown',       category: 'Clothing & Fashion', subcategory: 'Women',
      images: ['https://cdn.dummyjson.com/product-images/tops/gray-dress/1.webp'],
      price: 13000, description: 'Flowing boubou gown with intricate embroidery, comfortable for all-day wear.',
      details: { Material: 'Cotton blend', Style: 'Boubou' },
      colors: [COLORS.blue, COLORS.white], sizes: ['M', 'L', 'XL'],
    });
    await createProduct({
      vendorId: elSamad.id, title: 'African Print Dress',       category: 'Clothing & Fashion', subcategory: 'Women',
      images: ['https://cdn.dummyjson.com/product-images/tops/blue-frock/3.webp'],
      price: 11000, description: 'Vibrant African print dress, fitted waist with a flared skirt.',
      details: { Material: 'Ankara (African Wax Print)' },
      colors: [COLORS.green, COLORS.gold, COLORS.red], sizes: ['S', 'M', 'L'],
    });
    await createProduct({
      vendorId: elSamad.id, title: 'Kids Ankara Two-Piece',       category: 'Clothing & Fashion', subcategory: 'Kids',
      images: ['https://cdn.dummyjson.com/product-images/tops/gray-dress/2.webp'],
      price: 6500, description: 'Matching Ankara two-piece set for kids, soft and breathable.',
      details: { Material: 'Ankara (African Wax Print)' },
      colors: [COLORS.gold, COLORS.blue], sizes: ['2-3Y', '4-5Y', '6-7Y'],
    });
    console.log('✅ Seeded 3 products on El samad');
  }
  const elSamadProducts = await prisma.product.findMany({ where: { vendorId: elSamad.id } });
  await seedVendorReviews(elSamad, elSamadProducts, [
    { name: 'Aisha M.', rating: 5, timeAgo: '6 days ago', comment: 'Lovely fit and fast reply on chat.' },
    { name: 'Yusuf T.', rating: 4, timeAgo: '1 month ago', comment: 'Solid quality for the price.' },
  ]);
  await seedShopHighlights(elSamad, elSamadProducts, [
    {
      name: 'Latest Looks', sortOrder: 0,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/1.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/1.webp', caption: 'Boubou gown with intricate embroidery', productIds: [0] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/blue-frock/3.webp', caption: 'African print dress, fitted waist', productIds: [1] },
      ],
    },
    {
      name: 'Kids', sortOrder: 1,
      coverImageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/2.webp',
      stories: [
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/2.webp', caption: 'Kids Ankara two-piece sets', productIds: [2] },
        { imageUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/1.webp', caption: 'Family matching styles', productIds: [0] },
      ],
    },
  ]);
  // El samad's canonical tiles: Abaya and gown (custom), Atamfa/Shadda/Lace/
  // Voile (Fabric & Textile subs), Veil (CF sub), Boxes (Bags sub), Shoes and
  // Bag -> global Bags.
  await ensureCustomProduct({ vendorId: elSamad.id, categoryName: 'Abaya and gown', title: 'Printed Kaftan Gown', images: ['https://placehold.co/600x600/7C3AED/fff?text=Kaftan+Gown'],
    price: 14500, description: 'Flowing printed kaftan gown with side slits, comfortable for all-day elegance.',
    details: { Material: 'Cotton blend', Style: 'Kaftan' }, colors: [COLORS.blue, COLORS.gold, COLORS.white], sizes: ['S', 'M', 'L', 'XL'] });
  await ensureCustomProduct({ vendorId: elSamad.id, categoryName: 'Abaya and gown', title: 'Embroidered Gown - Party', images: ['https://placehold.co/600x600/7C3AED/fff?text=Embroidered+Gown'],
    price: 21000, description: 'Embellished gown with fine embroidery for weddings and special occasions.',
    details: { Material: 'Crepe', Embellishment: 'Embroidery' }, colors: [COLORS.gold, COLORS.red, COLORS.black], sizes: ['M', 'L', 'XL'] });
  await ensureCustomProduct({ vendorId: elSamad.id, categoryName: 'Abaya and gown', title: 'Two-Piece Ankara Set', images: ['https://placehold.co/600x600/7C3AED/fff?text=Ankara+Set'],
    price: 16500, description: 'Matching two-piece Ankara set - top and trousers/shirt - for a sharp casual look.',
    details: { Material: 'Ankara (African Wax Print)', Style: 'Two-piece' }, colors: [COLORS.green, COLORS.gold, COLORS.red], sizes: ['S', 'M', 'L', 'XL'] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Premium Atamfa (6 Yards)', category: 'Fabric & Textile', subcategory: 'Atamfa',
    images: ['https://placehold.co/600x600/7C2D12/fff?text=Atamfa'],
    price: 41000, description: 'Premium atamfa fabric with rich sheen for elegant traditional tailoring.',
    details: { Type: 'Atamfa', Length: '6 yards' }, colors: [COLORS.black, COLORS.gold, COLORS.blue] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Shadda Carnival Print (6 Yards)', category: 'Fabric & Textile', subcategory: 'Shadda',
    images: ['https://placehold.co/600x600/065F46/fff?text=Shadda+Print'],
    price: 25000, description: 'Bold carnival-print shadda for festive wrappers and gowns.',
    details: { Type: 'Shadda', Length: '6 yards', Print: 'Carnival' }, colors: [COLORS.red, COLORS.green, COLORS.gold] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Sequined Lace (5 Yards)', category: 'Fabric & Textile', subcategory: 'Lace',
    images: ['https://placehold.co/600x600/9A3412/fff?text=Sequined+Lace'],
    price: 58000, description: 'Sequined lace with glistening detailing for showstopping evening wear.',
    details: { Type: 'Lace', Length: '5 yards', Finish: 'Sequins' }, colors: [COLORS.gold, COLORS.black, COLORS.white] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Voile Blouse Fabric (4 Yards)', category: 'Fabric & Textile', subcategory: 'Voile',
    images: ['https://placehold.co/600x600/0D9488/fff?text=Voile+Blouse'],
    price: 12500, description: 'Light voile ideal for flowing blouses, breathable and soft.',
    details: { Type: 'Voile', Length: '4 yards' }, colors: [COLORS.white, COLORS.blue, COLORS.green] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Chiffon Veil with Border', category: 'Clothing & Fashion', subcategory: 'Veil',
    images: ['https://placehold.co/600x600/DB2777/fff?text=Bordered+Veil'],
    price: 8200, description: 'Chiffon veil with a delicate embroidered border, everyday elegance.',
    details: { Material: 'Chiffon', Style: 'Bordered' }, colors: [COLORS.black, COLORS.gold, COLORS.green] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Decorative Gift Box Set', category: 'Bags', subcategory: 'Boxes',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Gift+Boxes'],
    price: 7200, description: 'Set of decorative rigid boxes for gifting and storage, assorted sizes.',
    details: { Pack: '3 sizes', Use: 'Gifting' }, colors: [COLORS.brown, COLORS.gold] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Men\'s Slip-On Shoes', category: 'Shoes', subcategory: 'Men',
    images: ['https://placehold.co/600x600/A16207/fff?text=Slip-On'],
    price: 20500, description: 'Slip-on shoes with a cushioned sole - easy comfort for casual wear.',
    details: { Material: 'Faux leather', Style: 'Slip-on' }, sizes: ['EU41', 'EU42', 'EU43'] });
  await ensureProduct({ vendorId: elSamad.id, title: 'Tote Shopping Handbag', category: 'Bags',
    images: ['https://placehold.co/600x600/9333EA/fff?text=Tote'],
    price: 11200, description: 'Everyday tote handbag with a wide opening and inner zip pocket.',
    details: { Material: 'PU leather', Pockets: '2' }, colors: [COLORS.black, COLORS.brown] });
  console.log('✅ Expanded El samad catalog');

  // ─── Furniture shops ────────────────────────────────────────────────────────
  // Stock Unsplash imagery - the shop owners will swap in their own branding
  // from the vendor dashboard later.
  const furnitureHouse = await createVendor({
    email: 'furniturehouse@ecommerce.test', phone: '2348012345677',
    categorySlug: 'furniture',
    firstName: 'Furniture', lastName: 'House',
    name: 'Furniture House',
    description: 'Furniture House stocks quality sofas, dining sets and office furniture for the modern home and workplace, delivered across the city.',
    address: 'Kaduna, Nigeria', lat: 10.5105, lng: 7.4165, averageRating: 4.7,
    logoUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop&q=70',
    coverImageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&q=70',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&q=70',
      'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=500&q=70',
    ],
    policies: {
      shipping: 'City-wide delivery within 48 hours',
      returns: 'Exchanges accepted (5 days)',
      payment: 'Pay on delivery or bank transfer',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${furnitureHouse.name} (Furniture, APPROVED)`);

  if ((await prisma.product.count({ where: { vendorId: furnitureHouse.id } })) === 0) {
    await createProduct({
      vendorId: furnitureHouse.id, title: 'Velvet Accent Sofa', category: 'Sofa', subcategory: 'Fabric Sofa',
      images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=70'],
      price: 185000, description: 'Plush three-seater velvet sofa with a solid hardwood frame and detachable cushion covers.',
      details: { Material: 'Velvet + hardwood', Seats: '3', Style: 'Modern' },
      colors: [COLORS.black, COLORS.green, COLORS.brown],
    });
    await createProduct({
      vendorId: furnitureHouse.id, title: 'Oak Dining Table Set (6 Chairs)', category: 'Dining Table', subcategory: '6-Seater',
      images: ['https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&q=70'],
      price: 245000, description: 'Solid oak dining table with six upholstered chairs - seats the whole family comfortably.',
      details: { Material: 'Solid oak', Seats: '6', Finish: 'Natural' },
      colors: [COLORS.brown, COLORS.black],
    });
    await createProduct({
      vendorId: furnitureHouse.id, title: 'Ergonomic Office Chair', category: 'Chair', subcategory: 'Office Chair',
      images: ['https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=70'],
      price: 65000, description: 'Breathable mesh ergonomic chair with lumbar support and adjustable height and recline.',
      details: { Material: 'Mesh + aluminium', Support: 'Lumbar', Adjustment: 'Height, recline' },
      colors: [COLORS.black],
    });
    console.log('✅ Seeded 3 products on Furniture House');
  }
  const furnitureHouseProducts = await prisma.product.findMany({ where: { vendorId: furnitureHouse.id } });
  await seedVendorReviews(furnitureHouse, furnitureHouseProducts, [
    { name: 'Bello H.', rating: 5, timeAgo: '1 week ago', comment: 'Sofa is stunning and delivery was on time.' },
    { name: 'Ngozi P.', rating: 4, timeAgo: '3 weeks ago', comment: 'Good quality furniture, fair prices.' },
  ]);
  await seedShopHighlights(furnitureHouse, furnitureHouseProducts, [
    {
      name: 'New Arrivals', sortOrder: 0,
      coverImageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=70', caption: 'Velvet accent sofa just landed', productIds: [0] },
        { imageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&q=70', caption: 'Oak dining set for the family', productIds: [1] },
      ],
    },
    {
      name: 'Workspace', sortOrder: 1,
      coverImageUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=70', caption: 'Ergonomic office chairs in stock', productIds: [2] },
        { imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=70', caption: 'Living room refresh ideas', productIds: [0] },
      ],
    },
  ]);

  const vavaFurniture = await createVendor({
    email: 'vavafurniture@ecommerce.test', phone: '2348012345678',
    categorySlug: 'furniture',
    firstName: 'VAVA', lastName: 'Furniture',
    name: 'VAVA Furniture',
    description: 'VAVA Furniture offers contemporary bedroom and living room collections - bed frames, wardrobes and storage that blend style with everyday durability.',
    address: 'Abuja, Nigeria', lat: 9.0765, lng: 7.3986, averageRating: 4.6,
    logoUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=200&h=200&fit=crop&q=70',
    coverImageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&h=400&fit=crop&q=70',
    photos: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500&q=70',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&q=70',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=70',
    ],
    policies: {
      shipping: 'City-wide delivery within 48 hours',
      returns: 'Exchanges accepted (7 days)',
      payment: 'Pay on delivery or bank transfer',
      shopPolicies: 'Read shop terms and conditions',
    },
  });
  console.log(`✅ Vendor created: ${vavaFurniture.name} (Furniture, APPROVED)`);

  if ((await prisma.product.count({ where: { vendorId: vavaFurniture.id } })) === 0) {
    await createProduct({
      vendorId: vavaFurniture.id, title: 'Upholstered Queen Bed Frame', category: 'Bed Frames', subcategory: 'Upholstered Frame',
      images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=70'],
      price: 320000, description: 'Queen-size upholstered bed frame with padded headboard and sturdy slatted base.',
      details: { Material: 'Fabric + engineered wood', Size: 'Queen', Headboard: 'Padded' },
      colors: [COLORS.white, COLORS.brown, COLORS.black],
    });
    await createProduct({
      vendorId: vavaFurniture.id, title: 'Modular TV Stand', category: 'TV Stand', subcategory: 'Floor Standing',
      images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=70'],
      price: 145000, description: 'Contemporary TV stand with open shelving and concealed cable management.',
      details: { Material: 'MDF + veneer', Style: 'Contemporary', Storage: 'Shelves + cabinet' },
      colors: [COLORS.brown, COLORS.black],
    });
    await createProduct({
      vendorId: vavaFurniture.id, title: 'Built-In Wardrobe (3 Doors)', category: 'Wardrobe', subcategory: '3-Door',
      images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=70'],
      price: 275000, description: 'Three-door built-in wardrobe with hanging rails, shelves and soft-close hinges.',
      details: { Material: 'Engineered wood', Doors: '3', Hinges: 'Soft-close' },
      colors: [COLORS.white, COLORS.brown],
    });
    console.log('✅ Seeded 3 products on VAVA Furniture');
  }
  const vavaProducts = await prisma.product.findMany({ where: { vendorId: vavaFurniture.id } });
  await seedVendorReviews(vavaFurniture, vavaProducts, [
    { name: 'Hauwa J.', rating: 5, timeAgo: '5 days ago', comment: 'Bed frame is solid and beautiful.' },
    { name: 'Chukwuemeka O.', rating: 4, timeAgo: '2 weeks ago', comment: 'Great wardrobe, assembly was easy.' },
  ]);
  await seedShopHighlights(vavaFurniture, vavaProducts, [
    {
      name: 'Bedrooms', sortOrder: 0,
      coverImageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=70', caption: 'Queen upholstered bed frame', productIds: [0] },
        { imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=70', caption: 'Built-in wardrobes, soft-close', productIds: [2] },
      ],
    },
    {
      name: 'Living Room', sortOrder: 1,
      coverImageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=70',
      stories: [
        { imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=70', caption: 'Modular TV stands with cable mgmt', productIds: [1] },
        { imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=70', caption: 'Bedroom matching sets available', productIds: [0] },
      ],
    },
  ]);

  // ─── Discount codes ─────────────────────────────────────────────────────────
  await prisma.discountCode.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10', vendorId: null, type: 'percentage', discountPercentage: 10,
      value: 10, minOrder: 1000, maxDiscount: 2000, usageLimit: 1000, status: 'APPROVED',
    },
  });
  await prisma.discountCode.upsert({
    where: { code: 'FMK1000' },
    update: {},
    create: {
      code: 'FMK1000', vendorId: fmkClothing.id, type: 'fixed', discountAmount: 1000,
      value: 1000, minOrder: 5000, usageLimit: 200, status: 'APPROVED',
    },
  });
  console.log('✅ Seeded 2 discount codes (1 platform-wide, 1 vendor-specific)');

  // ─── Banners ────────────────────────────────────────────────────────────────
  await prisma.banner.upsert({
    where: { id: '00000000-0000-4000-c000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-c000-000000000001',
      title: 'Welcome! 10% off your first order', subtitle: 'Use code WELCOME10 at checkout',
      imageUrl: 'https://placehold.co/1200x400?text=Welcome+10%25+Off', deepLink: '/orders',
      bgColor: '#EA580C', priority: 10, isActive: true,
    },
  });
  await prisma.banner.upsert({
    where: { id: '00000000-0000-4000-c000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-c000-000000000002',
      title: 'New season, new wardrobe', subtitle: 'Shop FMK Clothing today',
      imageUrl: 'https://placehold.co/1200x400?text=FMK+Clothing', deepLink: `/vendors/${fmkClothing.id}`,
      bgColor: '#DB2777', priority: 5, isActive: true,
    },
  });
  console.log('✅ Seeded 2 banners');

  // ─── Platform settings ──────────────────────────────────────────────────────
  // Keys actually read via settingsService.getSetting() at runtime, plus the
  // full PUBLIC_KEYS allowlist exposed to the customer/vendor apps.
  const settings = [
    { key: 'platform.currency', value: 'NGN', description: 'Default platform currency' },
    { key: 'platform.supportPhone', value: '08012345678', description: 'Customer support phone number' },
    { key: 'platform.supportEmail', value: 'support@ecommerce.test', description: 'Customer support email' },
  ];
  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: { key: s.key, value: s.value, description: s.description },
    });
  }
  console.log(`✅ Platform settings seeded (${settings.length} entries)`);

  // Custom categories are created closer to the top (before products file
  // under them). The cleanup below removes the redundant vendor-owned rows that
  // earlier flat-list seeding created for names that are really GLOBAL
  // categories/subcategories (Atamfa, Shoes, Lace were duplicated per vendor).
  // The storefront now shows those via the products filed under the global
  // cat/sub, so the private rows are dead weight and leaked into the public
  // category list.

  // Cleanup: previous flat-list seeding created redundant vendor-owned rows for
  // names that are really global categories/subcategories (Atamfa, Shopping,
  // Lace were duplicated per vendor). Remove every vendor-owned category whose
  // name collides with a global category OR a global subcategory - the storefront
  // now shows those via the products filed under the global cat/sub, so the
  // private rows are dead weight and leaked into the public category list.
  const globalNameSet = new Set((await prisma.vendorCategory.findMany({
    where: { vendorId: null },
    select: { name: true },
  })).map((c) => c.name.trim().toLowerCase()));
  const globalSubNameSet = new Set((await prisma.subcategory.findMany({
    where: { vendorId: null },
    select: { name: true },
  })).map((s) => s.name.trim().toLowerCase()));
  const redundant = await prisma.vendorCategory.findMany({
    where: { vendorId: { not: null } },
    select: { id: true, name: true },
  });
  let removed = 0;
  for (const rc of redundant) {
    const key = rc.name.trim().toLowerCase();
    if (globalNameSet.has(key) || globalSubNameSet.has(key)) {
      // Safe: products never reference these; only drop rows with no products.
      const productCount = await prisma.product.count({ where: { categoryId: rc.id } });
      if (productCount === 0) {
        await prisma.vendorCategory.delete({ where: { id: rc.id } });
        removed += 1;
      }
    }
  }
  if (removed > 0) console.log(`🧹 Removed ${removed} redundant vendor-owned categories`);

  // Give a few custom categories a two-level tree so the shop-category →
  // shop-subcategory → products flow is demonstrable end to end.
  await seedShopSubcategories(fmkClothing.id, 'Lefe collection', [
    { name: 'Women', imageUrl: CLD['clothing-fashion/women'], productTitles: ['Ankara Maxi Dress'] },
    { name: 'Men', imageUrl: CLD['clothing-fashion/men'], productTitles: ["Men's Kaftan Set", 'Premium Polo Shirt'] },
  ]);
  await seedShopSubcategories(elSamad.id, 'Abaya and gown', [
    { name: 'Boubou gowns', imageUrl: CLD['clothing-fashion/abaya-gowns'], productTitles: ['Boubou Gown'] },
    { name: 'Printed dresses', imageUrl: CLD['clothing-fashion/general'], productTitles: ['African Print Dress'] },
  ]);
  await seedShopSubcategories(danmamaSmartHomes.id, 'Smart Homes', [
    { name: 'Smart apartments', imageUrl: CLD['real-estate/apartments'], productTitles: ['2-Bedroom Smart Apartment - Gwarinpa'] },
    { name: 'Smart houses', imageUrl: CLD['real-estate/houses'], productTitles: ['Smart-Fitted 3-Bedroom House - Maitama'] },
  ]);


  // ─── Re-file + expand the fine-grained industries' shops ────────────────
  // Furniture, Vehicles & Automobiles and Real Estate are now INDUSTRIES only
  // (a shop's fixed home-grouping). Their storefront CARDS come from the new
  // fine-grained global categories (sofa/bed/dining-table, brand names, and
  // property types). Move any previously-seeded products still filed under the
  // old industry categories onto the matching fine-grained card, then top up
  // each card to 3-5 quality products. Idempotent - re-runs move nothing that is
  // already on the right card and skip products that already exist by title.
  const refileProduct = async (vendorId, title, category, subcategory) => {
    const product = await prisma.product.findFirst({ where: { vendorId, name: title } });
    if (!product) return;
    const cat = await prisma.vendorCategory.findFirst({ where: { name: category, vendorId: null } });
    if (!cat) throw new Error(`refile: category not found ${category}`);
    let subcategoryId = null;
    if (subcategory) {
      const sub = await prisma.subcategory.findFirst({ where: { categoryId: cat.id, name: subcategory, vendorId: null } });
      if (!sub) throw new Error(`refile: subcategory not found ${subcategory} (in ${category})`);
      subcategoryId = sub.id;
    }
    if (product.categoryId === cat.id && product.subcategoryId === subcategoryId) return;
    await prisma.product.update({ where: { id: product.id }, data: { categoryId: cat.id, subcategoryId } });
  };
  // Move the existing live products onto their fine-grained cards.
  await refileProduct(sarkinMotaAutos.id, 'Toyota Camry 2015', 'Toyota', 'Sedans');
  await refileProduct(sarkinMotaAutos.id, 'Dodge Charger SXT', 'Dodge', 'Muscle Cars');
  await refileProduct(furnitureHouse.id, 'Velvet Accent Sofa', 'Sofa', 'Fabric Sofa');
  await refileProduct(furnitureHouse.id, 'Oak Dining Table Set (6 Chairs)', 'Dining Table', '6-Seater');
  await refileProduct(furnitureHouse.id, 'Ergonomic Office Chair', 'Chair', 'Office Chair');
  await refileProduct(vavaFurniture.id, 'Upholstered Queen Bed Frame', 'Bed Frames', 'Upholstered Frame');
  await refileProduct(vavaFurniture.id, 'Modular TV Stand', 'TV Stand', 'Floor Standing');
  await refileProduct(vavaFurniture.id, 'Built-In Wardrobe (3 Doors)', 'Wardrobe', '3-Door');
  await refileProduct(eliteCycleConstruction.id, 'Two-Storey Duplex - Jabi', 'House', 'Duplex');
  await refileProduct(eliteCycleConstruction.id, 'Land - 400 sqm, Idu', 'Land', 'Commercial Plot');
  await refileProduct(eliteCycleConstruction.id, 'Residential Plot - Katampe', 'Land', 'Residential Plot');
  await refileProduct(danmamaSmartHomes.id, 'Smart-Fitted 3-Bedroom House - Maitama', 'House', 'Detached');
  await refileProduct(danmamaSmartHomes.id, '2-Bedroom Smart Apartment - Gwarinpa', 'Apartment', '2-Bedroom');
  await refileProduct(danmamaSmartHomes.id, 'Land - 600 sqm, Lokogoma', 'Land', 'Residential Plot');
  console.log('✅ Re-filed furniture/vehicles/real-estate products onto fine-grained cards');

  const VIMAGE = {
    toyota: 'https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp',
    hyundai: 'https://cdn.dummyjson.com/product-images/vehicle/tucson/thumbnail.webp',
    byd: 'https://cdn.dummyjson.com/product-images/vehicle/seal/thumbnail.webp',
    honda: 'https://cdn.dummyjson.com/product-images/vehicle/civic/thumbnail.webp',
    kia: 'https://cdn.dummyjson.com/product-images/vehicle/sportage/thumbnail.webp',
    dodge: 'https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp',
  };
  // Vehicles - one product per brand card.
  await ensureProduct({ vendorId: sarkinMotaAutos.id, title: 'Hyundai Tucson 2021', category: 'Hyundai', subcategory: 'SUVs', images: [VIMAGE.hyundai], price: 16500000, description: 'Mid-size Hyundai Tucson SUV, clean interior and full service history.', details: { Make: 'Hyundai', Model: 'Tucson', Year: '2021', Mileage: '28,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });
  await ensureProduct({ vendorId: sarkinMotaAutos.id, title: 'BYD Seal (Electric)', category: 'BYD', subcategory: 'Electric', images: [VIMAGE.byd], price: 28500000, description: 'All-electric BYD Seal sedan, long range and fast charging.', details: { Make: 'BYD', Model: 'Seal', Year: '2023', Range: '570 km', Drive: 'Electric', Condition: 'New' } });
  await ensureProduct({ vendorId: sarkinMotaAutos.id, title: 'Honda Civic 2020', category: 'Honda', subcategory: 'Sedans', images: [VIMAGE.honda], price: 12500000, description: 'Well-kept Honda Civic sedan, economical and reliable.', details: { Make: 'Honda', Model: 'Civic', Year: '2020', Mileage: '41,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });
  await ensureProduct({ vendorId: sarkinMotaAutos.id, title: 'Kia Sportage 2022', category: 'Kia', subcategory: 'SUVs', images: [VIMAGE.kia], price: 17500000, description: 'Compact Kia Sportage SUV with a roomy, modern cabin.', details: { Make: 'Kia', Model: 'Sportage', Year: '2022', Mileage: '19,000 km', Transmission: 'Automatic', Condition: 'Foreign Used' } });

  // Furniture House - top up Sofa, Dining Table, Chair cards.
  await ensureProduct({ vendorId: furnitureHouse.id, title: 'Leather Recliner Sofa', category: 'Sofa', subcategory: 'Leather Sofa', images: ['https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600&q=70'], price: 410000, description: 'Genuine leather recliner sofa with powered reclining seats.', details: { Material: 'Leather', Seats: '3 + recliner', Style: 'Contemporary' }, colors: [COLORS.black, COLORS.brown] });
  await ensureProduct({ vendorId: furnitureHouse.id, title: 'Sectional Sofa (L-Shape)', category: 'Sofa', subcategory: 'Sectional Sofa', images: ['https://images.unsplash.com/photo-1550226891-ef816aed4a98?w=600&q=70'], price: 520000, description: 'Spacious L-shape sectional perfect for large living rooms.', details: { Material: 'Fabric', Seats: '6', Style: 'Modular' }, colors: [COLORS.black, COLORS.green] });
  await ensureProduct({ vendorId: furnitureHouse.id, title: 'Bar Stools (Pair)', category: 'Chair', subcategory: 'Bar Stool', images: ['https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&q=70'], price: 85000, description: 'Set of two adjustable bar stools with cushioned seats.', details: { Material: 'Metal + PU', Height: 'Adjustable', Set: 'Pair' }, colors: [COLORS.black, COLORS.white] });

  // VAVA - top up Bed, Bed Frames, Wardrobe cards.
  await ensureProduct({ vendorId: vavaFurniture.id, title: 'King Size Bed & Mattress', category: 'Bed', subcategory: 'King Bed', images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=70'], price: 480000, description: 'King size bed frame with matching premium mattress included.', details: { Size: 'King', Frame: 'Wooden', Mattress: 'Included' }, colors: [COLORS.white, COLORS.brown] });
  await ensureProduct({ vendorId: vavaFurniture.id, title: 'Children Bunk Bed', category: 'Bed', subcategory: 'Bunk Bed', images: ['https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=70'], price: 290000, description: 'Solid wooden bunk bed with safety guardrails and a ladder.', details: { Size: 'Single/Full', Material: 'Wooden', Safety: 'Guardrails' }, colors: [COLORS.brown] });

  // Elite (real estate) - top up Land + House cards.
  await ensureProduct({ vendorId: eliteCycleConstruction.id, title: 'Detached 5-Bedroom House - Kado', category: 'House', subcategory: 'Detached', images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70'], price: 185000000, description: 'Detached 5-bedroom family house with a garden and fitted kitchen.', details: { Type: 'Detached', Bedrooms: '5', Location: 'Kado, Abuja', Title: 'C of O', Status: 'Available' } });
  await ensureProduct({ vendorId: eliteCycleConstruction.id, title: 'Commercial Plot - Guzape', category: 'Land', subcategory: 'Commercial Plot', images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70'], price: 42000000, description: 'Commercial plot along a busy road in Guzape for retail or offices.', details: { Type: 'Plot', Size: '450 sqm', Location: 'Guzape, Abuja', Title: 'R of O', Status: 'Available' } });
  await ensureProduct({ vendorId: eliteCycleConstruction.id, title: 'Retail Shop - Wuse Market', category: 'Shop', subcategory: 'Retail Shop', images: ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=70'], price: 65000000, description: 'Prime retail shop within Wuse Market for sale.', details: { Type: 'Shop', Size: '35 sqm', Location: 'Wuse, Abuja', Title: 'Certified', Status: 'Available' } });

  // Danmama - top up Land, Apartment, House, Self Contain; keep Smart Homes tile.
  await ensureProduct({ vendorId: danmamaSmartHomes.id, title: 'Studio Smart Apartment - Jahi', category: 'Apartment', subcategory: 'Studio', images: ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=70'], price: 38000000, description: 'Smart-fitted studio apartment with automation and backup power.', details: { Type: 'Apartment', Size: 'Studio', Location: 'Jahi, Abuja', Smart: 'Home automation', Status: 'Available' } });
  await ensureProduct({ vendorId: danmamaSmartHomes.id, title: 'Self Contain - Lugbe', category: 'Self Contain', subcategory: 'Single Room', images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=70'], price: 6500000, description: 'Self-contained single room with private bathroom and kitchen.', details: { Type: 'Self Contain', Rooms: 'Single', Location: 'Lugbe, Abuja', Status: 'Available' } });
  await ensureCustomProduct({ vendorId: danmamaSmartHomes.id, categoryName: 'Smart Homes', title: 'Smart Security Bundle', images: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=70'], price: 2500000, description: 'Home security bundle - smart locks, cameras and a video doorbell for your smart home.', details: { Type: 'Security', Includes: 'Smart lock, camera, doorbell' } });
  console.log('✅ Expanded furniture/vehicles/real-estate catalogs (3-5 per card)');

  // Delete the now-unused industry subcategories (Furniture, Vehicles & Automobiles,
  // Real Estate are category-only industries now). Safe: all products have been
  // re-filed onto the fine-grained cards above first. Any straggler products still
  // pointing at an old industry subcategory are moved onto their shop's own industry
  // (categoryId, no subcategory) so the delete cannot violate the FK.
  const oldIndustrySlugs = ['furniture', 'vehicles-automobiles', 'real-estate'];
  const oldCats = await prisma.vendorCategory.findMany({ where: { vendorId: null, slug: { in: oldIndustrySlugs } }, select: { id: true, name: true } });
  const oldSubIds = [];
  for (const oc of oldCats) {
    const subs = await prisma.subcategory.findMany({ where: { categoryId: oc.id, vendorId: null }, select: { id: true } });
    oldSubIds.push(...subs.map(s => s.id));
  }
  const stragglers = await prisma.product.findMany({ where: { subcategoryId: { in: oldSubIds } }, select: { id: true, vendorId: true } });
  for (const st of stragglers) {
    if (!st.vendorId) continue;
    const v = await prisma.vendor.findUnique({ where: { id: st.vendorId }, select: { categoryId: true } });
    await prisma.product.update({ where: { id: st.id }, data: { subcategoryId: null, categoryId: v.categoryId } });
  }
  if (oldSubIds.length) await prisma.subcategory.deleteMany({ where: { id: { in: oldSubIds } } });
  console.log(`✅ Cleaned old subcategories off the ${oldCats.map(c => c.name).join(', ')} industries (moved ${stragglers.length} stragglers)`);

  console.log('\n🌱 Seeding complete!');
  console.log('---');
  console.log('Admin login:     admin@ecommerce.test / admin123456');
  console.log('Customer login:  aisha@ecommerce.test / customer123');
  console.log('Customer login:  chidi@ecommerce.test / customer123');
  console.log('Vendor login:    fmkclothing@ecommerce.test / fmk123 (APPROVED, Clothing & Fashion)');
  console.log('Vendor login:    algazaruabayas@ecommerce.test / algazaru123 (APPROVED, Clothing & Fashion)');
  console.log('Vendor login:    mudatex@ecommerce.test / mudatex123 (APPROVED, Clothing & Fashion)');
  console.log('Vendor login:    sarkinmotaautos@ecommerce.test / sarkin123 (APPROVED, Vehicles & Automobiles)');
  console.log('Vendor login:    elsamad@ecommerce.test / elsamad123 (APPROVED, Clothing & Fashion)');
  console.log('Vendor login:    furniturehouse@ecommerce.test / furniture123 (APPROVED, Furniture)');
  console.log('Vendor login:    vavafurniture@ecommerce.test / vava123 (APPROVED, Furniture)');
  console.log('Vendor login:    wasseinvestments@ecommerce.test / wasse123 (APPROVED, Clothing & Fashion)');
  console.log('Vendor login:    elitecycleconstruction@ecommerce.test / elite123 (APPROVED, Real Estate)');
  console.log('Vendor login:    danmamasmarthomes@ecommerce.test / danmama123 (APPROVED, Real Estate)');
  console.log('Discount codes:  WELCOME10 (10% off, platform-wide), FMK1000 (₦1000 off, FMK Clothing only)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
