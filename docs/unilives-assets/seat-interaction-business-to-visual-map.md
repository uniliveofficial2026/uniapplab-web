# UniLive’s seat-interaction business → visual map

Official brand: **UniLive’s**  
Phase: 8

Prefer existing registry IDs (`interaction.kiss`, …). Do not invent `seat-interaction.social.*` duplicates.

| businessId | canonicalAssetId | category | sourceTargetMode | permissionScope | cooldownReference | legacyThumbnail | status |
|------------|------------------|----------|------------------|-----------------|-------------------|-----------------|--------|
| `kiss` | `interaction.kiss` | social | user-to-user | any-seated | client-catalog-unset | 💋 | wired-with-fallback |
| `hug` | `interaction.hug` | social | user-to-user | any-seated | client-catalog-unset | 🤗 | wired-with-fallback |
| `high_five` | `interaction.high-five` | social | user-to-user | any-seated | client-catalog-unset | 🙌 | wired-with-fallback |
| `pillow_fight` | `interaction.pillow-fight` | social | user-to-user | any-seated | client-catalog-unset | 🛏️ | wired-with-fallback |
| `love_you` | `interaction.love-you` | social | user-to-user | any-seated | client-catalog-unset | 😍 | wired-with-fallback |
| `cheer` | `interaction.cheer` | social | user-to-user | any-seated | client-catalog-unset | 📣 | wired-with-fallback |
| `crown` | `interaction.crown` | effect | user-to-user | host-or-moderator-unset | client-catalog-unset | 👑 | wired-with-fallback |
| `freeze` | `interaction.freeze` | effect | user-to-user | host-or-moderator-unset | client-catalog-unset | ❄️ | wired-with-fallback |
| `fire` | `interaction.fire` | effect | user-to-user | any-seated | client-catalog-unset | 🔥 | wired-with-fallback |
| `confetti` | `interaction.confetti` | effect | room-or-target | any-seated | client-catalog-unset | 🎊 | wired-with-fallback |

## Product note

Room UI currently has **no** seat-to-seat interaction picker/send pipeline (seat sheet = mute/follow/profile/mention/remove/ban).  
Phase 8 registers visuals + brand components only — **no fake events**.
