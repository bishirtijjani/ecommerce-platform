#!/usr/bin/env node
/**
 * Seller API parity check.
 *
 * The customer app and the web vendor dashboard are two independent clients
 * of the same backend. They used to drift: the app sent `imageUrl` where the
 * backend wanted `mediaUrl`, asked for chat history with `cursor` when the
 * endpoint only understands `before`, and forgot `side: 'vendor'` so sellers
 * saw their own customer-side conversations. Every one of those was a bug,
 * and all of them were invisible until a seller hit the screen.
 *
 * This script makes the two clients agree by construction. It parses both API
 * layers and asserts that every shared function hits the same URL with the
 * same method, sends the same query params, and resolves to the same shape.
 *
 *   node scripts/check-seller-parity.mjs
 *
 * Exits non-zero when the two clients have drifted apart.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(APP_ROOT, "..");

const APP_API = join(APP_ROOT, "src/seller/api/vendorApi.js");
const WEB_API_DIR = join(REPO_ROOT, "vendor-dashboard/src/api");

// ============================================================
// Extraction
// ============================================================

/** Normalise a URL so `/vendors/vendor/:id/orders` compares equal on both sides. */
const normaliseUrl = (raw) =>
  raw
    .split("?")[0]
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/['"`]/g, "")
    .replace(/\s+/g, "");

/**
 * Classify what a function resolves to.
 *   payload       - the endpoint's data (`r.data`)
 *   payload.field - a single field of it (`r.data.count`)
 *   envelope      - the whole `{ success, message, data, meta }` wrapper
 *
 * Note that returning `api.get(...)` without a `.then` IS the envelope: the
 * axios response interceptor in src/services/api.js resolves with the
 * envelope, not with the payload.
 */
const classifyReturn = (body) => {
  if (/\.then\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\s*\.\s*data\s*\.\s*(\w+)/.test(body)) {
    const field = body.match(/\.then\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\s*\.\s*data\s*\.\s*(\w+)/)[1];
    return `payload.${field}`;
  }
  if (/\.then\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\s*\.\s*data\s*\)/.test(body)) return "payload";
  return "envelope";
};

/** Pull the query-parameter names out of a function body. */
const extractParams = (body) => {
  const params = new Set();
  // `params: { side: "vendor", ...params }` / `params: { limit: 1 }`
  for (const m of body.matchAll(/params\s*:\s*\{([^}]*)\}/g)) {
    for (const key of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) params.add(key[1]);
  }
  // `params: { side: "vendor", ...(cond ? { archived: "true" } : {}) }`
  for (const m of body.matchAll(/\{([^}]*?)\}\s*:\s*['"`]/g)) {
    for (const key of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) params.add(key[1]);
  }
  return params;
};

/**
 * Skip a TypeScript generic argument list starting at `i` (which points at
 * the `<`). Generic types can contain nested braces AND semicolons - e.g.
 * `api.get<unknown, { data: { requestId: string; declined: boolean } }>(...)`
 * - so a regex cannot be trusted to find the closing `>`.
 */
const skipGenerics = (src, i) => {
  let depth = 0;
  for (let j = i; j < src.length; j += 1) {
    const ch = src[j];
    if (ch === "<") depth += 1;
    else if (ch === ">") {
      depth -= 1;
      if (depth === 0) return j + 1;
    } else if (ch === "`" || ch === "'" || ch === '"') {
      // Skip over string literals so a `>` inside one is not counted.
      const quote = ch;
      j += 1;
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\") j += 1;
        j += 1;
      }
    }
  }
  return -1;
};

/**
 * Parse an API module into { name -> { method, url, shape, params } }.
 * Handles both the app's plain JS and the web's TypeScript generics.
 */
