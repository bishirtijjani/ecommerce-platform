# Console fill sheet - MySooq customer app

Everything you type into **App Store Connect** and **Google Play Console**, in
the order the consoles ask, with the value to paste. Copy from here.

Companion docs:
- Listing copy - `listing-customer-app.md`
- App privacy questionnaire - `app-store-privacy.md`
- Data safety form - `play-data-safety.md`
- Screenshot storyboard - `screenshot-plan.md`

Values that are **yours to supply** are marked `TODO:`.

---

## 0. Create the app records first (one-time)

### Google Play Console
`All apps → Create app`
| Field | Value |
|---|---|
| App name | `MySooq` |
| Default language | `English (United States)` |
| App or game | `App` |
| Free or paid | `Free` |
| Declarations (2 checkboxes) | tick both (Play policies + US export laws) |

### App Store Connect
`My Apps → + → New App`
| Field | Value |
|---|---|
| Platform | `iOS` |
| Name | `MySooq` |
| Primary language | `English (U.S.)` |
| Bundle ID | `ng.mysooq.customer` (must match `app.json`) |
| SKU | `NGMYSOOQCUSTOMER01` (internal only, can't be changed) |
| User Access | `Full Access` |

---

## 1. Google Play Console

### 1.1 Store settings
| Field | Value |
|---|---|
| App category | `Shopping` |
| Tags | `Local`, `Lifestyle` |
| Contact email | `support@mysooq.ng` |
| Contact phone | `+2349068149540` |
| Website | `https://mysooq.ng` |
| Countries/regions | `Nigeria` (add more later) |

### 1.2 Main store listing
| Field | Limit | Value |
|---|---|---|
| App name | 30 | `MySooq - Buy & Sell` *(19)* |
| Short description | 80 | `Shop local vendors, chat, and ask for what you can't find - all in one app.` |
| Full description | 4000 | *(the EN full description in `listing-customer-app.md`)* |
| App icon | 512×512 PNG | `store-assets/customer/icon-512.png` |
| Feature graphic | 1024×500 | `store-assets/customer/feature-graphic.png` |
| Phone screenshots | 2–8 | `playstore-customer-phone-*` (see §3) |
| 7" tablet screenshots | ≤8 | `playstore-customer-tablet-7-*` |
| 10" tablet screenshots | ≤8 | `playstore-customer-tablet-10-*` |

### 1.3 App content (the left-hand list - do all of these)
| Section | Answer |
|---|---|
| **Privacy policy** | `https://mysooq.ng/legal/privacy` |
| **App access** | *"All or some functionality is restricted"* → **Add instructions** → paste the §4 block (demo buyer login) |
| **Ads** | `No, my app does not contain ads` |
| **Content rating** | Start questionnaire → category `Utility, Productivity, Communication, or Other` → see §1.4 |
| **Target audience** | Age groups: `13-15`, `16-17`, `18 and over` |
| **News app** | `No` |
| **Data safety** | Fill from `play-data-safety.md`. See §1.5. |
| **Government apps** | `No` |
| **Financial features** | `No` *(no wallet, payments or lending in the customer app)* |
| **Health apps** | `No` |
| **COVID-19 contact tracing** | `No` |
| **Data deletion** | `https://mysooq.ng/legal/account-deletion` + DPO email |

### 1.4 Content rating questionnaire (IARC)
Category: `Utility, Productivity, Communication, or Other`

| Question | Answer |
|---|---|
| Violence / blood / sexual / nudity / language | `No` to all |
| Controlled substances | `No` |
| Gambling - real-money / simulated | `No` |
| User-generated content / users can interact | `Yes` |
| Users can share location | `Yes` |
| Digital purchases | `No` |
| Does the app allow users to communicate? | `Yes` |

Final rating: **Teen / PEGI 12**.

### 1.5 Data safety (summary of the form)
- Collects/shares data: **Yes**
- Encrypted in transit: **Yes** (TLS 1.2+)
- Deletion request method: **Yes** (in-app + DPO email)
- Families policy: **No**
- Per data type: use the tables in `play-data-safety.md`. Sharing column: all
  **No** (processors under DPA ≠ sharing).

### 1.6 Production / release
- Upload the `.aab` from `eas build --profile production --platform android`.
- Start on **Internal testing** → add testers → promote.
- Let **Play App Signing** be managed by EAS (default).

---

## 2. App Store Connect

### 2.1 App Information
| Field | Value |
|---|---|
| Name | `MySooq` |
| Subtitle | `Buy & sell from local vendors` *(29)* |
| Primary category | `Shopping` |
| Secondary category | `Lifestyle` |
| Content Rights | `No, it does not contain third-party content` |
| Age Rating | See §2.4 |

### 2.2 Pricing and Availability
| Field | Value |
|---|---|
| Price | `Free` |
| Availability | `Nigeria` (add territories later) |
| Phased Release | enable later, at release |

### 2.3 iOS App - version 1.0.0
| Field | Limit | Value |
|---|---|---|
| Promotional text | 170 | *(the EN promotional text in `listing-customer-app.md`)* |
| Description | 4000 | *(the EN full description)* |
| Keywords | 100 | `marketplace,shop,buy,sell,vendor,local,souq,second hand,wholesale,Nigeria,request,bazaar` |
| Support URL | - | `https://mysooq.ng/support` (TODO: confirm it resolves) |
| Marketing URL | - | `https://mysooq.ng` *(optional)* |
| Privacy Policy URL | - | `https://mysooq.ng/legal/privacy` |
| Version | - | `1.0.0` |
| Copyright | - | `2026 MySooq` |
| What's New | - | `First release. Browse local vendors, chat with sellers, and post a request for anything you can't find.` |
| Screenshots iPhone (required) | 3–10 | `appstore-customer-iphone-*` |
| Screenshots 13" iPad | 3–10 | `appstore-customer-ipad-*` |
| App icon 1024 | 1024×1024 | `store-assets/customer/icon-1024.png` (no alpha) |

### 2.4 Age Rating
Answer `No` everywhere except:
| Question | Answer |
|---|---|
| User-Generated Content | **`Yes`** |
| Users can share location | **`Yes`** |
| Unrestricted Web Access | `No` (external links open the OS browser) |

Result: **12+**. UGC + user-to-user messaging justify it.

### 2.5 App Privacy
Use `app-store-privacy.md`. Key answers:
- Data collected: **Yes** (Contact, User Content, Location, Identifiers,
  Purchases/order history)
- Not collected: financial info, payments, contacts, health, search history
- Tracking across other apps/sites: **No** → no ATT prompt needed

### 2.6 Export compliance (encryption)
| Field | Value |
|---|---|
| Uses encryption? | `Yes` - standard HTTPS/TLS only |
| Non-exempt encryption | **`No`** |

Already set permanently in `app/app.json`
(`ios.config.usesNonExemptEncryption: false` + `ITSAppUsesNonExemptEncryption`),
so ASC will stop asking.

### 2.7 App Review Information
| Field | Value |
|---|---|
| Sign-in required | **`Yes`** |
| Demo account | TODO: seeded buyer phone/email + password (see §4) |
| Contact first/last name | TODO: |
| Contact phone | `+2349068149540` |
| Contact email | `support@mysooq.ng` |
| Notes | paste the §4 block as-is |

---

## 3. Asset → upload slot map

All files live in `store-assets/customer/`. Upload order = listing order:
`home`, `discover`, `product`, `chat`, `request`, `storefront`, `sell`.

| Slot | Store | Files |
|---|---|---|
| App icon | Play (512) | `icon-512.png` |
| App icon | App Store (1024) | `icon-1024.png` |
| Feature graphic | Play only | `feature-graphic.png` |
| Phone screenshots | Play | `playstore-customer-phone-*.png` |
| 7" tablet screenshots | Play | `playstore-customer-tablet-7-*.png` |
| 10" tablet screenshots | Play | `playstore-customer-tablet-10-*.png` |
| iPhone screenshots (required) | App Store | `appstore-customer-iphone-*.png` (1206×2622) |
| iPad 13" screenshots | App Store | `appstore-customer-ipad-*.png` (2064×2752) |

App Store only needs the required iPhone set + the 13" iPad set. Play needs
each size uploaded separately.

---

## 4. Review-notes / app-access block (copy-paste)

Seed a demo buyer against PROD first, then paste this into **both** stores
(fill the credentials).

```
MySooq is a local marketplace (Nigeria). Buyers browse vendors and products,
chat with sellers (real-time), save items to a wishlist, and can post a
"request" describing something they can't find, then receive and accept offers
from sellers.

There is no in-app payment or checkout: buyers contact the seller and the
order is recorded by the vendor. Browsing and search are public; signing in is
required only for chats, orders, requests and account.

Sign in with this approved demo buyer:
  Email:    TODO (e.g. buyer.review@mysooq.ng)
  Password: TODO

The demo account ships with a chat thread, saved items, one request with
offers, and order history. Questions: support@mysooq.ng
```

---

## 5. Character-count quick table

| Field | Limit | Value length |
|---|---|---|
| App name | 30 | 19 |
| Apple subtitle | 30 | 29 |
| Play short description | 80 | 75 |
| Apple keywords | 100 | 88 |
| Apple promotional text | 170 | 150 |

All fields are within their limits - paste as-is.

---

## 6. Before submit - both stores

- [ ] App records created (§0)
- [ ] Demo buyer seeded to PROD, creds pasted into §4 in both stores
- [ ] `https://mysooq.ng/legal/privacy`, `/legal/terms`, `/legal/account-deletion` all resolve
- [ ] Support URL + contact email/phone decided
- [ ] Company legal name + copyright line decided
- [ ] `ios.config.usesNonExemptEncryption: false` in `app.json` (done)
- [ ] `REPLACE_WITH_APPLE_TEAM_ID` + `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` filled in `app/eas.json`
- [ ] `app/mysooq-service-account.json` present (gitignored) for Android submit
- [ ] Builds uploaded: `.aab` → Play internal, `.ipa` → TestFlight
