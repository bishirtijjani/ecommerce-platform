/**
 * Shared location rules for customers and vendors.
 *
 * A vendor's shop location is the authoritative location used for browsing,
 * Requests and notifications. It is "complete" only when State, LGA, a real
 * street address and a usable map pin are all present.
 */

const PLACEHOLDER_ADDRESS = 'Pending - set in onboarding';

/** A pin is usable when it is finite, in range, and not the seeded (0,0). */
const isUsableCoord = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
};

const isPlaceholderAddress = (address) => {
  const value = String(address || '').trim();
  return !value || value === PLACEHOLDER_ADDRESS;
};

/** Returns the list of missing location fields (empty = complete). */
const missingVendorLocation = (vendor) => {
  if (!vendor) return ['state', 'lga', 'address', 'location'];

  const missing = [];
  if (!String(vendor.state || '').trim()) missing.push('state');
  if (!String(vendor.lga || '').trim()) missing.push('lga');
  if (isPlaceholderAddress(vendor.address)) missing.push('address');
  if (!isUsableCoord(vendor.lat, vendor.lng)) missing.push('location');
  return missing;
};

const isVendorLocationComplete = (vendor) => missingVendorLocation(vendor).length === 0;

module.exports = {
  PLACEHOLDER_ADDRESS,
  isUsableCoord,
  isPlaceholderAddress,
  missingVendorLocation,
  isVendorLocationComplete,
};
