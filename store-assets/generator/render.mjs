// @ts-nocheck
/**
 * render.mjs - rasterize MySooq customer-app visual assets from the HTML/CSS
 * templates in this folder.
 *
 *   node store-assets/generator/render.mjs
 *
 * Serves the repo root over a throwaway localhost port (so @font-face and the
 * shared brand/logo.png load cleanly) and drives Playwright Chromium at exact
 * viewports with deviceScaleFactor=1, so PNGs come out at the exact store size.
 *
 * Outputs (all at 1x):
 *   app/assets/icon.png               1024x1024 (opaque)
 *   app/assets/adaptive-icon.png      1024x1024 (transparent foreground)
 *   app/assets/adaptive-icon-bg.png   1024x1024 (opaque background)
 *   app/assets/splash-icon.png        1024x1024 (transparent)
 *   app/assets/favicon.png             256x256
 *   store-assets/customer/icon-1024.png           1024x1024
 *   store-assets/customer/icon-512.png             512x512
 *   store-assets/customer/feature-graphic.png     1024x500
 *   store-assets/customer/playstore-customer-{phone,tablet-7,tablet-10}-*.png
 *   store-assets/customer/appstore-customer-{iphone,ipad}-*.png
 */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const ROOT = path.join(__dirname, '..', '..');
const GEN = __dirname;
const APP = path.join(ROOT, 'app', 'assets');
const STORE = path.join(ROOT, 'store-assets', 'customer');

// Resolve playwright from the repo-root devDependency, falling back to a
// globally/NODE_PATH-resolvable copy.
const { chromium } = (() => {
  try {
    return require(path.join(ROOT, 'node_modules', 'playwright'));
  } catch {
    return require('playwright');
  }
})();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404);
          return res.end('not found');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const SCREENS = [
  ['01-home.html', 'home'],
  ['02-discover.html', 'discover'],
  ['03-product.html', 'product'],
  ['04-chat.html', 'chat'],
  ['05-request.html', 'request'],
  ['06-storefront.html', 'storefront'],
  ['07-sell.html', 'sell'],
];

// Play uses one size per device class; App Store rejects Play dimensions, so
// the required iPhone slot (1206x2622) and 13" iPad (2064x2752) are separate.
const DEVICES = [
  { key: 'phone', w: 1080, h: 1920, prefix: 'playstore-customer-phone' },
  { key: 'tablet-7', w: 1200, h: 1920, prefix: 'playstore-customer-tablet-7' },
  { key: 'tablet-10', w: 1600, h: 2560, prefix: 'playstore-customer-tablet-10' },
  { key: 'ios-iphone', w: 1206, h: 2622, prefix: 'appstore-customer-iphone' },
  { key: 'ios-ipad', w: 2064, h: 2752, prefix: 'appstore-customer-ipad' },
];

async function shoot(page, url, out, w, h, { transparent = false } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, omitBackground: transparent });
  console.log(`  ✓ ${path.relative(ROOT, out)}  ${w}x${h}${transparent ? ' (transparent)' : ''}`);
}

async function launch() {
  let browser = null;
  for (const channel of ['msedge', 'chrome', null]) {
    try {
      browser = await chromium.launch(channel ? { channel, args: ['--allow-file-access-from-files'] } : { args: ['--allow-file-access-from-files'] });
      break;
    } catch (e) {
      if (!channel) throw e;
    }
  }
  return browser;
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const icon = (q) => `${base}/store-assets/generator/templates/icon.html?${q}`;

  console.log('Icons + splash:');
  await shoot(page, icon('bg=white&color=green&ratio=0.72'), path.join(APP, 'icon.png'), 1024, 1024);
  await shoot(page, icon('bg=white&color=green&ratio=0.72'), path.join(STORE, 'icon-1024.png'), 1024, 1024);
  await shoot(page, icon('bg=white&color=green&ratio=0.72'), path.join(STORE, 'icon-512.png'), 512, 512);
  await shoot(page, icon('bg=transparent&color=white&ratio=0.66'), path.join(APP, 'adaptive-icon.png'), 1024, 1024, { transparent: true });
  await shoot(page, `${base}/store-assets/generator/templates/adaptive-bg.html`, path.join(APP, 'adaptive-icon-bg.png'), 1024, 1024);
  await shoot(page, icon('bg=transparent&color=white&ratio=0.56'), path.join(APP, 'splash-icon.png'), 1024, 1024, { transparent: true });
  await shoot(page, icon('bg=white&color=green&ratio=0.72'), path.join(APP, 'favicon.png'), 256, 256);

  console.log('Feature graphic:');
  await shoot(page, `${base}/store-assets/generator/templates/feature-graphic.html`, path.join(STORE, 'feature-graphic.png'), 1024, 500);

  console.log('Store screenshots:');
  for (const d of DEVICES) {
    for (const [file, name] of SCREENS) {
      await shoot(
        page,
        `${base}/store-assets/generator/templates/screens/${file}?device=${d.key}`,
        path.join(STORE, `${d.prefix}-${name}.png`),
        d.w,
        d.h,
      );
    }
  }

  await browser.close();
  server.close();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
