# Google Play Console - Data Safety Form

Source-of-truth for Play Console → Data safety, derived from
`backend/prisma/schema.prisma` and the processors in
`app/src/services`. Scope: the **MySooq customer app** (`ng.mysooq.customer`).

---

## Section 1 - Data collection & security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** - TLS 1.2+ on all client ↔ server traffic |
| Do you provide a way for users to request that their data be deleted? | **Yes** - Account → Security → Delete Account, plus the DPO email in the privacy policy |

---

## Section 2 - Data types collected

Play groups data into **categories**. For each sub-type we declare:
(a) collected, (b) shared, (c) optional or required, (d) purpose.

For MySooq, **"shared"** means **transferred to a third party**, NOT "used by
our service providers under a DPA". Per Play's definitions, processors
(Cloudinary, Expo/FCM, Termii/WhatsApp, SMTP, Google Maps) count as
data-processing partners, not data sharers, when they only process on our
behalf.

### Personal info

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Name | ✓ | - | Required | Account management; shown to vendors you contact |
| Email address | ✓ | - | Required | Account management, verification |
| Phone number | ✓ | - | Required | Account identity, OTP, buyer ↔ vendor contact |
| Address | ✓ | - | Optional | Saved delivery addresses / order shipping |
| Other personal info | ✓ | - | Optional | Date of birth |

### Financial info

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Purchase history | ✓ | - | Optional | Order history (orders are logged by vendors; no in-app payment) |
| User payment info | - | - | - | No wallet, card or payment flow in the customer app |
| Credit score | - | - | - | - |
| Other financial info | - | - | - | No BVN/NIN captured in-app |

### Location

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Approximate location | ✓ | - | Optional | Show listings, shops and vendors near you |
| Precise location | ✓ | - | Optional | Address/map picker; attach a location to a request. Foreground only, no background tracking. |

### Personal identifiers

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| User IDs | ✓ | - | Required | Account management |
| Device or other IDs | ✓ | - | Required | Session security, push notification targeting |

### Web & app activity

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Other in-app messages | ✓ | - | Required | Buyer ↔ vendor chat and support threads |
| Other user-generated content | ✓ | - | Optional | Requests (reverse marketplace), listing details, ratings/comments |
| App interactions | - | - | - | No product-analytics SDK |
| In-app search history | - | - | - | Not stored server-side or on device |
| Installed apps | - | - | - | - |
| Other actions | - | - | - | - |

### App info & performance

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Crash logs | - | - | - | - |
| Diagnostics | - | - | - | - |
| Other app performance data | - | - | - | - |

### Photos & videos

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Photos | ✓ | - | Optional | Profile photo, request images, chat/support attachments |
| Videos | ✓ | - | Optional | Request videos |

### Messages

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Emails | - | - | - | Transactional email is sent; inbound email is not stored on the user's behalf |
| SMS or MMS | - | - | - | OTPs sent via provider; we do not read the user's SMS |
| Other in-app messages | ✓ | - | Required | Buyer ↔ vendor chat and support threads |

### Files & docs / Health / Contacts / Calendar / Audio / Navigation

**None collected.**

---

## Section 3 - Security practices

| Item | Answer | Notes |
|---|---|---|
| Data is encrypted in transit | **Yes** | TLS 1.2+ everywhere |
| You provide a way to request deletion | **Yes** | In-app + DPO email |
| You follow the Families Policy | **No** | Not targeted at children; 13+ |
| Independent security review | **No** (not yet) | Disclose honestly; a review is planned |

---

## Section 4 - Data sharing (NOT processing)

**No data is "shared" in the Play Console sense.** The vendors we use
(Cloudinary, Expo Push / Firebase Cloud Messaging, WhatsApp Cloud API /
Termii, SMTP, Google Maps Platform) are data-processing partners
contracted to process data only on MySooq's instructions for the stated
purposes. Per Google's definitions this is not "sharing" and must NOT be
declared in the sharing column.

Canonical reference: Google's
["data sharing" guidance](https://support.google.com/googleplay/android-developer/answer/10787469#zippy=%2Cdata-collection-and-data-sharing).

---

## Section 5 - Privacy Policy URL

```
https://mysooq.ng/legal/privacy
```

(Must resolve at review time. Related: `/legal/terms`,
`/legal/account-deletion`.)

---

## Form vs. Apple parity check

- Both forms declare the same real categories: contact info, photos/video,
  user content (chat, requests, ratings), location, identifiers, purchase
  history (order history), diagnostics.
- Neither form declares financial info or payments - the customer app has no
  payment flow.
- Google has a separate **Required vs Optional** flag per sub-type; Apple does
  not. Fields required to create an account are marked required; the rest
  optional.
- Apple has a tracking declaration; Google does not.
- Adding payments, product analytics, or any cross-app tracking later requires
  updating this form within 90 days of the change going live.
