# 13 — Storage Boundary (`@unilives/storage`)

Provider-neutral object storage adapter boundary.

## Package

- Path: `lib/unilives-storage`
- Name: `@unilives/storage` v0.1.0

## Purpose

Abstracts blob/media storage. Default registry entry: Cloudflare R2.

## Stage B status

**FOUNDATION** — adapter boundary stub.

- API: `GET /v1/storage/buckets` returns stub response
- MCP: `create_storage_bucket` records intent only

## Production storage today

Reference app media uses Cloudflare R2 via `workers/uniapplab-media` bindings — outside this package.

## SDK integration

SDK `storage` namespace throws `STORAGE_ADAPTER_REQUIRED`.

## Stage C work

- [ ] R2 adapter (S3-compatible API)
- [ ] MinIO adapter for self-host
- [ ] Signed URL minting interface
- [ ] Wire SDK + API beyond stub

## Classification

**FOUNDATION** + **NEEDS_PRODUCTIZATION**

## Self-host

MinIO or S3-compatible endpoint — see `20-SELF-HOST-READINESS.md`.
