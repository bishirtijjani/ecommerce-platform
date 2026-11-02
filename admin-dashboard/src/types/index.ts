export type VendorStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type OrderSource = 'CUSTOMER' | 'VENDOR';
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type CustomerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type KycStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'FAILED';
export type AdminPermission =
  | 'ALL'
  | 'MANAGE_USERS'
  | 'MANAGE_VENDORS'
  | 'MANAGE_FINANCE'
  | 'MANAGE_SUPPORT'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_STAFF';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  status: CustomerStatus;
  permissions: AdminPermission[] | null;
  vendorId: string | null;
  profilePicture?: string | null;
  roles?: { customer: boolean; vendor: VendorStatus | null };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
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
  source?: OrderSource;
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
  vendor?: { id: string; name: string; phone: string };
  shippingAddress?: SavedAddress;
  items: OrderItem[];
  discountCode?: { code: string } | null;
  rating?: { vendorScore: number | null; vendorComment: string | null } | null;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address?: string | null;
  state: string | null;
  lga: string | null;
  status: CustomerStatus;
  kycStatus: KycStatus;
  dateOfBirth: string | null;
  profilePicture: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends Customer {
  counts?: { orders: number; addresses: number };
  otherProfiles?: { vendor?: { id: string; name: string; status: VendorStatus } | null };
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
  state: string | null;
  lga: string | null;
  lat: number;
  lng: number;
  locationComplete?: boolean;
  missingLocationFields?: string[];
  openingTime: string;
  closingTime: string;
  openingDays: string[];
  logoUrl: string | null;
  coverImageUrl: string | null;
  photos: string[];
  policies: Record<string, string> | null;
  isActive: boolean;
  isOpen: boolean;
  adminActiveOverride: boolean;
  suspensionReason: string | null;
  rejectionReason: string | null;
  averageRating: number;
  totalOrders: number;
  createdAt: string;
  updatedAt: string;
  user?: { firstName: string; lastName: string; email: string; phone: string } | null;
  categories?: { id: string; name: string }[];
  tags?: { id: string; name: string; color: string | null }[];
}

export interface VendorTagJoin {
  tag: { id: string; name: string; color: string | null };
}

export type PackUnit = 'ML' | 'L' | 'G' | 'KG' | 'TABLET' | 'CAPSULE' | 'PIECE' | 'PAIR' | 'PACK' | 'BOTTLE' | 'SACHET' | 'CARTON';

export interface CategoryAttributeSchema {
  axes?: string[];
  pack?: boolean;
  packUnits?: PackUnit[];
  sizeSystem?: string;
  [key: string]: unknown;
}

export interface VendorCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  sortOrder: number;
  hasPreparation: boolean;
  isActive: boolean;
  attributeSchema: CategoryAttributeSchema | null;
  vendorId: string | null;
  owner?: { id: string; name: string } | null;
  owned?: boolean;
  /** Distinct vendors actually selling in this category (available products). */
  vendorCount?: number;
  _count?: { vendors: number; products: number };
  /** Returned inline by the admin list endpoint (global + vendor-created). */
  subcategories?: Subcategory[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  _count?: { vendors: number };
}

export interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  totalOrders: number;
  activeOrders: number;
}

export interface OrderStats {
  active: number;
  deliveredToday: number;
  cancelledToday: number;
}

export interface CustomerStats {
  total: number;
  active: number;
  suspended: number;
  kycVerified: number;
  kycPending: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  totalOrders: number;
  topVendors: { id: string; name: string; revenue: number; orders: number }[];
  revenueTrend: RevenuePoint[];
}

export interface RawRevenueAnalytics {
  totalRevenue: number;
  totalOrders: number;
  topVendors: { vendorId: string; _sum: { total: number | null }; _count: number }[];
  revenueTrend: { date: string; revenue: number; orders: number }[];
}

export interface OrderAnalytics {
  totalOrders: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
  cancellationRate: number;
}

export interface RawOrderAnalytics {
  totalOrders: number;
  ordersByStatus: { status: OrderStatus; _count: { status: number } }[];
  cancellationRate: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  topCustomers: { id: string; firstName: string; lastName: string; email?: string; orders: number }[];
}

export interface RawCustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  topCustomers: { id: string; firstName: string; lastName: string; email: string; orderCount: number }[];
}

/// New / pre-owned / Second Hand listing. Mirrors the backend ProductCondition enum.
export type ProductCondition = 'NEW' | 'USED' | 'SECOND_HAND';

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  categoryId: string;
  subcategoryId: string | null;
  basePrice: number;
  stock: number;
  imageUrl: string | null;
  images: string[];
  videoUrl: string | null;
  isAvailable: boolean;
  condition: ProductCondition;
  createdAt: string;
  updatedAt: string;
  vendor?: { id: string; name: string; isActive: boolean; status: VendorStatus };
  category?: { id: string; name: string; slug: string };
  subcategory?: { id: string; name: string } | null;
  orderCount?: number;
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  vendorId: string | null;
  owned: boolean;
  owner?: { id: string; name: string } | null;
  _count?: { products: number };
}

