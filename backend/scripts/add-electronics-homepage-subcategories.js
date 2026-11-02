/**
 * add-electronics-homepage-subcategories.js
 *
 * Non-destructive taxonomy update for the categories surfaced on the customer
 * app Home grid. It:
 *   1. creates missing GLOBAL subcategories for Phones & Tablets,
 *      Computers & Laptops and Islamic Herbal;
 *   2. activates two previously hidden global categories (Pharmacy and
 *      Islamic Herbal) so they reach the public /categories payload and the
 *      Home grid can pin them.
 * It never renames, deactivates or deletes existing rows, and never touches
 * products. Safe to re-run (existing subcategory names are skipped by name).
 *
 *   node scripts/add-electronics-homepage-subcategories.js --dry   # print plan
 *   node scripts/add-electronics-homepage-subcategories.js         # apply
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const ADD = {
  'Phones & Tablets': ['Smartphones', 'Tablets', 'Feature Phones', 'Phone Accessories', 'Tablet Accessories'],
  'Computers & Laptops': [
    'Laptops',
    'Desktops',
    'Monitors',
    'Printers & Scanners',
    'Computer Accessories',
    'Storage & Drives',
    'Networking',
  ],
  'Islamic Herbal': [
    'Herbal Medicine',
    'Islamic Oils & Balms',
    'Honey & Natural Remedies',
    'Islamic Books & Supplies',
    'Ruqyah & Wellbeing',
  ],
};

const ACTIVATE = ['Pharmacy', 'Islamic Herbal'];

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');

  let created = 0;
  let skipped = 0;
  let activated = 0;

  for (const [categoryName, subNames] of Object.entries(ADD)) {
    const cat = await prisma.vendorCategory.findFirst({ where: { name: categoryName, vendorId: null } });
    if (!cat) {
      console.log(`\n## ${categoryName}: CATEGORY NOT FOUND — skipping`);
      continue;
    }

    const existing = await prisma.subcategory.findMany({
      where: { categoryId: cat.id, vendorId: null },
      select: { name: true },
    });
    const have = new Set(existing.map((s) => s.name.trim().toLowerCase()));

    const max = await prisma.subcategory.aggregate({
      where: { categoryId: cat.id },
      _max: { sortOrder: true },
    });
    let nextSort = (max._max.sortOrder || 0) + 10;

    console.log(`\n## ${categoryName} (existing: ${existing.length})`);
    for (const name of subNames) {
      if (have.has(name.trim().toLowerCase())) {
        console.log(`   = skip "${name}" (already exists)`);
        skipped += 1;
        continue;
      }
      console.log(`   + add  "${name}"  (slug: ${slugify(name)}, sort ${nextSort})`);
      if (!DRY) {
        await prisma.subcategory.create({
          data: { categoryId: cat.id, name, slug: slugify(name), sortOrder: nextSort, isActive: true },
        });
      }
      have.add(name.trim().toLowerCase());
      nextSort += 10;
      created += 1;
    }
  }

  console.log('\n## Activating hidden global categories');
  for (const name of ACTIVATE) {
    const cat = await prisma.vendorCategory.findFirst({ where: { name, vendorId: null } });
    if (!cat) {
      console.log(`   ! "${name}" not found — skipping`);
      continue;
    }
    if (cat.isActive) {
      console.log(`   = "${name}" already active`);
      continue;
    }
    console.log(`   ~ activate "${name}"`);
    if (!DRY) {
      await prisma.vendorCategory.update({ where: { id: cat.id }, data: { isActive: true } });
    }
    activated += 1;
  }

  console.log(`\nDone. Added: ${created}, skipped: ${skipped}, activated: ${activated}${DRY ? ' (dry run — nothing written)' : ''}`);
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
