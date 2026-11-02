// Cloudinary URL optimizer.
//
// Requests are served from Cloudinary's full-resolution originals by default,
// which is slow on mobile and wastes bandwidth. Injecting transformation
// parameters (`w_`, `q_auto`, `f_auto`, `c_limit`) makes Cloudinary return a
// right-sized, auto-formatted (WebP/AVIF where supported), quality-optimized
// image. Combined with expo-image's disk cache this gives fast, persistent
// image loading.
//
// The transform is inserted right after `/image/upload/` (or after any existing
// version segment) so it composes with Cloudinary's versioned URLs.

const CLOUDINARY_UPLOAD_RE = /(\/image\/upload\/)(v\d+\/)?/;

export const optimizeCloudinaryUrl = (url, width = 600) => {
  if (typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  // Already transformed (has a width/quality param right after upload/)?
  if (/\/image\/upload\/(w_|q_|f_|c_)/.test(url)) return url;
  return url.replace(CLOUDINARY_UPLOAD_RE, (_, prefix, version) => {
    const transform = `f_auto,q_auto,c_limit,w_${width}`;
    return `${prefix}${transform}/${version || ""}`;
  });
};

// The API already rewrites Cloudinary URLs to a delivery variant
// (f_auto,q_auto,c_limit,w_1080). Grid/list cards only need a fraction of
// that, so replace the width in place and keep every other transform exactly
// as the backend/detail screens send it. Reordering the params here caused
// expo-image to render blank cards while the untouched detail URLs loaded.
const CLOUDINARY_WIDTH_RE = /\/image\/upload\/([^/]*?)w_\d+/;

export const withImageWidth = (url, width) => {
  if (typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  if (CLOUDINARY_WIDTH_RE.test(url)) {
    return url.replace(CLOUDINARY_WIDTH_RE, `/image/upload/$1w_${width}`);
  }
  return optimizeCloudinaryUrl(url, width);
};

// Recursively walk a value and optimize any Cloudinary image URL string found
// in `image(s)`, `logo`, `cover`, `avatar`, `photo`, `thumbnail`, `banner`
// fields or anywhere a string matches the Cloudinary upload pattern.
const IMAGE_FIELD_HINTS = /image|logo|cover|avatar|photo|thumbnail|banner|picture/i;

export const optimizeImagesInPayload = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return optimizeCloudinaryUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => optimizeImagesInPayload(v, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) return value;
    seen.add(value);
    const out = {};
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (typeof v === "string" && (IMAGE_FIELD_HINTS.test(key) || /res\.cloudinary\.com.*\/image\/upload\//.test(v))) {
        out[key] = optimizeCloudinaryUrl(v);
      } else {
        out[key] = optimizeImagesInPayload(v, seen);
      }
    }
    return out;
  }
  return value;
};