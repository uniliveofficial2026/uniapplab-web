# FINAL DATAFLOW MAP

Canonical pattern for paid / control / media:

```
USER ACTION
→ UI COMPONENT
→ CONTROLLER / HOOK / DOMAIN
→ UniLive SDK / UniLiveRTC (media) OR API (authority)
→ SERVER AUTHORIZATION
→ DATABASE / PROVIDER
→ AUTHORITATIVE RESULT
→ REALTIME EVENT
→ LOCAL STATE
→ UI UPDATE
```

## Gift example
Send Gift → GiftPanel → gift domain → settlement API → authenticated sender → wallet/gift RPC → authoritative gift event → UniLive event lane → GiftPlaybackScheduler → overlay (+ PK scorer if applicable).

## Camera example
Physical camera → `appCameraOwner` / `cameraAcquire` → beauty/effect processing → local preview → processed track → UniLiveRTC → LiveKitRTCProvider → LiveKit.

No client-authoritative paid state. No production localhost game health probe after LocalGamePlayer DEV guard.
