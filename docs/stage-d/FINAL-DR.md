# FINAL — Disaster Recovery

## Script

`scripts/stage-d-dr.mjs`

## Scenarios

1. Cloud identity + usage durability (in-process)
2. Self-host backup/restore round-trip
3. Post-restore status check

## Limitations

No multi-region, no LiveKit cluster DR, no managed cloud Postgres PITR.

## Status

`disasterRecovery`: **PASS**
