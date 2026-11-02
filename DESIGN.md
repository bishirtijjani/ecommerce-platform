# Design System — MySooq

## 1. Brand

- **Name**: "MySooq" (Arabic for "my marketplace/bazaar") — confirmed platform name.
- **Positioning**: the marketplace/discovery layer itself is the product's identity — not payments, not delivery. Design should read as "a market you browse."
- **Audience**: Nigerian local-commerce vendors across any category — clothing/textile, vehicles, real estate, electronics, groceries, food, beauty, services, and more — and their customers, primarily mobile-first, variable bandwidth/device tier. Do not assume desktop-first or high-end-device interaction patterns, and do not assume a food-delivery-only vendor mix.

## 2. Color tokens

Palette drawn from raw clay/mud-brick architecture — deep umber-clay accents, forest green as the one carried saturated accent, warm neutrals, charcoal ink.

```
--color-forest-600: #0B3D24  /* THE carried accent — primary buttons, active nav, links */
--color-forest-700: #082A19  /* forest hover/pressed */
--color-forest-100: #EAF3EC  /* forest-tinted soft backgrounds (badges, selected states) */
--color-clay-900: #2B1B12   /* deepest umber — dark-mode base, high-emphasis text on light */
--color-clay-700: #5A3D2B   /* raised relief / borders on dark */
--color-clay-500: #8B5E3C   /* mid clay — secondary text, disabled states */
--color-limewash-100: #EDE4D0 /* card/section backgrounds, dark-mode text */
--color-charcoal: #201A16   /* body ink — warm-black, not pure #000 */
--color-error: #B3432B      /* warm red-clay error, not stock #EF4444 */
--color-success: #3D7A52    /* muted market-green, not stock #10B981 */
```

Background/surface/muted-text: white/near-white and neutral gray — not the clay/limewash tones, which are reserved for dark mode and accent/relief roles.

**Color strategy by surface** (see §5):

- **Website (Persuade)**: forest-600 carries 30–60% of the surface (section backgrounds, not just buttons) — the one place the brand gets to be bold.
- **Admin / vendor dashboards, mobile app (Operate)**: neutral-dominant, forest-600 appears only as the single actionable accent. Density and legibility outrank expression here.

Dark mode: `clay-900` base, `clay-700` raised surfaces/borders, `limewash-100` text.

**Verify contrast at implementation time** — `clay-500` on the white/near-white surface is close to the WCAG AA body-text threshold; confirm before shipping as anything other than large/secondary text.

## 3. Logo concept (no finished asset — construction spec)

**Construction logic**: an abstract threshold/archway silhouette built from stacked geometric relief units (triangles and lozenges, echoing Hausa mud-brick facade motifs), reading simultaneously as (a) a market stall entrance and (b) the letter "M." Two raised diamond units sit atop a wider triangular base, separated by a thin negative-space gap that doubles as a doorway.

- Must work as a single-color mark (favicons/app icons down to 16px).
- Wordmark pairs the mark with "MySooq" in the display face (§4), sentence case.

A first-pass execution exists at `brand/logo-mark.svg` (icon) and `brand/logo-lockup.svg` (mark + wordmark), tokens in `brand/tokens.json`. Not yet visually verified by a human — check both in a browser before use.

## 4. Typography

- **Display (website headlines only)**: a bold geometric sans with architectural weight (e.g. Archivo Expanded/Black).
- **Body / UI (all 4 surfaces)**: a clean neutral grotesk (e.g. Inter). Operate surfaces should not use the display face.
- Scale: standard 1.25 modular scale for dashboards; the website may break scale at the first-viewport headline.

## 5. Pattern language

The geometric relief motif (stacked triangle/lozenge units, §3) is the system's recurring signature, used sparingly as:

- Section dividers on the website (thin repeating relief strip, not a full background texture)
- Empty-state illustrations (abstracted, never literal building photography)
- Loading/skeleton states (subtle, low-contrast repeats of the motif unit)

Not a background texture behind body text — a signature accent, not wallpaper.

## 6. Per-surface guidance

| Surface | Mode | Notes |
|---|---|---|
| Marketing website | Persuade | First viewport is a dense "market floor" grid of real vendor categories, not a single hero image + CTA. Forest-green carries real surface area. Display face for headlines only. |
| Customer mobile app | Operate | Task is "find and order," not "be persuaded." Neutral-dominant palette, workhorse type. A dense vendor/category grid paired with a spatial "directory" view for browsing many small vendors at once — not a single infinite feed. |
| Vendor dashboard | Operate | Density and clarity first. Order-management and catalog screens should read fast; brand shows up in accent color and the relief motif on empty/loading states, never in layout novelty. |
| Admin dashboard | Operate | Same as vendor dashboard — internal ops tool. Lowest priority for brand expression, highest for information density and correctness. |

## 7. Motion

Restrained and functional on the 3 Operate surfaces (state transitions, loading, no decorative motion). On the website, motion may be more expressive at the first-viewport "market floor" grid, but must degrade gracefully on low-end devices/slow connections.

## 8. Open decisions (do not invent answers to these)

- Exact logo asset (construction spec only, §3 — needs an actual design pass)
- Launch city/market
- Competitive positioning/differentiation
