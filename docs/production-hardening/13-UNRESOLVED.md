# 13-UNRESOLVED

Updated: 2026-08-24T04:27:00Z

## Stage A
**PASS** — see `14-FINAL-ACCEPTANCE.md` and `FINAL-STATUS.json`.

## Accepted external (post–Stage A / store QA)
- Native CallKit / Android FGS: keep `FEATURE_ENABLED=false` until VoIP PushKit cert + online physical device QA.
- APNS provider send: provision Apple push key/cert when available (FCM topic healthcheck already PASS).

## Cloudflare notes
- `uniapplab-media`: production media Worker (R2 binding).
- `uniapplab-web` / `empty-recipe-8fd7`: stubs — do not delete without owner intent.
- R2: `uniapplab-media`, `livestream-assets`.

## Do not start without new owner directive
- Stage B UniLive RTC packages / production RTC cutover
