#!/usr/bin/env node
/**
 * Seller payload contract check.
 *
 * The backend validates every write with a zod schema and then REPLACES
 * req.body with the parsed result (backend/src/middlewares/validate.middleware.js).
 * zod v3 runs in strip mode by default, so a key the schema does not know is
 * not an error - it is silently thrown away. A renamed field is worse: the
 * request 400s with the BACKEND's field name and the seller sees a generic
 * "Validation failed" toast with no hint what went wrong.
 *
 * That is exactly how these shipped:
 *   story    - the app sent `imageUrl`, the schema wants `mediaUrl`
 *   ticket   - the app sent `message`, the schema wants `description` (+ a
 *              required `category`)
 *   product  - the app sent `variants` on update, where the update schema has
 *              no such field, so every variant edit was silently discarded
 *
 * This script reads the app's real call sites, works out which keys each
 * payload carries, and compares them against the backend's zod schema for
 * that exact route. It needs no fixtures and no eval: it compares the KEYS
 * the app sends with the KEYS the schema accepts.
 *
 *   node scripts/check-seller-payloads.mjs [--verbose]
 *
 * Exits non-zero when a payload can never validate.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(APP_ROOT, "..");
const BACKEND_ROOT = join(REPO_ROOT, "backend");

const APP_API = join(APP_ROOT, "src/seller/api/vendorApi.js");
const APP_SELLER_DIR = join(APP_ROOT, "src/seller");

const VERBOSE = process.argv.includes("--verbose");

// ============================================================
// Source-scanning helpers
// ============================================================

/** Every .js file under a directory (recursively). */
const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".js")) out.push(full);
  }
  return out;
};

/**
 * Extract the balanced `{ ... }` starting at `start` (which must point at
 * the opening brace). Returns null when the braces never balance.
 */
const balancedObject = (src, start) => {
  if (src[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start + 1, i);
    } else if (ch === "`" || ch === "'" || ch === '"') {
      const quote = ch;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i += 1;
        i += 1;
      }
    } else if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
    }
  }
  return null;
};

/** Split the arguments of a call whose `(` is at `open`. */
const splitArguments = (src, open) => {
  // Start inside the call's parentheses, and do not include the opening
  // paren in the first argument - otherwise a single-argument call like
  // `createSupportTicket({ ... })` yields an argument that starts with "("
  // and no longer looks like an object literal.
  let depth = 1;
  let current = "";
  const parts = [];
  for (let i = open + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
      if (depth === 0) {
        parts.push(current);
        return parts;
      }
    }
    if (ch === "`" || ch === "'" || ch === '"') {
      const quote = ch;
      current += ch;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        current += src[i];
        if (src[i] === "\\") {
          i += 1;
          current += src[i];
        }
        i += 1;
      }
      current += src[i] ?? "";
      continue;
    }
    // A comma at the call's own depth separates two arguments.
    if (ch === "," && depth === 1) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  return null;
};

/** Split an object's body into its top-level parts. */
const splitTopLevel = (body) => {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "{" || ch === "[" || ch === "(") depth += 1;
    else if (ch === "}" || ch === "]" || ch === ")") depth -= 1;
    if (ch === "`" || ch === "'" || ch === '"') {
      const quote = ch;
      current += ch;
      i += 1;
      while (i < body.length && body[i] !== quote) {
        current += body[i];
        if (body[i] === "\\") {
          i += 1;
          current += body[i];
        }
        i += 1;
      }
      current += body[i] ?? "";
      continue;
    }
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
};

