# QR payload audit (Phase 10)

| file | component | QR context | payload source | type | sensitive? | expiration | renderer | export | visual | proposed IDs | safe visual? | risks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | **none in product** | — | — | — | — | — | — | — | `sharing.qr.*` | **not-in-phase** | do not invent QR UI |
| `sharing/brand/UniLivesQrFrame.tsx` | ready | future | children only | passthrough | n/a | n/a | parent | n/a | frame chrome | `sharing.qr.*.frame` | yes (unused) | no logo overlay |
| `sharing/brand/UniLivesQrPreview.tsx` | ready | future | children + label | passthrough | label must not leak tokens | n/a | parent | n/a | preview | same | yes (unused) | |

**Encoded input equality:** N/A — no QR generator exists to compare.

**Scan validation:** Unavailable — no local QR contexts. Limitation reported honestly.

