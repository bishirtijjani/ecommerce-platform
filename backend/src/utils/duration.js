/**
 * Parse a JWT-style duration into milliseconds.
 *
 * Accepts the same shapes jsonwebtoken accepts for `expiresIn` ("30s", "15m",
 * "12h", "7d", "2w") plus a bare number of seconds. An unparseable value falls
 * back to `fallbackMs` rather than producing a session that expires immediately.
 */
const UNIT_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

const parseDurationMs = (value, fallbackMs) => {
  if (typeof value === "number" && Number.isFinite(value)) return value * 1000;
  const match = String(value || "").trim().match(/^(\d+)\s*(ms|s|m|h|d|w)?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  return amount * (UNIT_MS[unit] || 1000);
};

module.exports = { parseDurationMs };
