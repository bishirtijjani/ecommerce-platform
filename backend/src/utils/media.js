/**
 * Cloudinary delivery optimization.
 *
 * Vendors/admin upload images straight to Cloudinary and we store the raw
 * `secure_url` (e.g. .../image/upload/v1791568404/<path>.jpg). Those are the
 * full-resolution originals - often 866 KB-1.8 MB phone photos/PNGs. Serving
 * them verbatim to list/grid screens is what made the customer app crawl.
 *
 * `optimizeImageUrl` injects Cloudinary delivery transforms so the CDN sends
 * a right-sized, auto-formatted (WebP/AVIF), auto-compressed variant instead.
 * Typical reduction is 20-35x (e.g. 1.8 MB PNG -> ~50 KB).
 *
 * Only `res.cloudinary.com/.../image/upload/...` URLs are touched. Video
 * uploads (`/video/upload/`), local `/shop-logos` paths, placeholders and
 * non-Cloudinary URLs pass through untouched.
 */

// `<cloud>/image/upload/` - the segment we splice the transform into. Anchored
// to Cloudinary's res host so arbitrary strings (e.g. our own /shop-logos) are
// never rewritten.
const CLOUDINARY_IMAGE_UPLOAD_RE =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;

// The exact prefix we inject - used to keep this idempotent when an optimized
// URL round-trips back through the API (e.g. a dashboard re-saving a fetched
// value), so we never stack transforms.
const INJECTED_TRANSFORM_PREFIX = "f_auto,q_auto,c_limit,w_";

const DEFAULT_WIDTH = 1080;

/**
 * Rewrite a single Cloudinary image URL with delivery transforms.
 *
 * @param {unknown} url
 * @param {number} [width] target max width (px); images are never upscaled
 *   because of the `c_limit` crop mode.
 * @returns {unknown} the optimized URL, or the input unchanged when it isn't a
 *   Cloudinary image URL / is already transformed / is not a string.
 */
const optimizeImageUrl = (url, width = DEFAULT_WIDTH) => {
  if (typeof url !== "string") return url;
  const match = url.match(CLOUDINARY_IMAGE_UPLOAD_RE);
  if (!match) return url;

  const [, base, rest] = match;
  // Already carries our transform - leave it (idempotent).
  if (rest.startsWith(INJECTED_TRANSFORM_PREFIX)) return url;

  const w =
    Number.isFinite(Number(width)) && Number(width) > 0
      ? Math.round(Number(width))
      : DEFAULT_WIDTH;
  return `${base}f_auto,q_auto,c_limit,w_${w}/${rest}`;
};

/**
 * Walk an arbitrary JSON-ish value and optimize every Cloudinary image URL it
 * contains. Mutates arrays/objects in place (cheap; payloads are already
 * materialized) and returns the same reference.
 *
 * Cycle-safe is not required here - API payloads are trees - but the depth is
 * unbounded only by the data, which is bounded by our query limits.
 */
const optimizeMediaDeep = (value, width = DEFAULT_WIDTH) => {
  if (typeof value === "string") return optimizeImageUrl(value, width);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = optimizeMediaDeep(value[i], width);
    }
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = optimizeMediaDeep(value[key], width);
    }
    return value;
  }
  return value;
};

module.exports = { optimizeImageUrl, optimizeMediaDeep };
