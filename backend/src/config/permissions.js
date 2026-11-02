/**
 * Admin permission constants.
 * These strings are stored in the user.permissions array.
 */
const PERMISSIONS = {
  ALL: 'ALL', // Super Admin - can do everything
  MANAGE_USERS: 'MANAGE_USERS', // Customers
  MANAGE_VENDORS: 'MANAGE_VENDORS', // Vendors, Categories, Tags
  MANAGE_FINANCE: 'MANAGE_FINANCE', // Transactions, Revenue, Payouts
  MANAGE_SUPPORT: 'MANAGE_SUPPORT', // Tickets, Disputes
  MANAGE_SETTINGS: 'MANAGE_SETTINGS', // Platform settings, Marketing, Banners
  MANAGE_STAFF: 'MANAGE_STAFF', // Create/Edit other Admin users
};

module.exports = { PERMISSIONS };
