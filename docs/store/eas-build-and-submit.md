# EAS - build & submit guide

How to take the Marketplace customer app from `git push` to a TestFlight / Play
Console upload. All commands run inside `app/`.

## Prerequisites (one-time setup)

### 1. Accounts

| Account | Cost | Why |
|---|---|---|
| **Expo account** | Free | Owns the EAS project, holds credentials, runs builds |
| **Apple Developer Program** | $99/year | Required to sign + submit iOS builds |
| **Google Play Console** | $25 one-time | Required to upload Android AABs |

### 2. CLI install

```sh
npm install -g eas-cli
eas login
```

### 3. Link the app to EAS

`app/app.json` already carries a `projectId`
(`a95f02ee-b847-4b29-93db-6268b4c76d14`), so:

```sh
# inside app/
eas init           # picks up the projectId in app.json
eas device:create  # only needed to install dev builds on your own devices
```

If you re-create the Expo project, replace `extra.eas.projectId` in
`app/app.json` with the new id, and `owner` if the account differs.

### 4. Configure secrets

No build-time secrets are required for v1. Crash reporting (Sentry) is **not**
configured - the SDK ships inert (no DSN), so no `EXPO_PUBLIC_SENTRY_DSN`
secret is needed. `EXPO_PUBLIC_API_URL` is already set per-profile in
`eas.json`. If Sentry is enabled later, add the DSN as an EAS secret and set
the plugin's `organization` in `app/app.json`:

```sh
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN \
  --value "https://...@oXXXX.ingest.sentry.io/YYYY" --type string
```

### 5. Fill in the submit placeholders

`app/eas.json` already has `submit.production.ios.appleTeamId` set
(`SRSAYBG6V5`). There is no `ascAppId` - the App Store Connect app record
doesn't exist yet, so create it (or let `eas submit` create it) and pass
`--id <ascAppId>` on the command line.

| Value | Where to find it |
|---|---|
| Apple Team ID (already set) | https://developer.apple.com/account → Membership |
| ASC App ID (pass via `--id`) | App Store Connect → app → App Information → Apple ID (10-digit number) |

For Android: download the service-account JSON from Google Cloud Console for
the project linked to Play Console (roles **Service Account User** +
**App Manager**), save it as `app/marketplace-service-account.json` (gitignored),
then `eas submit` will use it via `serviceAccountKeyPath`.

---

## Build profiles

| Profile | Distribution | iOS | Android | Channel | Use case |
|---|---|---|---|---|---|
| `development` | internal | dev-client `.ipa` | dev-client `.apk` | `development` | Debug native modules on your own devices |
| `preview` | internal | release `.ipa` (ad-hoc) | release `.apk` | `staging` | QA / stakeholders |
| `production` | store | `.ipa` for App Store | `.aab` for Play Store | `production` | The thing you submit |

`autoIncrement: true` on production bumps `buildNumber` (iOS) and
`versionCode` (Android) every build. `appVersionSource: remote` means EAS owns
the version numbers - after the first build, `eas build:version:get` is the
source of truth, not `app.json`.

---

## Common build commands

```sh
# inside app/

eas build --profile development --platform android
eas build --profile development --platform ios

eas build --profile preview --platform all

eas build --profile production --platform all

eas build:list --limit 5
```

The first iOS production build prompts for Apple Developer credentials,
a distribution certificate and a provisioning profile (let EAS generate them).

---

## Submit commands

```sh
# iOS -> TestFlight
eas submit --profile production --platform ios --id <build-id>

# Android -> Play Console internal track
eas submit --profile production --platform android --id <build-id>
```

Submit defaults from `eas.json`:
- **iOS**: lands in TestFlight; promote to App Store via App Store Connect.
- **Android**: lands on the **alpha** track as a **draft**; promote in Play
  Console.

---

## Staged rollout (production only)

| Stage | Audience % | Wait | Watch |
|---|---|---|---|
| 1 | 10% | 24 h | Play vitals crash-free sessions ≥ 99.5%, no support spike |
| 2 | 25% | 24 h | Same |
| 3 | 50% | 48 h | Same + retention |
| 4 | 100% | - | - |

Apple has no staged-rollout UI; use **Phased Release for Automatic Updates**
in App Store Connect (7-day ramp for auto-update users).

---

## Rollback

| Platform | Action |
|---|---|
| Android | Play Console → release → halt rollout |
| iOS | Phased Release → pause |
| Either | Re-submit the previous build as a new version with a higher build number |

JS-only hotfixes (no native change) can ship via EAS Update:

```sh
eas update --branch production --message "fix: <description>"
```

`runtimeVersion.policy: appVersion` means a JS patch only applies to builds on
the same native version.

---

## What still needs YOU (not code) to ship

- [ ] Apple Developer Program enrolment ($99/year)
- [ ] Google Play Console account ($25 one-time)
- [ ] Fill `REPLACE_WITH_APPLE_TEAM_ID` + `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` in `app/eas.json` (or pass via CLI)
- [ ] Create + save `app/marketplace-service-account.json` (gitignored) for `eas submit` → Play
- [ ] No EAS secrets required for v1 (Sentry is skipped)
- [ ] App icon exists - `app/assets/icon.png` (regenerate via `npm run assets:customer`)
- [ ] Adaptive icon - `app/assets/adaptive-icon.png` + `adaptive-icon-bg.png`
- [ ] Splash - `app/assets/splash-icon.png`
- [ ] Screenshots - `store-assets/customer/` (see `docs/store/screenshot-plan.md`)
- [ ] Privacy policy + ToS deployed at public URLs (`marketplace.ng/legal/*`)
- [ ] App Store privacy questionnaire + Play data-safety form - see `docs/store/`
- [ ] Demo account seeded to PROD and review notes pasted (see `console-fill-sheet.md`)
