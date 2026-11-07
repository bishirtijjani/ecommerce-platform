# Marketplace — Vendor Dashboard

Web dashboard for Marketplace vendors: manage orders, catalogue, storefront profile, and marketing. Built to close the chat-commerce loop — customers browse and contact vendors in the mobile app, and vendors run the business from here.

## Stack

- React + TypeScript + Vite
- Tailwind CSS (design tokens mirrored from the customer app's `theme/tokens.js` — same forest-green/clay palette, light + dark mode)
- TanStack Query for server state, Zustand for auth/theme
- React Router, React Hook Form-free forms (plain controlled inputs), Leaflet for the location picker (no API key required), Recharts for analytics

## Getting started

```bash
npm install
cp .env.development .env.local   # optional: override VITE_API_URL for local dev
npm run dev
```

The app expects the backend (`../backend`) running and reachable at `VITE_API_URL` (defaults to `http://127.0.0.1:3000` in development, set in `.env.development`/`.env.production`).

## Structure

```
src/
  api/          Typed API client + per-module request functions
  components/   Shared UI kit (components/ui) + layout (sidebar, topbar, bottom nav)
  hooks/        React Query hooks per domain (orders, products, vendor, analytics, marketing)
  pages/        Route-level screens, grouped by feature
  store/        Zustand stores (auth session, theme)
  types/        Shared domain types matching the backend's Prisma schema
```

## Notes

- **Mobile-first**: most vendors use this on a phone. The shell uses a bottom tab bar below the `lg` breakpoint (sidebar is the desktop upgrade), list views render as tappable cards instead of tables on small screens, and modals become full-width bottom sheets.
- **Vendor status gating**: `VendorGate` routes PENDING_APPROVAL vendors through an onboarding wizard (drop a map pin, confirm hours) before showing the "under review" screen, and REJECTED/SUSPENDED vendors to dedicated status screens instead of a broken dashboard.
- **Image uploads** go straight to Cloudinary via a signed upload the backend issues (`/auth/upload-signature`) — files never pass through our server.
