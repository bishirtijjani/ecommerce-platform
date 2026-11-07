# Notification Diagnosis — 2026-10-23

Scope: customer PWA/native app push, vendor notifications, admin-originated
notifications, and the reverse-marketplace Request fan-out.

Method: read the backend notification stack, inspected the running container
(`docker logs ecommerce`), queried the live database, and validated the push
configuration (VAPID keys / stored web-push subscriptions).

---

## 1. Verdict (TL;DR)

Notifications are **not primarily a delivery problem** — they are a
**generation problem**, plus one **registration problem** for native devices.

1. **The Request fan-out has never notified anyone.** The database has
   `request_pings = 0` for all 6 Requests ever created. The latest Request
   (2026-10-22 15:02) matched **zero sellers**, so `pingVendors()` created no
   pings and no notifications. This is the user-visible "customer makes a
   request to a vendor and nothing happens".
2. **Native push has never been registered.** `users.fcmToken` is non-null for
   **0 of 45 users**. The app's token-registration failure path only writes a
   `console.warn` on the device — the server never sees it.
3. **Admin/vendor lifecycle actions send email only.** Vendor approve / reject /
   suspend / unsuspend never call `pushAndSocket`.
4. **Web push is configured and healthy** (VAPID loaded, 13 subscriptions
   across 5 users, all 13 validate). When an event does fire, web push should
   deliver. But almost nothing has fired since 2026-10-12.
5. The in-app Notification Center pipeline itself works: 20 rows exist
   (12 CHAT, 7 SUPPORT, 1 REQUEST_EXPIRED), and the socket bridge is wired.

---

## 2. Evidence

### 2.1 Database (live `ecommerce` container)

| Metric | Value |
|---|---|
| Users | 45 (33 CUSTOMER, 11 VENDOR, 1 ADMIN) |
| Users with `fcmToken` | **0** |
| Web push subscriptions | 13 rows / 5 users (all Android Chrome) |
| Web push subscriptions that sign successfully | **13 / 13** |
| Notifications total | 20 |
| Notifications in last 48h | **0** |
| Notification types | 12 CHAT, 7 SUPPORT, 1 REQUEST_EXPIRED |
| Latest notification | 2026-10-12 17:34 UTC (CHAT) |
| Requests | 6 (5 OPEN, 1 EXPIRED) |
| Request pings | **0** |
| Vendors | 8 APPROVED, 3 PENDING_APPROVAL, 9 SUSPENDED |
| APPROVED vendors with a linked `userId` | 4 of 8 (4 have `userId = null`) |
| APPROVED, active, linked vendors | 4 |

### 2.2 Latest Request fan-out (2026-10-22 15:02 UTC)

```
title      : "I need"
category   : Electronics (…0007)
subcategory: TVs & Sound (46d5931a…)
state      : Katsina
lat/lng    : 23.728249, 57.3083463   ← this is in Oman, not Nigeria
reach      : NEARBY, radiusKm 15
pings      : 0
notifications: 0
```

Why zero matches (`backend/src/modules/request/request.service.js:89-200`):

- No APPROVED vendor is in `Electronics`, and no available product is in
  `Electronics > TVs & Sound`. The category/subcategory query returns nobody.
- Geo filter then removes everyone else. Three of the four eligible vendors have
  `lat = 0, lng = 0` (never geocoded); the fourth (FMK Clothing) has Abuja
  coordinates while its `state` says Katsina. A 15 km radius around
  `23.728, 57.308` excludes all of them by thousands of kilometres.
- There is **no fallback**: if the exact category and radius return nobody, the
  request silently goes dark. `pingVendors()` is called with `[]`, writes no
  pings, and creates no notifications.
- The customer receives **no notification at all** that the request was posted
  (or that nobody matched).

### 2.3 Logs

- `docker logs ecommerce`: no `Expo push`, `FCM send`, `Firebase`,
  `Notification persist`, `fan-out failed`, or `web push` errors at all.
  The absence of push logs is explained by `users.fcmToken = 0` (native path
  never runs) and by the request path never producing notifications.
- REST/socket auth shows normal 15-minute access-token expiry; the silent
  refresh works (`POST /auth/refresh 200`). Not the cause.

