# Legal content change log (Phase 10)

## Permitted brand corrections (verbatim)

### `artifacts/instacollab/public/privacy-policy.html`

All occurrences of the product name using ASCII apostrophe:

- **Before:** `UniLive's` (U+0027)
- **After:** `UniLive’s` (U+2019)

Count: 14 in-document replacements (plus decorative header wordmark). Titles, meta description, body clauses, and footer “Back to …” updated spelling only.

### `artifacts/instacollab/public/terms-of-service.html`

Same spelling correction:

- **Before:** `UniLive's` (U+0027)
- **After:** `UniLive’s` (U+2019)

Count: 15 in-document replacements (plus decorative header wordmark).

### Decorative (non-clause) addition

Both HTML files: brand header with `/brand/app-logo.png` + wordmark `UniLive’s` and `.brand-header` CSS. Does not alter numbered sections, dates, or obligations.

### `artifacts/instacollab/src/lib/legalDocs.ts`

Comment only:

- Before: `Public legal documents for UniLive.`
- After: `Public legal documents for UniLive’s.`

### Unchanged (explicit)

- `LEGAL_AGREEMENT_VERSION` = `2026-07-09-d`
- `LEGAL_AGE_DISCLAIMER` / `LEGAL_AGREEMENT_CHECKBOX_LABEL` (already `APP_DISPLAY_NAME`)
- Paths `/privacy-policy.html`, `/terms-of-service.html`
- Effective date July 9, 2026
- Domains `uniapplab.com` / `app.uniapplab.com`
- All numbered Terms sections and Privacy sections wording aside from brand apostrophe

