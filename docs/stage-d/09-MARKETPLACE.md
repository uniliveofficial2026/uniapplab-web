# Developer Marketplace Registry

## Package

`@unilives/marketplace` — `lib/unilives-marketplace/`

## Purpose

Curated **local registry** for UniLive provider, plugin, and template artifacts with manifest validation, integrity hashing, and install safety.

## Manifest schema

Required fields: `id`, `name`, `publisher`, `version`, `type`, `description`, `capabilities`, `compatibility`, `integrity`, `entrypoint`, `permissions`, `metadata`.

Types: `template` | `plugin` | `provider`

## Operations

| Method | Description |
| --- | --- |
| `list` | Catalog entries |
| `search` | Text search |
| `get` | Full manifest |
| `install` | Validate + optional materialize |
| `remove` | Uninstall |
| `validate` | Structural + integrity checks |

## Privileged permissions (never auto-granted)

- `secret.read`
- `db.admin`
- `deploy.mutate`
- `filesystem.root`
- `shell`

## Stage C template seeds

Six templates: `basic`, `social`, `reels`, `livestream`, `call`, `marketplace` — via `seed/stage-c-templates.mjs`.

## Example

`examples/provider-plugin/index.mjs`

## Classification

**IMPLEMENTED MVP** — local registry, not a public marketplace SaaS.