### 2.4 Push configuration

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` are
  set; `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` are set.
- `webpush.service.isConfigured() === true`.
- `web-push.generateRequestDetails()` succeeds for all 13 stored browser
  subscriptions, so the VAPID key pair is internally valid and the stored keys
  are well-formed.
- Repo has **no** `google-services.json` / `GoogleService-Info.plist`, and
  `app.json` has **no** `android.googleServicesFile` / `ios.googleServicesFile`.
- `app.json` does carry `extra.eas.projectId`
  (`a95f02ee-b847-4b29-93db-6268b4c76d14`).

### 2.5 App / channel facts

- `customer-dist` is an installable PWA (`manifest.display = "standalone"`,
  service worker registered, push + notificationclick handlers present).
- The PWA web bundle contains `webPush` and `push/subscribe` code.
- The native project is Expo SDK 54 (`expo-notifications ~0.32.17`).

---

## 3. Root causes, ranked

### P0 — Request fan-out matches nobody, silently

`backend/src/modules/request/request.service.js`

- `findMatches()` (line 89) has no relaxation path. Category miss → `[]`.
- `rankByGeo()` (line 100) treats missing coordinates as `(0,0)` and applies
  the radius unconditionally.
- `createRequest()` (line 364) calls `pingVendors()` but never notifies the
  customer. `pingVendors()` (line 203) returns `0` silently.
- `cancelRequest()` (line 484) does not notify sellers who responded.
- `respondToRequest()` does notify the customer (line 691) — that part is fine.

Net effect: the core "customer asks, seller gets notified" flow is dead
whenever supply/category/geo data is imperfect — which it currently is.

### P0 — Native device push was never registered

`app/src/services/notifications.js:18-58`

- `Notifications.getExpoPushTokenAsync()` is called **without a `projectId`**.
  SDK 54 looks for `Constants.easConfig?.projectId` or
  `Constants.expoConfig?.extra?.eas?.projectId`; in Expo Go / a misbuilt binary
  it throws `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID`.
- All registration errors are swallowed to `console.warn`. The backend therefore
  has no visibility and `fcmToken` stays null.
- Android APNs/FCM delivery also requires Firebase credentials present in the
  EAS build. This repo has no `google-services.json`, so that depends entirely
  on EAS project credentials being configured.
- `Notifications.setNotificationHandler` uses only the deprecated
  `shouldShowAlert`. SDK 54 requires `shouldShowBanner` and `shouldShowList`
  (`expo-notifications/build/Notifications.types.d.ts:600-610`); foreground
  notifications can be suppressed.

If the phone install is the **PWA**, native tokens are irrelevant and web push
is already subscribed (13 valid subscriptions). Either way, point 1 above is
why no notification arrives.

### P1 — Admin and vendor lifecycle actions only send email

`backend/src/modules/admin/admin.service.js`

- `notifyService` is imported (line 19) and **never called**.
- `approveVendor` (line ~855), `rejectVendor` (~880), `suspendVendor` (~905),
  `unsuspendVendor` (~945) send email only. No in-app row, no push.
- Admin account edits / status changes also produce no notification.
- Admin support-ticket replies **do** notify (`support.service.js:292,303`) and
  dispute messages notify (`support.service.js:528,699`), so the "admin replied"
  path is partly healthy — but only for support/disputes.

### P1 — Missing event coverage

| Event | In-app row | Push | Notes |
|---|---|---|---|
| Chat message | yes | yes | `chat.service.js:379` |
| Contact-vendor conversation opened | **no** | **no** | `startConversation` creates a thread silently |
| Request posted (customer confirmation) | **no** | **no** | no call in `createRequest` |
| Request matched to sellers | no (0 pings) | no | matcher returns empty |
| Seller replies to request | yes | yes | `request.service.js:691` |
| Request accepted / lost | yes | yes (winner) | loser is `silent: true` |
| Request cancelled by customer | **no** | **no** | `cancelRequest` notifies no one |
| Request expired | yes | no (`silent: true`) | deliberate |
| Callback request to vendor | **no** | **no** | email only, `vendor.service.js:439` |
| Vendor approved/rejected/suspended | **no** | **no** | email only |
| New order → vendor | yes | yes | `order.service.js:376` |
| Order status → customer | yes | yes | `notify.service.js:246` |
| Order message → other party | yes | yes | `order.service.js:792` |
| Support ticket / reply | yes | yes | support.service |
| Dispute created/replied/resolved | yes | yes | support.service |
| Welcome / "the app exists" | **no** | **no** | nothing on verify/login |
| Promotions / campaigns | **no** | **no** | `PROMOTION` type supported but never sent |

### P2 — No push observability or retry

- `notify.service.js:146-215` sends push fire-and-forget. Only
  `INVALID_TOKEN` is logged; success and non-fatal failures are invisible.
- The `notification-queue` exists and a worker is started
  (`queues/workers/notification.worker.js`) but **nothing enqueues to it**;
  sends bypass the queue, so there is no retry/backoff for transient errors.
- No `PushDelivery` record, no admin "send test push" endpoint, no metrics.

### P2 — Data quality

- 4 APPROVED vendors have `userId = null` → cannot be notified.
- 3 of 4 eligible vendors have `lat = 0, lng = 0`.
- FMK Clothing has `state = Katsina` but Abuja coordinates.
- 13 web-push subscriptions for 5 users includes duplicate endpoints per user
  (e.g. 5 for one customer) — harmless but noisy; stale ones should be pruned.

---

## 4. What is working

- `notify.service.pushAndSocket()` persists a `Notification`, emits
  `notification:new` to the user room, sends web push, then native push.
- Web push module is configured, all subscriptions sign, and the PWA service
  worker handles `push` + `notificationclick` + `pushsubscriptionchange`.
- The in-app Notification Center (`/notifications`), unread count, mark-read,
  and the Redux/socket bridge are wired and were exercised (20 rows, socket
  connect/disconnect logs).
- Firebase and VAPID env values are present in the runtime container.
- Support, dispute, chat, order, and order-message notifications do fire.

---

## 5. Recommended fixes (in order)

### P0-1 — Make Request matching degrade gracefully and never fail silently

In `request.service.js`:

1. Normalize vendor coordinates: treat `lat === 0 && lng === 0` as unknown.
   Include unknown-coordinate vendors in the candidate set instead of excluding
   them by radius.
2. If the category/subcategory + radius query returns 0, retry in order:
   state-only (ignore radius) → nationwide category → keyword match on
   title/description/vendor name/products.
3. In `createRequest()`, always send the customer a confirmation:
   `type: 'REQUEST_STATUS'`, title "Your request is live", body mentioning how
   many sellers were notified, `data.route = /requests/:id`.
4. If the final match set is empty, still create that confirmation with
   "We couldn't match a seller yet — we'll keep looking" and emit an ops alert.
5. In `cancelRequest()`, notify every seller with a non-withdrawn response.
6. Backfill/validate vendor coordinates and require them at onboarding; link the
   4 orphan vendors to their users.

### P0-2 — Fix native push registration

`app/src/services/notifications.js`:

1. Pass the project id explicitly:
   `Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId })`.
2. Add `shouldShowBanner: true` and `shouldShowList: true` to
   `setNotificationHandler` (keep `shouldShowAlert` for older SDKs).
3. Report registration failures to the backend (or Sentry) instead of only
   `console.warn`, so `fcmToken` failures are visible.
4. Ensure EAS has FCM (Android) / APNs (iOS) credentials, or add
   `android.googleServicesFile` / `ios.googleServicesFile`.
5. Show an in-app "notifications are off" banner with a link to system
   settings when permission is `denied`.
6. Verify by installing a build and checking `users.fcmToken` becomes non-null.

### P0-3 — Notify on admin and vendor lifecycle actions

In `admin.service.js`, after each successful mutation call `pushAndSocket` to
`vendor.userId` (or the affected `userId`):

- Vendor approved / rejected (include reason) / suspended / unsuspended.
- User status, email, or phone changed by an admin.
- Use `data.route` values the target app can resolve (`/vendor/settings`,
  `/vendor/orders`, `/notifications`).

### P1 — Fill coverage gaps

- `auth.service.verifyOtp` (and first login): send a welcome notification
  ("Welcome to Marketplace…") with `data.route = /home`.
- `chatService.startConversation`: notify the vendor that a customer opened a
  chat (or rely on the first message; document the choice).
- `vendorService` callback request: also notify the vendor in-app/push, not just
  email.
- `requestService.cancelRequest`: notify responders.
- Add a promotions/campaign send path using `type: 'PROMOTION'` and the existing
  `promotions` preference gate.

### P1 — Observability

- Log every push attempt as
  `{ channel: 'web'|'expo'|'fcm', userId, type, code, detail }`.
- Route sends through the existing `notification-queue` so transient failures
  retry with backoff.
- Add `GET /admin/notifications/health` and
  `POST /admin/notifications/test` (send to the calling admin) so the tray can
  be verified without waiting for a business event.
- Optionally add a `PushDelivery` table keyed by notification id + channel.

---

## 6. Verification runbook

After fixes, verify in this order:

1. **Registration**: log in on a real device; confirm
   `SELECT count(*) FROM users WHERE "fcmToken" IS NOT NULL;` increments
   (native) and `push_subscriptions` has a fresh endpoint (PWA).
2. **Request fan-out**: create a request in a category that has supply; confirm
   `request_pings` increments for each matched vendor, the customer gets a
   "request is live" row, and each vendor gets a `REQUEST_PING` row + tray push.
3. **Admin action**: approve/suspend a vendor; confirm a Notification row and a
   tray push for that vendor.
4. **Foreground display**: keep the app open and send a test push; confirm the
   banner (after adding `shouldShowBanner`/`shouldShowList`).
5. **Delivery logs**: `docker logs ecommerce | grep -i 'push\\|notification'`
   should show per-attempt results (currently it shows nothing).

---

## 7. One-line summary for stakeholders

The notification code that exists is sound, but almost nothing triggers it:
request matching returns no sellers, native devices never register a token, and
admin lifecycle actions never notify. Fixing matching + registration + admin
events will turn notifications back on; adding a delivery log will make the next
failure diagnosable.

---

## 8. Implementation status (2026-10-23)

All P0/P1 recommendations above were implemented in a **scratch clone**
(`/root/scratch/ecommerce`), per the VPS README. The live checkout at
`/opt/docker/apps/ecommerce/repo` was left untouched at `a9660ce`.

### Backend

- `services/notify.service.js`
  - Push type gate now maps `ORDER*`, `REQUEST*`, and `PROMOTION` correctly.
  - Native sends go through the BullMQ notification queue (retry/backoff) with
    an inline fallback when Redis is unavailable.
  - Every send logs channel, type, and result; invalid tokens are dead-lettered
    by the worker using the same helper.
  - Account/security alerts (`ACCOUNT`, `SYSTEM`) now reach suspended users.
  - Push payloads carry `requestId`, `conversationId`, `ticketId`, `disputeId`.
- `services/webpush.service.js`
  - Returns `{ sent, pruned, failed }`, logs 401/403 as a VAPID mismatch, and
    prunes 404/410 endpoints.
- `queues/workers/notification.worker.js`
  - Dead-letters invalid tokens, logs attempts, retries only transient errors.
- `modules/request/request.service.js`
  - Matcher relaxes geo in stages (state+radius -> state -> nationwide) and
    appends unknown-coordinate sellers instead of dropping them.
  - Excludes vendors with no linked user (they cannot receive anything).
  - Final keyword fallback uses the category/subcategory name, seller name,
    description, and product text (catches "Abu electronics" for Electronics).
  - `createRequest` always sends the customer a "request is live" notification,
    including an honest "still matching" message when nobody was notified.
  - `cancelRequest` notifies every seller who replied.
  - `findMatches` is exported for verification/tests.
- `modules/admin/admin.service.js`
  - Vendor approve/reject/suspend/unsuspend now create in-app rows + push in
    addition to email.
  - Customer/vendor account changes notify the owner (status, email, phone).
  - Activating a campaign broadcasts a `PROMOTION` notification to its audience
    (batched, only on the transition to `active`).
  - Added `getNotificationHealth()` and `sendTestNotification()`.
- `modules/admin/admin.controller.js`, `admin.routes.js`
  - `GET /admin/notifications/health`
  - `POST /admin/notifications/test`
- `modules/auth/auth.service.js`
  - Welcome notification after customer or vendor verification.
  - `requestAlerts` added to preference create/update.
- `modules/auth/auth.validator.js`
  - `requestAlerts` accepted by PATCH `/auth/notification-preferences`.
- `modules/chat/chat.service.js`
  - Opening a new customer conversation notifies the vendor.
- `modules/vendor/vendor.service.js`
  - "Request a callback" now pushes/in-app notifies the vendor, not just email.

### Customer app

- `services/notifications.js`
  - Passes `projectId` to `getExpoPushTokenAsync`.
  - Uses SDK 54 `shouldShowBanner` / `shouldShowList`.
  - Reports registration failures to Sentry instead of only `console.warn`.
  - Adds `getPushPermissionStatus()` and `openNotificationSettings()`.
- `services/webPush.js`
  - Reports VAPID/subscription failures to Sentry.
- `screens/profile/NotificationSettingsScreen.js`
  - Shows an "Notifications are off on this device" banner with an
    "Open settings" action; refreshes on screen focus.
  - Adds a "Request Alerts" toggle.
- `lib/notificationRoute.js`
  - `/vendor/*` notifications open the in-app Seller area.
- `package.json` / `package-lock.json`
  - `expo-constants` is now an explicit dependency.

### Vendor dashboard

- `components/layout/NotificationBell.tsx`
  - Notification taps now resolve `/requests/:id`, `/requests`,
    `/vendor/dashboard`, `/vendor/shop`, `/vendor/settings`, and account-status
    routes.

### Verification performed

- `node --check` passes for every modified backend file.
- ESLint passes for every modified app file.
- `tsc -p tsconfig.app.json --noEmit` passes for the vendor dashboard.
- Module graph (`queues` -> worker -> notify service) loads in a throwaway
  container.
- Live-DB matcher test for the previously-dead request
  (`49697c86…`, Electronics / TVs & Sound, Oman coordinates):
  **before:** 0 matches, 0 pings. **After:** 1 match,
  **Abu electronics** (a real vendor with a linked user).
- `GET /admin/notifications/health` reports:
  `webPushConfigured: true`, `usersWithDeviceToken: 0`,
  `webPushSubscriptions: 13`, `usersWithWebPush: 5`, `notificationsLast24h: 0`.

### Still required to turn native tray notifications on

1. Rebuild the backend image and deploy the scratch branch changes.
2. Rebuild the customer app (native) or redeploy the PWA export.
3. For a **native** install, EAS must have FCM (Android) and APNs (iOS)
   credentials, or the project must include `google-services.json` /
   `GoogleService-Info.plist`. The code now reports the failure to Sentry if
   these are missing, but it cannot supply the credentials.
4. For the **PWA**, the 13 existing subscriptions are valid; the next business
   event will exercise the new logging. Use
   `POST /admin/notifications/test` to verify the tray immediately.


### Post-audit hardening (second pass)

- Every notification now carries an explicit `data.audience`
  (`customer` | `vendor`). Shared paths such as `/requests/:id` and
  `/messages/:id` route to the correct side of the app.
- Service-worker + in-app route normalization for the vendor and admin PWAs
  (orders, requests, support, disputes, account status, shop, settings).
- Customer PWA cold-start notification taps carry `?audience=` so shared paths
  still route correctly when no app window is open.
- The customer app now unregisters its web-push subscription on logout, so a
  shared/logged-out device stops receiving that user's notifications.
- Admin force-cancel notifies both customer and vendor; admin order overrides
  notify the vendor; admin request removal and vendor profile edits notify the
  owner.
- Order status changes notify the vendor when the actor is not the vendor.
- Request repost sends a confirmation; expiry is no longer silent.
- Notification-queue enqueue has a 5s timeout with an inline-send fallback, so
  an unreachable Redis cannot leave a dispatch pending forever.
- Added `backend/scripts/audit-notification-readiness.js` (read-only) to list
  orphan vendors, missing/0,0 coordinates, token/subscription coverage, and
  duplicate subscriptions.

Additional verification:
- Routing unit matrix (vendor request, customer request, vendor/customer chat,
  orders, seller screens, support/dispute, custom-scheme and web deep links)
  produces the expected navigation actions.
- Preference gate unit checks (`ORDER_STATUS`, `REQUEST_PING`, `PROMOTION`,
  `ACCOUNT`) behave correctly.
- Full backend module graph (`queues` → worker → notify → order/admin/auth/
  request/chat/vendor) loads in a throwaway container.
- Live matcher still returns `Abu electronics` for the dead sample request.
- Readiness audit confirms 4 orphan approved vendors (now excluded from
  matching) and 3 approved vendors with 0,0 coordinates (now reachable via the
  fallback; ops should still set their pins).

- The customer PWA detects a rotated VAPID key and re-subscribes instead of
  reusing a subscription the push service would reject (401/403).

- Native logout clears the device FCM token server-side (gated on the
  `x-device-platform` header, so a web logout does not kill a native device
  that is still signed in elsewhere).
