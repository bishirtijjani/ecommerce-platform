/**
 * Vendor validator schemas
 */

const { z } = require('zod');

const VENDOR_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED'];

// ============================================================
// Create Vendor Schema
// ============================================================

const createVendorSchema = z.object({
  name: z.string().min(2, 'Vendor name is required'),
  description: z.string().optional(),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Valid email is required').optional(),
  address: z.string().min(5, 'Address is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format').default('08:00'),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format').default('22:00'),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
});

// ============================================================
// Update Vendor Schema
// ============================================================

const updateVendorSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  isOpen: z.boolean().optional(),
});

// ============================================================
// List Vendors Schema
// ============================================================

const listVendorsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
  status: z.enum(VENDOR_STATUSES).optional(),
  // Query strings arrive as strings, so coerce numbers and preprocess the
  // boolean. Bare z.number()/z.boolean() reject "12.34"/"true" and 400 out.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(50).default(10),
  openNow: z
    .preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Public Product Browse Schema (GET /vendors/products)
// ============================================================

// Sort keys - must stay in sync with the customer app's SortMenu
// (app/src/lib/productFilters.js). `newest` is the historical default.
const PUBLIC_PRODUCTS_SORTS = ['newest', 'popular', 'price_asc', 'price_desc', 'rating'];
// Mirrors the ProductCondition Prisma enum (see PRODUCT_CONDITIONS below).
const PUBLIC_PRODUCTS_CONDITIONS = ['NEW', 'USED', 'SECOND_HAND'];

const publicProductsSchema = z.object({
  // Normally a category UUID. Also accepts a category NAME/slug because the
  // published customer app's product-detail screen derives the top-level
  // category from the display string ("Top > Sub") and sends that name back -
  // the service resolves it (see vendor.service getPublicProducts). Keep this
  // loose rather than `.uuid()` so those already-shipped clients don't 400 with
  // VALIDATION_FAILED ("Please check the highlighted fields").
  categoryId: z.string().min(1).optional(),
  subcategoryId: z.string().uuid().optional(),
  // Scope to a single shop (used by the customer app's market/storefront
  // screens so they can go through this endpoint instead of the embedded
  // vendor-detail payload and get server-side filters/sort).
  vendorId: z.string().uuid().optional(),
  sort: z.enum(PUBLIC_PRODUCTS_SORTS).default('newest'),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  condition: z.enum(PUBLIC_PRODUCTS_CONDITIONS).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  // Second Hand location filter (State then LGA), applied only to SECOND_HAND
  // listings.
  state: z.string().max(60).optional(),
  lga: z.string().max(80).optional(),
  // Geo filter (near-me): products from vendors within `radius` km of lat/lng.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(50).default(10),
  limit: z.coerce.number().int().min(1).max(1000).default(60),
});

// ============================================================
// Toggle Vendor Status Schema
// ============================================================

const toggleVendorStatusSchema = z.object({
  isOpen: z.boolean(),
});

// ============================================================
// Vendor Dashboard Schemas
// ============================================================

const updateVendorProfileSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  state: z.string().max(60).optional(),
  lga: z.string().max(80).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  // Shop gallery + policies are edited on the vendor dashboard and sent with
  // every profile save — without these the fields are silently stripped by
  // zod, so changes "save" (200) but never reach the database.
  photos: z.array(z.string().url()).optional(),
  policies: z.record(z.string(), z.string()).nullable().optional(),
  openingDays: z.array(z.string().min(2).max(10)).optional(),
  isOpen: z.boolean().optional(),
});

const searchVendorCustomersSchema = z.object({
  phone: z.string().trim().min(3).max(20),
});

const vendorOrderItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  selectedOptions: z.array(z.object({
    groupId: z.string().uuid(),
    itemIds: z.array(z.string().uuid()).default([]),
  })).optional(),
  specialInstructions: z.string().max(200).optional(),
  substitution: z.enum(['NONE', 'VENDOR_PICK', 'CONTACT_ME']).optional(),
});

const createVendorOrderSchema = z.object({
  customerId: z.string().uuid('Select a customer'),
  shippingAddressId: z.string().uuid().optional(),
  // Only used when the customer has no saved address the vendor can pick -
  // creates one on the customer's behalf. lat/lng are optional; the service
  // falls back to the vendor's own coordinates (no map dependency here).
  newAddress: z.object({
    label: z.string().trim().max(60).optional(),
    address: z.string().trim().min(5, 'Address is required'),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }).optional(),
  items: z.array(vendorOrderItemSchema).min(1, 'Order must contain at least one item'),
  promoCode: z.string().trim().toUpperCase().optional(),
}).refine((d) => d.shippingAddressId || d.newAddress, {
  message: 'shippingAddressId or newAddress is required',
  path: ['shippingAddressId'],
});

const vendorOrdersSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const rejectOrderSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['SHIPPED', 'DELIVERED']),
  // Optional carrier tracking reference, set when marking SHIPPED.
  trackingNumber: z.string().max(100).optional(),
});

const vendorProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ------------------------------------------------------------
// Variants & Option Groups
// ------------------------------------------------------------

const PACK_UNITS = ['ML','L','G','KG','TABLET','CAPSULE','PIECE','PAIR','PACK','BOTTLE','SACHET','CARTON'];
const SELECTION_RULES = ['REQUIRED_ONE','OPTIONAL_ONE','REQUIRED_MULTIPLE','OPTIONAL_MULTIPLE'];
// Mirrors the ProductCondition Prisma enum on Product.
const PRODUCT_CONDITIONS = ['NEW','USED','SECOND_HAND'];

// Each selection rule fixes how minSelect/maxSelect may be set. The dashboards
// couple these in the UI; this is the matching server-side guard so a
// contradictory group (e.g. REQUIRED_ONE with maxSelect 5) can never be
// persisted regardless of which client sent it. Returns a human-readable error
// string, or null when the (rule, min, max) triple is internally consistent.
const optionGroupRuleError = ({ selectionRule, minSelect, maxSelect }) => {
  switch (selectionRule) {
    case 'REQUIRED_ONE':
      return minSelect === 1 && maxSelect === 1
        ? null : 'A "pick exactly one" group must require exactly one selection';
    case 'OPTIONAL_ONE':
      return minSelect === 0 && maxSelect === 1
        ? null : 'A "pick at most one" group must allow zero or one selection';
    case 'REQUIRED_MULTIPLE':
      if (minSelect < 1) return 'A required multi-pick group must ask for at least one selection';
      if (maxSelect < minSelect) return 'Max picks must be greater than or equal to min picks';
      return null;
    case 'OPTIONAL_MULTIPLE':
      if (minSelect !== 0) return 'An optional multi-pick group must have a minimum of zero';
      if (maxSelect < 1) return 'An optional multi-pick group must allow at least one selection';
      return null;
    default:
      return 'Unknown selection rule';
  }
};

// Canonical min/max for a rule, used to fill in bounds a caller didn't pin so
// the rule and its bounds always agree (matches ruleDefaults in the dashboards).
const ruleDefaults = (selectionRule) => {
  switch (selectionRule) {
    case 'REQUIRED_ONE':      return { minSelect: 1, maxSelect: 1 };
    case 'OPTIONAL_ONE':      return { minSelect: 0, maxSelect: 1 };
    case 'REQUIRED_MULTIPLE': return { minSelect: 1, maxSelect: 2 };
    case 'OPTIONAL_MULTIPLE': return { minSelect: 0, maxSelect: 2 };
    default:                  return { minSelect: 0, maxSelect: 1 };
  }
};

const variantInputSchema = z.object({
  sku: z.string().optional(),
  attributes: z.record(z.any()).optional(),
  packSize: z.number().positive().optional(),
  packUnit: z.enum(PACK_UNITS).optional(),
  packLabel: z.string().max(60).optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).max(5).optional(),
  videoUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
});

const optionItemInputSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  priceDelta: z.number().default(0),
  imageUrl: z.string().url().optional(),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const optionGroupInputSchema = z.object({
  name: z.string().min(1).max(80),
  selectionRule: z.enum(SELECTION_RULES),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).default(0),
  items: z.array(optionItemInputSchema).default([]),
}).transform((d) => {
  // Derive canonical min/max from the rule when the caller didn't pin them, so
  // the rule and its bounds always stay in agreement.
  const fallback = ruleDefaults(d.selectionRule);
  return {
    ...d,
    minSelect: d.minSelect ?? fallback.minSelect,
    maxSelect: d.maxSelect ?? fallback.maxSelect,
  };
}).superRefine((d, ctx) => {
  const ruleErr = optionGroupRuleError(d);
  if (ruleErr) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: ruleErr, path: ['maxSelect'] });
  }
  // A populated group must be satisfiable - it can't ask for more picks than it
  // offers. Empty groups are allowed: the dashboard creates the group first and
  // the vendor adds items afterwards.
  if (d.items.length > 0 && d.minSelect > d.items.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `This group asks for ${d.minSelect} pick(s) but only has ${d.items.length} item(s)`,
      path: ['minSelect'],
    });
  }
});

const createProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  basePrice: z.number().nonnegative('Price must be non-negative'),
  // Admin-managed taxonomy: category is required; subcategory is optional so a
  // product can be filed under a category that has no subcategories yet.
  categoryId: z.string().uuid('Select a category'),
  subcategoryId: z.string().uuid('Select a subcategory').nullable().optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).max(5).optional(),
  videoUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
  // New vs pre-owned. Omitted → NEW (the schema/DB default).
  condition: z.enum(PRODUCT_CONDITIONS).default('NEW'),

  /// Optional inline variant + option-group setup. When omitted, a default
  /// single variant is created from basePrice/stock.
  variants: z.array(variantInputSchema).optional(),
  optionGroups: z.array(optionGroupInputSchema).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  basePrice: z.number().nonnegative().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).max(5).optional(),
  videoUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  condition: z.enum(PRODUCT_CONDITIONS).optional(),
});

const toggleProductAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

const updateVariantSchema = variantInputSchema.partial();

const optionGroupUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  selectionRule: z.enum(SELECTION_RULES).optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const optionItemUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(200).nullable().optional(),
  priceDelta: z.number().optional(),
  imageUrl: z.string().url().nullable().optional(),
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const vendorAnalyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('7d'),
});

const vendorOrderHistorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ============================================================
// Callback Request Schema (chat-commerce "Request a callback" action)
// ============================================================

const createCallbackRequestSchema = z.object({
  customerName: z.string().trim().min(2, 'Please enter your name').max(120),
  customerPhone: z.string().trim().min(10, 'Please enter a valid phone number').max(20),
  productId: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
  // Honeypot - same convention as the marketing-site contact form.
  website: z.string().max(200).optional().default(''),
});

// ============================================================
// Shop story highlights (whatsapp-status-style, permanent)
// ============================================================

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(60),
  imageUrl: z.string().url().optional().nullable(),
});

const createSubcategorySchema = z.object({
  name: z.string().trim().min(1, 'Subcategory name is required').max(60),
  imageUrl: z.string().url().optional().nullable(),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  imageUrl: z.string().url().optional().nullable(),
});
const createHighlightSchema = z.object({
  name: z.string().trim().min(2, 'Highlight name must be at least 2 characters').max(60),
  coverImageUrl: z.string().url('Cover must be a valid URL').optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateHighlightSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const createHighlightStorySchema = z.object({
  mediaUrl: z.string().url('mediaUrl is required'),
  mediaType: z.enum(['image', 'video']).default('image'),
  caption: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  productIds: z.array(z.string().uuid()).max(2, 'A story can link at most 2 products').optional(),
});

const updateHighlightStorySchema = z.object({
  caption: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  productIds: z.array(z.string().uuid()).max(2, 'A story can link at most 2 products').optional(),
});

const reorderStoriesSchema = z.object({
  storyIds: z.array(z.string().uuid()).min(1, 'storyIds must not be empty'),
});

module.exports = {
  createVendorSchema,
  updateVendorSchema,
  listVendorsSchema,
  publicProductsSchema,
  PUBLIC_PRODUCTS_SORTS,
  PUBLIC_PRODUCTS_CONDITIONS,
  toggleVendorStatusSchema,
  VENDOR_STATUSES,
  // Vendor dashboard schemas
  updateVendorProfileSchema,
  searchVendorCustomersSchema,
  createVendorOrderSchema,
  vendorOrdersSchema,
  rejectOrderSchema,
  updateOrderStatusSchema,
  vendorProductsSchema,
  createProductSchema,
  updateProductSchema,
  toggleProductAvailabilitySchema,
  vendorAnalyticsSchema,
  vendorOrderHistorySchema,
  // variants + option groups
  variantInputSchema,
  updateVariantSchema,
  optionGroupInputSchema,
  optionGroupUpdateSchema,
  optionItemInputSchema,
  optionItemUpdateSchema,
  PACK_UNITS,
  SELECTION_RULES,
   optionGroupRuleError,
   createCallbackRequestSchema,
   // Shop story highlights
   createHighlightSchema,
   updateHighlightSchema,
   createHighlightStorySchema,
   updateHighlightStorySchema,
   reorderStoriesSchema,
   // Unified taxonomy (single Category -> Subcategory system)
   createCategorySchema,
   createSubcategorySchema,
   updateCategorySchema,
};