export interface Rating {
  id: string;
  orderId: string;
  customerId: string;
  vendorScore: number | null;
  vendorComment: string | null;
  createdAt: string;
  order?: { id: string; status: OrderStatus; total: number; vendor: { id: string; name: string } };
  customer?: { id: string; firstName: string; lastName: string; phone: string };
}

export interface CallbackRequest {
  id: string;
  vendorId: string;
  customerName: string | null;
  customerPhone: string;
  customerEmail: string | null;
  productId: string | null;
  note: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  vendor?: { id: string; name: string; phone: string; email: string };
  product?: { id: string; name: string; imageUrl: string } | null;
}

export type RequestStatus = 'OPEN' | 'ASSIGNED' | 'EXPIRED' | 'CANCELLED';
export type RequestReach = 'NEARBY' | 'ANYWHERE';

export interface RequestRow {
  id: string;
  title: string;
  status: RequestStatus;
  reach: RequestReach;
  radiusKm: number;
  address: string;
  // Optional: only set when the customer's GPS fix was available at compose.
  lat: number | null;
  lng: number | null;
  /// Nigerian State + LGA the need is in (customer-picked on compose).
  state?: string | null;
  lga?: string | null;
  category: { id: string; name: string; slug: string } | null;
  customer: { id: string; firstName: string; lastName: string; phone: string; profilePicture: string | null } | null;
  responseCount: number;
  pingCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface RequestResponseRow {
  id: string;
  vendorId: string;
  message: string;
  price: number | null;
  priceNote: string | null;
  etaText: string | null;
  status: string;
  createdAt: string;
  vendor: {
    id: string;
    name: string;
    logoUrl: string | null;
    averageRating: number;
    lat: number;
    lng: number;
    phone?: string;
  } | null;
}

export interface RequestDetail extends RequestRow {
  description: string | null;
  images: string[];
  videos: string[];
  quantity: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  neededBy: string | null;
  urgency: string;
  subcategory: { id: string; name: string; slug: string } | null;
  assignedVendorId: string | null;
  assignedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  responses: RequestResponseRow[];
  acceptedResponse: RequestResponseRow | null;
}

export interface ChatConversation {
  id: string;
  customer: { id: string; firstName: string; lastName: string; profilePicture: string | null; phone: string } | null;
  vendor: { id: string; name: string; logoUrl: string | null; phone: string; isActive: boolean; isOpen: boolean } | null;
  contextProductId: string | null;
  contextProductName: string | null;
  contextProductImage: string | null;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageSenderId: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: { id: string; firstName: string; lastName: string; role?: string };
  body: string;
  attachmentUrls: string[];
  createdAt: string;
}

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'paused';

export interface PlatformCampaign {
  id: string;
  name: string;
  type: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  spent: number;
  targetAudience: string;
  status: CampaignStatus;
  vendorId: string | null;
  vendor?: { id: string; name: string } | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  vendorId: string | null;
  vendor?: { id: string; name: string } | null;
  type: 'percentage' | 'fixed';
  discountPercentage: number | null;
  discountAmount: number | null;
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
  updatedAt: string;
}

export interface Highlight {
  id: string;
  vendorId: string;
  vendor?: { id: string; name: string; logoUrl: string | null };
  name: string;
  coverImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { stories: number };
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  deepLink: string | null;
  bgColor: string | null;
  startsAt: string | null;
  endsAt: string | null;
  audience: Record<string, unknown> | null;
  priority: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  number: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_USER' | 'RESOLVED' | 'CLOSED';
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
  user?: { id: string; email: string; firstName: string; lastName: string; role: string; phone: string };
  assignedTo?: { id: string; email: string; firstName: string; lastName: string } | null;
}

export interface Dispute {
  id: string;
  number: string;
  category: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'AWAITING_RESPONSE' | 'RESOLVED' | 'REJECTED';
  reason: string;
  description: string;
  attachmentUrls: string[];
  resolution: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  orderId: string;
  raisedById: string;
  resolvedById: string | null;
  raisedBy?: { id: string; email: string; firstName: string; lastName: string; role: string; phone: string };
  resolvedBy?: { id: string; email: string; firstName: string; lastName: string } | null;
  order?: {
    id: string;
    status: OrderStatus;
    total: number;
    customerId: string;
    vendorId: string;
    customer?: { id: string; firstName: string; lastName: string; phone: string };
    vendor?: { id: string; name: string };
  } | null;
}
