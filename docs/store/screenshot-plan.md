# Store screenshots - capture plan

Both stores require screenshots in specific dimensions. This file is the
script for producing them - what to shoot, at which size, in which order.

MySooq marketing frames are generated at exact pixel sizes by
`store-assets/generator/render.mjs` (see its README) rather than captured from
a simulator, so they are reproducible from HTML/CSS. The capture-from-simulator
notes are kept for reference / for real product shots.

## Required dimensions

### Apple App Store

| Device class | Pixels | Status | Notes |
|---|---|---|---|
| **iPhone** (Dynamic Island, medium) | **1206 × 2622** portrait | **Required** | Apple's required iPhone slot since the Oct 2026 spec change; smaller iPhones auto-derive from this set |
| iPhone (Dynamic Island, large) | 1320 × 2868 portrait | Optional | 6.9"/6.7" class |
| iPad 13" | 2064 × 2752 portrait | Required IF you check "iPad" support | `"supportsTablet": true` is set, so yes |

Up to 10 screenshots per device class; we use **7**.

### Google Play Store

| Device class | Pixels | Status |
|---|---|---|
| **Phone** | 1080 × 1920 (9:16) | **Required**, min 2, recommended 4-8 |
| 7-inch tablet | 1200 × 1920 | Optional |
| 10-inch tablet | 1600 × 2560 | Optional |
| **Feature graphic** | **1024 × 500** | **Required** |

---

## The 7 frames (story order)

The order matters more than any single frame. Build a 7-frame arc.

| # | Frame (slug) | What's shown | Why this frame |
|---|---|---|---|
| 1 | **home** | Home screen: search + "Ask" chip, platform banners (China Market, Arab World, Wholesale, Second Hand), category grid, featured listings | Establishes scope - "this is a real marketplace, not one shop" |
| 2 | **discover** | Search / category browse with filters (price, condition, state/LGA, sort) and grid/list toggle | Shows shopping depth - filtering, sorting, discovery |
| 3 | **product** | Product detail: gallery, price, condition badge, trust badges, rating, "Contact vendor" (Call / Chat / Callback) | The core buying action - talking to the seller |
| 4 | **chat** | Buyer ↔ vendor chat thread with product context chip, typing/read receipts, attachments | The defining marketplace UX - chat commerce |
| 5 | **request** | "Ask sellers" request composer: description, photos, reach (nearby/anywhere), budget, urgency, map | The differentiator - post what you need, sellers respond |
| 6 | **storefront** | Verified vendor storefront: cover, verified badge, products, reviews, policies | Trust + proof that real shops live on the platform |
| 7 | **sell** | "Sell on MySooq": open your shop / manage dashboard, the 3-step how-it-works | Recruits sellers; closes the two-sided loop |

---

## Caption strategy (headline overlaid above the phone frame)

Keep them short - 4-7 words.

| # | Frame | Caption |
|---|---|---|
| 1 | home | "Everything local, one app." |
| 2 | discover | "Search, filter, compare." |
| 3 | product | "Talk to the seller." |
| 4 | chat | "Chat before you buy." |
| 5 | request | "Can't find it? Ask." |
| 6 | storefront | "Shop verified vendors." |
| 7 | sell | "Open your own shop." |

---

## How to capture (simulator, for real product shots)

1. **Use the iOS simulator** for canonical captures.
   - iPhone 16 Pro Max (1290 × 2796) or the 1206 × 2622 required size.
   - Run `npx expo start --ios` from `app/`.
   - `⌘+S` saves a PNG of the simulator window.
2. **Seed realistic demo data** before capturing - a fresh test account with
   believable shops, listings, a request with offers, and a chat thread. Avoid
   "Test User" and lorem-ipsum.
3. **Capture in English.** (The app also ships Hausa; only English store
   listings are submitted for now.)
4. **Caption overlays:** white headline, bold, top ~15% of the frame, on a
   solid brand band (forest green `#0B3D24`). Keep the bottom ~85% as the
   unaltered phone capture.
5. **Feature graphic** (Play only): 1024 × 500, brand-green background, the
   MySooq lockup + tagline. Avoid embedding tiny screenshots.

> The frames in `store-assets/generator/templates/screens/` render the
> marketing versions of each of these at every required size - the same
> templates produce the App Store and Play dimensions.

---

## File output (generated)

```
store-assets/customer/
├── icon-1024.png
├── icon-512.png
├── feature-graphic.png                         (1024×500)
├── playstore-customer-phone-{home,discover,product,chat,request,storefront,sell}.png           (1080×1920)
├── playstore-customer-tablet-7-{...}.png       (1200×1920)
├── playstore-customer-tablet-10-{...}.png      (1600×2560)
├── appstore-customer-iphone-{...}.png          (1206×2622)
└── appstore-customer-ipad-{...}.png            (2064×2752)
```

7 screens × 5 device classes = **35 screenshots**, plus icon-1024, icon-512
and the feature graphic.

---

## Anti-patterns to avoid

- ❌ Marketing copy that isn't visible in the actual app
- ❌ Heavy gradients / drop shadows around the phone frame
- ❌ Real customer phone numbers, emails or addresses
- ❌ Inconsistent status-bar time across frames (use 9:41)
- ❌ Empty states as a hero shot
- ❌ Captions that just narrate the screenshot ("This is the home page")
