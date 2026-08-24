# 12 — Database Boundary (`@unilives/database`)

Provider-neutral database adapter boundary.

## Package

- Path: `lib/unilives-database`
- Name: `@unilives/database` v0.1.0

## Purpose

Abstracts data persistence behind capability kind `database`. Default registry entry: Supabase.

## Stage B status

**FOUNDATION** — adapter boundary stub. MCP `inspect_database` returns provider info only (no query execution).

## SDK integration

SDK `database` namespace throws `DATABASE_ADAPTER_REQUIRED`.

## Reference app

Uses Supabase client directly + `lib/db` workspace helpers. Platform boundary does not yet replace app queries.

## Stage C work

- [ ] Define minimal query interface (read/write/migrate hooks)
- [ ] Supabase adapter implementation
- [ ] Postgres plain adapter for self-host
- [ ] Wire SDK + document migration from direct Supabase imports

## Self-host

Supabase CLI local, managed Supabase, or plain Postgres — see `20-SELF-HOST-READINESS.md`.

## Classification

**FOUNDATION** + **NEEDS_PRODUCTIZATION**

## Evidence

Package present + platform docs; MCP inspect tool in Stage B suite.
