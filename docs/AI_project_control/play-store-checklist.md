# Google Play Store — UniLive’s readiness checklist

**Package name (locked):** `com.uniapplab.unilive`  
**App display name:** UniLive’s  
**Native shell:** Capacitor Android under `artifacts/instacollab/android/`  
**Default release mode:** live shell → `https://app.uniapplab.com` (`cap:sync:live`)

## Build the uploadable AAB (local)

```bash
cd /Volumes/Wei2TB/Universal-Fixer/artifacts/instacollab
# Requires gitignored android/key.properties + android/keystore/unilive-upload.jks
pnpm run android:bundle
```

Outputs:

- `android/app/build/outputs/bundle/release/app-release.aab`
- `exports/UniLive-play-<stamp>-v1.0-vc1.aab`
- `exports/UniLive-play-latest.aab`

Offline (bundled web assets) instead of live URL:

```bash
pnpm run android:bundle:offline
```

Signing template (no secrets): `artifacts/instacollab/android/key.properties.example`

### Keystore backup (critical)

1. Copy `android/keystore/unilive-upload.jks` and `android/key.properties` to offline secure storage.
2. Never commit them (gitignored).
3. Losing the upload key blocks Play updates unless Play App Signing recovery applies.

## Play Console steps (owner account only)

1. Open [Google Play Console](https://play.google.com/console) → Create app.
2. Package name must be exactly `com.uniapplab.unilive`.
3. Enroll in **Play App Signing** (recommended) and upload with the local upload keystore.
4. Upload AAB to **Internal testing** first, then promote to Production.

## Store listing assets

| Asset | Requirement |
|-------|-------------|
| App icon | 512×512 PNG (use `pnpm run cap:icons` source / Play Console high-res icon) |
| Feature graphic | 1024×500 |
| Phone screenshots | ≥2 (recommended 4–8) |
| Short description | ≤80 chars |
| Full description | ≤4000 chars |
| App category | Social / Entertainment (choose one) |

## Privacy policy

- Local page: `artifacts/instacollab/public/privacy-policy.html`
- Console URL (preferred once live): `https://app.uniapplab.com/privacy-policy.html`
- Required for store listing and Data safety.

## Data safety / permissions declared in Manifest

Already declared in `AndroidManifest.xml`:

- `INTERNET`
- `CAMERA` (optional hardware)
- `RECORD_AUDIO` (optional hardware)
- `MODIFY_AUDIO_SETTINGS`
- `ACCESS_NETWORK_STATE`

In Play Data safety, disclose collection/sharing for auth, media, live streaming, and analytics as applicable to UniLive’s production backend.

## Content rating

Complete the IARC questionnaire in Play Console (user-generated content, social features, in-app purchases if any).

## Versioning

Current first release in `android/app/build.gradle`:

- `versionCode 1`
- `versionName "1.0"`

Bump `versionCode` on every Play upload; bump `versionName` for user-visible releases.

## Commands reference

| Command | Purpose |
|---------|---------|
| `pnpm run android:bundle` | Live shell sync + signed AAB |
| `pnpm run android:bundle:offline` | Full web build sync + signed AAB |
| `pnpm run android:bundle:gradle` | Gradle only (already synced) |
| `pnpm run cap:icons` | Regenerate launcher icons |
| `pnpm run cap:sync:live` | Point WebView at production |

## Out of scope here

- Uploading to Play (requires your Google login)
- iOS App Store
- Changing package name
- UI/UX redesign
