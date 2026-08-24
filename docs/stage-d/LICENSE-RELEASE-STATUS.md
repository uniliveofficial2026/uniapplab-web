# License / Public Release Status

## License

| Source | Value |
| --- | --- |
| Root `package.json` `"license"` | `MIT` (declared) |
| Root `LICENSE` file | **Not present** |
| Release manifest `licenseStatus` | `FORMAL_LICENSE_PENDING` |

Engineering proceeds under workspace MIT declaration. **Do not claim "MIT licensed" in public marketing or npm readme until a formal LICENSE file is committed and reviewed.**

## Public registry release

| Field | Value |
| --- | --- |
| `publicRegistryRelease` | `RELEASE_READY_EXTERNAL_STEP` |
| npm publish performed | **No** |
| Tarballs generated | **Yes** — `release/artifacts/*.tgz` (12 packages) |
| Checksums | SHA-256 in `release-manifest.json` |

## External steps to complete public release

1. **Legal:** add root `LICENSE` file (MIT or chosen license)
2. **Registry:** configure npm org/`@unilives` scope authentication and 2FA
3. **Publish:** run registry publish for each `RELEASE_READY` artifact
4. **Verify:** package consumer test against published versions

## Reason for external step classification

Formal LICENSE file + registry authentication are outside the engineering worktree. Artifacts are pack-validated and consumer-tested locally; public distribution awaits operator/legal action.
