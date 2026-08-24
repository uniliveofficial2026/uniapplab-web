# UniLive’s Production Hardening — DONE vs STILL NEEDED

**Report date (UTC):** 2026-08-23T08:40:00Z  
**Branch:** `fix/vercel-api-root-now`  
**HEAD baseline:** `da38775` (working tree includes Stage A continuation)  
**Backup:** `backups/production-hardening/baseline-20260823T064955Z`  
**uiUxChanged:** `false`  
**Stage B (own RTC):** **NOT STARTED**  
**Production deploy / RTC cutover:** **NOT PERFORMED**  
**Stage A acceptance:** **NOT PASSED**

Authoritative machine progress: `AUTONOMOUS-PROGRESS.json`  
Changelog: `12-CHANGE-LOG.md` · Open items: `13-UNRESOLVED.md`

---

## Executive summary

| Area | Status |
|---|---|
| Gift combo FIFO scheduler + authority + replay | **DONE** (unit evidence 13/13) |
| Likes loss-tolerant + thermal particle budget | **DONE** |
| Room topology policy (no global maxParticipants=50) | **DONE** |
| Network QoE governor + capability simulcast profile | **DONE** |
| Thermal → likes + reels prefetch (`allowPrefetch`/`fxBudget`) | **DONE** (reels offscreen preload gated) |
| Posts/Reels auth gates + contract tests | **DONE** (unit/source; browser E2E still open) |
| Identity layers + logout scoped clear | **DONE** |
| Supabase anon `is_platform_admin` revoke | **DONE** |
| Visual structural lock | **STARTED** |
| Production web build (instacollab) | **PASS** |
| Full Stage A E2E matrix (posts/reels/calls/live/PK/…) | **NOT DONE** |
| Stage B UniLive RTC | **LOCKED until Stage A PASS** |

---

## Evidence (this continuation)

- `pnpm --filter @workspace/instacollab run typecheck` → PASS  
- `pnpm --filter @workspace/instacollab run test:gift-scheduler` → 13/13 PASS  
- `pnpm --filter @workspace/instacollab run test:wallet` → 7/7 PASS  
- `pnpm run test:gifts` → 3/3 PASS  
- `pnpm --filter @workspace/instacollab run test:visual-lock` → 7/7 PASS  
- `pnpm --filter @workspace/instacollab run test:rtc-policy` → 3/3 PASS  
- `pnpm --filter @workspace/instacollab run test:posts-reels` → 12/12 PASS  
- `pnpm --filter @workspace/instacollab run build` → PASS (~1m5s)  
- PK legacy suppression tests → 7/7 PASS (updated for approved chrome ids)

---

## Still required before Stage A PASS / Stage B

Posts, Reels long-scroll memory, Messages, Calls (+ native), Live/Multi-Guest/PK all topologies E2E, pixel visual baselines, deeper thermal→beauty/BG, games stress, marketplace/orders E2E, notifications/push full matrix.
