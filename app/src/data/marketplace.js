// Marketplace formatting/parsing utilities shared by the browsing screens.
//
// The mock VENDORS/PRODUCTS catalog that used to live here has been retired
// now that the backend has a real seeded catalog and public browse routes
// (see backend/src/modules/vendor/vendor.routes.js, store/slices/
// marketplaceSlice.js, and lib/normalizeMarketplace.js). Only the two
// pure helpers below survive, since they're just string formatting/parsing
// with no data behind them.

export const formatNaira = (amount) => `₦${Number(amount).toLocaleString("en-NG")}`;

// category path segments: "Clothing & Fashion > Women > Dresses" -> ["Clothing & Fashion", "Women", "Dresses"]
export const categorySegments = (categoryPath) => categoryPath.split(">").map((s) => s.trim());
