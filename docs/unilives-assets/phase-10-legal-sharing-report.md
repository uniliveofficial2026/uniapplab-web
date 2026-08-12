# UniLive’s Phase 10 — Legal, QR & sharing branding report

Generated: 2026-07-23  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s** (U+2019)

Visual branding only. No legal meaning, version, consent, QR payload, share URL, deep-link, clipboard, native-share, privacy, route, or analytics changes. No deploy/push/R2.

---

## Existing legal flow summary

1. Canonical public HTML: `/privacy-policy.html`, `/terms-of-service.html`.
2. In-app helpers: `lib/legalDocs.ts` — paths, titles, age disclaimer, checkbox label, `LEGAL_AGREEMENT_VERSION = 2026-07-09-d`.
3. Acceptance: `LegalAgreementCheckbox` on profile setup; `writeLegalAcceptanceToStorage(userId)` stores `legal_agreement:{userId}` with `acceptedAt` + `version`.
4. Links: AuthScreen footer, ProfileEditSettings Legal section — `openPrivacyPolicy` / `openTermsOfService` → `window.open` same paths.
5. No separate Community Guidelines / Copyright / Safety product pages (directories are placeholders only).
6. No in-app HTML document viewer route — external HTML tabs.

## Existing QR and sharing flow summary

1. **No QR product UI** — no QRCode library usage, no profile/room QR screens.
2. Share URLs: `lib/shareLinks.ts` builders (`buildPostSharePayload`, profile/live/party builders) using `APP_SHARE_HOST` / origin.
3. Share sheet: `ShareModal` — DM send via `sendShareToUsers`, copy via `navigator.clipboard.writeText(shareUrl)`.
4. Room share: `RoomShareButton` → existing share openers; `ShareIcon` Lucide Send.
5. Chat previews: `SharedLinkCard` resolves meta from share URL text — payload unchanged.

## Logic boundaries

**Outside visuals:** document fetch/version, consent/acceptance storage, age gate, open handlers, URL/payload/QR encode, clipboard, native share, privacy checks, analytics, DB writes.

**Visual layer:** decorative chrome, logos, icons, loaders — props only.

---

## Audits

See companion docs: `legal-surface-audit.md`, `qr-payload-audit.md`, `share-flow-audit.md`.

## Exact legal copy changes

1. In `privacy-policy.html` and `terms-of-service.html`: every displayed product name `UniLive's` (ASCII apostrophe U+0027) → `UniLive’s` (U+2019). **Meaning unchanged.**
2. Added decorative brand header (logo + wordmark) and CSS — **not** legal clause text.
3. `legalDocs.ts` file comment: `UniLive.` → `UniLive’s.` (non-user-facing).
4. Consent/disclaimer strings already used `APP_DISPLAY_NAME` (correct spelling) — **unchanged**.
5. Effective date, version ID, paths, contact domains, clause order — **unchanged**.

## Legal-content preservation

Reversing Phase 10 transforms (remove brand header/CSS; restore ASCII apostrophe) recovers the pre-Phase-10 HTML body/clauses. No clause rephrase, shorten, or renumber.  
`LEGAL_AGREEMENT_VERSION` remains `2026-07-09-d`.

## QR

No product QR encoder. Registry QR frame IDs are `not-in-phase`. Components `UniLivesQrFrame` / `UniLivesQrPreview` accept pre-encoded children only.

## Security / privacy

Share URLs remain public share-host links (user/post/room IDs as already designed). No tokens added. No private fields newly displayed. Existing share URL patterns deferred for behavioral security review if needed — **not altered**.

## Registry

- Seed version **10**
- Legal assets: **13**
- Sharing assets: **17**
- Phase 10 maps: **10**
- Production binaries: **0** (all missing → Lucide/`/brand/app-logo.png`)

## Rollback

1. Revert `components/legal/brand/*`, `components/sharing/brand/*`.
2. Revert `legalResolve.ts` / `sharingResolve.ts` / index exports / registry legal path.
3. Restore `LegalAgreementCheckbox`, `ShareModal`, `AuthScreen`, `ProfileEditSettingsModal`.
4. Restore legal HTML apostrophe + remove brand header.
5. Revert seed v10 legal/sharing assets and maps.
6. Rebuild locally.

**STOP** — awaiting human approval.
