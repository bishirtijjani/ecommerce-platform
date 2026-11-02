import * as ExpoLocation from "expo-location";
import api from "../services/api";

/**
 * Reverse geocoding: device first, then our backend, never raw coordinates.
 *
 * On native, expo-location's on-device geocoder returns a real place name.
 * On web (the customer PWA) there is no device geocoder, so we fall back to
 * the backend `/geo/reverse` proxy (Google Geocoding, key kept server-side).
 * If neither resolves we return an empty string so the UI shows a friendly
 * placeholder - coordinates are NEVER shown to the user as an address.
 */

const joinParts = (g) => {
  if (!g) return "";
  const parts = [g.name, g.street, g.district, g.subregion, g.city, g.region, g.country]
    .filter((p) => p && String(p).trim());
  return [...new Set(parts)].join(", ");
};

/** Server-side reverse geocode. Returns { address, city, state, lga, country } or null. */
const backendReverse = async (latitude, longitude) => {
  try {
    const envelope = await api.get("/geo/reverse", { params: { lat: latitude, lng: longitude } });
    return envelope?.data || null;
  } catch (_) {
    return null;
  }
};

/**
 * Free-text place/address search. Server-side so it works on the PWA too,
 * where expo-location has no forward geocoder.
 */
export const searchPlaces = async (query) => {
  try {
    const envelope = await api.get("/geo/search", { params: { query } });
    return Array.isArray(envelope?.data) ? envelope.data : [];
  } catch (_) {
    return [];
  }
};

/**
 * Resolve a human-readable address for a coordinate. Never throws and never
 * returns coordinates - resolves to "" when nothing is available.
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    const label = joinParts(results && results[0]);
    if (label) return label;
  } catch (_) {
    // Device geocoder unavailable (notably web) - fall through to backend.
  }
  const backend = await backendReverse(latitude, longitude);
  return backend?.address || "";
};

/** Best-effort short city/area name for a coordinate, for compact chips. */
export const reverseGeocodeShort = async (latitude, longitude) => {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    const g = results && results[0];
    if (g) {
      const short = g.city || g.subregion || g.district || g.region || g.name;
      if (short) return short;
    }
  } catch (_) {}
  const backend = await backendReverse(latitude, longitude);
  return backend?.city || backend?.state || "";
};

/**
 * Best-effort State name for a coordinate (the compose screen prefills its
 * State pick from this). Same device-then-backend order as above; resolves to
 * "" when nothing is available. Callers match it against NIGERIA_STATES, so a
 * foreign/unrecognised region is simply ignored.
 */
export const reverseGeocodeDetails = async (latitude, longitude) => {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    const g = results && results[0];
    if (g) {
      const address = joinParts(g);
      const state = g.region || "";
      const lga = g.subregion || g.city || g.district || "";
      if (address || state || lga) {
        return { address: address || "", state: state || "", lga: lga || "" };
      }
    }
  } catch (_) {
    // Device geocoder unavailable (notably web) - fall through to backend.
  }
  const backend = await backendReverse(latitude, longitude);
  return {
    address: backend?.address || "",
    state: backend?.state || "",
    lga: backend?.lga || "",
  };
};

export const reverseGeocodeState = async (latitude, longitude) => {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    const g = results && results[0];
    if (g?.region) return g.region;
  } catch (_) {
    // Device geocoder unavailable (notably web) - fall through to backend.
  }
  const backend = await backendReverse(latitude, longitude);
  return backend?.state || "";
};
