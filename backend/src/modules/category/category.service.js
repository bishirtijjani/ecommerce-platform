/**
 * Category service - public-facing reads of vendor categories.
 *
 * Uses an in-process 60s cache because categories change rarely
 * (admin actions only) and are queried on every customer app cold start.
 */

const { prisma } = require('../../config/database');

let memCache = null;
let memCachedAt = 0;
const MEM_TTL_MS = 60 * 1000;

const invalidateCache = () => {
  memCache = null;
  memCachedAt = 0;
};

const listCategories = async ({ activeOnly = true } = {}) => {
  if (activeOnly && memCache && Date.now() - memCachedAt < MEM_TTL_MS) {
    return memCache;
  }

  const categories = await prisma.vendorCategory.findMany({
    // Public taxonomy exposes only GLOBAL (admin-managed) categories and their
    // global subcategories. Vendor-owned rows are private to that vendor and are
    // served to them separately via the vendor taxonomy endpoint - they must not
    // leak into the global category grid or the product form's union.
    where: activeOnly ? { isActive: true, vendorId: null } : { vendorId: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      // Product/subcategory tallies let the customer app sort categories with
      // supply first, show real counts and pick popular subcategories without
      // N+1 product calls. Additive - existing consumers ignore `_count`.
      _count: { select: { products: true, subcategories: true } },
      // Admin-managed subcategories, for the product form's dependent
      // dropdown (vendor app) and the category browse grid (customer app).
      subcategories: {
        where: activeOnly ? { isActive: true, vendorId: null } : { vendorId: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { products: true } } },
      },
    },
  });

  if (activeOnly) {
    memCache = categories;
    memCachedAt = Date.now();
  }

  return categories;
};

const getCategoryById = (id) =>
  prisma.vendorCategory.findUnique({ where: { id } });

const getCategoryBySlug = (slug) =>
  prisma.vendorCategory.findUnique({ where: { slug } });

module.exports = {
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  invalidateCache,
};
