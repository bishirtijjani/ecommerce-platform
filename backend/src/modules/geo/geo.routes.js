/**
 * Public geo reference data - Nigerian States + their LGAs, plus reverse
 * geocoding.
 *
 * States/LGAs are served from the exact JSON the Second Hand seed uses
 * (prisma/nigeria-states-lgas.json) so the dashboards' State/LGA selects and
 * the seed can never drift.
 *
 * Reverse geocoding exists because browsers (the customer PWA) have no
 * on-device geocoder, so the client previously fell back to printing raw
 * coordinates as the "address". We resolve a real place name server-side via
 * the Google Geocoding API (key in env, never shipped to the client) and cache
 * results to keep quota/cost down. No auth - same public data as the rest.
 */
const { Router } = require('express');
const { ApiResponse } = require('../../utils/api-response');
const { logger } = require('../../utils/logger');
const STATES = require('../../../prisma/nigeria-states-lgas.json');

const router = Router();

// All state names, for the State select.
router.get('/states', (_req, res) => {
  res.json(ApiResponse.success('States', STATES.map((s) => s.name)));
});

// LGAs for one state (case-insensitive), for the dependent LGA select.
router.get('/states/:state/lgas', (req, res) => {
  const wanted = String(req.params.state || '').trim().toLowerCase();
  const match = STATES.find((s) => s.name.toLowerCase() === wanted);
  res.json(ApiResponse.success('LGAs', match ? match.lgas : []));
});

// Free-text place/address search for the map pickers (Google Geocoding,
// restricted to Nigeria). Returns up to 6 normalized results.
router.get('/search', async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (query.length < 2) return res.json(ApiResponse.success('Search results', []));
  const results = await searchPlaces(query);
  res.json(ApiResponse.success('Search results', results));
});

// ============================================================
// Reverse geocoding
// ============================================================

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const CACHE_MAX = 2000;
const cache = new Map(); // "lat,lng" (4dp) -> { at, value }

// Components -> readable place name, de-duplicated so we never emit
// "Katsina, Katsina, Nigeria".
const buildLabel = (result) => {
  if (!result) return '';
  const byType = {};
  for (const c of result.address_components || []) {
    for (const t of c.types) byType[t] = c;
  }
  const pick = (...types) => {
    for (const t of types) if (byType[t]) return byType[t].long_name;
    return null;
  };
  const street = [pick('street_number'), pick('route')].filter(Boolean).join(' ');
  const parts = [
    street || null,
    pick('sublocality_level_1', 'sublocality', 'neighborhood'),
    pick('locality', 'postal_town', 'administrative_area_level_2'),
    pick('administrative_area_level_1'),
    pick('country'),
  ].filter(Boolean);
  const label = [...new Set(parts)].join(', ');
  return label || result.formatted_address || '';
};

/** Normalize Google region names onto the canonical State/LGA lists. */
const normalizeRegion = (rawState, rawLga) => {
  const stateEntry = STATES.find((s) => {
    const name = s.name.toLowerCase();
    const raw = String(rawState || '').toLowerCase();
    return raw === name || raw === `${name} state`;
  });
  const lga =
    stateEntry?.lgas.find((l) => l.toLowerCase() === String(rawLga || '').toLowerCase()) ||
    rawLga ||
    null;
  return { state: stateEntry?.name || rawState || null, lga };
};

/** Free-text place/address search, normalized for the map pickers. */
const searchPlaces = async (query) => {
  if (!GOOGLE_KEY) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=ng&components=country:NG&key=${GOOGLE_KEY}`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = await resp.json();
    if (body.status !== 'OK' || !body.results?.length) return [];

    return body.results
      .slice(0, 6)
      .map((result, index) => {
        const byType = {};
        for (const c of result.address_components || []) for (const t of c.types) byType[t] = c;
        const pick = (...types) => {
          for (const t of types) if (byType[t]) return byType[t].long_name;
          return null;
        };
        const lat = result.geometry?.location?.lat;
        const lng = result.geometry?.location?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const { state, lga } = normalizeRegion(
          pick('administrative_area_level_1'),
          pick('administrative_area_level_2'),
        );
        return {
          id: result.place_id || `geo-${index}`,
          label: buildLabel(result),
          address: result.formatted_address || buildLabel(result),
          lat,
          lng,
          state,
          lga,
        };
      })
      .filter(Boolean);
  } catch (err) {
    logger.warn('Forward geocode failed (non-fatal)', { query, error: err.message });
    return [];
  }
};

const reverseGeocode = async (lat, lng) => {
  const empty = { address: null, city: null, state: null, lga: null, country: null };
  if (!GOOGLE_KEY) return empty;

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = await resp.json();
    if (body.status !== 'OK' || !body.results?.length) return empty;

    const result = body.results[0];
    const byType = {};
    for (const c of result.address_components || []) for (const t of c.types) byType[t] = c;
    const pick = (...types) => {
      for (const t of types) if (byType[t]) return byType[t].long_name;
      return null;
    };

    // Normalize the Google region names onto our canonical State/LGA lists so
    // the values can be stored and matched without a separate picker.
    const rawState = pick('administrative_area_level_1');
    const rawLga = pick('administrative_area_level_2');
    const { state, lga } = normalizeRegion(rawState, rawLga);

    const value = {
      address: buildLabel(result),
      city: pick('locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1'),
      state,
      lga,
      country: pick('country'),
    };

    // Bound the cache so a busy day can't grow it without limit.
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    logger.warn('Reverse geocode failed (non-fatal)', { lat, lng, error: err.message });
    return empty;
  }
};

router.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json(ApiResponse.error('Invalid coordinates'));
  }
  const data = await reverseGeocode(lat, lng);
  res.json(ApiResponse.success('Location', data));
});

module.exports = router;
