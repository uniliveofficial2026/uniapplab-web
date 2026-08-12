# Next tasks (ordered)

1. **Supply missing approved brand references** (individual files, not boards):
   - `URL_BRAND_LOGO_PRIMARY_TRANSPARENT_v001_APPROVED.png`
   - `URL_BRAND_LOGO_ICON_512_v001_APPROVED.png`
   - `URL_BRAND_SPLASH_LAYOUT_v001_APPROVED.png`
   - `URL_BRAND_SPLASH_CHARACTER_STILL_v001_APPROVED.png`
   - `URL_BRAND_SPLASH_ANIMATION_SPEC_v001_APPROVED.md`
   - `URL_BRAND_SPLASH_VOICE_SCRIPT_v001_APPROVED.txt`
2. Ledger them in `docs/unilives-assets/approved-reference-ledger.md`
3. `pnpm asset-studio:prepare --id brand.logo.primary` (must unblock)
4. Dry preview: `pnpm asset-studio:preview --id brand.logo.primary --provider openai`
5. Only after dry-run looks correct: temporarily `ASSET_STUDIO_DRY_RUN=false`, one preview, then restore `true`
6. Repeat for `brand.logo.icon` and `brand.logo.animated`
7. Stop for human approval of playable previews — do not production-approve or deploy
