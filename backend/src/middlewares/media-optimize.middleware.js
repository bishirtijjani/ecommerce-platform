/**
 * Response media-optimization middleware.
 *
 * Rewrites Cloudinary image URLs in every JSON response to an optimized
 * delivery variant (see utils/media.js). This is the single choke point that
 * fixes image performance across every consumer - the published customer app
 * included - without a client release: uploads store the raw `secure_url`, and
 * we only transform it on the way out.
 *
 * Mounted globally before the routes so it wraps `res.json` for all handlers.
 * Non-JSON responses (e.g. the admin CSV export via `res.send`) are untouched,
 * and a rewrite failure never breaks a response - we fall back to the original
 * body.
 */

const { optimizeMediaDeep } = require('../utils/media');

const mediaOptimizeMiddleware = (_req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    let payload = body;
    try {
      payload = optimizeMediaDeep(body);
    } catch (_err) {
      // A malformed/edge-case payload must never take down a request; send it
      // through unchanged instead.
      payload = body;
    }
    return originalJson(payload);
  };

  next();
};

module.exports = { mediaOptimizeMiddleware };