/** Find a `const|let|var <name> = {` in a file and return the object's body. */
const findLocalObject = (fileSrc, name) => {
  const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\{`, "g");
  const m = re.exec(fileSrc);
  if (!m) return null;
  const braceAt = m.index + m[0].length - 1;
  return balancedObject(fileSrc, braceAt);
};

/**
 * The top-level keys of an object literal body, resolving `...spread` by
 * looking the spread target up in the same file.
 */
const topLevelKeys = (body, fileSrc, depth = 0) => {
  const keys = new Set();
  if (depth > 5) return keys;
  for (const raw of splitTopLevel(body)) {
    const part = raw.trim();
    if (!part) continue;
    if (part.startsWith("...")) {
      const name = part.slice(3).trim().replace(/,$/, "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) {
        const spread = findLocalObject(fileSrc, name);
        if (spread) for (const k of topLevelKeys(spread, fileSrc, depth + 1)) keys.add(k);
      }
      continue;
    }
    const keyed = /^([A-Za-z_$][\w$]*)\s*:/.exec(part);
    if (keyed) {
      keys.add(keyed[1]);
      continue;
    }
    const shorthand = /^([A-Za-z_$][\w$]*)$/.exec(part);
    if (shorthand) keys.add(shorthand[1]);
  }
  return keys;
};

/**
 * Given an argument expression, return the object literal it refers to:
 *   { ... }              -> itself
 *   someLocalVariable    -> the `const someLocalVariable = { ... }` in the file
 * Returns null when it cannot be resolved statically.
 */
const resolveObjectLiteral = (expr, fileSrc) => {
  const trimmed = expr.trim();
  if (trimmed.startsWith("{")) return balancedObject(fileSrc, fileSrc.indexOf("{", fileSrc.indexOf(trimmed)));
  if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) return findLocalObject(fileSrc, trimmed);
  return null;
};

// ============================================================
// Backend: routes -> zod schemas
// ============================================================

const normaliseUrl = (raw) =>
  raw
    .split("?")[0]
    .replace(/\$\{[^}]+\}/g, ":p")
    // The backend names its params (`:vendorId`); the app interpolates
    // variables (`${vendorId}`). Both mean "one path segment".
    .replace(/:[A-Za-z_$][\w$]*/g, ":p")
    .replace(/['"`]/g, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") || "/";

/** Mount point of each router, from backend/src/app.js. */
const readMounts = () => {
  const src = readFileSync(join(BACKEND_ROOT, "src/app.js"), "utf8");
  const mounts = new Map();
  for (const m of src.matchAll(/app\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)Routes\s*\)/g)) {
    mounts.set(`${m[2]}Routes`, m[1] === "/" ? "" : m[1]);
  }
  return mounts;
};

/** Every route that validates a body/query, per routes file. */
const readRoutes = () => {
  const mounts = readMounts();
  const routes = [];
  const modulesDir = join(BACKEND_ROOT, "src/modules");

  for (const mod of readdirSync(modulesDir)) {
    const file = join(modulesDir, mod, `${mod}.routes.js`);
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    const prefix = mounts.get(`${mod}Routes`) ?? `/${mod}`;

    // router.<method>('<path>', ..., validate(<schema>), ...)
    for (const m of src.matchAll(
      /router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]\s*,\s*([\s\S]{0,400}?)\)\s*;/g,
    )) {
      const validate = /\bvalidate\(\s*(\w+)\s*(?:,\s*["'](\w+)["'])?\s*\)/.exec(m[3]);
      if (!validate) continue;
      routes.push({
        method: m[1].toUpperCase(),
        path: normaliseUrl(`${prefix}${m[2]}`),
        schemaName: validate[1],
        source: validate[2] || "body",
        module: mod,
        file,
      });
    }
  }
  return routes;
};

/**
 * Locate the validator module that defines a given schema.
 *
 * Schema names are NOT unique across modules - `updateVendorProfileSchema`
 * exists in BOTH admin.validator.js and vendor.validator.js, and they differ:
 * the admin one has no `state`/`lga` and adds `adminActiveOverride`. The
 * vendor one is the one the seller's own profile route uses.
 *
 * So the route's own module wins, and only if that fails do we search the
 * rest of the codebase.
 */
const findValidatorFile = (schemaName, preferredModule) => {
  const modulesDir = join(BACKEND_ROOT, "src/modules");
  const candidates = [];

  // A module can split its schemas across several files
  // (vendor/marketing.validator.js next to vendor/vendor.validator.js).
  if (preferredModule) {
    const modDir = join(modulesDir, preferredModule);
    if (existsSync(modDir)) {
      for (const f of readdirSync(modDir)) {
        if (f.endsWith(".validator.js")) candidates.push(join(modDir, f));
      }
    }
  }
  for (const mod of readdirSync(modulesDir)) {
    const file = join(modulesDir, mod, `${mod}.validator.js`);
    if (!candidates.includes(file)) candidates.push(file);
  }

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    if (new RegExp(`const\\s+${schemaName}\\s*=`).test(src)) return file;
  }
  return null;
};

const schemaCache = new Map();
const loadSchema = (schemaName, preferredModule) => {
  const key = `${preferredModule || "*"}::${schemaName}`;
  if (schemaCache.has(key)) return schemaCache.get(key);
  const file = findValidatorFile(schemaName, preferredModule);
  if (!file) {
    schemaCache.set(key, { error: `no validator file defines ${schemaName}` });
    return schemaCache.get(key);
  }
  let mod;
  try {
    mod = require(file);
  } catch (err) {
    schemaCache.set(key, { error: `cannot load ${file} (${err.code || err.message})` });
    return schemaCache.get(key);
  }
  const schema = mod[schemaName];
  if (!schema) {
    schemaCache.set(key, { error: `${schemaName} is not exported by ${file}` });
    return schemaCache.get(key);
  }
  schemaCache.set(key, { schema, file });
  return schemaCache.get(key);
};

