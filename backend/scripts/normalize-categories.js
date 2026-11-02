/**
 * normalize-categories.js
 *
 * One-off, idempotent taxonomy cleanup:
 *
 *   1. Rename "Small Chops, Candies & Drinks" -> "Small Chops".
 *   2. Rename "Groceries"                     -> "Provision & Groceries".
 *   3. Merge  "Fruits & Vegetables" into the renamed "Farm Products"
 *      (formerly "Agriculture & Farm"): move its subcategories + products,
 *      then delete the emptied source.
 *   4. Delete the stray vendor-scoped "Furnitures" category (global
 *      "Furniture" is the real one).
 *
 * Display names use "&"; slugs keep the site's "and"/hyphen convention.
 * Nothing with real references is hard-deleted - a category that still has
 * products/subcategories/vendors/requests is left in place.
 *
 *   node scripts/normalize-categories.js --dry   # print plan, no writes
 *   node scripts/normalize-categories.js         # apply
 *
 * After applying, restart the app container (or wait out the 60s in-memory
 * category cache) so /categories serves the new names:
 *
 *   docker restart ecommerce
 *
 * Safe to re-run: every step looks up existing rows first.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const RENAMES = [
  { from: 'Small Chops, Candies & Drinks', to: 'Small Chops' },
  { from: 'Groceries', to: 'Provision & Groceries' },
  { from: 'Agriculture & Farm', to: 'Farm Products' },
];

// Absorb `from` (global category) into `into`, then delete the emptied source.
const ABSORB = [{ from: 'Fruits & Vegetables', into: 'Farm Products' }];

// Stray vendor-scoped categories to drop (by name), if empty.
const DELETE_VENDOR = ['Furnitures'];

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const findGlobal = (name) =>
  prisma.vendorCategory.findFirst({ where: { name, vendorId: null } });

// Resolve a target name that may only exist after a rename in this same run
// (keeps the dry run accurate, where renames aren't written).
const findTarget = async (name) => {
  const direct = await findGlobal(name);
  if (direct) return direct;
  const renamed = RENAMES.find((r) => r.to === name);
  return renamed ? findGlobal(renamed.from) : null;
};

const countRefs = async (categoryId) => {
  const [products, subcategories, vendors, requests] = await Promise.all([
    prisma.product.count({ where: { categoryId } }),
    prisma.subcategory.count({ where: { categoryId } }),
    prisma.vendor.count({ where: { categoryId } }),
    prisma.request.count({ where: { categoryId } }),
  ]);
  return products + subcategories + vendors + requests;
};

const renameCategory = async (from, to) => {
  const src = await findGlobal(from);
  const dst = await findGlobal(to);

  if (!src) {
    console.log(`[rename] SKIP "${from}" -> "${to}" (source not found${dst ? '; target exists' : ''})`);
    return dst;
  }
  if (dst && dst.id !== src.id) {
    console.log(`[rename] CONFLICT: "${to}" already exists - leaving "${from}" untouched`);
    return dst;
  }

  console.log(`[rename] "${from}" -> "${to}" (slug: ${slugify(to)})`);
  if (DRY) return { ...src, name: to };
  return prisma.vendorCategory.update({
    where: { id: src.id },
    data: { name: to, slug: slugify(to) },
  });
};

const absorb = async (fromName, intoName) => {
  const into = await findTarget(intoName);
  const from = await findGlobal(fromName);

  if (!into) {
    console.log(`\n## absorb SKIP: target "${intoName}" not found`);
    return 0;
  }
  if (!from) {
    console.log(`\n## absorb SKIP: source "${fromName}" not found`);
    return 0;
  }
  if (from.id === into.id) return 0;

  console.log(`\n## absorbing "${from.name}" -> "${into.name}"`);

  const subs = await prisma.subcategory.findMany({
    where: { categoryId: from.id, vendorId: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const maxSort = await prisma.subcategory.aggregate({
    where: { categoryId: into.id },
    _max: { sortOrder: true },
  });
  let nextSort = (maxSort._max.sortOrder || 0) + 10;
  let folded = 0;

  for (const sub of subs) {
    const clash = await prisma.subcategory.findFirst({
      where: { categoryId: into.id, vendorId: null, name: sub.name },
    });
    if (clash && clash.id !== sub.id) {
      folded += 1;
      const n = await prisma.product.count({ where: { subcategoryId: sub.id } });
      console.log(`[sub]    FOLD "${sub.name}" -> existing "${into.name} > ${clash.name}" (${n} products)`);
      if (!DRY) {
        await prisma.product.updateMany({ where: { subcategoryId: sub.id }, data: { subcategoryId: clash.id } });
        await prisma.subcategory.update({ where: { id: sub.id }, data: { isActive: false } });
      }
    } else {
      console.log(`[sub]    MOVE "${from.name} > ${sub.name}" -> "${into.name}" (sort ${nextSort})`);
      if (!DRY) {
        await prisma.subcategory.update({
          where: { id: sub.id },
          data: { categoryId: into.id, sortOrder: nextSort },
        });
      }
      nextSort += 10;
    }
  }

  const vendors = await prisma.vendor.count({ where: { categoryId: from.id } });
  if (vendors) {
    console.log(`[vendor] re-point ${vendors} vendors "${from.name}" -> "${into.name}"`);
    if (!DRY) await prisma.vendor.updateMany({ where: { categoryId: from.id }, data: { categoryId: into.id } });
  }

  const requests = await prisma.request.count({ where: { categoryId: from.id } });
  if (requests) {
    console.log(`[request] re-point ${requests} requests "${from.name}" -> "${into.name}"`);
    if (!DRY) await prisma.request.updateMany({ where: { categoryId: from.id }, data: { categoryId: into.id } });
  }

  const products = await prisma.product.count({ where: { categoryId: from.id } });
  if (products) {
    console.log(`[product] MOVE ${products} products "${from.name}" -> "${into.name}"`);
    if (!DRY) await prisma.product.updateMany({ where: { categoryId: from.id }, data: { categoryId: into.id } });
  }

  // In a dry run nothing above was written, so model the post-merge state:
  // moved subs/products/vendors/requests leave the source; only clashed (folded)
  // subs still point at it.
  const refs = DRY ? folded : await countRefs(from.id);

  if (refs === 0) {
    console.log(`[clean]  DELETE emptied category "${from.name}"`);
    if (!DRY) await prisma.vendorCategory.delete({ where: { id: from.id } });
  } else {
    console.log(`[clean]  KEEP "${from.name}" (still referenced: ${refs}) - deactivating`);
    if (!DRY) await prisma.vendorCategory.update({ where: { id: from.id }, data: { isActive: false } });
  }
  return products;
};

const deleteVendorCategory = async (name) => {
  const cat = await prisma.vendorCategory.findFirst({ where: { name, vendorId: { not: null } } });
  if (!cat) {
    console.log(`[clean]  SKIP "${name}" (vendor category not found)`);
    return;
  }
  const refs = await countRefs(cat.id);
  if (refs > 0) {
    console.log(`[clean]  KEEP vendor category "${name}" (still referenced: ${refs})`);
    return;
  }
  console.log(`[clean]  DELETE empty vendor category "${name}" (vendor:${cat.vendorId.slice(0, 8)})`);
  if (!DRY) await prisma.vendorCategory.delete({ where: { id: cat.id } });
};

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');

  console.log('\n## renames');
  for (const { from, to } of RENAMES) await renameCategory(from, to);

  console.log('\n## merges');
  let moved = 0;
  for (const { from, into } of ABSORB) moved += await absorb(from, into);

  console.log('\n## cleanup');
  for (const name of DELETE_VENDOR) await deleteVendorCategory(name);

  console.log(`\nDone. Products moved: ${moved}${DRY ? ' (dry run - nothing written)' : ''}`);
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