const parseApiModule = (file) => {
  const src = readFileSync(file, "utf8");
  const fns = new Map();

  const reDecl = /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*/g;
  let m;
  while ((m = reDecl.exec(src))) {
    const name = m[1];

    // The API call has to be the arrow function's value - not merely
    // somewhere later in the file - otherwise a plain helper such as
    // `VENDOR_BASE = (id) => `/vendors/vendor/${id}`` would be mistaken for
    // the next function's API call.
    const head = m[0];
    const callStart = m.index + head.length;

    // The function's body ends where the next export begins.
    const nextExport = src.indexOf("export const", m.index + 10);
    const bodyEnd = nextExport === -1 ? src.length : nextExport;

    const call = /api\s*\.\s*(get|post|put|patch|delete)\b/.exec(src.slice(callStart, bodyEnd));
    if (!call) continue;
    const method = call[1].toUpperCase();

    // Find the opening paren of the call, skipping any TS generics.
    let i = callStart + call.index + call[0].length;
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (src[i] === "<") {
      i = skipGenerics(src, i);
      if (i === -1) continue;
      while (i < src.length && /\s/.test(src[i])) i += 1;
    }
    if (src[i] !== "(") continue;

    // First argument is the path.
    const pathMatch = /^\(\s*[`'"]([^`'"]+)/.exec(src.slice(i));
    if (!pathMatch) continue;

    // Function body runs to the next `export const`.
    const start = m.index;
    const next = src.indexOf("export const", start + 10);
    const body = src.slice(start, next === -1 ? src.length : next);

    fns.set(name, {
      method,
      url: normaliseUrl(pathMatch[1]),
      shape: classifyReturn(body),
      params: extractParams(body),
      file,
    });
  }
  return fns;
};

// ============================================================
// Load
// ============================================================

if (!existsSync(APP_API)) {
  console.error(`✗ Cannot find the app's seller API layer at ${APP_API}`);
  process.exit(2);
}
if (!existsSync(WEB_API_DIR)) {
  console.error(`✗ Cannot find the web dashboard's API layer at ${WEB_API_DIR}`);
  process.exit(2);
}

const app = parseApiModule(APP_API);

const web = new Map();
for (const file of readdirSync(WEB_API_DIR).filter((f) => f.endsWith(".ts"))) {
  for (const [name, fn] of parseApiModule(join(WEB_API_DIR, file))) {
    // The first module wins, mirroring how the web's own imports resolve.
    if (!web.has(name)) web.set(name, fn);
  }
}

// ============================================================
// Compare
// ============================================================

const errors = [];
const warnings = [];

const shared = [...app.keys()].filter((k) => web.has(k)).sort();

for (const name of shared) {
  const a = app.get(name);
  const b = web.get(name);

  if (a.method !== b.method || a.url !== b.url) {
    errors.push(
      `${name}: app calls ${a.method} ${a.url} but the dashboard calls ${b.method} ${b.url}`,
    );
  }

  if (a.shape !== b.shape) {
    errors.push(
      `${name}: app resolves to "${a.shape}" but the dashboard resolves to "${b.shape}" ` +
        `(app: ${a.file.replace(REPO_ROOT + "/", "")}, web: ${b.file.replace(REPO_ROOT + "/", "")})`,
    );
  }

  // The dashboard is the reference client, so a param it sends and the app
  // does not is a bug in the app (that is exactly how `side: 'vendor'` and
  // `before` went missing).
  const missing = [...b.params].filter((p) => !a.params.has(p));
  if (missing.length) {
    errors.push(`${name}: app is missing query param(s) the dashboard sends: ${missing.join(", ")}`);
  }

  // Params only the app sends are allowed, but they are worth knowing about.
  const extra = [...a.params].filter((p) => !b.params.has(p));
  if (extra.length) {
    warnings.push(`${name}: app sends extra query param(s) the dashboard does not: ${extra.join(", ")}`);
  }
}

const appOnly = [...app.keys()].filter((k) => !web.has(k)).sort();
const webOnly = [...web.keys()].filter((k) => !app.has(k)).sort();

// ============================================================
// Report
// ============================================================

const rel = (p) => p.replace(REPO_ROOT + "/", "");

console.log(`Seller API parity — app (${app.size} fns) vs dashboard (${web.size} fns)`);
console.log(`Shared functions: ${shared.length}\n`);

for (const w of warnings) console.log(`  warn  ${w}`);
if (warnings.length) console.log("");

if (errors.length) {
  console.log(`✗ ${errors.length} parity violation(s):\n`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log("");
  console.log("The mobile app and the web dashboard must speak to the backend identically.");
  console.log("Fix the app to match the dashboard (or the other way round), then re-run.");
  process.exit(1);
}

console.log(`✓ No parity violations across ${shared.length} shared functions.`);

if (appOnly.length) {
  console.log(`\nApp-only endpoints (${appOnly.length}): ${appOnly.join(", ")}`);
}
if (webOnly.length) {
  console.log(`Dashboard-only endpoints (${webOnly.length}): ${webOnly.join(", ")}`);
}
console.log(`\nChecked ${rel(APP_API)} against ${rel(WEB_API_DIR)}/*.ts`);
