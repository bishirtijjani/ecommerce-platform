/**
 * consolidate-vehicles.js
 *
 * One-off, idempotent taxonomy consolidation for the vehicle categories.
 * Rallies the scattered top-level vehicle categories under a single parent,
 * each becoming a subcategory, and re-points their products:
 *
 *   Vehicles & Automobiles            (parent, exists)
 *     ├─ Cars            <- "2 door" + "4 door"
 *     ├─ SUVs
 *     ├─ Pickups
 *     ├─ Electric Cars
 *     ├─ Sports Cars
 *     ├─ Buses & Vans
 *     ├─ Trucks
 *     ├─ Motorcycles
 *     ├─ Power Bike
 *     └─ Trailers
 *
 * The emptied source categories are deleted when nothing references them,
 * else deactivated (reversible). The parent's own vendor industry ref and any
 * product order history are untouched; "Automotive" (parts/accessories) is
 * intentionally left as its own top-level.
 *
 * Run with a dry run first:
 *
 *   node scripts/consolidate-vehicles.js --dry   # print plan, no writes
 *   node scripts/consolidate-vehicles.js         # apply
 *
 * After applying, restart the app container (or wait out the 60s in-memory
 * category cache) so /categories serves the new tree:
 *
 *   docker restart ecommerce
 *
 * Safe to re-run: every step looks up existing rows first.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const PARENT_NAME = 'Vehicles & Automobiles';

// Each group becomes ONE subcategory; its `sources` are the top-level global
// categories folded into it (their products are re-pointed).
const GROUPS = [
  { sub: 'Cars', sources: ['2 door', '4 door'] },
  { sub: 'SUVs', sources: ['SUVs'] },
  { sub: 'Pickups', sources: ['Pickups'] },
  { sub: 'Electric Cars', sources: ['Electric Cars'] },
  { sub: 'Sports Cars', sources: ['Sports Cars'] },
  { sub: 'Buses & Vans', sources: ['Buses & Vans'] },
  { sub: 'Trucks', sources: ['Trucks'] },
  { sub: 'Motorcycles', sources: ['Motorcycles'] },
  { sub: 'Power Bike', sources: ['Power Bike'] },
  { sub: 'Trailers', sources: ['Trailers'] },
];

// Dead, empty global duplicates that shadow live Services subcategories.
const DELETE_IF_EMPTY = ['Auto Repair', 'Car Wash & Detailing'];

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const findGlobal = (name) =>
  prisma.vendorCategory.findFirst({ where: { name, vendorId: null } });

const countRefs = async (categoryId) => {
  const [products, subcategories, vendors, requests] = await Promise.all([
    prisma.product.count({ where: { categoryId } }),
    prisma.subcategory.count({ where: { categoryId } }),
    prisma.vendor.count({ where: { categoryId } }),
    prisma.request.count({ where: { categoryId } }),
  ]);
  return products + subcategories + vendors + requests;
};

const ensureSub = async (parent, group, sortOrder) => {
  let sub = await prisma.subcategory.findFirst({
    where: { categoryId: parent.id, vendorId: null, name: group.sub },
  });
  if (sub) return sub;
  const data = {
    categoryId: parent.id,
    name: group.sub,
    slug: slugify(group.sub),
    sortOrder,
    isActive: true,
    vendorId: null,
  };
  console.log(`[sub]     CREATE ${parent.name} > ${group.sub}`);
  if (DRY) return { id: 'DRY-SUB', name: group.sub };
  sub = await prisma.subcategory.create({ data });
  return sub;
};

const absorbSource = async (parent, sub, sourceName) => {
  const source = await findGlobal(sourceName);
  if (!source) {
    console.log(`[child]   SKIP (not found): ${sourceName}`);
    return 0;
  }
  if (source.id === parent.id) {
    console.log(`[child]   SKIP (is the parent): ${sourceName}`);
    return 0;
  }

  const vendors = await prisma.vendor.count({ where: { categoryId: source.id } });
  if (vendors) {
    console.log(`[vendor]  re-point ${vendors} vendor industries ${source.name} -> ${parent.name}`);
    if (!DRY) await prisma.vendor.updateMany({ where: { categoryId: source.id }, data: { categoryId: parent.id } });
  }

  const requests = await prisma.request.count({ where: { categoryId: source.id } });
  if (requests) {
    console.log(`[request] re-point ${requests} requests ${source.name} -> ${parent.name}`);
    if (!DRY) await prisma.request.updateMany({ where: { categoryId: source.id }, data: { categoryId: parent.id } });
  }

  const products = await prisma.product.count({ where: { categoryId: source.id } });
  if (products) {
    console.log(`[product] MOVE ${products} products: ${source.name} -> ${parent.name} > ${sub.name}`);
    if (!DRY) {
      await prisma.product.updateMany({
        where: { categoryId: source.id },
        data: { categoryId: parent.id, subcategoryId: sub.id },
      });
    }
  }

  // In a dry run the products/vendors/requests above aren't actually moved, so
  // only count what would remain (subcategories) to keep dry == apply.
  const refs = DRY
    ? await prisma.subcategory.count({ where: { categoryId: source.id } })
    : await countRefs(source.id);
  if (refs === 0) {
    console.log(`[clean]   DELETE empty category "${source.name}"`);
    if (!DRY) await prisma.vendorCategory.delete({ where: { id: source.id } });
  } else {
    console.log(`[clean]   KEEP "${source.name}" (still referenced: ${refs}) - deactivating`);
    if (!DRY) await prisma.vendorCategory.update({ where: { id: source.id }, data: { isActive: false } });
  }
  return products;
};

const deleteIfEmpty = async (name) => {
  const cat = await findGlobal(name);
  if (!cat) return;
  const refs = await countRefs(cat.id);
  if (refs > 0) {
    console.log(`[clean]   KEEP ${name} (still referenced: ${refs})`);
    return;
  }
  console.log(`[clean]   DELETE empty category "${name}"`);
  if (!DRY) await prisma.vendorCategory.delete({ where: { id: cat.id } });
};

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');

  const parent = await findGlobal(PARENT_NAME);
  if (!parent) throw new Error(`Parent category not found: "${PARENT_NAME}"`);
  console.log(`\n## parent "${parent.name}" (${parent.id}) active=${parent.isActive}`);
  if (!parent.isActive && !DRY) {
    await prisma.vendorCategory.update({ where: { id: parent.id }, data: { isActive: true } });
    console.log('[parent]  REACTIVATE');
  }

  let moved = 0;
  let sortOrder = 0;
  for (const group of GROUPS) {
    console.log(`\n## ${group.sub}  <= ${group.sources.join(', ')}`);
    const sourceCats = await Promise.all(group.sources.map(findGlobal));
    const groupSort = sourceCats.reduce(
      (min, c) => (c && (min === null || c.sortOrder < min) ? c.sortOrder : min),
      null,
    );
    const sub = await ensureSub(parent, group, groupSort ?? sortOrder);
    sortOrder = (groupSort ?? sortOrder) + 1;
    for (const sourceName of group.sources) {
      moved += await absorbSource(parent, sub, sourceName);
    }
  }

  console.log('\n## cleanup (dead duplicates)');
  for (const name of DELETE_IF_EMPTY) await deleteIfEmpty(name);

  console.log(`\nDone. Products re-pointed: ${moved}${DRY ? ' (dry run - nothing written)' : ''}`);
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
