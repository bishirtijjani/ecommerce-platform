/**
 * cleanup-duplicate-categories.js
 *
 * One-off, idempotent data cleanup. Deletes global categories that are
 * duplicates of an existing subcategory under another (active) category -
 * the "category twins" left over from the old flat taxonomy, e.g. a top-level
 * "Veil" category that also exists as "Fabric & Textile > Veil".
 *
 * Safety / behaviour:
 *  - Only the explicitly listed names are considered (no fuzzy matching).
 *  - Before deleting a twin, its child subcategories are RE-PARENTED onto the
 *    active category that already uses the twin's name (so nothing is lost).
 *    If a child name already exists on the target, it is skipped (dupe) and
 *    simply cascades away with the twin.
 *  - A twin is only deleted when it is global, inactive, has 0 products,
 *    0 vendor-industry links and 0 requests. Anything referenced is skipped
 *    and reported.
 *
 *   node scripts/cleanup-duplicate-categories.js --dry   # plan only
 *   node scripts/cleanup-duplicate-categories.js         # apply
 *
 * "Yan gwan gwan( kayan nauyi)" is intentionally NOT in the list.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const NAMES = [
  'Abaya',
  'Apartment',
  'Atamfa',
  'Bags',
  'Beauty & Cosmetics',
  'Beauty & Makeup',
  'Bed',
  'Bed Frames',
  'Bureau de Change',
  'Caps',
  'Chair',
  'Cleaning',
  'Dining Table',
  'Education & Training',
  'Electrical',
  'Event Planning & Catering',
  'Handyman',
  'Health & Wellness',
  'Home & Kitchen',
  'House',
  'Jewelry & Watches',
  'Lace',
  'Land',
  'Laundry & Dry Cleaning',
  'Pest Control & Fumigation',
  'Photography & Video',
  'Plumbing',
  'Salon & Barber',
  'Self Contain',
  'Shadda',
  'Shoes',
  'Shop',
  'Sofa',
  'Solar & AC Installation',
  'TV Stand',
  'Tailoring',
  'Transport & Logistics',
  'Tutoring & Lessons',
  'Veil',
  'Voile',
  'Wardrobe',
  'Yard',
];

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');

  let deleted = 0;
  let reparented = 0;
  let skippedRefs = 0;
  let notFound = 0;

  for (const name of NAMES) {
    const cat = await prisma.vendorCategory.findFirst({ where: { name, vendorId: null } });
    if (!cat) {
      console.log(`\n## ${name}: not found - skip`);
      notFound += 1;
      continue;
    }
    if (cat.isActive) {
      console.log(`\n## ${name}: still ACTIVE - skip (not a twin)`);
      continue;
    }

    const [prods, vendors, reqs] = await Promise.all([
      prisma.product.count({ where: { categoryId: cat.id } }),
      prisma.vendor.count({ where: { categoryId: cat.id } }),
      prisma.request.count({ where: { categoryId: cat.id } }),
    ]);
    if (prods || vendors || reqs) {
      console.log(`\n## ${name}: REFERENCED (products=${prods}, vendors=${vendors}, requests=${reqs}) - skip`);
      skippedRefs += 1;
      continue;
    }

    // Find the active category that already has a subcategory of this name -
    // the "real parent" the twin duplicates.
    const target = await prisma.vendorCategory.findFirst({
      where: {
        vendorId: null,
        isActive: true,
        id: { not: cat.id },
        subcategories: { some: { vendorId: null, name } },
      },
      select: { id: true, name: true },
    });

    console.log(`\n## ${name}  -> parent: ${target ? target.name : '(none, will just delete)'}`);

    const children = await prisma.subcategory.findMany({
      where: { categoryId: cat.id },
      select: { id: true, name: true },
    });

    if (target) {
      for (const child of children) {
        const exists = await prisma.subcategory.findFirst({
          where: { categoryId: target.id, name: child.name, vendorId: null },
          select: { id: true },
        });
        if (exists) {
          console.log(`   = child "${child.name}" already under ${target.name} - drop`);
          continue;
        }
        console.log(`   > move child "${child.name}" -> ${target.name}`);
        if (!DRY) {
          await prisma.subcategory.update({ where: { id: child.id }, data: { categoryId: target.id } });
        }
        reparented += 1;
      }
    }

    console.log(`   x delete category "${name}"`);
    if (!DRY) {
      await prisma.vendorCategory.delete({ where: { id: cat.id } });
    }
    deleted += 1;
  }

  console.log(
    `\nDone. Deleted: ${deleted}, subcategories re-parented: ${reparented}, skipped (referenced): ${skippedRefs}, not found: ${notFound}${DRY ? ' (dry run)' : ''}`,
  );
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
