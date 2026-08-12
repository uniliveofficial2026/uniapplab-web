<!-- RECOVERY 2026-07-30: File physically present in repository. Prior PASS/fail claims are historical and must not be treated as re-verified unless the recovery verification commands succeed independently. -->

# Final route and flow audit (Phase 12)

App is primarily shell/tab based (not a large React Router tree). Key surfaces:

| Flow | Entry | Target unchanged | Auth gate | Notes |
|------|-------|------------------|-----------|-------|
| Splash / launch | launch shell | yes | — | Phase 1–3 branding |
| Onboarding | launch | yes | — | Phase 2 |
| Auth | AuthScreen / launch AuthScreen | yes | — | Phase 3 |
| Profile setup | ProfileSetup / ProfileSetupScreen | yes | post-auth | Phase 4; legal checkbox |
| Trending | TrendingScreen | yes | post-setup | |
| Main shell tabs | Shell | yes | logged-in | feed/discovery/live/party/profile… |
| Live discovery | LiveScreen | yes | — | useCloudLiveDiscovery |
| Party/karaoke party | KaraokeScreen party tab | yes | — | gated discovery |
| Room entry | RoomsHost / Room | room IDs | — | Phase 11 lifecycle |
| Share | ShareModal | shareUrl props | — | Phase 10 chrome |
| Legal | `/privacy-policy.html`, `/terms-of-service.html` | paths unchanged | — | Phase 10 |
| Settings legal links | ProfileEditSettingsModal | open* handlers | — | |
| Banned | BannedScreen | — | banned users | brand label fixed |

No routes added or removed in Phase 12.
