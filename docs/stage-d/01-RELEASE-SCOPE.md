# Stage D Release Scope

## Objective

Deliver release, distribution, ecosystem, managed UniLive Cloud MVP, AI Builder, production self-host, security/scale qualification, disaster recovery, and launch documentation — building on the sealed Stage C developer platform.

## In scope (implemented in this worktree)

1. **Release versioning** — `@unilives/release` single source of truth (`0.1.0`, channel `stable`)
2. **Release artifacts** — `scripts/stage-d-release-artifacts.mjs` → `release-manifest.json` + `release/artifacts/*.tgz` (12 public packages)
3. **Managed cloud MVP** — `@unilives/cloud` in-memory control plane (orgs, projects, environments, RBAC, secrets, providers, deployments, domains, usage, quotas, rate limits, audit)
4. **Marketplace registry** — `@unilives/marketplace` local catalog for templates, plugins, providers with integrity + permission safety
5. **AI Builder** — `@unilives/ai-builder` provider-neutral planner → ProjectGraph patches with security scanning
6. **Self-host production helpers** — `@unilives/selfhost` compose generation, init, status, backup/restore, upgrade preflight
7. **Qualification scripts** — security matrix, load harness, DR scenarios, pack validate, secret scan, package consumer
8. **Examples** — `cloud-project`, `deploy`, `provider-plugin`, `ai-builder`, `self-host`
9. **CI** — `test:stage-d` added to `.github/workflows/ci.yml`

## Explicitly out of scope / not claimed

- Public npm registry publish (`RELEASE_READY_EXTERNAL_STEP`)
- Formal root `LICENSE` file (pending legal decision)
- Production SFU replacement or alternative RTC vendor cutover
- Managed UniLive Cloud **production deployment** to a live multi-tenant SaaS endpoint
- Pulling/publishing `ghcr.io/unilives/*` container images referenced in compose templates
- UI/UX visual changes to the production InstaCollab app
