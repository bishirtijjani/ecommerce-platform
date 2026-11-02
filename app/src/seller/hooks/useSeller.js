import { useSelector } from "react-redux";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import * as V from "../api/vendorApi";

/**
 * The vendor id lives in two places and both must be consulted:
 *   - `auth.user.vendorId` is set by /auth/profile during `hydrateAuth` and
 *     survives a cold start (auth is persisted to SecureStore).
 *   - `profile.profile.vendorId` is set by `fetchProfile()`, which is NOT
 *     persisted and is only dispatched once the biometric gate resolves.
 * Reading only `profile` left the seller screens spinning forever on a cold
 * start. The web dashboard reads a single source
 * (`useAuthStore(s => s.user?.vendorId)`); this mirrors that by preferring
 * `auth.user` and falling back to the profile.
 */
export const useVendorId = () =>
  useSelector((s) => s?.auth?.user?.vendorId || s?.profile?.profile?.vendorId || null);

export const useVendorProfile = () => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["vendor-profile", vendorId],
    queryFn: () => V.getVendorProfile(vendorId),
    enabled: !!vendorId,
    staleTime: 30000,
  });
};

export const useToggleShopStatus = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isOpen) => V.toggleVendorStatus(vendorId, isOpen),
    onSuccess: (data) => {
      qc.setQueryData(["vendor-profile", vendorId], data);
      Toast.show({ type: "success", text1: data?.isOpen ? "Shop open" : "Shop closed" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useVendorOrders = (params = {}) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["orders", vendorId, params],
    queryFn: () => V.getVendorOrders(vendorId, params),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useOrder = (orderId) =>
  useQuery({
    queryKey: ["order", orderId],
    queryFn: () => V.getOrderById(orderId),
    enabled: !!orderId,
    placeholderData: (prev) => prev,
  });

export const useAcceptOrder = (orderId) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => V.acceptOrder(vendorId, orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      Toast.show({ type: "success", text1: "Order accepted" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useRejectOrder = (orderId) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason) => V.rejectOrder(vendorId, orderId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      Toast.show({ type: "success", text1: "Order rejected" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useUpdateOrderStatus = (orderId) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, trackingNumber }) => V.updateOrderStatus(vendorId, orderId, status, trackingNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      Toast.show({ type: "success", text1: "Status updated" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useOrderMessages = (orderId) =>
  useQuery({
    queryKey: ["order-messages", orderId],
    queryFn: () => V.listOrderMessages(orderId),
    enabled: !!orderId,
    refetchInterval: 8000,
  });

export const usePostOrderMessage = (orderId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => V.postOrderMessage(orderId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-messages", orderId] }),
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useLogOrder = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => V.logVendorOrder(vendorId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      Toast.show({ type: "success", text1: "Order logged" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useVendorProducts = (params = {}) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["products", vendorId, params],
    queryFn: () => V.getVendorProducts(vendorId, { limit: 100, ...params }),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useProduct = (productId) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["product", vendorId, productId],
    queryFn: () => V.getVendorProductById(vendorId, productId),
    enabled: !!vendorId && !!productId,
    placeholderData: (prev) => prev,
  });
};

export const useCreateProduct = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => V.createProduct(vendorId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      Toast.show({ type: "success", text1: "Product created" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useUpdateProduct = (productId) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => V.updateProduct(vendorId, productId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", vendorId, productId] });
      Toast.show({ type: "success", text1: "Product updated" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useDeleteProduct = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId) => V.deleteProduct(vendorId, productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      Toast.show({ type: "success", text1: "Product deleted" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useToggleProductAvailability = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isAvailable }) => V.toggleProductAvailability(vendorId, productId, isAvailable),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

// Variants are reconciled one-by-one, exactly like the web dashboard does
// (vendor-dashboard/src/pages/products/ProductForm.tsx). The product update
// endpoint deliberately does not accept a `variants` array, so a bulk write
// would be silently dropped by the request schema.
export const useCreateVariant = (productId) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => V.createVariant(vendorId, productId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", vendorId, productId] });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useUpdateVariant = (productId) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, input }) => V.updateVariant(vendorId, productId, variantId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", vendorId, productId] });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useDeleteVariant = (productId) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId) => V.deleteVariant(vendorId, productId, variantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", vendorId, productId] });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useRequestInbox = (params = {}) =>
  useQuery({
    queryKey: ["request-inbox", params],
    queryFn: () => V.listRequestInbox(params),
    refetchInterval: 20000,
    placeholderData: (prev) => prev,
  });

export const useRequestUnreadCount = () =>
  useQuery({
    queryKey: ["request-unread-count"],
    queryFn: () => V.listRequestInbox({ seen: "false", limit: 1 }),
    refetchInterval: 20000,
    select: (page) => page?.unseenCount || 0,
  });

export const useRequest = (requestId) =>
  useQuery({
    queryKey: ["request", requestId],
    queryFn: () => V.getRequest(requestId),
    enabled: !!requestId,
    placeholderData: (prev) => prev,
  });

export const useRespondToRequest = (requestId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => V.respondToRequest(requestId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-inbox"] });
      qc.invalidateQueries({ queryKey: ["request-unread-count"] });
      Toast.show({ type: "success", text1: "Response sent" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useDeclineRequest = (requestId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => V.declineRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-inbox"] });
      qc.invalidateQueries({ queryKey: ["request-unread-count"] });
      Toast.show({ type: "success", text1: "Request declined" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useMarkInboxSeen = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => V.markInboxSeen(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-inbox"] });
      qc.invalidateQueries({ queryKey: ["request-unread-count"] });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useConversations = (archived = false) =>
  useQuery({
    queryKey: ["conversations", archived],
    queryFn: () => V.listConversations({ archived }),
    refetchInterval: 20000,
  });

export const useChatUnreadCount = () =>
  useQuery({
    queryKey: ["chat-unread-count"],
    queryFn: () => V.getChatUnreadCount(),
    refetchInterval: 20000,
  });

export const useConversation = (conversationId) =>
  useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => V.getConversation(conversationId),
    enabled: !!conversationId,
    placeholderData: (prev) => prev,
  });

export const useConversationMessages = (conversationId) =>
  useInfiniteQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: ({ pageParam }) => V.listChatMessages(conversationId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => (Array.isArray(lastPage) && lastPage.length >= 30 ? lastPage[0]?.createdAt : undefined),
    enabled: !!conversationId,
    placeholderData: (prev) => prev,
  });

export const useSendChatMessage = (conversationId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, attachmentUrls = [] }) => V.sendChatMessage(conversationId, body, attachmentUrls),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] }),
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useMarkConversationRead = (conversationId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => V.markConversationRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["chat-unread-count"] });
    },
  });
};

export const useSetConversationArchived = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, archived }) => V.setConversationArchived(conversationId, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useSalesSummary = (period) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["sales-summary", vendorId, period],
    queryFn: () => V.getSalesSummary(vendorId, period),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useOrderHistory = (params = {}) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["order-history", vendorId, params],
    queryFn: () => V.getOrderHistory(vendorId, params),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useDiscountCodes = () => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["discounts", vendorId],
    queryFn: () => V.getDiscountCodes(vendorId),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useCreateDiscountCode = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => V.createDiscountCode(vendorId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discounts", vendorId] });
      Toast.show({ type: "success", text1: "Discount created" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useVendorCampaigns = () => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["campaigns", vendorId],
    queryFn: () => V.getVendorCampaigns(vendorId),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useCreateCampaign = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => V.createVendorCampaign(vendorId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", vendorId] });
      Toast.show({ type: "success", text1: "Campaign created" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useVendorHighlights = () => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["highlights", vendorId],
    queryFn: () => V.getVendorHighlights(vendorId),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useCreateHighlight = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => V.createHighlight(vendorId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["highlights", vendorId] });
      Toast.show({ type: "success", text1: "Highlight created" });
    },
    onError: (e) => Toast.show({ type: "error", text1: e?.message || "Error" }),
  });
};

export const useVendorTaxonomy = () => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ["taxonomy", vendorId],
    queryFn: () => V.getVendorTaxonomy(vendorId),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useSupportTickets = () => useQuery({ queryKey: ["support-tickets"], queryFn: () => V.getSupportTickets() });

export const useStates = () => useQuery({ queryKey: ["states"], queryFn: () => V.getStates(), staleTime: Infinity });
export const useLgas = (state) => useQuery({ queryKey: ["lgas", state], queryFn: () => V.getLgas(state), enabled: !!state });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => V.getCategories(), staleTime: Infinity });