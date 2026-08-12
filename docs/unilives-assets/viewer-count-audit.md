# Viewer-count audit (Phase 11)

| surface | source | concept | host included | bots | freshness | decrement | reconnect | stale risk |
|---|---|---|---|---|---|---|---|---|
| Discovery card | stream viewers API / party participant_count | registered viewers or presence members | product-dependent | no intentional bots | poll/RT | leave/untrack | may briefly lag | capped poll |
| Party audience | presence members.length → participant_count | connected presence | if tracked | no | sync | leave | hub | low |
| Stream host UI | fetchStreamViewers | API viewers | API rule | — | 3s | leave | — | stale join fixed |
| Karaoke live cards | preview/count merge | mixed | unchanged | demo local separate | — | — | — | document only |

Do not merge concepts into one number without product approval.
