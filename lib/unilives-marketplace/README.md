# @unilives/marketplace

Curated local registry for UniLive **provider**, **plugin**, and **template** artifacts.

## Manifest schema

Each artifact exposes a manifest with:

| Field | Description |
| --- | --- |
| `id` | Stable artifact identifier |
| `name` | Human label |
| `publisher` | Publisher org or author |
| `version` | Semver string |
| `type` | `template`, `plugin`, or `provider` |
| `description` | Short summary |
| `capabilities` | Declared capability tokens |
| `compatibility` | Platform and schema requirements |
| `integrity` | `{ algorithm, hash }` over canonical manifest body |
| `entrypoint` | Relative module entry |
| `permissions` | Declared permission tokens |
| `metadata` | Non-secret tags and annotations |

Manifests must **not** embed secrets. Validation rejects secret-like keys or values.

## Operations

- `list` — catalog entries (optionally filter by type or installed state)
- `search` — text search over id, name, description, publisher
- `get` — fetch full manifest
- `install` — validate safety, optionally materialize package files
- `remove` — uninstall
- `validate` — structural and integrity checks

## Installation safety

Before install, the registry validates:

1. Manifest shape and semver
2. Platform/schema compatibility
3. Integrity hash
4. Declared permissions

These privileged permissions are **never auto-granted**:

- `secret.read`
- `db.admin`
- `deploy.mutate`
- `filesystem.root`
- `shell`

Pass `grantedPermissions` explicitly when installing artifacts that require them.

## Stage C seeds

The default catalog seeds six released templates: `basic`, `social`, `reels`, `livestream`, `call`, and `marketplace`.

```js
import { createMarketplaceRegistry, listSeedTemplates } from '@unilives/marketplace';

const registry = createMarketplaceRegistry({ seed: true });
console.log(listSeedTemplates());
await registry.install('unilives.template.basic');
```

## Tests

```bash
pnpm --filter @unilives/marketplace test
```
