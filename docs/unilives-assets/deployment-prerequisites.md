# Deployment prerequisites (recovery 2026-07-30)

Do **not** deploy until:

1. Individual production assets exist on disk and are explicitly `production-approved`
2. Manifest checksums match installed files
3. Registry validation scripts pass without silencing missing-file issues
4. Typecheck/build baselines are known and accepted
5. Explicit human approval for deploy/push/merge

Current blockers: **254** missing production binaries; **0** installed approved assets.
