/**
 * Translates a server-supplied notification (or deep-link path) into a
 * navigation action consumable by `navigation.navigate(name, params)`.
 *
 * Some routes are shared by both sides of the marketplace (notably
 * `/requests/:id` and `/messages/:id`), so the backend tags every notification
 * with `data.audience: 'customer' | 'vendor'`. That tag decides which side of
 * the app a tap should open.
 *
 * Server-side route conventions (see backend/src/services/notify.service.js):
 *   customer: /order/:id, /requests/:id, /chat/:id, /support/ticket/:id
 *   vendor:   /vendor/orders/:id, /vendor/requests/:id, /messages/:id,
 *             /vendor/dashboard, /vendor/shop, /vendor/settings,
 *             /vendor/account/{pending,rejected,suspended}
 */

// IMPORTANT: tab names below MUST match MainTabNavigator's screen names
// (HomeTab/ChatsTab/CartTab/SellTab/AccountTab). A mismatch produces a
// silent "screen not found" inside the tab navigator, which presents as the
// tap switching to MainTabs but never moving to the intended tab. Profile and
// Orders are stack screens above MainTabs.
const ROUTE_MAP = [
  // ============================================================
  // Vendor-facing routes (open the in-app seller area)
  // ============================================================
  {
    re: /^\/?vendor\/orders\/([^/?#]+)/i,
    build: (m) => ({ name: 'Seller', params: { screen: 'SellerOrderDetail', params: { orderId: m[1] } } }),
  },
  {
    re: /^\/?vendor\/orders\/?$/i,
    build: () => ({ name: 'Seller', params: { screen: 'SellerTabs', params: { screen: 'SellerOrders' } } }),
  },
  {
    re: /^\/?vendor\/requests\/([^/?#]+)/i,
    build: (m) => ({ name: 'Seller', params: { screen: 'SellerRequestDetail', params: { requestId: m[1] } } }),
  },
  {
    re: /^\/?vendor\/requests\/?$/i,
    build: () => ({ name: 'Seller', params: { screen: 'SellerRequests' } }),
  },
  {
    re: /^\/?vendor\/shop\/?$/i,
    build: () => ({ name: 'Seller', params: { screen: 'SellerShopProfile' } }),
  },
  {
    re: /^\/?vendor\/settings\/?$/i,
    build: () => ({ name: 'Seller', params: { screen: 'SellerSettings' } }),
  },
  {
    re: /^\/?vendor\/account\/pending/i,
    build: () => ({ name: 'Seller', params: { screen: 'SellerPending' } }),
  },
  {
    re: /^\/?vendor\/account\/rejected/i,
    build: () => ({ name: 'Seller', params: { screen: 'SellerRejected' } }),
  },
  {
    re: /^\/?vendor\/account\/suspended/i,
    build: () => ({ name: 'Seller', params: { screen: 'SellerSuspended' } }),
  },
  {
    re: /^\/?vendor\/dashboard/i,
    build: () => ({ name: 'Seller' }),
  },
  {
    re: /^\/?vendor\/?$/i,
    build: () => ({ name: 'Seller' }),
  },

  // ============================================================
  // Customer-facing routes
  // ============================================================
  // /order/:id or /orders/:id → order history. The customer app has no
  // standalone order-detail screen, so the list is the correct destination.
  {
    re: /^\/?orders?\/[^/?#]+/i,
    build: () => ({ name: 'Orders' }),
  },
  // /orders → order history (stack screen - the bottom-tab slot is "Sell" now)
  {
    re: /^\/?orders\/?$/i,
    build: () => ({ name: 'Orders' }),
  },
  // /home → main tabs
  {
    re: /^\/?home\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'HomeTab' } }),
  },
  // /notifications → Notification Center
  {
    re: /^\/?notifications\/?$/i,
    build: () => ({ name: 'NotificationCenter', params: {} }),
  },
  // /requests/new → post a Request (must precede /requests/:id)
  {
    re: /^\/?requests\/new\/?$/i,
    build: () => ({ name: 'RequestCompose', params: {} }),
  },
  // /requests/:id → customer Request detail OR seller request detail.
  {
    re: /^\/?requests\/([^/?#]+)/i,
    build: (m, audience) =>
      audience === 'vendor'
        ? { name: 'Seller', params: { screen: 'SellerRequestDetail', params: { requestId: m[1] } } }
        : { name: 'RequestDetail', params: { requestId: m[1] } },
  },
  // /requests → customer "my Requests" OR the seller requests list.
  {
    re: /^\/?requests\/?$/i,
    build: (_m, audience) =>
      audience === 'vendor'
        ? { name: 'Seller', params: { screen: 'SellerRequests' } }
        : { name: 'MyRequests', params: {} },
  },
  // /chat/:id → customer-side chat thread. The backend uses /chat for
  // customer recipients and /messages for vendor recipients.
  {
    re: /^\/?chat\/([^/?#]+)/i,
    build: (m) => ({ name: 'ChatThread', params: { conversationId: m[1] } }),
  },
  // /messages/:id → vendor-side chat thread (chatSlice is customer-only, so
  // opening ChatThread for a vendor would post as the wrong side).
  {
    re: /^\/?messages\/([^/?#]+)/i,
    build: (m) => ({ name: 'Seller', params: { screen: 'SellerMessagesThread', params: { conversationId: m[1] } } }),
  },
  // /chats → Chats tab (conversation list)
  {
    re: /^\/?chats\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'ChatsTab' } }),
  },
  // /support/dispute/new/:requestId → CreateDispute (must precede /support/dispute/:id)
  {
    re: /^\/?support\/dispute\/new\/([^/?#]+)/i,
    build: (m) => ({ name: 'CreateDispute', params: { requestId: m[1] } }),
  },
  // /support/dispute/:id or /disputes/:id → DisputeDetail
  {
    re: /^\/?(?:support\/dispute|disputes?)\/([^/?#]+)/i,
    build: (m) => ({ name: 'SupportDisputeDetail', params: { disputeId: m[1] } }),
  },
  // /support/new → CreateTicket (must precede /support/:id)
  {
    re: /^\/?support\/new\/?$/i,
    build: () => ({ name: 'CreateSupportTicket', params: {} }),
  },
  // /support/ticket/:id or /support/:id → TicketDetail
  {
    re: /^\/?support\/(?:ticket\/)?([^/?#]+)/i,
    build: (m) => ({ name: 'SupportTicketDetail', params: { ticketId: m[1] } }),
  },
  // /support → My Tickets list
  {
    re: /^\/?support\/?$/i,
    build: () => ({ name: 'MyTickets', params: {} }),
  },
];

const matchRoute = (routePath, audience) => {
  if (!routePath) return null;
  for (const rule of ROUTE_MAP) {
    const m = routePath.match(rule.re);
    if (m) {
      const out = rule.build(m, audience);
      if (out) return out;
    }
  }
  return null;
};

/**
 * From a notification row OR plain route string, return a navigation action,
 * or null if nothing matches - callers must no-op rather than crash on a
 * null return.
 */
export const routeToScreen = (n) => {
  if (!n) return null;
  // Direct route string.
  if (typeof n === 'string') return matchRoute(n);

  const route = n?.data?.route || n?.route;
  const audience = n?.data?.audience;
  return matchRoute(route, audience);
};

/**
 * Parse a deep-link URL like `marketplace://orders` into the same action shape.
 * Returns null if the URL doesn't carry a known path. The scheme-agnostic
 * regex below means legacy `customerapp://…` URLs (pre-rename) still parse
 * correctly if a stale notification lands.
 */
export const parseDeepLink = (url, audienceOverride) => {
  if (!url) return null;
  try {
    const audienceFromQuery = url.match(/[?&]audience=(vendor|customer)\b/i)?.[1]?.toLowerCase();
    const audience = audienceOverride || audienceFromQuery;

    // Strip the scheme. For absolute web URLs also drop the host, but keep
    // the path for custom schemes (`marketplace://requests/123` → `requests/123`).
    let path = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const firstSegment = path.split('/')[0];
    if (firstSegment.includes('.') || firstSegment.includes(':')) {
      const slash = path.indexOf('/');
      path = slash === -1 ? '/' : path.slice(slash);
    }
    path = path.split(/[?#]/)[0];

    return matchRoute(path, audience);
  } catch (_) {
    return null;
  }
};
