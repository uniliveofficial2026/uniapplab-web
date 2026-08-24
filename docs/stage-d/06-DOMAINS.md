# Custom Domains

## API (`@unilives/cloud`)

- `addDomain({ projectId, environmentId, domain, actorId })`

Returns domain record:

| Field | Initial value |
| --- | --- |
| `verificationStatus` | `pending` |
| `tlsStatus` | `pending` |
| `providerMapping` | `null` |

## Scope (Stage D MVP)

Domain **resource model** and metadata tracking are implemented in the in-memory control plane. Automated DNS verification, TLS issuance, and provider mapping are **not** wired to live DNS/CDN providers in this slice.

## Future work

Integrate with deployment provider (Vercel/custom) for verification tokens and certificate status updates.
