# FINAL — Backup & Restore

## Self-host

| API | Purpose |
| --- | --- |
| `backupSelfHost` | Export postgres fixture + config |
| `restoreSelfHost` | Restore from backup file |
| `destroySelfHostState` | Tear down for DR test |

## Verified flow

init → mutate data → backup → destroy → restore → verify records

## Cloud MVP

No durable cloud backup (in-memory). Future persistent cloud requires DB backup strategy.

## Status

`backup`: **PASS** · `restore`: **PASS**
