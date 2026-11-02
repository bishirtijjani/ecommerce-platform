/**
 * merge-food-categories.js
 *
 * One-off, idempotent fix for the duplicate "food" categories that a manual
 * rename left behind:
 *
 *   - "Food"  (id ...00c5, slug small-chops)  <- KEEP (featured on Home)
 *   - "Foo"   (id ...0001, slug restaurant)   <- DELETE (merged in)
 *
 * It re-parents every subcategory from the "Foo" row onto "Food" (nothing is
 * lost), renames the kept row's slug to `food`, and deletes the duplicate.
 *
 *   node scripts/merge-food-categories.js --dry   # plan only
 *   node scripts/merge-food-categories.js         # apply
 *
 * Safe to re-run: after the first run the "Foo" row is gone and it no-ops.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const KEEP_ID = '7a2b3c4d-5e6f-4a7b-8c9d-0000000000c5'; // "Food"
const MERGE_ID = '00000000-0000-4000-a000-000000000001'; // "Foo"

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');

  const keep = await prisma.vendorCategory.findUnique({ where: { id: KEEP_ID } });
  const merge = await prisma.vendorCategory.findUnique({ where: { id: MERGE_ID } });

  if (!keep) {
    console.log(`Keeper category ${KEEP_ID} not found - nothing to do.`);
    return;
  }
  if (!merge) {
    console.log('Duplicate "Foo" category already gone - ensuring keeper slug/name is correct.');

    if (!DRY && (keep.name !== 'Food' || keep.slug !== 'food')) {
      await prisma.vendorCategory.update({ where: { id: KEEP_ID }, data: { name: 'Food', slug: 'food' } });
      console.log('   ~ set keeper name="Food" slug="food"');
    }
    return;
  }

  // Re-parent every subcategory from the duplicate onto the keeper. Skip a
  // name that already exists on the keeper (avoids unique-constraint clashes).
  const mergeSubs = await prisma.subcategory.findMany({
    where: { categoryId: MERGE_ID },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const keepSubs = await prisma.subcategory.findMany({
    where: { categoryId: KEEP_ID },
    select: { name: true, sortOrder: true },
  });
  const haveNames = new Set(keepSubs.map((s) => s.name.trim().toLowerCase()));
  let nextSort = Math.max(0, ...keepSubs.map((s) => s.sortOrder)) + 10;

  for (const sub of mergeSubs) {
    if (haveNames.has(sub.name.trim().toLowerCase())) {
      console.log(`   = sub "${sub.name}" already on keeper - drop duplicate`);
      if (!DRY) await prisma.subcategory.delete({ where: { id: sub.id } });
      continue;
    }
    console.log(`   > move sub "${sub.name}" -> Food (sort ${nextSort})`);
    if (!DRY) {
      await prisma.subcategory.update({
        where: { id: sub.id },
        data: { categoryId: KEEP_ID, sortOrder: nextSort },
      });
    }
    haveNames.add(sub.name.trim().toLowerCase());
    nextSort += 10;
  }

  console.log('   ~ set keeper name="Food" slug="food"');
  if (!DRY) {
    await prisma.vendorCategory.update({ where: { id: KEEP_ID }, data: { name: 'Food', slug: 'food' } });
  }

  console.log(`   x delete duplicate category "Foo" (${MERGE_ID})`);
  if (!DRY) {
    await prisma.vendorCategory.delete({ where: { id: MERGE_ID } });
  }

  console.log('\nDone. "Foo" merged into "Food"; slug set to "food".');
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
