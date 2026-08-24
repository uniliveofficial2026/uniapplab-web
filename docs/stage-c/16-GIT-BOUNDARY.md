# 16 — Git Boundary (`@unilives/git`)

Repository metadata abstraction for platform projects.

## Package

- Path: `lib/unilives-git`
- Name: `@unilives/git` v0.1.0

## Purpose

Links projects to source repositories. Default registry provider: GitHub.

## Stage B status

**FOUNDATION** — metadata records (repo URL, default branch, last SHA). No git operations executed inside package.

## Consumers

- Control plane deployment records reference `gitSha`
- MCP/CLI deploy flows use repo context
- Project graph may bind to repo paths (future)

## Stage C work

- [ ] GitHub App / token integration for commit status
- [ ] Branch protection hints in deploy flow
- [ ] Document monorepo vs single-app project mapping

## Classification

**FOUNDATION** + **NEEDS_PRODUCTIZATION**

## Evidence

`scripts/test-stage-b.mjs` → `deploy_git_registry`
