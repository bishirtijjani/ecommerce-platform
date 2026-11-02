export type VendorStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PackUnit =
  | 'ML' | 'L' | 'G' | 'KG' | 'TABLET' | 'CAPSULE' | 'PIECE' | 'PAIR' | 'PACK' | 'BOTTLE' | 'SACHET' | 'CARTON';
export type SelectionRule = 'REQUIRED_ONE' | 'OPTIONAL_ONE' | 'REQUIRED_MULTIPLE' | 'OPTIONAL_MULTIPLE';

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  status: string;
  vendorId: string | null;
  roles?: { customer: boolean; vendor: VendorStatus | null };
}

export interface VendorCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  hasPreparation: boolean;
  isActive: boolean;
  attributeSchema: { axes?: string[]; pack?: boolean; packUnits?: PackUnit[]; sizeSystem?: string } | null;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface VendorPolicies {
  shipping?: string;
  returns?: string;
  payment?: string;
  shopPolicies?: string;
}

export interface Vendor {
  id: string;
  userId: string | null;
  status: VendorStatus;
  name: string;
  description: string | null;
  phone: string;
  email: string | null;
  address: string;
  lat: number;
  lng: number;
  /// Nigerian State + LGA (shop location; drives Second Hand listing location).
  state?: string | null;
  lga?: string | null;
  locationComplete?: boolean;
  missingLocationFields?: string[];
  openingTime: string;
  closingTime: string;
  openingDays: string[];
  logoUrl: string | null;
  coverImageUrl: string | null;
  photos: string[];
  policies: VendorPolicies | null;
  isActive: boolean;
  isOpen: boolean;
  adminActiveOverride: boolean;
  suspensionReason: string | null;
  rejectionReason: string | null;
  averageRating: number;
  totalOrders: number;
  createdAt: string;
  updatedAt: string;
  user?: { firstName: string; lastName: string; email: string; phone: string };
  // Categories derived from the shop's available products.
  categories?: VendorCategory[];
}

/// Whether a listing is brand-new, normally-sold pre-owned, or a Second Hand
/// split. Mirrors the backend ProductCondition enum.
export type ProductCondition = 'NEW' | 'USED' | 'SECOND_HAND';

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string | null;
  attributes: Record<string, string>;
  packSize: number | null;
  packUnit: PackUnit | null;
  packLabel: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  images?: string[];
  videoUrl?: string | null;
  isAvailable: boolean;
}

export interface ProductOptionItem {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  priceDelta: number;
  imageUrl: string | null;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ProductOptionGroup {
  id: string;
  productId: string;
  name: string;
  selectionRule: SelectionRule;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  items: ProductOptionItem[];
}

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  categoryId: string;
  subcategoryId?: string | null;
  category?: VendorCategory;
  subcategory?: Subcategory;
  basePrice: number;
  stock: number;
  imageUrl: string | null;
  images?: string[];
  videoUrl?: string | null;
  isAvailable: boolean;
  condition: ProductCondition;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
  optionGroups: ProductOptionGroup[];
}

export interface SavedAddress {
  id: string;
  userId: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  isDefault: boolean;
}

export interface VendorCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  savedAddresses: SavedAddress[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  description: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  selectedOptions: { groupId: string; groupName: string; items: { itemId: string; itemName: string; priceDelta: number }[] }[] | null;
  specialInstructions: string | null;
  substitution: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customerId: string;
  vendorId: string;
  shippingAddressId: string;
  trackingNumber: string | null;
  subtotal: number;
  tax: number;
  total: number;
  discountAmount: number;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  confirmedAt: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; firstName: string; lastName: string; phone: string };
  shippingAddress?: SavedAddress;
  items: OrderItem[];
  rating?: { vendorScore: number | null; vendorComment: string | null } | null;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  fromUserId: string;
  body: string;
  createdAt: string;
  fromUser: { id: string; firstName: string; lastName: string; role: string };
}

export interface DiscountCode {
  id: string;
  code: string;
  vendorId: string | null;
  type: 'percentage' | 'fixed';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number;
  used: number;
  startDate: string | null;
  endDate: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
}

export interface HighlightStoryProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
}

export interface HighlightStory {
  id: string;
  highlightId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption: string | null;
  sortOrder: number;
  createdAt: string;
  products: HighlightStoryProduct[];
}

export interface Highlight {
  id: string;
  vendorId: string;
  name: string;
  coverImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stories: HighlightStory[];
  _count?: { stories: number };
}

