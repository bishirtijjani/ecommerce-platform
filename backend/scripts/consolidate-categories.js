/**
 * consolidate-categories.js
 *
 * One-off, idempotent taxonomy migration. It demotes a fixed set of
 * over-specific GLOBAL categories into subcategories of broader parents:
 *
 *   1. Find/create the parent (global) category; reactivate + fill icon/color.
 *   2. Create a subcategory under it named after the child category.
 *   3. Re-point the child's products to { parent, new sub } (flattened).
 *   4. Deactivate the old child category (reversible - nothing is deleted).
 *
 * Run it with a dry run first:
 *
 *   node scripts/consolidate-categories.js --dry   # print plan, no writes
 *   node scripts/consolidate-categories.js         # apply
 *
 * After applying, restart the app container (or wait out the 60s in-memory
 * category cache) so /categories serves the new tree:
 *
 *   docker restart ecommerce
 *
 * Safe to re-run: every step looks up existing rows before creating.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// parent: { name, icon, color, description, renameFrom?, create? }
// children: global category names that become subcategories of the parent.
const PLAN = [
  {
    parent: {
      name: 'Clothing & Fashion',
      icon: 'shirt',
      color: '#DB2777',
      description: 'Clothing, shoes, bags and accessories',
    },
    children: ['Abaya', 'Veil', 'Caps', 'Shoes', 'Bags', 'Jewelry & Watches'],
  },
  {
    parent: {
      name: 'Fabric & Textile',
      icon: 'layers',
      color: '#C2410C',
      description: 'Fabrics and textiles by the yard and set',
    },
    children: ['Atamfa', 'Shadda', 'Lace', 'Voile', 'Yard'],
  },
  {
    parent: {
      name: 'Furniture',
      icon: 'armchair',
      color: '#7C2D12',
      description: 'Home and office furniture',
    },
    children: ['Sofa', 'Bed', 'Bed Frames', 'Dining Table', 'Chair', 'TV Stand', 'Wardrobe', 'Home & Kitchen'],
  },
  {
    parent: {
      name: 'Real Estate',
      icon: 'home',
      color: '#0D9488',
      description: 'Land, houses and rentals',
    },
    children: ['Land', 'House', 'Apartment', 'Shop', 'Self Contain'],
  },
  {
    parent: {
      name: 'Health & Beauty',
      icon: 'heart-pulse',
      color: '#10B981',
      description: 'Health, wellness and personal care',
      renameFrom: 'Health & Personal Care',
    },
    children: ['Pharmacy', 'Beauty & Cosmetics', 'Islamic Herbal'],
  },
  {
    parent: {
      name: 'Services',
      icon: 'construct',
      color: '#2563EB',
      description: 'Professional and home services',
      sortOrder: 200,
      create: true,
    },
    children: [
      'Auto Repair',
      'Tailoring',
      'Plumbing',
      'Electrical',
      'Cleaning',
      'Handyman',
      'Salon & Barber',
      'Beauty & Makeup',
      'Laundry & Dry Cleaning',
      'Photography & Video',
      'Event Planning & Catering',
      'Tutoring & Lessons',
      'Health & Wellness',
      'Transport & Logistics',
      'Car Wash & Detailing',
      'Solar & AC Installation',
      'Pest Control & Fumigation',
      'Construction & Masonry',
      'Education & Training',
      'Bureau de Change',
    ],
  },
  {
    // Stray heavy-goods category, folded into an existing parent.
    parent: { name: 'Hardware & Building' },
    children: ['Yan gwan gwan( kayan nauyi)'],
  },
];

// Disabled, unused duplicate - removed only if nothing references it.
const DELETE_IF_EMPTY = ['Fashion'];

const findGlobal = (name) => prisma.vendorCategory.findFirst({ where: { name, vendorId: null } });

const ensureParent = async (spec) => {
  let parent = await findGlobal(spec.name);
  if (!parent && spec.renameFrom) parent = await findGlobal(spec.renameFrom);

  if (!parent) {
    if (!spec.create) throw new Error(`Parent category not found: ${JSON.stringify(spec.name)}`);
    const data = {
      name: spec.name,
      slug: slugify(spec.name),
      icon: spec.icon || null,
      color: spec.color || null,
      description: spec.description || null,
      sortOrder: spec.sortOrder ?? 0,
      isActive: true,
      hasPreparation: false,
      vendorId: null,
    };
    console.log(`[parent] CREATE ${spec.name}`);
    if (DRY) return { id: 'DRY-PARENT', name: spec.name, _created: true };
    return prisma.vendorCategory.create({ data });
  }

  const data = {
    name: spec.name,
    isActive: true,
    icon: parent.icon || spec.icon || null,
    color: parent.color || spec.color || null,
    description: parent.description || spec.description || null,
  };
  const changes = Object.entries(data).filter(([k, v]) => parent[k] !== v);
  if (changes.length) {
    console.log(`[parent] UPDATE ${parent.name} -> ${spec.name} (${changes.map(([k]) => k).join(', ')})`);
    if (!DRY) parent = await prisma.vendorCategory.update({ where: { id: parent.id }, data });
  }
  return parent;
};

const ensureSubcategory = async (parent, child) => {
  let sub = await prisma.subcategory.findFirst({
    where: { categoryId: parent.id, vendorId: null, name: child.name },
  });
  if (sub) return { sub, created: false };

  const data = {
    categoryId: parent.id,
    name: child.name,
    slug: child.slug || slugify(child.name),
    imageUrl: child.imageUrl || null,
    sortOrder: child.sortOrder ?? 0,
    isActive: true,
    vendorId: null,
  };
  console.log(`[sub]    CREATE ${parent.name} > ${child.name}`);
  if (DRY) return { sub: { id: 'DRY-SUB' }, created: true };
  sub = await prisma.subcategory.create({ data });
  return { sub, created: true };
};

const demoteChild = async (parent, childName) => {
  const child = await findGlobal(childName);
  if (!child) {
    console.log(`[child]  SKIP (not found): ${childName}`);
    return { products: 0 };
  }
  if (child.id === parent.id) {
    console.log(`[child]  SKIP (is the parent): ${childName}`);
    return { products: 0 };
  }

  const { sub } = await ensureSubcategory(parent, child);

  // Defensive: if any vendor's top-level industry points at this child, move it
  // to the parent so the shop keeps an industry group on Home.
  const vendorRefs = await prisma.vendor.count({ where: { categoryId: child.id } });
  if (vendorRefs) {
    console.log(`[vendor] re-point ${vendorRefs} vendor industry ${child.name} -> ${parent.name}`);
    if (!DRY) await prisma.vendor.updateMany({ where: { categoryId: child.id }, data: { categoryId: parent.id } });
  }

  const productCount = await prisma.product.count({ where: { categoryId: child.id } });
  if (productCount) {
    console.log(`[prod]   MOVE ${productCount} products: ${child.name} -> ${parent.name} > ${child.name}`);
    if (!DRY) {
      await prisma.product.updateMany({
        where: { categoryId: child.id },
        data: { categoryId: parent.id, subcategoryId: sub.id },
      });
    }
  }

  if (child.isActive) {
    console.log(`[child]  DEACTIVATE ${child.name}`);
    if (!DRY) await prisma.vendorCategory.update({ where: { id: child.id }, data: { isActive: false } });
  } else {
    console.log(`[child]  already inactive: ${child.name}`);
  }

  return { products: productCount };
};

const deleteIfEmpty = async (name) => {
  const cat = await findGlobal(name);
  if (!cat) return;
  const [products, vendors, subcategories] = await Promise.all([
    prisma.product.count({ where: { categoryId: cat.id } }),
    prisma.vendor.count({ where: { categoryId: cat.id } }),
    prisma.subcategory.count({ where: { categoryId: cat.id } }),
  ]);
  const refs = products + vendors + subcategories;
  if (refs > 0) {
    console.log(`[clean]  KEEP ${name} (still referenced: ${refs})`);
    return;
  }
  console.log(`[clean]  DELETE empty ${name}`);
  if (!DRY) await prisma.vendorCategory.delete({ where: { id: cat.id } });
};

const main = async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLYING ===');
  let moved = 0;

  for (const group of PLAN) {
    console.log(`\n## ${group.parent.name}`);
    const parent = await ensureParent(group.parent);
    for (const childName of group.children) {
      const { products } = await demoteChild(parent, childName);
      moved += products;
    }
  }

  console.log('\n## cleanup');
  for (const name of DELETE_IF_EMPTY) await deleteIfEmpty(name);

  console.log(`\nDone. Products re-pointed: ${moved}${DRY ? ' (dry run - nothing written)' : ''}`);
};

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
