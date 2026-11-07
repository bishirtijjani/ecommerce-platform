# Marketplace visual asset generator

Renders the Marketplace **customer app** store/brand assets and store screenshots
from HTML/CSS - no Figma, Inkscape, or Pillow required. One command, exact
store dimensions.

## Run

```bash
node store-assets/generator/render.mjs
# or, from the repo root:
npm run assets:customer
```

Requires Playwright Chromium (the repo-root `playwright` devDependency;
`npm install` at the repo root). `deviceScaleFactor=1` means the PNGs come out
at exactly the viewport size.

## Outputs

| File | Size | Notes |
|---|---|---|
| `app/assets/icon.png` | 1024×1024 | opaque, green mark on white |
| `app/assets/adaptive-icon.png` | 1024×1024 | transparent foreground, white mark |
| `app/assets/adaptive-icon-bg.png` | 1024×1024 | opaque green background |
| `app/assets/splash-icon.png` | 1024×1024 | transparent, white mark |
| `app/assets/favicon.png` | 256×256 | |
| `store-assets/customer/icon-1024.png` | 1024×1024 | Play/App Store listing |
| `store-assets/customer/icon-512.png` | 512×512 | Play listing |
| `store-assets/customer/feature-graphic.png` | 1024×500 | Play listing banner |
| `store-assets/customer/playstore-customer-phone-*.png` | 1080×1920 ×7 | Play phone |
| `store-assets/customer/playstore-customer-tablet-7-*.png` | 1200×1920 ×7 | Play 7" |
| `store-assets/customer/playstore-customer-tablet-10-*.png` | 1600×2560 ×7 | Play 10" |
| `store-assets/customer/appstore-customer-iphone-*.png` | 1206×2622 ×7 | App Store iPhone (required slot) |
| `store-assets/customer/appstore-customer-ipad-*.png` | 2064×2752 ×7 | App Store 13" iPad |

The 7 frames are `home, discover, product, chat, request, storefront, sell`
(see `docs/store/screenshot-plan.md` for the story order and captions).
App Store sizes differ from Play (Apple rejects Play dimensions); the iPhone
slot is the "Dynamic Island, medium" display (1206×2622) and the 13" iPad set
is required because `supportsTablet: true`. The same templates render at every
size because the layout is viewport-relative.

## How it works

- `brand.css` — Marketplace brand tokens mirrored from `app/src/theme/tokens.js`
  (light) and `brand/tokens.json`, plus the four Roboto weights (`fonts/`,
  Apache-2.0).
- `templates/icon.html` — one parametrized template for icon / adaptive icon /
  splash / favicon. Query params: `?bg=green|white|transparent`,
  `?color=green|white`, `?ratio=<mark width as a fraction of the canvas>`.
  The mark is the real `brand/logo.png`; the white variant is produced with a
  CSS `filter: brightness(0) invert(1)` so no second asset is needed.
- `templates/adaptive-bg.html` — the opaque green background for the Android
  adaptive icon (`android.adaptiveIcon.backgroundImage`).
- `templates/feature-graphic.html` — 1024×500 Play banner.
- `templates/screens/*.html` — the seven marketing frames. Header copy + a
  floating phone mockup + footer lockup. `frame.js` injects the iOS status bar,
  dynamic island and home indicator. Inside the mockup `1em === 1vh` (set on
  `.screen`), so the app UI scales with the phone at every canvas size.
- `templates/screens/screens.css` — marketing layout + phone shell + app
  component styles.
- `render.mjs` — serves the repo root over a throwaway localhost port (so
  `@font-face` and `brand/logo.png` load cleanly) and screenshots each template
  at its exact store size, for each device in `DEVICES`.

The mockups mirror the real screens in `app/src/screens` (Home, Search/Discover,
Product detail + ContactVendorSheet, ChatThread, RequestCompose, VendorStorefront,
Sell) - no wallet/delivery flows, matching the shipping marketplace app.

## Editing

- Change colors → `brand.css`.
- Change the icon's mark size → the `ratio` values in `render.mjs`.
- Change banner copy → `templates/feature-graphic.html`.
- Change screenshot copy/mock data → the relevant `templates/screens/*.html`.
- Add a frame → add a file + an entry in `SCREENS` in `render.mjs`.
- Add a device class → add an entry to `DEVICES` in `render.mjs`.
- The logo itself is `brand/logo.png` (single source of truth); re-run after
  it changes.
