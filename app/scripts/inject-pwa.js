/* Post-export step: turn the static web bundle into an installable PWA.
 *
 * Expo's `expo export` generates dist-web/index.html but doesn't link a manifest
 * or register a service worker. This script (run after export - see the
 * `build:web` npm script) copies the PWA static files into the export and injects
 * the manifest link, theme-color, apple-touch-icon, and SW registration into the
 * generated index.html. It's idempotent, so re-running is safe.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist-web");
const pub = path.join(root, "public");
const assets = path.join(root, "assets");

if (!fs.existsSync(dist)) {
  console.error("[pwa] dist-web not found - run `expo export --platform web` first.");
  process.exit(1);
}

// 1. Ensure the PWA static files are present in the export.
for (const f of ["manifest.json", "sw.js"]) {
  const src = path.join(pub, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, f));
}
// App icon used by the manifest + apple-touch-icon.
const iconSrc = path.join(assets, "icon.png");
if (fs.existsSync(iconSrc)) fs.copyFileSync(iconSrc, path.join(dist, "icon.png"));
// Logo used by the first-paint splash injected below (mirrors AppSplash).
const splashSrc = path.join(assets, "splash-icon.png");
if (fs.existsSync(splashSrc)) fs.copyFileSync(splashSrc, path.join(dist, "splash-icon.png"));

// 2. Inject the PWA tags + SW registration into index.html.
const indexPath = path.join(dist, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

const headTags = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0B3D24" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />`;
if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", `${headTags}\n  </head>`);
}

const swReg = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          // updateViaCache:'none' => the browser always revalidates sw.js (and
          // its imports) against the network, so a new deploy is detected.
          navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function (reg) {
            var reloaded = false;
            var pending = false;
            function applyUpdate() {
              // Don't yank the page out from under someone mid-action: if the
              // tab is in the foreground, wait until they leave and come back.
              // If it's already hidden, refresh now so they return updated.
              if (document.visibilityState === 'visible') { pending = true; }
              else if (!reloaded) { reloaded = true; window.location.reload(); }
            }
            function watch(worker) {
              if (!worker) return;
              worker.addEventListener('statechange', function () {
                // 'installed' + an existing controller => a NEW deploy is ready
                // (not the first install), so swap the running tab to it.
                if (worker.state === 'installed' && navigator.serviceWorker.controller) applyUpdate();
              });
            }
            watch(reg.installing);
            reg.addEventListener('updatefound', function () { watch(reg.installing); });
            document.addEventListener('visibilitychange', function () {
              if (document.visibilityState !== 'visible') return;
              if (pending && !reloaded) { reloaded = true; window.location.reload(); return; }
              reg.update(); // re-check for a fresh deploy each time the app is reopened
            });
          }).catch(function () {});
        });
      }
    </script>`;
if (!html.includes("serviceWorker.register('/sw.js'")) {
  html = html.replace("</body>", `${swReg}\n  </body>`);
}

// 3. First-paint splash. The web bundle takes a moment to boot, and until
// React mounted the PWA sat on a blank white page. This paints the brand
// splash (brand green, logo, white "Marketplace" lettermark below it) immediately;
// AppSplash removes the div the instant the live overlay covers it, so the
// swap is invisible. The timeout is a safety hatch: a bundle that never boots
// must not leave someone stuck on a green screen.
const splashHtml = `
    <div id="web-splash" style="position:fixed;inset:0;z-index:2147483647;background:#0B3D24;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <img src="/splash-icon.png" alt="" width="108" height="108" style="display:block;margin-bottom:18px;" />
      <div style="color:#FFFFFF;font-size:27px;font-weight:900;letter-spacing:-0.4px;">Marketplace</div>
    </div>
    <script>
      setTimeout(function () {
        var el = document.getElementById('web-splash');
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 10000);
    </script>`;
if (!html.includes('id="web-splash"')) {
  html = html.includes("</body>") ? html.replace("</body>", `${splashHtml}\n  </body>`) : html + splashHtml;
}

fs.writeFileSync(indexPath, html);
console.log("[pwa] manifest, service worker + first-paint splash injected into", path.relative(root, indexPath));
