# Device Matrix (real-device QA)

**Base SHA:** `9e8c44a` · **Prod:** https://app.uniapplab.com  
**uiUxChanged:** false  

Fill cells during sessions. Do not store secrets, UDIDs with PII beyond lab labels, or push tokens.

---

## Known lab devices (pre-filled)

| Device ID | Platform | Model | OS | Pairing | Network default | Notes |
|-----------|----------|-------|-----|---------|-----------------|-------|
| D-IPHONE-14PM | iOS | iPhone 14 Pro Max | _(fill)_ | **Paired** | Wi‑Fi / LTE | Primary phone QA |
| D-IPAD | iPadOS | iPad _(fill model)_ | _(fill)_ | **Offline** (not attached this session) | — | Bring online when needed |
| D-ANDROID | Android | — | — | **None attached** | — | No Android handset in current lab attach |

---

## Template (copy rows as devices join)

| Device ID | Platform | Model | OS build | Capacitor / web | Pairing status | Camera | Mic | Push token registered? | CallKit/FGS | Attached at | Tester |
|-----------|----------|-------|----------|-----------------|----------------|--------|-----|------------------------|-------------|-------------|--------|
| | ios / android / web | | | native shell / Safari / Chrome | paired / offline / none | ok / deny / fail | ok / deny / fail | y/n / n/a | off / ready | | |
| | | | | | | | | | | | |

---

## Attach checklist

- [ ] Device unlocked, trusted, WebView/Safari can reach `https://app.uniapplab.com`
- [ ] Camera + mic permission prompts exercised once
- [ ] Signed in with **test PERSON** (not production personal)
- [ ] Confirm DEVICE id distinct from PERSON (`IDENTITY-MAP.md`)
- [ ] Note network: Wi‑Fi / LTE / airplane toggles for TEST-MATRIX

---

## Session notes

| Date | Devices online | Blockers |
|------|----------------|----------|
| 2026-08-24 | iPhone 14 Pro Max paired; iPad offline; no Android | APNS VoIP/CallKit not production-ready; Android coverage gap |
