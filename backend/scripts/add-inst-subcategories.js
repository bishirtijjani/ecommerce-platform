/**
 * add-inst-subcategories.js
 *
 * Non-destructive, purely additive taxonomy update for the 12 categories in
 * inst.txt. It ONLY creates missing global subcategories; it never edits,
 * renames, deactivates or deletes anything, and never touches products.
 *
 * The list below already excludes inst.txt names that duplicate an existing
 * subcategory ("skip it" decision) so no look-alike twins are created.
 *
 *   node scripts/add-inst-subcategories.js --dry   # print plan, no writes
 *   node scripts/add-inst-subcategories.js         # apply
 *
 * Safe to re-run: existing subcategory names are skipped by name.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const ADD = {
  'Small Chops': ['Snacks', 'Candies', 'Drinks', 'Shawarma & Grills', 'Dishes'],
  'Farm Products': [
    'Fish & Aquaculture',
    'Eggs',
    'Grains & Cereals',
    'Beans & Legumes',
    'Tubers & Roots',
    'Animal Feed',
    'Dairy Products',
    'Honey & Beekeeping Products',
  ],
  'Clothing & Fashion': ["Perfumes", "Children's Clothing", "Men's Clothing", "Women's Clothing"],
  'Building & Construction': [
    'Cement',
    'Blocks & Bricks',
    'Sand & Gravel',
    'Iron Rods & Steel',
    'Roofing Materials',
    'Tiles & Marble',
    'Doors & Windows',
    'Plumbing Materials',
    'Electrical Materials',
    'Wood & Timber',
    'Scaffolding',
    'Ladders',
    'Generators',
    'Concrete Mixers',
    'Welding Machines',
    'Drilling Machines',
    'Construction Tools',
    'Safety Equipment',
    'Water Tanks',
    'Wheelbarrows',
    'Heavy Equipment & Machinery',
  ],
  Furniture: [
    'Dining Sets',
    'Cabinets',
    'Office Furniture',
    'Shelves & Bookcases',
    'Dressing Tables',
    'Shoe Racks',
    'Outdoor Furniture',
    "Children's Furniture",
    'Used Furniture',
  ],
  'Household Appliances': [
    'Refrigerators',
    'Freezers',
    'Air Conditioners',
    'Washing Machines',
    'Dryers',
    'Televisions',
    'Gas Cookers',
    'Electric Cookers',
    'Microwaves',
    'Ovens',
    'Blenders',
    'Mixers',
    'Electric Kettles',
    'Irons',
    'Fans',
    'Water Dispensers',
    'Vacuum Cleaners',
    'Water Heaters',
    'Rice Cookers',
    'Air Fryers',
    'Generators',
  ],
  Electronics: [
    'Headphones & Earphones',
    'Cameras',
    'Smartwatches',
    'Gaming Consoles',
    'Printers & Scanners',
    'Routers & Modems',
    'Projectors',
    'Power Banks',
    'Chargers & Cables',
    'Computer Accessories',
    'Phone Accessories',
    'Security Cameras & CCTV',
    'Decoders & Receivers',
    'Electronic Accessories',
  ],
  'Sports & Fitness': [
    'Football Boots',
    'Dumbbells & Weights',
    'Treadmills',
    'Exercise Bikes',
    'Bicycles',
    'Boxing Equipment',
    'Yoga Equipment',
    'Sports Bags',
    'Sports Shoes',
    'Supplements & Protein',
  ],
  'Health & Beauty': [
    'Perfumes & Fragrances',
    'Personal Hygiene',
    "Men's Grooming",
    'Beauty Tools & Accessories',
    'Vitamins & Supplements',
    'Medical & Health Supplies',
    'Baby Care Products',
  ],
  'Provision & Groceries': [
    'Rice',
    'Pasta & Noodles',
    'Flour',
    'Sugar',
    'Cooking Oil',
    'Beans & Grains',
    'Canned Foods',
    'Breakfast Cereals',
    'Milk & Dairy Products',
    'Tea & Coffee',
    'Biscuits & Snacks',
    'Soft Drinks & Juices',
    'Bottled Water',
    'Bread & Bakery',
    'Frozen Foods',
    'Eggs',
    'Detergents & Cleaning Supplies',
    'Toiletries & Household Essentials',
  ],
  Services: [
    'Painting',
    'Carpentry',
    'Welding',
    'AC & Refrigeration Repair',
    'Phone Repair',
    'Computer Repair',
    'Printing & Branding',
    'Generator Repair',
    'Security Services',
    'Graphic Design',
    'Web & App Development',
  ],
  'Real Estate': ['Offices', 'Warehouses', 'Farms & Agricultural Land', 'Short-Let / Holiday Rentals'],
};

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

  console.log(`\nDone. Added: ${created}, skipped: ${skipped}${DRY ? ' (dry run — nothing written)' : ''}`);
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
