# FINAL — Release Manifest

## Files

- `release-manifest.json` (workspace root)
- `release/artifacts/release-manifest.json` (copy)
- `release/artifacts/*.tgz` (12 packages)

## Manifest fields

```json
{
  "platform": "UniLive",
  "version": "0.1.0",
  "channel": "stable",
  "publicRegistryRelease": "RELEASE_READY_EXTERNAL_STEP",
  "licenseStatus": "FORMAL_LICENSE_PENDING",
  "baselines": { "stageA", "stageB", "stageC" }
}
```

## Regenerate

```bash
node scripts/stage-d-release-artifacts.mjs
```

Each artifact includes `sha256:` checksum and byte size.
