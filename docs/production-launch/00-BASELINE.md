# Production Launch Baseline

- Worktree: `/Volumes/Wei2TB/Universal-Fixer-Production-Launch`
- Branch: `release/app-uniapplab-production`
- Base SHA: `47e15f9bd56d5893be08415971a269b895073037`
- Target: `https://app.uniapplab.com`
- Started: 2026-08-24T22:35:33Z

## Invariants
- uiUxChanged=false
- productionRtcApi=UniLiveRTC
- productionMediaProvider=LiveKit
- productionSfuCutover=NOT_PERFORMED
- Stages A/B/C/D remain PASS (not restarted)

## BEFORE public state (captured)
- DNS `app.uniapplab.com` CNAME → `5fb89dd6.translate-cf.weglot.io` (proxied=false)
- HTTPS → Cloudflare → Weglot → Vercel returns **402 DEPLOYMENT_DISABLED**
- `/api/v1/health`, `/studio/`, `/docs/`, `/games/greedy-slot/` all 402
- Zone NS: colette/andronicus.ns.cloudflare.com
- Zone id: `d6a3f463bf0d8b04f25eb51ba32537fc`
