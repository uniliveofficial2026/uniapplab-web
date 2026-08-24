# Upgrade / Migration System

## Self-host upgrade preflight

`upgradePreflight({ dataDir, targetVersion })` in `@unilives/selfhost`:

- Compares current config version to target
- Returns `{ ok, blockers[], warnings[] }`
- Blockers prevent unsafe upgrade (e.g., missing backup, version downgrade)

## Platform version source

`@unilives/release` exposes `PLATFORM_VERSION` (`0.1.0`) used consistently across cloud audit, release manifest, and self-host config.

## Cloud / marketplace / AI builder

In-memory cloud state has no migration layer in Stage D MVP. Future persistent cloud would require schema migrations via `@unilives/database`.

## Tests

Self-host tests cover backup → destroy → restore round-trip as upgrade safety prerequisite.
