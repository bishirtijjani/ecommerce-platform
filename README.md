# Multi-Vendor Marketplace

A multi-vendor e-commerce marketplace with a customer mobile app, a vendor dashboard, an admin dashboard and a Node.js backend. Built mobile-first for customers on varied devices and bandwidth.

**In production:** live on the App Store, Google Play and the web.

## Features
- **Customers (Expo app):** browse the catalogue, place orders, pay online, chat with vendors, push notifications
- **Vendors (web dashboard):** onboarding and approval, product management, order handling, chat
- **Admins (web dashboard):** vendor approval workflow, catalogue and order oversight
- **Payments:** online payments through Paystack and KatPay
- **Notifications:** mobile push (Firebase Cloud Messaging) and web push
- **Media & maps:** Cloudinary image storage, Google Maps location selection

## Stack
| Part | Technology |
|---|---|
| Customer app | React Native (Expo) |
| Admin & vendor dashboards | React + Vite |
| Backend API | Node.js, Express, Zod validation, JWT auth |
| Database | PostgreSQL + Prisma |
| Real-time & jobs | Socket.IO, Redis, BullMQ |
| Deployment | Docker, Nginx, Cloudflare, automatic deploys from GitHub |

## Repository layout
```
app/                 Expo customer app screens (Expo Router; project root holds app.json)
admin-dashboard/     React + Vite admin dashboard
vendor-dashboard/    React + Vite vendor dashboard
backend/             Express API, Prisma schema, BullMQ workers
docs/                Help and store documentation
store-assets/        App Store / Play Store assets
DESIGN.md            Design system (colours, typography, components)
```

## Running locally
```bash
# backend
cd backend && npm install
npm run db:migrate
npm run db:seed
npm run dev          # tests: npm test

# dashboards (admin-dashboard / vendor-dashboard)
cd admin-dashboard && npm install && npm run dev

# customer app (Expo project at the repo root)
npm install && npx expo start
```
Set the environment variables (database URL, Redis, payment keys, Cloudinary, Firebase) in each project's `.env` before running.

## License
See [LICENSE](LICENSE).
