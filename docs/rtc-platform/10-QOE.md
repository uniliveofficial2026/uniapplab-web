# 10 — QoE (Quality of Experience)

Network and thermal adaptation lives in `@unilives/rtc-qoe`.

## QoE states

`GOOD | DEGRADING | POOR | CRITICAL | RECOVERING`

## Classification

`classifyQoe(stats, prev)` uses packet loss + RTT thresholds:

| Condition | Raw state |
|---|---|
| loss ≥ 20% or RTT ≥ 800ms | CRITICAL |
| loss ≥ 10% or RTT ≥ 400ms | POOR |
| loss ≥ 5% or RTT ≥ 220ms | DEGRADING |
| else | GOOD |

**Hysteresis** prevents oscillation: e.g. CRITICAL→POOR yields RECOVERING; RECOVERING requires sustained GOOD before exit.

## Publish profiles

`publishProfileForQoe(state, { thermal, topologyPublishers })`:

| Input | Profile |
|---|---|
| CRITICAL or thermal critical | LOW |
| POOR or thermal hot or ≥6 publishers | LOW |
| DEGRADING/RECOVERING or warm or ≥4 publishers | STANDARD |
| GOOD + good thermal + 1 publisher | HIGH |
| default | STANDARD |

Profiles: `LOW | STANDARD | HIGH | PREMIUM` (contracts).

## Governor

`createQoeGovernor()` holds mutable session state:

```javascript
const { state, publishProfile } = governor.update(stats, { thermal: 'warm', topologyPublishers: 4 });
```

Client exposes via `room.getNetwork()` in `@unilives/rtc-client`.

## LiveKit mapping

`setPublishProfile` on LiveKit adapter stores profile; encoding mapping is provider-internal (dynacast/adaptive stream). Full simulcast layer policy remains in product `liveKitPublishProfile.ts` during migration.

## Stage A validation

Thermal + QoE + beauty unit tests passed. Reels decoder budget smoke validates downstream consumer behavior.
