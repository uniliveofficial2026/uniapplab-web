# Share-flow audit (Phase 10)

| file | component | context | authoritative ID | URL source | title/desc/image | privacy | handler | branding | proposed IDs | safe visual? | risks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `shareLinks.ts` | builders | post/profile/live/party/… | entity ids | `shareOrigin` + paths | from entities | public share hosts | pure fns | n/a | n/a | **no** | do not edit |
| `ShareModal.tsx` | modal | all kinds | props | `shareUrl` prop | `itemTitle`/`shareText` | caller | copy + `sendShareToUsers` | sheet chrome | `sharing.card.logo` | **yes** | preserve clipboard value |
| `shareDispatch.ts` | send | DM share | user ids | payload URL | text | existing | DB messages | n/a | n/a | **no** | |
| `profileShare.ts` | builder | profile | user | shareLinks | profile fields | public profile | — | n/a | n/a | **no** | |
| `RoomShareButton.tsx` | button | room | — | parent | — | room rules | onClick | ShareIcon | — | icon only | |
| `ShareIcon.tsx` | icon | many | — | — | — | — | — | Lucide Send | — | **legacy** | |
| `SharedLinkCard.tsx` | chat card | message | parseShareLink | message text | resolveShareCardMeta | public meta | open | future watermark | `sharing.card.watermark` | deferred | layout risk |

No new social platforms. No OG meta file changes beyond existing legal HTML titles’ brand apostrophe.

