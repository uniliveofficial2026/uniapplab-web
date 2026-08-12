# Asset validation report

Checked: 2026-07-23 (Phase 12)

| Check | Result |
|-------|--------|
| Registered assets | 259 |
| Seed version | 10 |
| Duplicate IDs | 0 |
| Status production falsely claimed | 0 (all missing) |
| Missing fallback field | 0 |
| Same-type multi-active maps | 0 |
| Brand spelling in registry | UniLive’s |
| Typecheck | 28 errors (baseline held) |
| Build | PASS (~33s) |
| auth:check | ready |
| smoke:manage-tab | PASS (after Vite dep cache restart; prior 504 flake documented) |
| livekit:check | PASS |
| smoke:platform | PASS |
| test:reels | PASS |
| check:health | FAIL (pre-existing file-size limits) |
| greedy-tap:smoke | FAIL (upstream greedy health unreachable — env) |

**Registry integrity: PASS**
