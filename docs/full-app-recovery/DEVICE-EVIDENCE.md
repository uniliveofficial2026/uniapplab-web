# Device / recovery evidence

## Critical root cause (owner incomplete-app report)

Static file `public/home/index.html` (Google OAuth brand / “Why we use Google Sign-In”) was published at **`/home/`**.

The consumer SPA uses `/home` after launch. Render served the static brand HTML instead of the React shell, so Cap and browsers looked like a broken/incomplete app.

**Fix:** SPA redirect at `home/index.html`, brand page moved to `/oauth-brand/`, Cloudflare cache purged for `/home*`.

Verification after fix + session inject:
- `#root` present
- **Profile setup** screen (“Set up your profile”) — real signed-in UniLive’s path
- Brand page text absent

## Deploy identity (do not confuse docs tip)

| Item | Value |
|---|---|
| Application SHA | `02ce264` |
| SPA deploy | `dep-da6po6c9v7es73a22910` |
| API presence fail-open | `f25a7d0` / `dep-da6ph12d0e5s73dc9gag` |
| `websocketOrigin` | `wss://app.uniapplab.com` |

## Authenticated API (Bearer QA)

| Route | Result |
|---|---|
| `/api/chat/threads` | 200 |
| `/api/me` / `/api/me/identities` | 200 |
| `/api/gifts/catalog` | 200 |
| `/api/presence/*` | degraded fail-open (Upstash quota) |

## iPhone 14 Pro Max

- Connected via `devicectl` (localNetwork) — PASS
- Cap Debug install + launch: PASS (`server.url=https://app.uniapplab.com`)
- Physical auth session (`@qa_device` / `2a7e55d4…`): PASS via scheme handoff (see PHYSICAL-AUTH-EVIDENCE.md)
- Presence from device → postgres `presence_ephemeral`: PASS
- Signed-in shell navigation matrix: NOT_TESTED
- Camera / mic / iPhone↔Mac RTC: NOT_TESTED

## Verdict

`fullRealApplication = FAIL` until signed-in navigation + media flows are proven on device.
Physical **auth session** is no longer the blocker (remote Cap + scheme handoff).
