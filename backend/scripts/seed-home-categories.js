/**
 * seed-home-categories.js
 *
 * One-time bootstrap of the `home.categories` platform setting so the customer
 * app Home grid starts from a sensible curated list (the categories the team
 * asked for) instead of the legacy product-count heuristic. It is purely a
 * starting point - the admin reorders/toggles it from the "Home categories"
 * page afterwards.
 *
 * It ONLY creates the setting when it is missing (or when --force is passed);
 * it never edits categories or products.
 *
 *   node scripts/seed-home-categories.js --dry    # print plan, no writes
 *   node scripts/seed-home-categories.js          # apply (only if unset)
 *   node scripts/seed-home-categories.js --force  # overwrite existing layout
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

// Ordered list of category names to feature on Home. Order matters.
const FEATURED = [
  'Food & drinks',
  'Drinks & Beverages',
  'Provision & Groceries',
  'Health & Beauty',
  'Baby Products',
  'Farm Products',
  'Pharmacy',
  'Islamic Herbal',
  'Building & Construction',
  'Household Appliances',
  'Inverter & solar Panels',
  'Computers & Laptops',
  'Phones & Tablets',
  'Electronics',
  'Services',
];

// Global categories that must exist for the Home grid. Created if missing
// (name -> defaults). Keeps the layout seed self-sufficient on a fresh DB.
const ENSURE = {
  'Phones & Tablets': {
    slug: 'phones-tablets',
    icon: 'phone-portrait',
    color: '#2563EB',
    sortOrder: 122,
    subcategories: ['Smartphones', 'Tablets', 'Feature Phones', 'Phone Accessories', 'Tablet Accessories'],
  },
  'Inverter & solar Panels': {
    slug: 'inverter-solar-panels',
    icon: 'solar-panel',
    color: '#D97706',
    sortOrder: 121,
    subcategories: ['Inverters', 'Solar Panels', 'Batteries', 'Charge Controllers', 'Solar Kits', 'Installation Accessories'],
  },
  'Computers & Laptops': {
    slug: 'computers-laptops',
    icon: 'laptop',
    color: '#2563EB',
    sortOrder: 123,
    subcategories: ['Laptops', 'Desktops', 'Monitors', 'Printers & Scanners', 'Computer Accessories', 'Storage & Drives', 'Networking'],
  },
};

const slugify = (s) => s.toLowerCase().replace(/['\u2019]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const KEY = 'home.categories';

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');

  // Ensure the required global categories (and their subcategories) exist.
  for (const [name, defaults] of Object.entries(ENSURE)) {
    const { subcategories = [], ...fields } = defaults;
    let cat = await prisma.vendorCategory.findFirst({ where: { name, vendorId: null }, select: { id: true } });
    if (cat) {
      console.log(`   = category "${name}" exists`);
    } else {
      console.log(`   + create category "${name}"`);
      if (!DRY) {
        cat = await prisma.vendorCategory.create({ data: { name, vendorId: null, isActive: true, ...fields } });
      }
    }
    if (cat && subcategories.length) {
      let sort = 10;
      for (const sub of subcategories) {
        const have = await prisma.subcategory.findFirst({
          where: { categoryId: cat.id, name: sub, vendorId: null },
          select: { id: true },
        });
        if (have) {
          console.log(`      = sub "${sub}" exists`);
        } else {
          console.log(`      + sub "${sub}"`);
          if (!DRY) {
            await prisma.subcategory.create({
              data: { categoryId: cat.id, name: sub, slug: slugify(sub), sortOrder: sort, isActive: true },
            });
          }
        }
        sort += 10;
      }
    }
  }

  const existing = await prisma.platformSetting.findUnique({ where: { key: KEY } });
  if (existing && !FORCE) {
    console.log(`"${KEY}" already set (${(existing.value?.items || []).length} items). Pass --force to overwrite. Nothing to do.`);
    return;
  }

  const wanted = [];
  const missing = [];
  for (const name of FEATURED) {
    const cat = await prisma.vendorCategory.findFirst({ where: { name, vendorId: null }, select: { id: true, name: true } });
    if (!cat) {
      missing.push(name);
      console.log(`   ! "${name}" not found - skipping`);
      continue;
    }
    wanted.push({ id: cat.id, featured: true });
    console.log(`   + ${cat.name}`);
  }

  const value = { items: wanted };

  if (DRY) {
    console.log(`\nWould write ${wanted.length} featured categories${missing.length ? ` (${missing.length} missing)` : ''}.`);
    return;
  }

  await prisma.platformSetting.upsert({
    where: { key: KEY },
    update: { value, updatedBy: 'seed-home-categories' },
    create: { key: KEY, value, updatedBy: 'seed-home-categories' },
  });

  console.log(`\nWrote ${wanted.length} featured categories${missing.length ? ` (${missing.length} missing)` : ''}.`);
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