export interface HighlightInput {
  name: string;
  coverImageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface StoryInput {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string | null;
  sortOrder?: number;
  productIds?: string[];
}

/**
 * The unified taxonomy shown on the vendor's category management page. A
 * single Category -> Subcategory system where each row is either global
 * (`owned: false`) or this vendor's own (`owned: true`). Vendors create their
 * own categories, add their own subcategories under any category, and can
 * edit the picture of any row (which updates the shared image).
 */
export interface TaxonomyCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  /** true = created by this vendor (private to them); false = global. */
  owned: boolean;
  /** false = hidden from the customer app by an admin. */
  isActive?: boolean;
  /** How many of this vendor's products sit in this category. */
  productCount?: number;
  subcategories: TaxonomySubcategory[];
}

export interface TaxonomySubcategory {
  id: string;
  name: string;
  imageUrl: string | null;
  /** true = created by this vendor; false = global. */
  owned: boolean;
  isActive?: boolean;
  /** How many of this vendor's products sit in this subcategory. */
  productCount?: number;
}

export interface CreateCategoryInput {
  name: string;
  imageUrl?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  imageUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrls: string[];
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; role: string; profilePicture: string | null };
}

/**
 * Conversation, as seen from the VENDOR side (the only side this dashboard
 * ever renders) - `customer` is always present, `vendor` is this vendor's
 * own summary. Mirrors the customer app's decorated shape (see
 * chat.service.decorateConversation on the backend) with the two sides
 * swapped.
 */
export interface Conversation {
  id: string;
  vendor: { id: string; name: string; logoUrl: string | null; phone: string | null; isOpen: boolean };
  customer: { id: string; firstName: string; lastName: string; profilePicture: string | null; phone: string | null };
  contextProductId: string | null;
  contextProductName: string | null;
  contextProductImage: string | null;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageIsMine: boolean;
  unread: boolean;
  otherLastReadAt: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus = 'OPEN' | 'ASSIGNED' | 'EXPIRED' | 'CANCELLED';
export type RequestReach = 'NEARBY' | 'ANYWHERE';

export interface RequestResponse {
  id: string;
  message: string;
  price: number | null;
  priceNote: string | null;
  etaText: string | null;
  status: string;
}

/**
 * A customer need pushed to matched sellers' private inboxes. `customer.phone`
 * is only present once this vendor's response has been accepted; until then
 * the backend hides it.
 */
export interface RequestItem {
  id: string;
  title: string;
  description: string;
  images: string[];
  videos: string[];
  quantity: number;
  budgetMin: number | null;
  budgetMax: number | null;
  neededBy: string | null;
  urgency: string;
  address: string;
  // Optional: only set when the customer's GPS fix was available at compose.
  lat: number | null;
  lng: number | null;
  /// Nigerian State + LGA the need is in (customer-picked on compose).
  state: string | null;
  lga: string | null;
  reach: RequestReach;
  radiusKm: number | null;
  status: RequestStatus;
  assignedVendorId: string | null;
  assignedAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string } | null;
  subcategory: { id: string; name: string; slug: string } | null;
  customer: { id: string; firstName: string; lastName?: string; phone?: string; profilePicture: string | null } | null;
  isOwner: boolean;
  responseCount: number;
  myResponse: RequestResponse | null;
  distanceKm?: number;
  pingedAt: string | null;
  seenAt: string | null;
}

export interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  completedOrders: number;
  period: '7d' | '30d' | '90d';
}

export interface Paginated<T> {
  data: T[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export type TicketCategory =
  | 'ACCOUNT' | 'PAYMENT' | 'ORDER' | 'DELIVERY' | 'PRODUCT' | 'TECHNICAL' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_USER' | 'RESOLVED' | 'CLOSED';

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  fromUserId: string;
  body: string;
  attachmentUrls: string[];
  isInternal: boolean;
  createdAt: string;
  fromUser: { id: string; firstName: string; lastName: string; role: string; profilePicture: string | null } | null;
}

/**
 * A support ticket raised by this vendor to the platform team. The list
 * endpoint returns summary rows (no `messages`); the detail endpoint includes
 * the full `messages` thread. Internal admin notes are stripped server-side
 * for non-admin viewers, so they never arrive here.
 */
export interface SupportTicket {
  id: string;
  number: number;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  attachmentUrls: string[];
  resolution: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  assignedToId: string | null;
  assignedTo: { id: string; email: string; firstName: string; lastName: string } | null;
  messages?: SupportTicketMessage[];
}

export interface CreateTicketInput {
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  attachmentUrls?: string[];
}
