# UniLive’s design token reference

Official brand spelling: **UniLive’s**  
Source of truth: `artifacts/instacollab/src/index.css` (`@theme` + utility classes)

Values preserve the current working theme (`--background`, `--card`, `--primary`, etc.). Phase 6 adds semantic aliases — it does not invent production brand palette from concept boards.

## Core

| Token | Resolves to |
|-------|-------------|
| `--color-unilives-background` | `var(--background)` |
| `--color-unilives-surface` | `var(--card)` |
| `--color-unilives-surface-raised` | `var(--popover)` |
| `--color-unilives-surface-overlay` | `var(--popover)` |
| `--color-unilives-border` | `var(--border)` |
| `--color-unilives-border-strong` | `var(--input)` |
| `--color-unilives-text` | `var(--foreground)` |
| `--color-unilives-text-muted` | `var(--muted-foreground)` |
| `--color-unilives-text-subtle` | `var(--muted-foreground)` |
| `--color-unilives-primary` | `#2563eb` (Phase 1) |
| `--color-unilives-primary-hover` | `color-mix(… primary 88%, black)` |
| `--color-unilives-primary-active` | `color-mix(… primary 78%, black)` |
| `--color-unilives-accent` | `#e11d48` (Phase 1) |
| `--color-unilives-focus` | `var(--ring)` |
| `--color-unilives-disabled` | `var(--muted)` |

## Status

| Token | Resolves to |
|-------|-------------|
| `--color-unilives-success` | `#16a34a` |
| `--color-unilives-warning` | `#d97706` |
| `--color-unilives-error` | `var(--destructive)` |
| `--color-unilives-info` | `var(--primary)` |
| `--color-unilives-live` | `#ef4444` (Phase 1) |
| `--color-unilives-online` | `#22c55e` |
| `--color-unilives-gold` | `#f9ce34` (Phase 1) |

## Controls

| Token | Resolves to |
|-------|-------------|
| `--color-unilives-input-background` | `var(--card)` |
| `--color-unilives-input-border` | `var(--input)` |
| `--color-unilives-input-placeholder` | `var(--muted-foreground)` |
| `--color-unilives-control-hover` | `var(--secondary)` |
| `--color-unilives-control-active` | `var(--muted)` |
| `--color-unilives-control-disabled` | `var(--muted)` |

## Shape

| Token | Value |
|-------|-------|
| `--radius-unilives-xs` | `0.375rem` |
| `--radius-unilives-sm` | `0.5rem` |
| `--radius-unilives-md` | `0.75rem` |
| `--radius-unilives-lg` | `1rem` |
| `--radius-unilives-xl` | `1.5rem` |
| `--radius-unilives-pill` | `9999px` |

## Elevation

| Token | Value |
|-------|-------|
| `--shadow-unilives-sm` | `0 1px 2px rgba(15, 23, 42, 0.06)` |
| `--shadow-unilives-md` | `0 4px 12px rgba(15, 23, 42, 0.1)` |
| `--shadow-unilives-lg` | `0 12px 32px rgba(15, 23, 42, 0.16)` |
| `--shadow-unilives-overlay` | `0 16px 48px rgba(15, 23, 42, 0.28)` |

## Motion

| Token | Value |
|-------|-------|
| `--duration-unilives-fast` | `120ms` |
| `--duration-unilives-normal` | `200ms` |
| `--duration-unilives-slow` | `320ms` |
| `--ease-unilives-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--ease-unilives-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` |

Utilities: `.unilives-transition-fast`, `.unilives-transition-normal` honor `prefers-reduced-motion`.

## Typography

| Token | Value |
|-------|-------|
| `--font-unilives-display` | Inter + system (Phase 1) |
| `--font-unilives-body` | Inter + system (Phase 1) |
| `--font-unilives-mono` | ui-monospace stack |
| `--text-unilives-caption` | `0.6875rem` |
| `--text-unilives-body` | `0.9375rem` |
| `--text-unilives-label` | `0.75rem` |
| `--text-unilives-title` | `1.125rem` |
| `--text-unilives-heading` | `1.5rem` |

## Utility classes

| Class | Purpose |
|-------|---------|
| `.unilives-focus-ring` | Visible `:focus-visible` ring using focus tokens |
| `.unilives-surface` | Surface bg/text/border |
| `.unilives-text-muted` | Muted text color |
| `.unilives-transition-fast` / `.unilives-transition-normal` | Short transitions + reduced-motion |

## Prior phase namespaces (preserved)

- Onboarding: `--color-unilives-onboarding-*`
- Auth: `--color-unilives-auth-*`
- Profile setup: `--color-unilives-profile-setup-*`
- Discovery: `--color-unilives-discovery-*`
