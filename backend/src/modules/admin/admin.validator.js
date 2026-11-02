/**
 * Admin module - Zod validation schemas.
 */

const { z } = require('zod');

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const paginationStatusSchema = paginationSchema.extend({
  status: z.string().optional(),
});

const getAllTagsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  category: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
});

const getAuditLogsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const updateCustomerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  reason: z.string().min(1).max(500).optional(),
});

const wipeCustomerKycSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

const updateCustomerSchema = z
  .object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: z.string().email().max(120).optional(),
    phone: z.string().min(7).max(20).optional(),
    address: z.string().max(255).optional(),
    state: z.string().max(60).optional(),
    lga: z.string().max(80).optional(),
    dateOfBirth: z.coerce.date().optional().nullable(),
    kycStatus: z.enum(['NONE', 'PENDING', 'VERIFIED', 'FAILED']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING']).optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .refine((data) => Object.keys(data).some((k) => k !== 'reason' && data[k] !== undefined), {
    message: 'At least one field must be provided',
  });

// Admin edits a vendor owner's own account identity (login email, name,
// phone). Email/phone are locked in the apps, so this is the support-side
// correction path. At least one editable field must be present.
const updateVendorAccountSchema = z
  .object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: z.string().email().max(120).optional(),
    phone: z.string().min(7).max(20).optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .refine((data) => Object.keys(data).some((k) => k !== 'reason' && data[k] !== undefined), {
    message: 'At least one field must be provided',
  });

const ORDER_STATUS_VALUES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

// Admin order management schemas
const listAllOrdersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
  source: z.enum(['CUSTOMER', 'VENDOR']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().trim().max(200).optional(),
});

// Same filters as the list, no pagination - export always covers the full
// filtered set (server-side capped).
const exportAllOrdersSchema = listAllOrdersSchema.omit({ page: true, limit: true });

const listAllCustomersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING']).optional(),
  kycStatus: z.enum(['NONE', 'PENDING', 'VERIFIED', 'FAILED']).optional(),
});

const customerOrdersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
});

const forceCancelOrderSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

const adminUpdateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES),
  reason: z.string().optional(),
});

// Admin vendor management schemas
const listAllVendorsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED']).optional(),
  search: z.string().optional(),
});

const approveVendorSchema = z.object({});

const rejectVendorSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

const suspendVendorSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

const unsuspendVendorSchema = z.object({});

const updateVendorProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  state: z.string().max(60).optional(),
  lga: z.string().max(80).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  openingDays: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  // Shop gallery + policies match the vendor dashboard's own schema so the
  // admin can moderate the exact surfaces only vendors could previously edit.
  photos: z.array(z.string().url()).optional(),
  policies: z.record(z.string(), z.string()).nullable().optional(),
  adminActiveOverride: z.boolean().optional(),
});

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  category: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(100).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  category: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

const setVendorTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

// Vendor category schemas
//
// `attributeSchema` is an admin-managed JSON hint that tells the vendor app
// which axes (size, color, strength, …) and pack units the category uses, plus
// some category-specific extras (sizeSystem, etc.). The DB does not enforce it -
// the vendor product form reads it to render the right inputs. Validation here
// is loose on purpose (categories can be added without code changes); we only
// constrain the shape of well-known fields.
const attributeSchemaSchema = z.object({
  axes: z.array(z.string().min(1).max(40)).max(10).optional(),
  pack: z.boolean().optional(),
  packUnits: z.array(z.enum(['ML','L','G','KG','TABLET','CAPSULE','PIECE','PAIR','PACK','BOTTLE','SACHET','CARTON'])).optional(),
  sizeSystem: z.string().max(20).optional(),
}).passthrough();

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  hasPreparation: z.boolean().optional(),
  attributeSchema: attributeSchemaSchema.optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  hasPreparation: z.boolean().optional(),
  isActive: z.boolean().optional(),
  attributeSchema: attributeSchemaSchema.nullable().optional(),
});

const updateAttributeSchemaSchema = z.object({
  attributeSchema: attributeSchemaSchema.nullable(),
});

const listCategoriesSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

// Subcategory management (admin-owned global rows; listing includes
// vendor-created rows for oversight).
const listSubcategoriesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  // "global" = admin-owned rows only (vendorId null); "all" = everything under
  // the category, tagged with ownership for the oversight list.
  scope: z.enum(['global', 'all']).optional().default('global'),
});

const createSubcategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const updateSubcategorySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

// Bulk reorder: an ordered list of { id, sortOrder } applied in one
// transaction. Capped so a malformed client can't send an unbounded payload.
const reorderItemsSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0).max(100000),
    }),
  )
  .min(1)
  .max(500);

const reorderCategoriesSchema = z.object({ items: reorderItemsSchema });

const reorderSubcategoriesSchema = z.object({ items: reorderItemsSchema });

// `unfile` opts in to detaching products from a subcategory before deleting it.
const deleteSubcategoryQuerySchema = z.object({
  unfile: z.enum(['true', 'false']).optional().default('false'),
});

// Ratings moderation
const listRatingsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  score: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['newest', 'oldest', 'highest', 'lowest']).optional(),
});

// Callback request leads
const listCallbacksQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  vendorId: z.string().uuid().optional(),
});

// Product catalogue moderation (global, cross-vendor)
const listProductsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  isAvailable: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  condition: z.enum(['NEW', 'USED', 'SECOND_HAND']).optional(),
});

// Chat oversight
const listChatsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

// Campaign management
const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1).max(40).default('promotion'),
  description: z.string().max(2000).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().nonnegative().default(0),
  targetAudience: z.string().max(80).default('all'),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

const updateCampaignStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'completed']),
});

// Highlight moderation (storefront story highlights created by vendors)
const listHighlightsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
});

const updateHighlightStatusSchema = z.object({
  isActive: z.boolean(),
});

// Home categories editor: an ordered list of categories that appear on the
// customer app Home grid. Order = array order; `featured` toggles visibility.
// Only global category ids are accepted (checked again in the service).
const updateHomeCategoriesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        featured: z.boolean(),
      }),
    )
    .max(100),
});

// Platform settings schemas
const updatePlatformSettingsSchema = z.object({}).passthrough();

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  permissions: z.array(z.string()).optional(),
});

const updateStaffPermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

const updateStaffProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  // Staff created via createStaffSchema have no phone (NULL). The edit modal
  // preloads and re-sends that null, so coerce null/'' -> undefined (service
  // already skips empty phone) instead of rejecting the whole request.
  phone: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().min(7).max(20).optional()
  ),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
});

module.exports = {
  updateCustomerStatusSchema,
  updateCustomerSchema,
  updateVendorAccountSchema,
  wipeCustomerKycSchema,
  listAllCustomersSchema,
  paginationSchema,
  paginationStatusSchema,
  getAllTagsSchema,
  getAuditLogsSchema,
  customerOrdersSchema,
  listAllOrdersSchema,
  exportAllOrdersSchema,
  forceCancelOrderSchema,
  adminUpdateOrderStatusSchema,
  listAllVendorsSchema,
  approveVendorSchema,
  rejectVendorSchema,
  suspendVendorSchema,
  unsuspendVendorSchema,
  updateVendorProfileSchema,
  createTagSchema,
  updateTagSchema,
  setVendorTagsSchema,
  createCategorySchema,
  updateCategorySchema,
  updateAttributeSchemaSchema,
  listCategoriesSchema,
  listSubcategoriesSchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  reorderCategoriesSchema,
  reorderSubcategoriesSchema,
  deleteSubcategoryQuerySchema,
  listRatingsQuerySchema,
  listCallbacksQuerySchema,
  listProductsQuerySchema,
  listChatsQuerySchema,
  createCampaignSchema,
  updateCampaignSchema,
  updateCampaignStatusSchema,
  listHighlightsQuerySchema,
  updateHighlightStatusSchema,
  updateHomeCategoriesSchema,
  updatePlatformSettingsSchema,
  createStaffSchema,
  updateStaffPermissionsSchema,
  updateStaffProfileSchema,
};
