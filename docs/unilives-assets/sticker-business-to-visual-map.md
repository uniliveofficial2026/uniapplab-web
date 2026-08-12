# UniLive’s sticker business → visual map

Official brand: **UniLive’s**  
Phase: 8

## Editor / story overlay stickers

Draft field `sticker` continues to store the **emoji string** (unchanged).  
Business slug IDs are for registry mapping / visual resolve only.

| businessId | emoji (legacy draft value) | canonicalAssetId | status |
|------------|----------------------------|------------------|--------|
| `fire` | 🔥 | `sticker.reaction.fire` | wired-with-fallback |
| `sparkles` | ✨ | `sticker.reaction.sparkles` | wired-with-fallback |
| `hundred` | 💯 | `sticker.reaction.hundred` | wired-with-fallback |
| `party` | 🎉 | `sticker.reaction.party` | wired-with-fallback |
| `heart` | ❤️ | `sticker.reaction.heart` | wired-with-fallback |
| `joy` | 😂 | `sticker.reaction.joy` | wired-with-fallback |
| `mountain` | 🏔️ | `sticker.static.mountain` | wired-with-fallback |
| `camera` | 📸 | `sticker.static.camera` | wired-with-fallback |
| `music` | 🎵 | `sticker.static.music` | wired-with-fallback |
| `star` | ⭐ | `sticker.reaction.star` | wired-with-fallback |
| `eyes` | 👀 | `sticker.reaction.eyes` | wired-with-fallback |
| `rocket` | 🚀 | `sticker.reaction.rocket` | wired-with-fallback |

## Beauty AR stickers (Tencent)

| Key | Behavior |
|-----|----------|
| Business ID | Tencent `TencentEffectItem.id` (remote) |
| Visual | Remote `cover` URL via `remoteIconOverride` |
| Registry map | Not enumerated (dynamic remote catalog) |
| Status | remote-first; no invented production files |

## Not mapped (out of scope)

- Chat message reaction emoji
- User-generated emoji
- Gift emoji
