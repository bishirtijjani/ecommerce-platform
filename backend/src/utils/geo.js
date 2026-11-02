/**
 * Geo helpers shared by distance-based features (search, nearby, Requests).
 *
 * Straight-line (haversine) distance and a coarse lat/lng bounding box. The
 * bbox is a cheap pre-filter for a SQL WHERE; the exact radius test is done
 * in memory with haversineKm. Good enough for city/state scale; PostGIS
 * ST_DWithin is the upgrade path when the dataset grows.
 */

// Approximate degrees per km at Nigeria's latitude (~10°N).
const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

/**
 * Coarse bounding box around a point. Returns null when the inputs are
 * unusable so callers can skip the geo filter rather than query garbage.
 */
const buildBoundingBox = (lat, lng, radiusKm) => {
  const la = Number(lat);
  const ln = Number(lng);
  const r = Number(radiusKm);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || !Number.isFinite(r)) return null;
  const dLat = r / KM_PER_DEG_LAT;
  const dLng = r / Math.max(kmPerDegLng(la), 0.01);
  return {
    latMin: la - dLat,
    latMax: la + dLat,
    lngMin: ln - dLng,
    lngMax: ln + dLng,
  };
};

const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in km between two points. */
const haversineKm = (la1, lo1, la2, lo2) => {
  const R = 6371;
  const dLat = toRad(la2 - la1);
  const dLng = toRad(lo2 - lo1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

module.exports = { buildBoundingBox, haversineKm, KM_PER_DEG_LAT };
