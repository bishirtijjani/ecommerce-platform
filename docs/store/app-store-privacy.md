# App Store Connect - Privacy Questionnaire

Answers derived from the actual data model (`backend/prisma/schema.prisma`)
and the customer app (`app/src`). Use these to fill App Store Connect →
App Privacy when submitting the MySooq customer app.

Scope: the **customer app only** (`ng.mysooq.customer`).

---

## Data Types - what we collect

Apple's questionnaire is keyed on canonical data types. For each, three
follow-ups: (a) **is it linked to the user**, (b) **is it used for tracking**,
(c) **what purposes do we use it for**.

| Apple data type | Collected? | Linked to user? | Tracking? | Purposes |
|---|---|---|---|---|
| **Contact Info - Name** | Yes | Yes | No | App Functionality, Product Personalization |
| **Contact Info - Email** | Yes | Yes | No | App Functionality, Account management, Customer Support |
| **Contact Info - Phone Number** | Yes | Yes | No | App Functionality (login identity, OTP, buyer ↔ vendor contact) |
| **Contact Info - Physical Address** | Yes | Yes | No | App Functionality (saved delivery addresses, order shipping) |
| **Contact Info - Other User Contact Info** | Yes | Yes | No | Date of birth (account identity) |
| **Health & Fitness** | No | - | - | - |
| **Financial Info - Payment Info** | No | - | - | The customer app has no wallet, card, or payment flow. |
| **Financial Info - Credit Info** | No | - | - | - |
| **Financial Info - Other Financial Info** | No | - | - | No BVN/NIN captured in-app. |
| **Location - Precise Location** | Yes | Yes | No | App Functionality - map/location picker for saved addresses and for attaching a location to a request. Foreground only, no background tracking. |
| **Location - Coarse Location** | Yes | Yes | No | App Functionality - show listings, shops and vendors near you |
| **Sensitive Info** | No | - | - | - |
| **Contacts** | No | - | - | - |
| **User Content - Emails or Text Messages** | Yes | Yes | No | App Functionality - in-app buyer ↔ vendor chat and support threads |
| **User Content - Photos or Videos** | Yes | Yes | No | App Functionality - profile photo, request images/video, chat and support attachments |
| **User Content - Audio Data** | No | - | - | - |
| **User Content - Customer Support** | Yes | Yes | No | Customer Support - support tickets, disputes and their messages |
| **User Content - Other User Content** | Yes | Yes | No | App Functionality - requests (reverse marketplace), listing details, ratings/comments |
| **Browsing History** | No | - | - | - |
| **Search History** | No | - | - | - |
| **Identifiers - User ID** | Yes | Yes | No | App Functionality, Account management |
| **Identifiers - Device ID** | Yes | Yes | No | Security (device-tied sessions) and push targeting (Expo/FCM push token) |
| **Purchases - Purchase History** | Yes | Yes | No | App Functionality - order history (orders are logged by vendors; no in-app payment) |
| **Usage Data - Product Interaction** | No | - | - | - |
| **Usage Data - Advertising Data** | No | - | - | - |
| **Usage Data - Other Usage Data** | No | - | - | - |
| **Diagnostics - Crash Data** | No | - | - | - |
| **Diagnostics - Performance Data** | No | - | - | - |
| **Diagnostics - Other Diagnostic Data** | No | - | - | - |
| **Other Data Types** | No | - | - | - |

---

## Tracking declaration

**Do we use any data for tracking across other companies' apps and websites?**

**No.**

We do not share user identifiers, device identifiers, or behavioural data
with any third party for cross-app/site tracking, attribution, or
advertising. No ad SDK or tracker SDK is embedded in the app.

This means **no AppTrackingTransparency prompt is required**.

---

## Privacy Policy URL

```
https://mysooq.ng/legal/privacy
```

(The legal pages are bundled at `app/public/legal/` and must resolve at
submission time. See also `/legal/terms` and `/legal/account-deletion`.)

---

## Data Use Purposes (Apple's enum)

Every "Yes" row above maps to at least one:

- **Third-Party Advertising** - ✗ never selected
- **Developer's Advertising or Marketing** - ✗ never selected
- **Analytics** - ✗ not used (no product analytics SDK in the customer app)
- **Product Personalization** - ✓ name used for greeting
- **App Functionality** - ✓ the core uses (account, chat, requests, orders, location)
- **Other Purposes** - ✗ not used

---

## Third-party processors (for the privacy-policy parity statement)

The customer app sends limited data to processors that only act on MySooq's
instructions:

| Processor | Data | Purpose |
|---|---|---|
| Expo Push / Firebase Cloud Messaging | push token, notification content | deliver push notifications |
| WhatsApp Cloud API / Termii | phone number, OTP text | send login/verification codes |
| SMTP (transactional email) | email address, message content | receipts and account emails |
| Cloudinary | uploaded images/video | host profile, request, chat and support media |
| Google Maps Platform | latitude/longitude | map display, address picking, reverse geocoding |
| Socket.io (self-hosted) | chat/notification events | realtime chat and notifications |

---

## Account deletion

`Account → Security → Delete Account` calls `DELETE /auth/account`. This is a
soft delete + anonymization: sessions are revoked, and name, email, phone,
address and profile photo are removed/obfuscated. Order, rating, support and
dispute records are retained for legal/accounting reasons. A user with active
orders must complete or cancel them first. A DPO contact is published in the
privacy policy.

---

## What changes if we add features later

- Adding payments/checkout → declare **Financial Info - Payment Info** and
  **Purchases**, and re-answer the payments questions.
- Adding product analytics (e.g. PostHog) → flip **Usage Data** rows to Yes.
- Adding any cross-app tracking or ad SDK → triggers AppTrackingTransparency
  and a separate consent flow.
