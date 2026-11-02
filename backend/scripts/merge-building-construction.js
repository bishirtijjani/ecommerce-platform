/**
 * merge-building-construction.js
 *
 * One-off, idempotent taxonomy merge. Consolidates the building/construction
 * categories into a single global category:
 *
 *   - Renames "Hardware & Building" -> "Building & Construction" (keeping its
 *     subcategories and products), or reuses an existing "Building &
 *     Construction" row if one is already present.
 *   - Absorbs "Construction & Masonry" (currently an inactive, empty category)
 *     by moving any of its subcategories / products / vendor industries /
 *     requests to the target, then deleting it if nothing references it.
 *
 * Nothing is hard-deleted unless it is completely empty; a source that still
 * has references is deactivated instead (reversible).
 *
 * Run with a dry run first:
 *
 *   node scripts/merge-building-construction.js --dry   # print plan, no writes
 *   node scripts/merge-building-construction.js         # apply
 *
 * After applying, restart the app container (or wait out the 60s in-memory
 * category cache) so /categories serves the merged tree:
 *
 *   docker restart ecommerce
 *
 * Safe to re-run: every step looks up existing rows first.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const TARGET_NAME = 'Building & Construction';
const RENAME_FROM = 'Hardware & Building';
const ABSORB = ['Construction & Masonry'];

// Misplaced subcategories that shadow the target's name under an unrelated
// parent. Their products (if any) move to the target category with no
// subcategory; the subcategory is then deleted if nothing else references it.
const REMOVE_MISPLACED = [{ parent: 'Toys & Games', name: 'Building & Construction' }];

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const findGlobal = (name) =>
  prisma.vendorCategory.findFirst({ where: { name, vendorId: null } });

const countRefs = async (id) => {
  const [products, subcategories, vendors, requests] = await Promise.all([
    prisma.product.count({ where: { categoryId: id } }),
    prisma.subcategory.count({ where: { categoryId: id } }),
    prisma.vendor.count({ where: { categoryId: id } }),
    prisma.request.count({ where: { categoryId: id } }),
  ]);
  return products + subcategories + vendors + requests;
};

// Move a source category's global subcategories to the target. If the target
// already has a subcategory with the same name, fold the source's into it
// (re-point products) instead of creating a duplicate.
const moveSubcategories = async (from, to) => {
  const subs = await prisma.subcategory.findMany({
    where: { categoryId: from.id, vendorId: null },
  });
  for (const sub of subs) {
    const clash = await prisma.subcategory.findFirst({
      where: { categoryId: to.id, vendorId: null, name: sub.name },
    });
    if (clash && clash.id !== sub.id) {
      const n = await prisma.product.count({ where: { subcategoryId: sub.id } });
      console.log(`[sub]    FOLD ${from.name} > ${sub.name} -> ${to.name} > ${clash.name} (${n} products)`);
      if (!DRY) {
        await prisma.product.updateMany({ where: { subcategoryId: sub.id }, data: { subcategoryId: clash.id } });
        await prisma.subcategory.update({ where: { id: sub.id }, data: { isActive: false } });
      }
    } else {
      console.log(`[sub]    MOVE ${from.name} > ${sub.name} -> ${to.name}`);
      if (!DRY) await prisma.subcategory.update({ where: { id: sub.id }, data: { categoryId: to.id } });
    }
  }
};

const absorb = async (from, to) => {
  if (!from || from.id === to.id) return;

  console.log(`\n## absorbing "${from.name}" (${from.id}) into "${to.name}"`);

  await moveSubcategories(from, to);

  const products = await prisma.product.count({ where: { categoryId: from.id } });
  if (products) {
    console.log(`[product] MOVE ${products} products -> ${to.name}`);
    if (!DRY) await prisma.product.updateMany({ where: { categoryId: from.id }, data: { categoryId: to.id } });
  }

  const vendors = await prisma.vendor.count({ where: { categoryId: from.id } });
  if (vendors) {
    console.log(`[vendor]  re-point ${vendors} vendor industries -> ${to.name}`);
    if (!DRY) await prisma.vendor.updateMany({ where: { categoryId: from.id }, data: { categoryId: to.id } });
  }

  const requests = await prisma.request.count({ where: { categoryId: from.id } });
  if (requests) {
    console.log(`[request] re-point ${requests} requests -> ${to.name}`);
    if (!DRY) await prisma.request.updateMany({ where: { categoryId: from.id }, data: { categoryId: to.id } });
  }

  const refs = await countRefs(from.id);
  if (refs === 0) {
    console.log(`[clean]   DELETE empty category "${from.name}"`);
    if (!DRY) await prisma.vendorCategory.delete({ where: { id: from.id } });
  } else {
    console.log(`[clean]   KEEP "${from.name}" (still referenced: ${refs}) - deactivating`);
    if (!DRY) await prisma.vendorCategory.update({ where: { id: from.id }, data: { isActive: false } });
  }
};

// Remove a subcategory that shadows the target's name under an unrelated
// parent (e.g. a toy "Building & Construction"). Its products are re-pointed
// to the target category with no subcategory; the row is deleted once nothing
// references it, else deactivated.
const removeMisplaced = async (target, spec) => {
  const parent = await findGlobal(spec.parent);
  if (!parent) {
    console.log(`\n## misplaced "${spec.name}": parent "${spec.parent}" not found - skip`);
    return;
  }
  const sub = await prisma.subcategory.findFirst({
    where: { categoryId: parent.id, vendorId: null, name: spec.name },
  });
  if (!sub) {
    console.log(`\n## misplaced "${spec.parent} > ${spec.name}": not found - skip`);
    return;
  }

  console.log(`\n## removing misplaced "${spec.parent} > ${spec.name}" (${sub.id})`);

  const products = await prisma.product.count({ where: { subcategoryId: sub.id } });
  if (products) {
    console.log(`[product] MOVE ${products} products -> ${TARGET_NAME} (no subcategory)`);
    if (!DRY) {
      await prisma.product.updateMany({
        where: { subcategoryId: sub.id },
        data: { categoryId: target.id, subcategoryId: null },
      });
    }
  }

  const remainingProducts = await prisma.product.count({ where: { subcategoryId: sub.id } });
  const requests = await prisma.request.count({ where: { subcategoryId: sub.id } });
  if (remainingProducts + requests === 0) {
    console.log(`[clean]   DELETE empty subcategory "${spec.parent} > ${spec.name}"`);
    if (!DRY) await prisma.subcategory.delete({ where: { id: sub.id } });
  } else {
    console.log(`[clean]   KEEP "${spec.parent} > ${spec.name}" (still referenced: ${remainingProducts + requests}) - deactivating`);
    if (!DRY) await prisma.subcategory.update({ where: { id: sub.id }, data: { isActive: false } });
  }
};

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');

  let target = await findGlobal(TARGET_NAME);
  const renameFrom = await findGlobal(RENAME_FROM);

  if (!target) {
    if (!renameFrom) {
      throw new Error(`Neither "${TARGET_NAME}" nor "${RENAME_FROM}" exists - nothing to merge`);
    }
    target = renameFrom;
    console.log(`\n## renaming "${renameFrom.name}" -> "${TARGET_NAME}"`);
  } else {
    console.log(`\n## target "${TARGET_NAME}" already exists (${target.id})`);
  }

  const targetData = {
    name: TARGET_NAME,
    slug: slugify(TARGET_NAME) || 'building-construction',
    description: 'Building materials, tools and construction services',
    isActive: true,
  };
  const changes = Object.entries(targetData).filter(([k, v]) => target[k] !== v);
  if (changes.length) {
    console.log(`[target]  UPDATE ${changes.map(([k]) => k).join(', ')}`);
    if (!DRY) target = await prisma.vendorCategory.update({ where: { id: target.id }, data: targetData });
  } else {
    console.log('[target]  already up to date');
  }

  // Absorb the renamed-from row (if the target was created fresh) plus every
  // explicitly listed source, then anything else left named in ABSORB.
  const sources = [];
  if (renameFrom && renameFrom.id !== target.id) sources.push(renameFrom);
  for (const name of ABSORB) {
    const cat = await findGlobal(name);
    if (cat && cat.id !== target.id && !sources.some((s) => s.id === cat.id)) sources.push(cat);
  }

  if (sources.length === 0) console.log('\n## nothing to absorb');
  for (const source of sources) await absorb(source, target);

  for (const spec of REMOVE_MISPLACED) await removeMisplaced(target, spec);

  console.log(`\nDone. Target: "${TARGET_NAME}" (${target.id})${DRY ? ' (dry run - nothing written)' : ''}`);
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
