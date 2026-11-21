# Ecommerce Platform

A mobile-first, multi-vendor commerce platform for local markets. Customers browse shops and products, chat with sellers and place orders, or post what they need and let sellers come to them. It ships as an **Expo app** (iOS, Android and installable web PWA), a **vendor dashboard**, an **admin dashboard** and a **Node.js backend**.

**Live on the iOS App Store, Google Play and the web.**

## Highlights
- **Reverse marketplace ("I need X, sellers respond"):** a customer posts a request with photos, videos, quantity, budget range, deadline and urgency. The platform matches relevant sellers by trade and distance (nearby radius or anywhere, with keyword fallback when no category is chosen), pushes it to them, and sellers reply with a message and an optional price.
- **Seller storefronts with Stories:** each vendor has a storefront with Instagram-style highlight tiles whose stories link straight to products, plus vendor-written shop policies (shipping, returns, payment, terms).
- **Real conversations:** customer ↔ seller chat threads and per-order messages, over Socket.IO with push notifications.
- **Built for how local trade works:** customers and sellers settle payment directly; orders track from pending → processing → shipped → delivered, and vendors can create orders themselves for customers who reach them offline.
- **Rich catalogue:** categories, subcategories and tags; product variants, option groups and pack units; item condition (new, used, second-hand).
- **Market sections:** dedicated sections for wholesalers, second-hand goods, imported goods markets and shops.
- **Local-first UX:** state and LGA location data, a GPS location picker, and the app available in **English and Hausa**.

## What's inside
| Part | Who uses it | Key features |
|---|---|---|
| **Customer app** (Expo / React Native, also a PWA) | Shoppers | Home & categories, market sections, search, product details, vendor storefronts & stories, cart & orders, post a request / my requests, chats, notification centre, callback requests, profile & support |
| **Vendor dashboard** (React + Vite + TypeScript) | Sellers | Onboarding & approval, products, categories, highlights/stories, orders, incoming customer requests, messages, marketing, analytics, settings, support |
| **Admin dashboard** (React + Vite + TypeScript) | Operations team | Vendor approval & suspension, customers, orders, requests, chat oversight, callback requests, ratings, categories & tags, home page curation, marketing, support |
| **Backend** (Node.js + Express) | All of the above | REST API, Socket.IO real-time, BullMQ workers for notifications and request fan-out |

## Platform features
- Vendor lifecycle: pending approval → approved / suspended / rejected, with KYC status
- Ratings, support tickets and disputes, waitlist, banners, discount codes and platform campaigns
- Notifications across mobile push (FCM), web push, in-app notification centre, SMS, email and WhatsApp
- Idempotency keys, audit log, role-based access, Zod validation, JWT auth
- Design system documented in [DESIGN.md](DESIGN.md); store listing assets generated from code (`store-assets/`)

## Stack
| Part | Technology |
|---|---|
| Customer app | React Native (Expo), Expo web export + PWA service worker |
| Dashboards | React, Vite, TypeScript |
| Backend API | Node.js, Express, Zod, JWT |
| Database | PostgreSQL + Prisma |
| Real-time & jobs | Socket.IO, Redis, BullMQ |
| Media & notifications | Cloudinary, Firebase Cloud Messaging, Web Push |
| Deployment | Docker, Nginx, Cloudflare, automatic deploys from GitHub |

## Repository layout
```
app/                 Expo customer app (iOS, Android, web/PWA)
vendor-dashboard/    React + Vite vendor dashboard
admin-dashboard/     React + Vite admin dashboard
backend/             Express API, Prisma schema, BullMQ workers, sockets
docs/                Help and store documentation
store-assets/        App Store / Play Store asset generator
DESIGN.md            Design system (colours, typography, components)
```

## Running locally
```bash
# backend
cd backend && npm install
npm run db:migrate
npm run dev

# dashboards (vendor-dashboard / admin-dashboard)
cd vendor-dashboard && npm install && npm run dev

# customer app
cd app && npm install
npx expo start        # web: npm run web
```
Set the environment variables (database URL, Redis, Cloudinary, Firebase, SMS/email providers) in each project's `.env` before running.

## License
See [LICENSE](LICENSE).
