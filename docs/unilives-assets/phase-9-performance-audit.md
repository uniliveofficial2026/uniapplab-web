# Phase 9 performance audit

## Strategy

- Prefer Lucide/CSS when registry status is `missing` (no broken URLs).
- Identity `<img>` uses `loading="lazy"` + `decoding="async"`.
- Decorative media: `pointer-events: none` / `aria-hidden`.
- Reduced motion / low performance: static fallbacks via `resolveIdentityMediaUrl`.
- Preload caps: current visible adornments + current-user active only; never all levels/VIP/animated rings.
- Virtualized lists: do not decode off-screen animated rings (none active yet).

## Cleanup

Brand media components do not retain animation instances (no animated identity production assets yet).
