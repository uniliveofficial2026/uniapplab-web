# UniLive’s Phase 1 — Branding report

Generated: 2026-07-23  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s** (U+2019)

## Branding audit table (before → after)

| File | Symbol / line area | Current asset | Brand name | Canonical ID | Safe in P1? | Phase 1 outcome |
|------|-------------------|---------------|------------|--------------|-------------|-----------------|
| `src/lib/appBrand.ts` | `APP_DISPLAY_NAME` | n/a | UniLive's (ASCII `'`) | n/a | Yes | Normalized to **UniLive’s** |
| `src/lib/appBrand.ts` | `APP_BRAND_FALLBACK_ICON` | `/brand/app-logo.png` | — | `brand.logo.primary` / icon | Yes | Kept; resolvers prefer registry → fallback |
| `src/lib/appBrandRuntime.ts` | `readAppBrandSnapshot` | remote → settings → `/brand/app-logo.png` | — | registry icon | Yes | Precedence: remote → registry → known-good |
| `src/components/launch/LaunchBrandMark.tsx` | default mark | `/brand/app-logo.png` | APP_DISPLAY_NAME | `brand.splash.main` / loading | Yes | Uses `UniLivesSplashBrand` / `UniLivesLoadingMark` |
| `src/components/common/AppBrandIcon.tsx` | img src | snapshot / fallback | APP_DISPLAY_NAME | `brand.logo.icon` | Yes | Registry fallback when no remote |
| `src/components/common/AppLogo.tsx` | icon + text | AppBrandIcon | APP_DISPLAY_NAME | icon + wordmark | Yes | `UniLivesWordmark` |
| `src/components/common/PwaInstallPrompt.tsx` | banner img | hardcoded `/brand/app-logo.png` | APP_DISPLAY_NAME | `brand.logo.icon` | Yes | `resolveAppBrandFallbackIcon()` |
| `src/lib/chat/chatCallNotifications.ts` | Notification icon | `/brand/app-logo.png` | — | `brand.icon.notification` | Yes | `resolveAppNotificationIcon()` |
| `src/components/layout/Shell.tsx` | `AppLogo` | via AppBrandIcon | APP_DISPLAY_NAME | icon | Yes | Indirect (no layout change) |
| `src/components/launch/SplashScreen.tsx` | `LaunchBrandMark` | via LaunchBrandMark | APP_DISPLAY_NAME | splash | Yes | Indirect |
| `src/components/launch/AuthScreen.tsx` | `LaunchBrandMark` | via LaunchBrandMark | APP_DISPLAY_NAME | splash | Yes | Indirect (auth layout unchanged) |
| `src/components/auth/SplashScreen.tsx` | `AppLogo` | via AppLogo | APP_DISPLAY_NAME | icon | Yes | Indirect |
| `src/components/auth/AuthScreen.tsx` | `AppLogo` | via AppLogo | APP_DISPLAY_NAME | icon | Yes | Indirect |
| `index.html` | favicon / apple / og / twitter | `/brand/app-logo.png` | UniLive's | `brand.logo.icon` | Partial | Paths kept (pre-React); spelling normalized |
| `vite.config.ts` | PWA icons | `/icons/icon-*.png` | — | `brand.icon.pwa.*` | No replace | **blocked-missing-asset** — keep current icons |
| `capacitor.config.ts` | `appName` | string | UniLive's | n/a | Yes | Spelling normalized; splash plugin unchanged |
| `public/privacy-policy.html` | favicon | `/brand/app-logo.png` | — | — | Deferred | Legal redesign is later phase |
| Onboarding / gifts / badges | various | — | — | — | **No** | Explicitly out of scope |

## Canonical brand IDs wired

- `brand.logo.primary`
- `brand.logo.horizontal`
- `brand.logo.icon`
- `brand.logo.monochrome`
- `brand.logo.animated`
- `brand.mascot.default`
- `brand.splash.main`
- `brand.loading.mascot`
- `brand.icon.pwa.192`
- `brand.icon.pwa.512`
- `brand.icon.maskable.192`
- `brand.icon.maskable.512`
- `brand.icon.notification`

All currently `status: "missing"` → runtime resolves to `/brand/app-logo.png`.

## Production assets used

**None.** No new PNG/SVG/SVGA/WebM/JSON brand binaries were invented.

## Fallback assets still active

- `/brand/app-logo.png` (primary known-good)
- `/icons/icon-192.png`, `/icons/icon-512.png`, maskable variants (PWA — unchanged)
- `/pwa-icon.png` (unchanged)
- Capacitor SplashScreen plugin config (unchanged background `#020617`)

## Mapping statuses (brand)

| Mapping | Status |
|---------|--------|
| `/brand/app-logo.png` → `brand.logo.primary` | `wired-with-fallback` |
| PWA / maskable / pwa-icon mappings | `blocked-missing-asset` |
| Gift mappings | `not-in-phase` |

## Animation policy

| Context | Mode | Phase 1 behavior |
|---------|------|------------------|
| splash | full | Static fallback (animated asset missing) |
| loading | short-loop | Static fallback |
| header | subtle-idle / static | Static |
| profile / share / legal | static | Static |
| reduced-motion / low-perf | static | Forced static |
| audio | never | No logo audio |

## Global tokens added (aliases only)

`--color-unilives-primary|accent|live|gold|surface|ring`  
`--font-unilives-display|body`  

Values mirror existing theme (Inter + current blues/rose/gold). **No screen repaint.** Brand fonts missing — documented.

## Required icon deliverables (still missing)

- PWA 192 / 512 PNG  
- Maskable 192 / 512 PNG  
- Apple 1024×1024  
- Android adaptive foreground + background  
- Notification monochrome  
- Splash logo (transparent)  
- Favicon sizes + apple-touch-icon  
- Open Graph share image  
- App Store / Play Store artwork  
- Brand display + body font files  

## Rollback

1. Revert Phase 1 commits / restore modified files listed in the completion response.  
2. Confirm `/brand/app-logo.png` still served.  
3. Clear `platform_app_brand_remote` only if testing remote overrides.  
4. Rebuild: `pnpm --filter @workspace/instacollab build`.  
5. Do **not** delete `/brand/` or `/icons/` during rollback.

## Layout / functional changes

- Layout: **none**  
- Auth / routing / LiveKit / wallet / gifts / APIs / DB: **none**
