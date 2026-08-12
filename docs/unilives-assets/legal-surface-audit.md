# Legal-surface audit (Phase 10)

| file | component | route/surface | document source | version | acceptance? | handler | stored fields | branding | proposed IDs | safe visual? | risks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `public/privacy-policy.html` | static HTML | `/privacy-policy.html` | same file | effective Jul 9 2026 | no (read-only) | n/a | n/a | UniLive’s + logo favicon | `legal.document.*` | **yes** | apostrophe only |
| `public/terms-of-service.html` | static HTML | `/terms-of-service.html` | same file | effective Jul 9 2026 | no | n/a | n/a | UniLive’s | `legal.document.*` | **yes** | apostrophe only |
| `lib/legalDocs.ts` | helpers | shared | paths + copy | `2026-07-09-d` | storage helpers | `writeLegalAcceptanceToStorage` | `acceptedAt`,`version` | APP_DISPLAY_NAME | n/a | comment only | do not change version |
| `LegalAgreementCheckbox.tsx` | checkbox | profile setup | legalDocs strings | same | **yes** | parent parent onChange | via parent write | design tokens | `legal.consent.icon` | **yes** | no auto-check |
| `ProfileSetup.tsx` / `ProfileSetupScreen.tsx` | setup | onboarding | checkbox | same | **yes** | `writeLegalAcceptanceToStorage` | localStorage | — | — | **no logic** | preserve gate |
| `AuthScreen.tsx` | footer links | auth | open* | n/a | no | `openPrivacy/Terms` | n/a | links | `legal.privacy/terms.icon` | **yes** | same URLs |
| `ProfileEditSettingsModal.tsx` | Legal section | settings | open* | paths shown | no | open* | n/a | Shield/FileText | legal icons | **yes** | same paths |
| community/copyright/safety | — | none | `.gitkeep` only | — | — | — | — | — | icons reserved | **not-in-phase** | no invent pages |

