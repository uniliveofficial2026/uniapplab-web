# Responsive System SSOT

## Tokens (written by `lib/safeArea.ts`)

| Token | Meaning |
|-------|---------|
| `--app-vv-height` / `--app-height` | Visible viewport height (above keyboard) |
| `--app-vv-width` | Visible viewport width |
| `--app-safe-*` | Static safe-area insets only |
| `--app-keyboard-inset` / `--keyboard-height` | Soft keyboard overlap |
| `--app-composer-bottom-inset` | Keyboard when open, else safe-bottom |
| `--app-shell-*-offset` | Top/bottom chrome (nav + static safe) |

## Utilities

- `.h-vv` / `.max-h-vv` — shell height
- `.pb-shell-nav` — main content clearance for bottom nav
- `.pb-composer` / `.pb-keyboard` — composers / fixed footers
- `html[data-keyboard-open="1"]` — hides bottom nav; zeros nav height token

## React

`AppViewportProvider` / `useAppViewport()` subscribe to the same SSOT — no per-screen listeners.

## Forbidden

- Competing `100vh` shell heights without `h-vv`
- Cap Body resize + manual translateY
- Folding keyboard into `--app-safe-bottom`
