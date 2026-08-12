# UniLive’s Asset Studio package — construction report

Date: 2026-07-30  
Package: `@workspace/unilives-asset-studio` at `lib/unilives-asset-studio/`

## Confirmations

- No secret values displayed
- No paid API calls
- No deploy / push / merge / publish
- `.env.local` protected by gitignore
- Dry-run default **true**; max paid calls **1**; auto-retry **false**; approval required **true**

## First dry-run command

```bash
pnpm asset-studio:prepare --id brand.logo.primary
```

Then (still dry-run; no credits):

```bash
pnpm asset-studio:preview --id brand.logo.primary --provider openai
```
