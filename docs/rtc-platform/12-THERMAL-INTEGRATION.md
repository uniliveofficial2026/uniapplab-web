# 12 — Thermal Integration

Thermal state feeds QoE publish profile decisions alongside network stats.

## Thermal levels (QoE context)

`good | warm | hot | critical`

Passed to `publishProfileForQoe(state, { thermal, topologyPublishers })`.

## Effects

| Thermal | Publish profile cap |
|---|---|
| `critical` | LOW (same as CRITICAL QoE) |
| `hot` | LOW |
| `warm` | STANDARD ceiling |
| `good` | Allows HIGH when QoE GOOD and single publisher |

## Product integration (Stage A)

- Likes batching is loss-tolerant under thermal pressure
- Beauty/AR pipeline uses newest-frame shared vision (Stage A fix)
- Reels decoder budget smoke validates thermal-adjacent media limits

## Stage B scope

`@unilives/rtc-qoe` accepts thermal as **input context** only. Thermal sensing remains platform-specific (iOS/Android/Web APIs in product layers). Orchestrators do not read device APIs directly.

## Future

SDK `observe.getMetrics()` may surface thermal + QoE rollup when device adapters plug into platform-core trace context.

## Testing

`thermal-qoe-beauty-unit-pass` in Stage A evidence; Stage B suite validates `publishProfileForQoe('CRITICAL', { thermal: 'critical' }) === 'LOW'`.
