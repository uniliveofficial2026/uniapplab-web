# Disaster Recovery

## DR script

`scripts/stage-d-dr.mjs` — representative scenarios:

| Scenario | Mechanism |
| --- | --- |
| API identity durability | Cloud org/project/usage survives in-process operations |
| RTC outage durable state | Usage records persist through cloud operations (simulated) |
| Self-host backup/restore | `initSelfHost` → mutate dump → `backupSelfHost` → `destroySelfHostState` → `restoreSelfHost` |

## Recovery objectives (MVP targets)

- **RPO:** bounded by last self-host backup (operator-triggered)
- **RTO:** restore script completes in-process (seconds for fixture data)

## Not covered in Stage D

- Multi-region failover
- LiveKit cluster DR
- Managed cloud Postgres PITR (cloud not persisted)

## Status

`disasterRecovery`: **PASS** (script green).