// ============================================================
// App: API functions
// ============================================================

/**
 * Parse the app's API layer.
 *
 * For each function we also work out WHICH parameter becomes the request
 * body, so a hook wrapper like
 *   useUpdateVariant -> mutationFn: ({ variantId, input }) => V.updateVariant(vendorId, productId, variantId, input)
 * can be told apart from one that forwards the whole payload:
 *   useCreateProduct -> mutationFn: (input) => V.createProduct(vendorId, input)
 */
const readAppApi = () => {
  const src = readFileSync(APP_API, "utf8");
  const fns = new Map();

  const reFn =
    /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*api\s*\.\s*(get|post|put|patch|delete)\s*\(/g;
  let m;
  while ((m = reFn.exec(src))) {
    const [, name, paramList, methodLower] = m;
    const method = methodLower.toUpperCase();
    const open = m.index + m[0].length - 1;
    const args = splitArguments(src, open) || [];

    const url = (args[0] || "").trim().replace(/^[`'"]/, "").replace(/[`'"]$/, "");
    const bodyExpr = (args[1] || "").trim();
    const params = paramList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let bodyParam = null;
    let bodyLiteralKeys = null;

    if (["POST", "PUT", "PATCH"].includes(method)) {
      if (/^[A-Za-z_$][\w$]*$/.test(bodyExpr) && params.includes(bodyExpr)) {
        // The body is one of the function's own parameters.
        bodyParam = bodyExpr;
      } else if (bodyExpr.startsWith("{")) {
        // The body is an inline literal in the API layer itself.
        const body = balancedObject(src, src.indexOf("{", src.indexOf(bodyExpr, open)));
        if (body !== null) bodyLiteralKeys = topLevelKeys(body, src);
      }
    }

    fns.set(name, { method, url: normaliseUrl(url), bodyParam, bodyLiteralKeys, params });
  }
  return fns;
};

/**
 * Map each hook to the API function it calls, and record how it forwards the
 * mutation payload.
 *
 * The file is split at `export const` FIRST: a query hook has no
 * `mutationFn`, so a single regex over the whole file would happily reach
 * across it and attribute the NEXT hook's mutation to it.
 */
const readHookMap = () => {
  const src = readFileSync(join(APP_SELLER_DIR, "hooks/useSeller.js"), "utf8");
  const map = new Map();

  for (const block of src.split(/\nexport const /).slice(1)) {
    const name = /^(use\w+)/.exec(block)?.[1];
    if (!name) continue;
    const mf = /mutationFn:\s*\(([^)]*)\)\s*=>\s*V\.(\w+)\s*\(/.exec(block);
    if (!mf) continue; // a query hook - no mutation payload
    map.set(name, { apiFn: mf[2], paramPattern: mf[1].trim() });
  }
  return map;
};

// ============================================================
// App: the payloads each endpoint is actually called with
// ============================================================

const collectPayloads = (appApi, hookMap) => {
  const findings = [];

  for (const file of walk(APP_SELLER_DIR)) {
    const src = readFileSync(file, "utf8");

    // `const create = useCreateProduct();` -> alias -> hook
    const aliases = new Map();
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(use\w+)\s*\(/g)) {
      const hook = hookMap.get(m[2]);
      if (hook && appApi.has(hook.apiFn)) aliases.set(m[1], hook);
    }

    // Direct calls:  createStory(vendorId, highlightId, { ... })
    for (const m of src.matchAll(/\b(\w+)\s*\(/g)) {
      const name = m[1];
      const api = appApi.get(name);
      if (!api) continue;
      const open = m.index + m[0].length - 1;
      const args = splitArguments(src, open);
      if (!args || args.length === 0) continue;

      // The request body is the API function's LAST parameter, so the body's
      // value is the call's last argument.
      const body = resolveObjectLiteral(args[args.length - 1] || "", src);
      if (body === null) continue;
      findings.push({ apiFn: name, file, keys: topLevelKeys(body, src) });
    }

    // Hook calls:  create.mutateAsync({ ... })
    for (const [alias, hook] of aliases) {
      const api = appApi.get(hook.apiFn);
      if (!api) continue;

      // The API function's body is an inline literal in the API layer - the
      // hook's payload is not it, so there is nothing to compare here.
      if (api.bodyLiteralKeys) {
        findings.push({
          apiFn: hook.apiFn,
          file: join(APP_ROOT, "src/seller/api/vendorApi.js"),
          keys: api.bodyLiteralKeys,
        });
        continue;
      }

      // The hook forwards the whole mutation payload as one argument.
      const forwardsWholeObject =
        /^[A-Za-z_$][\w$]*$/.test(hook.paramPattern) && hook.paramPattern === api.bodyParam;
      if (!forwardsWholeObject) continue;

      for (const m of src.matchAll(new RegExp(`\\b${alias}\\.(?:mutate|mutateAsync)\\s*\\(`, "g"))) {
        const open = m.index + m[0].length - 1;
        const args = splitArguments(src, open);
        if (!args) continue;
        const body = resolveObjectLiteral(args[0] || "", src);
        if (body === null) continue;
        findings.push({ apiFn: hook.apiFn, file, keys: topLevelKeys(body, src) });
      }
    }
  }
  return findings;
};

// ============================================================
// Compare
// ============================================================

const errors = [];
const warnings = [];
const covered = new Set();

const routes = readRoutes();
const appApi = readAppApi();
const hookMap = readHookMap();
const payloads = collectPayloads(appApi, hookMap);

if (VERBOSE) {
  console.log(`Backend routes with a body/query schema: ${routes.length}`);
  console.log(`App API functions: ${appApi.size}`);
  console.log(`Hook -> api map: ${hookMap.size}`);
  console.log("\nPayload call sites found:");
  for (const f of payloads) {
    const api = appApi.get(f.apiFn);
    console.log(
      `  - ${f.apiFn} ${api ? `${api.method} ${api.url}` : "?"} keys=[${[...f.keys].join(", ")}] (${f.file.replace(APP_ROOT + "/", "")})`,
    );
  }
  console.log("");
}

for (const finding of payloads) {
  const api = appApi.get(finding.apiFn);
  if (!api) continue;

  // Only BODY schemas matter here: a `validate(schema, 'query')` schema
  // checks the URL's query string, not the payload we are comparing.
  const route = routes.find((r) => r.method === api.method && r.path === api.url && r.source === "body");
  if (!route) continue;

  const loaded = loadSchema(route.schemaName, route.module);
  if (!loaded || !loaded.schema) {
    // A schema we cannot load means the comparison did NOT happen. Reporting
    // that as a warning would let the check look green while checking
    // nothing, so it is an error.
    errors.push(
      `${finding.apiFn}: could not load ${route.schemaName} (${loaded?.error || "unknown error"}). ` +
        `Install the backend's dependencies first: cd ../backend && npm install`,
    );
    continue;
  }

  const zodShape = loaded.schema && loaded.schema.shape;
  if (!zodShape) continue; // not a plain object schema

  const allowed = new Set(Object.keys(zodShape));
  // A field is REQUIRED when zod cannot parse `undefined` for it.
  // `isOptional()` answers exactly that question (it is
  // `safeParse(undefined).success`), so a field is required when
  // isOptional() is FALSE.
  const required = Object.keys(zodShape).filter((k) => {
    const field = zodShape[k];
    if (typeof field.isOptional === "function") return !field.isOptional();
    return true;
  });

  const rel = finding.file.replace(APP_ROOT + "/", "");
  const unknown = [...finding.keys].filter((k) => !allowed.has(k));
  const missing = required.filter((k) => !finding.keys.has(k));

  if (unknown.length) {
    errors.push(
      `${finding.apiFn} (${rel}) sends ${unknown.join(", ")} but ${route.schemaName} only accepts ` +
        `${[...allowed].join(", ")}. zod strips unknown keys, so ${unknown.join(", ")} would be ` +
        `silently dropped - the request would succeed but the field would never be saved.`,
    );
  }
  if (missing.length) {
    errors.push(
      `${finding.apiFn} (${rel}) is missing required field(s) ${missing.join(", ")} for ${route.schemaName}.`,
    );
  }
  covered.add(finding.apiFn);
}

// ============================================================
// Report
// ============================================================

console.log(`Seller payload contract — ${payloads.length} payload call site(s) found\n`);

if (errors.length) {
  console.log(`✗ ${errors.length} payload violation(s):\n`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log("");
  process.exit(1);
}

for (const w of warnings) console.log(`  warn  ${w}`);
if (warnings.length) console.log("");

console.log(`✓ Every checked payload matches its backend schema.\n`);
console.log("Checked:");
for (const f of [...covered].sort()) {
  const a = appApi.get(f);
  const route = routes.find((r) => a && r.method === a.method && r.path === a.url && r.source === "body");
  console.log(`  ✓ ${f} → ${route ? route.schemaName : "?"}`);
}

const notChecked = [...appApi.keys()].filter((k) => !covered.has(k));
console.log(`\nApp endpoints not covered by this check (${notChecked.length}):`);
console.log(`  ${notChecked.join(", ")}`);
