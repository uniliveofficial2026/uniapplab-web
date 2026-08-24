# Launch Readiness

## Engineering gates (green)

- `pnpm run test:stage-d` — PASS
- Stage C/B regression — PASS (baseline revalidation)
- Release artifacts generated with checksums
- Examples run clean
- CI includes Stage D job

## Not launched (honest)

| Surface | Status |
| --- | --- |
| Public npm packages | RELEASE_READY_EXTERNAL_STEP |
| Managed UniLive Cloud SaaS | NOT_DEPLOYED (in-memory MVP only) |
| Self-host ghcr.io images | Reference compose only |
| Production SFU cutover | NOT_PERFORMED |
| UI/UX changes | None (`uiUxChanged=false`) |

## Recommended launch sequence (external)

1. Legal: LICENSE file
2. Registry: publish `@unilives/*` tarballs
3. Docs: deploy docs portal (Stage C artifact)
4. Cloud: deploy persistent control plane (future slice)
5. Self-host: publish verified container images

Stage D completes **engineering readiness**; commercial/public launch steps remain operator-owned.
