# Device evidence

## Deploy consistency

| Surface | Application SHA | Deploy ID |
|---|---|---|
| Render SPA (`uniapplab-spa`) | `7e4f6cf` (then docs/follow-ups may differ) | `dep-da6p6qoae00c738l1d0g` |
| Render API (`uniapplab-web`) | `f25a7d0` (presence fail-open) after `7e4f6cf` | see Render after redeploy |
| Public bootstrap websocket | `wss://app.uniapplab.com` | PASS |

Do **not** treat a docs-only tip as the application SHA.

## Authenticated API (real Bearer QA user)

| Route | Status |
|---|---|
| `GET /api/chat/threads` | 200 |
| `GET /api/me/identities` | 200 |
| `GET /api/me` | 200 |
| `GET /api/gifts/catalog` | 200 |
| `POST /api/presence/offline` | FAIL → Upstash quota; fail-open in `f25a7d0` |

## Boot / config fixes

- AuthProvidersHost: explicit BOOTING (`loading: true`), not offline stub
- SpeedInsights: absent from `main.tsx` / production index
- `websocketOrigin` localhost sanitized server+client

## iPhone 14 Pro Max (iPhone15,3)

- `devicectl`: connected (localNetwork)
- Cap Debug install: **PASS** (`com.uniapplab.unilive`)
- `capacitor.config` `server.url`: `https://app.uniapplab.com`
- Launch: **PASS**
- Signed-in shell / camera / mic / iPhone↔Mac RTC: **NOT_TESTED**

## Verdict

`fullRealApplication = FAIL` until signed-in shell + real media flows are proven.
