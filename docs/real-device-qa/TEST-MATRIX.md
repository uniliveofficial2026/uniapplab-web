# Test Matrix (feature × device × network × result)

**Base SHA:** `9e8c44a` · **Prod:** https://app.uniapplab.com  
**uiUxChanged:** false  

**Result codes:** `PASS` | `FAIL` | `BLOCKED` | `SKIP` | `WIP`

---

## Networks

| Code | Meaning |
|------|---------|
| WIFI | Stable Wi‑Fi |
| LTE | Cellular |
| WIFI_LOSSY | Throttle / intermittent Wi‑Fi |
| OFFLINE | Airplane / no network |
| SWITCH | Mid-session Wi‑Fi ↔ LTE |

---

## Template

| Test ID | Feature | Scenario | Device ID | Network | Build/SHA | Result | Evidence (notes/screenshot ref) | Bug link |
|---------|---------|----------|-----------|---------|-----------|--------|----------------------------------|----------|
| T-LIVE-01 | Live | Host go-live Solo; viewer join | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-LIVE-02 | Live | Camera flip + beauty toggle | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-LIVE-03 | Live | End live cleanup (no stuck cam) | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-PK-01 | PK | Invite/accept Solo PK | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-PK-02 | PK | Gift score increments authority-side | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-GIFT-01 | Gifts | Send catalog gift; overlay plays | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-GIFT-02 | Gifts | Insufficient balance → recharge path | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-LIKE-01 | Likes | Live heart FX peer visible | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-CALL-01 | Calls | 1v1 video foreground | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-CALL-02 | Calls | Background/killed incoming | D-IPHONE-14PM | LTE | 9e8c44a | BLOCKED | Expect fail: CallKit/PushKit off | |
| T-MSG-01 | Messages | Send text + media (R2) | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-MKT-01 | Marketplace | Live commerce checkout settle | D-IPHONE-14PM | WIFI | 9e8c44a | | | |
| T-AUTH-01 | Auth | Google OAuth native return | D-IPHONE-14PM | WIFI | 9e8c44a | | No localhost redirect | |
| T-CAM-01 | Camera | Live then call (ownership) | D-IPHONE-14PM | WIFI | 9e8c44a | | Watch dual GUM | |
| T-NET-01 | Live | Reconnect after SWITCH | D-IPHONE-14PM | SWITCH | 9e8c44a | | | |
| T-IPAD-01 | Live | Viewer on iPad | D-IPAD | WIFI | 9e8c44a | SKIP | Device offline | |
| T-AND-01 | Live | Host on Android | D-ANDROID | WIFI | 9e8c44a | SKIP | No device attached | |

---

## Pass criteria (summary)

- Media: local preview + remote video within SLA; no permanent black screen after leave.
- Gifts: wallet debit matches catalog; peers see overlay once.
- PK: scores match gift authority, not local-only increments.
- Calls: foreground A/V works; background incoming marked BLOCKED until native ready.
- Auth: returns to `app.uniapplab.com` / app scheme, never localhost.
- Identity: PERSON ≠ DEVICE ≠ LiveKit SID in logs/UI debug.

---

## Blank rows (extend)

| Test ID | Feature | Scenario | Device ID | Network | Build/SHA | Result | Evidence | Bug link |
|---------|---------|----------|-----------|---------|-----------|--------|----------|----------|
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |
