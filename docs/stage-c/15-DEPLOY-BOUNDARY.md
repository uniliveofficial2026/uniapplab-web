# 15 — Deploy Boundary (`@unilives/deploy`)

Deployment lifecycle abstraction for platform operations.

## Package

- Path: `lib/unilives-deploy`
- Name: `@unilives/deploy` v0.1.0

## Purpose

Records deployment intent and status in control plane. Default registry provider: Vercel.

## Stage B status

**FOUNDATION** — create/read deployment records; actual promotion delegates to existing Vercel/GitHub integration in repo scripts.

## API

- `GET/POST /v1/deployments`
- MCP: `create_deployment`, `get_deployment`

## CLI

`unilive deploy` delegates to repo deploy path.

## Stage C work

- [ ] Normalize deployment status enum across providers
- [ ] Git SHA + environment linkage
- [ ] Webhook from Vercel → control plane audit
- [ ] Self-host deploy adapter (Render/Railway) foundation

## Classification

**FOUNDATION** + **NEEDS_PRODUCTIZATION**

## Evidence

`scripts/test-stage-b.mjs` → `deploy_git_registry`
