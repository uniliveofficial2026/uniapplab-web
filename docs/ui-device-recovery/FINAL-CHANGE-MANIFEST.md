# FINAL-CHANGE-MANIFEST

## UI/UX
uiUxChanged: **false** — layout/keyboard/safe-area/landmark only.

## Code
- artifacts/instacollab/src/lib/safeArea.ts
- artifacts/instacollab/src/lib/bootNativeShell.ts
- artifacts/instacollab/src/contexts/AppViewportContext.tsx
- artifacts/instacollab/src/main.tsx
- artifacts/instacollab/src/index.css
- artifacts/instacollab/src/components/messages/MessagesComposeBar.tsx
- artifacts/instacollab/src/components/messages/MessagesActiveCallOverlay.tsx
- artifacts/instacollab/src/components/messages/ChatLocationShareSheet.tsx
- artifacts/instacollab/src/components/layout/Shell.tsx
- artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx
- artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx
- artifacts/instacollab/src/smule-rooms/components/solo-shop-live-approved.css
- artifacts/instacollab/src/smule-rooms/components/LiveGiftRechargeModal.tsx
- artifacts/instacollab/src/smule-rooms/components/GiftSendersOverlay.tsx
- artifacts/instacollab/ios/App/App/AppDelegate.swift
- scripts/ui-device-recovery/*
- docs/ui-device-recovery/*
- package.json test scripts

## Verdict
fullRealApplication remains **FAIL** until physical iPhone keyboard/layout retest + deploy hash verify.
