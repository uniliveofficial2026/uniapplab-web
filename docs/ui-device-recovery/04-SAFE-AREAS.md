# Safe Areas

Use `env(safe-area-inset-*)` via `--app-safe-*`.

Fallbacks in `nativeShellFallbacks()` apply only when env reports 0 on native/PWA shells (OS class, not model id).

Background media may bleed edge-to-edge; controls use safe/composer insets.
