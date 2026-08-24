/* generated — UniLive’s live experience registry. Do not edit. */
export const LIVE_UI_REGISTRY = {
  "schemaVersion": 1,
  "brand": "UniLive’s",
  "canonicalRoomTypes": [
    "solo_audio",
    "solo_video",
    "audio_party",
    "video_multi",
    "pk_1v1",
    "pk_team",
    "game",
    "commerce"
  ],
  "experiences": [
    {
      "experienceId": "experience.live.solo-audio",
      "displayName": "Solo Audio",
      "canonicalRoomTypes": [
        "solo_audio"
      ],
      "uiRoomModes": [
        "Solo-Live",
        "Chat"
      ],
      "mediaMode": "audio",
      "seats": {
        "min": 1,
        "max": 1
      },
      "pkSupport": false,
      "hostViewerGuest": true,
      "backendStatus": "supported",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "layoutId": "layout.live.solo-audio.default",
      "fallbackExperienceId": "experience.live.solo-video",
      "existingExperienceKey": "live.solo-audio",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.solo-audio",
        "displayName": "Solo Audio",
        "canonicalRoomTypes": [
          "solo_audio"
        ],
        "mediaMode": "audio",
        "versionId": "v1",
        "layoutVersionId": "layout.live.solo-audio.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.solo-audio.stage": "1",
          "node.live.solo-audio.host-avatar": "1",
          "node.live.solo-audio.speaking-ring": "1",
          "node.live.solo-audio.waveform": "1",
          "node.live.solo-audio.audio-status": "1",
          "node.live.solo-audio.background-art": "1",
          "node.live.solo-audio.host-controls": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.solo-video",
        "checksum": "ff1843ffdd73e8bf1d9e54014ddf027e"
      }
    },
    {
      "experienceId": "experience.live.solo-video",
      "displayName": "Solo Video",
      "canonicalRoomTypes": [
        "solo_video"
      ],
      "uiRoomModes": [
        "Solo-Live"
      ],
      "mediaMode": "video",
      "seats": {
        "min": 1,
        "max": 1
      },
      "pkSupport": true,
      "hostViewerGuest": true,
      "backendStatus": "supported",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "layoutId": "layout.live.solo-video.default",
      "fallbackExperienceId": "experience.live.solo-audio",
      "existingExperienceKey": "live.solo-video",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.solo-video",
        "displayName": "Solo Video",
        "canonicalRoomTypes": [
          "solo_video"
        ],
        "mediaMode": "video",
        "versionId": "v1",
        "layoutVersionId": "layout.live.solo-video.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.pk-state": "1",
          "node.live.host.pk-score": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.shared.pk-invite-sheet": "1",
          "node.live.solo-video.stage": "1",
          "node.live.solo-video.video-surface": "1",
          "node.live.solo-video.video-placeholder": "1",
          "node.live.solo-video.camera-status": "1",
          "node.live.solo-video.host-overlay": "1",
          "node.live.solo-video.effect-surface": "1",
          "node.live.solo-video.host-controls": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic",
          "camera"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.solo-audio",
        "checksum": "e56d6547ae56a0827f4c18d5fc8ebc8b"
      }
    },
    {
      "experienceId": "experience.live.multi-guest-audio",
      "displayName": "Multi-Guest Audio",
      "canonicalRoomTypes": [
        "audio_party"
      ],
      "uiRoomModes": [
        "Chat",
        "Multi-Guest"
      ],
      "mediaMode": "audio",
      "seats": {
        "min": 1,
        "max": 15
      },
      "pkSupport": false,
      "hostViewerGuest": true,
      "backendStatus": "supported-via-alias",
      "backendNote": "No dedicated multi_guest_audio enum. Maps to audio_party. Chat lounge / audio Multi-Guest use this presentation.",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "layoutId": "layout.live.multi-guest-audio.default",
      "fallbackExperienceId": "experience.live.solo-audio",
      "existingExperienceKey": "live.multi-audio",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.multi-guest-audio",
        "displayName": "Multi-Guest Audio",
        "canonicalRoomTypes": [
          "audio_party"
        ],
        "mediaMode": "audio",
        "versionId": "v1",
        "layoutVersionId": "layout.live.multi-guest-audio.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.multi-guest-audio.seat-grid": "1",
          "node.live.multi-guest-audio.seat-template": "1",
          "node.live.multi-guest-audio.empty-seat-template": "1",
          "node.live.multi-guest-audio.seat-avatar": "1",
          "node.live.multi-guest-audio.seat-name": "1",
          "node.live.multi-guest-audio.seat-badges": "1",
          "node.live.multi-guest-audio.seat-speaking-ring": "1",
          "node.live.multi-guest-audio.seat-mic-status": "1",
          "node.live.multi-guest-audio.seat-lock-status": "1",
          "node.live.multi-guest-audio.seat-menu": "1",
          "node.live.multi-guest-audio.request-queue": "1",
          "node.live.multi-guest-audio.invitation-panel": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.solo-audio",
        "checksum": "3e22882a033053cc6f560c963800b577"
      }
    },
    {
      "experienceId": "experience.live.multi-guest-video",
      "displayName": "Multi-Guest Video",
      "canonicalRoomTypes": [
        "video_multi"
      ],
      "uiRoomModes": [
        "Multi-Guest"
      ],
      "mediaMode": "video",
      "seats": {
        "min": 1,
        "max": 15
      },
      "pkSupport": true,
      "hostViewerGuest": true,
      "backendStatus": "supported",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "layoutId": "layout.live.multi-guest-video.default",
      "fallbackExperienceId": "experience.live.solo-video",
      "existingExperienceKey": "live.multi-video",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.multi-guest-video",
        "displayName": "Multi-Guest Video",
        "canonicalRoomTypes": [
          "video_multi"
        ],
        "mediaMode": "video",
        "versionId": "v1",
        "layoutVersionId": "layout.live.multi-guest-video.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.pk-state": "1",
          "node.live.host.pk-score": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.shared.pk-invite-sheet": "1",
          "node.live.multi-guest-video.stage": "1",
          "node.live.multi-guest-video.tile-grid": "1",
          "node.live.multi-guest-video.tile-template": "1",
          "node.live.multi-guest-video.empty-tile-template": "1",
          "node.live.multi-guest-video.video-surface": "1",
          "node.live.multi-guest-video.video-placeholder": "1",
          "node.live.multi-guest-video.participant-name": "1",
          "node.live.multi-guest-video.participant-badges": "1",
          "node.live.multi-guest-video.audio-level": "1",
          "node.live.multi-guest-video.mic-status": "1",
          "node.live.multi-guest-video.camera-status": "1",
          "node.live.multi-guest-video.tile-menu": "1",
          "node.live.multi-guest-video.focused-speaker": "1",
          "node.live.multi-guest-video.request-queue": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic",
          "camera"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.solo-video",
        "checksum": "b1bb2d03b2cc944eaefaa236e322407e"
      }
    },
    {
      "experienceId": "experience.live.party-audio",
      "displayName": "Party Audio",
      "canonicalRoomTypes": [
        "audio_party"
      ],
      "uiRoomModes": [
        "Party"
      ],
      "mediaMode": "audio",
      "seats": {
        "min": 1,
        "max": 8
      },
      "pkSupport": false,
      "hostViewerGuest": true,
      "backendStatus": "supported",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Party.tsx",
      "layoutId": "layout.live.party-audio.default",
      "fallbackExperienceId": "experience.live.multi-guest-audio",
      "existingExperienceKey": "live.party",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.party-audio",
        "displayName": "Party Audio",
        "canonicalRoomTypes": [
          "audio_party"
        ],
        "mediaMode": "audio",
        "versionId": "v1",
        "layoutVersionId": "layout.live.party-audio.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.multi-guest-audio.seat-grid": "1",
          "node.live.multi-guest-audio.seat-template": "1",
          "node.live.multi-guest-audio.empty-seat-template": "1",
          "node.live.multi-guest-audio.seat-avatar": "1",
          "node.live.multi-guest-audio.seat-name": "1",
          "node.live.multi-guest-audio.seat-badges": "1",
          "node.live.multi-guest-audio.seat-speaking-ring": "1",
          "node.live.multi-guest-audio.seat-mic-status": "1",
          "node.live.multi-guest-audio.seat-lock-status": "1",
          "node.live.multi-guest-audio.seat-menu": "1",
          "node.live.multi-guest-audio.request-queue": "1",
          "node.live.multi-guest-audio.invitation-panel": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.multi-guest-audio",
        "checksum": "35ab1fe7c2bac0fda566c3c2d2e58612"
      }
    },
    {
      "experienceId": "experience.live.party-video",
      "displayName": "Party Video",
      "canonicalRoomTypes": [
        "video_multi"
      ],
      "uiRoomModes": [
        "Party"
      ],
      "mediaMode": "video",
      "seats": {
        "min": 1,
        "max": 8
      },
      "pkSupport": false,
      "hostViewerGuest": true,
      "backendStatus": "supported-via-alias",
      "backendNote": "No party_video enum. Party video is presentation on video_multi. Same seat API as multi-guest-video. PK disabled in Party UI.",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "layoutId": "layout.live.party-video.default",
      "fallbackExperienceId": "experience.live.multi-guest-video",
      "existingExperienceKey": "live.party",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.party-video",
        "displayName": "Party Video",
        "canonicalRoomTypes": [
          "video_multi"
        ],
        "mediaMode": "video",
        "versionId": "v1",
        "layoutVersionId": "layout.live.party-video.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.multi-guest-video.stage": "1",
          "node.live.multi-guest-video.tile-grid": "1",
          "node.live.multi-guest-video.tile-template": "1",
          "node.live.multi-guest-video.empty-tile-template": "1",
          "node.live.multi-guest-video.video-surface": "1",
          "node.live.multi-guest-video.video-placeholder": "1",
          "node.live.multi-guest-video.participant-name": "1",
          "node.live.multi-guest-video.participant-badges": "1",
          "node.live.multi-guest-video.audio-level": "1",
          "node.live.multi-guest-video.mic-status": "1",
          "node.live.multi-guest-video.camera-status": "1",
          "node.live.multi-guest-video.tile-menu": "1",
          "node.live.multi-guest-video.focused-speaker": "1",
          "node.live.multi-guest-video.request-queue": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic",
          "camera"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.multi-guest-video",
        "checksum": "934299454bd858f86351b0650df8ca2d"
      }
    },
    {
      "experienceId": "experience.live.pk-1v1",
      "displayName": "PK 1v1",
      "canonicalRoomTypes": [
        "pk_1v1"
      ],
      "uiRoomModes": [
        "Solo-Live",
        "Multi-Guest"
      ],
      "mediaMode": "mixed",
      "seats": {
        "min": 2,
        "max": 2
      },
      "pkSupport": true,
      "hostViewerGuest": true,
      "backendStatus": "supported",
      "backendNote": "live_pk_sessions table exists. Dedicated PK command routes are incomplete; client reducer + table. Scores must come from committed gifts, not UI config.",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "layoutId": "layout.live.pk-1v1.default",
      "fallbackExperienceId": "experience.live.solo-video",
      "existingExperienceKey": "live.pk-one-v-one",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.pk-1v1",
        "displayName": "PK 1v1",
        "canonicalRoomTypes": [
          "pk_1v1"
        ],
        "mediaMode": "mixed",
        "versionId": "v1",
        "layoutVersionId": "layout.live.pk-1v1.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.pk-state": "1",
          "node.live.host.pk-score": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.shared.pk-invite-sheet": "1",
          "node.live.pk.root": "1",
          "node.live.pk.local-side": "1",
          "node.live.pk.opponent-side": "1",
          "node.live.pk.local-host": "1",
          "node.live.pk.opponent-host": "1",
          "node.live.pk.vs-badge": "1",
          "node.live.pk.invite-state": "1",
          "node.live.pk.accept-panel": "1",
          "node.live.pk.countdown": "1",
          "node.live.pk.timer": "1",
          "node.live.pk.scoreboard": "1",
          "node.live.pk.local-score": "1",
          "node.live.pk.opponent-score": "1",
          "node.live.pk.score-progress": "1",
          "node.live.pk.gift-score-layer": "1",
          "node.live.pk.result-overlay": "1",
          "node.live.pk.winner-state": "1",
          "node.live.pk.loser-state": "1",
          "node.live.pk.draw-state": "1",
          "node.live.pk.end-button": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic",
          "camera"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.solo-video",
        "checksum": "077bf46aa03dfdbe938e8fe08983aa84"
      }
    },
    {
      "experienceId": "experience.live.pk-team",
      "displayName": "PK Team",
      "canonicalRoomTypes": [
        "pk_team"
      ],
      "uiRoomModes": [
        "Multi-Guest"
      ],
      "mediaMode": "mixed",
      "seats": {
        "min": 2,
        "max": 15
      },
      "pkSupport": true,
      "hostViewerGuest": true,
      "backendStatus": "supported",
      "backendNote": "Same PK table. No extra multipliers/rewards invented.",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "layoutId": "layout.live.pk-team.default",
      "fallbackExperienceId": "experience.live.pk-1v1",
      "existingExperienceKey": "live.pk-team",
      "manifest": {
        "schemaVersion": 1,
        "experienceId": "experience.live.pk-team",
        "displayName": "PK Team",
        "canonicalRoomTypes": [
          "pk_team"
        ],
        "mediaMode": "mixed",
        "versionId": "v1",
        "layoutVersionId": "layout.live.pk-team.default:1",
        "nodeVersionIds": {
          "node.live.shared.root": "1",
          "node.live.shared.background": "1",
          "node.live.shared.safe-area": "1",
          "node.live.shared.header": "1",
          "node.live.shared.back": "1",
          "node.live.shared.room-title": "1",
          "node.live.shared.room-badge": "1",
          "node.live.shared.host-avatar": "1",
          "node.live.shared.host-name": "1",
          "node.live.shared.host-badges": "1",
          "node.live.shared.follow": "1",
          "node.live.shared.viewer-count": "1",
          "node.live.shared.viewer-list-trigger": "1",
          "node.live.shared.network-indicator": "1",
          "node.live.shared.share": "1",
          "node.live.shared.more-menu": "1",
          "node.live.shared.report": "1",
          "node.live.shared.moderation-menu": "1",
          "node.live.shared.stage": "1",
          "node.live.shared.bottom-controls": "1",
          "node.live.shared.leave-button": "1",
          "node.live.shared.end-room-button": "1",
          "node.live.shared.leave-room": "1",
          "node.live.shared.leave-confirmation": "1",
          "node.live.host.end-live": "1",
          "node.live.host.end-live-confirmation": "1",
          "node.live.host.ending-state": "1",
          "node.live.host.realtime-dashboard": "1",
          "node.live.host.realtime-dashboard-trigger": "1",
          "node.live.host.live-duration": "1",
          "node.live.host.current-viewers": "1",
          "node.live.host.peak-viewers": "1",
          "node.live.host.unique-viewers": "1",
          "node.live.host.participants": "1",
          "node.live.host.seat-requests": "1",
          "node.live.host.comments-count": "1",
          "node.live.host.comments-rate": "1",
          "node.live.host.reactions-count": "1",
          "node.live.host.likes-count": "1",
          "node.live.host.shares-count": "1",
          "node.live.host.followers-gained": "1",
          "node.live.host.follows-count": "1",
          "node.live.host.follow-count": "1",
          "node.live.host.gifts-count": "1",
          "node.live.host.gift-value": "1",
          "node.live.host.coins-received": "1",
          "node.live.host.cash-convertible": "1",
          "node.live.host.network-quality": "1",
          "node.live.host.upload-bitrate": "1",
          "node.live.host.video-fps": "1",
          "node.live.host.packet-loss": "1",
          "node.live.host.reconnect-state": "1",
          "node.live.host.pk-state": "1",
          "node.live.host.pk-score": "1",
          "node.live.host.final-summary": "1",
          "node.live.shared.mic-toggle": "1",
          "node.live.shared.camera-toggle": "1",
          "node.live.shared.camera-switch": "1",
          "node.live.shared.speaker-toggle": "1",
          "node.live.shared.comment-feed": "1",
          "node.live.shared.comment-item-template": "1",
          "node.live.shared.comment-composer": "1",
          "node.live.shared.comment-send": "1",
          "node.live.shared.reaction-trigger": "1",
          "node.live.shared.reaction-layer": "1",
          "node.live.shared.gift-trigger": "1",
          "node.live.shared.gift-panel": "1",
          "node.live.shared.gift-item-template": "1",
          "node.live.shared.gift-effect-layer": "1",
          "node.live.shared.face-effect-trigger": "1",
          "node.live.shared.face-effect-panel": "1",
          "node.live.shared.face-effect-layer": "1",
          "node.live.shared.seat-request-trigger": "1",
          "node.live.shared.seat-request-panel": "1",
          "node.live.shared.toast-layer": "1",
          "node.live.shared.dialog-layer": "1",
          "node.live.shared.sheet-layer": "1",
          "node.live.shared.loading-state": "1",
          "node.live.shared.empty-state": "1",
          "node.live.shared.error-state": "1",
          "node.live.shared.offline-state": "1",
          "node.live.shared.reconnecting-state": "1",
          "node.live.shared.ended-state": "1",
          "node.live.shared.announcement-pin": "1",
          "node.live.shared.seat-ban-banner": "1",
          "node.live.shared.voice-changer": "1",
          "node.live.shared.gift-recharge": "1",
          "node.live.shared.pip": "1",
          "node.live.shared.pk-invite-sheet": "1",
          "node.live.pk.root": "1",
          "node.live.pk.local-side": "1",
          "node.live.pk.opponent-side": "1",
          "node.live.pk.local-host": "1",
          "node.live.pk.opponent-host": "1",
          "node.live.pk.local-team-template": "1",
          "node.live.pk.opponent-team-template": "1",
          "node.live.pk.vs-badge": "1",
          "node.live.pk.invite-state": "1",
          "node.live.pk.accept-panel": "1",
          "node.live.pk.countdown": "1",
          "node.live.pk.timer": "1",
          "node.live.pk.scoreboard": "1",
          "node.live.pk.local-score": "1",
          "node.live.pk.opponent-score": "1",
          "node.live.pk.score-progress": "1",
          "node.live.pk.gift-score-layer": "1",
          "node.live.pk.result-overlay": "1",
          "node.live.pk.winner-state": "1",
          "node.live.pk.loser-state": "1",
          "node.live.pk.draw-state": "1",
          "node.live.pk.end-button": "1"
        },
        "translationNamespaceIds": [
          "live",
          "common"
        ],
        "themeTokenSetId": "tokens.unilives.v4",
        "requiredCapabilities": [
          "mic",
          "camera"
        ],
        "minimumAppVersion": "0.0.0",
        "fallbackExperienceId": "experience.live.pk-1v1",
        "checksum": "50a46776353cee665611e640552fe6d4"
      }
    }
  ],
  "extraUiModes": [
    {
      "uiMode": "Karaoke",
      "canonicalHint": "audio_party",
      "experienceId": null,
      "blocker": "Not one of the eight live experiences. ChorusPerformanceStage remains existing UI."
    },
    {
      "uiMode": "Radio",
      "canonicalHint": "video_multi",
      "experienceId": null,
      "blocker": "Watch Together is a separate renderer (WatchTogetherView), not in the eight-experience set."
    },
    {
      "uiMode": "Commerce-Live",
      "canonicalHint": "commerce",
      "experienceId": null,
      "blocker": "Backend room_type=commerce exists. Not mapped into the eight live experiences."
    },
    {
      "uiMode": "Game-Live",
      "canonicalHint": "game",
      "experienceId": null,
      "blocker": "Backend room_type=game exists. GameLiveView remains existing UI."
    }
  ],
  "nodes": [
    {
      "nodeId": "node.live.shared.root",
      "displayName": "Live room root",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "live.screen.v1",
      "allowedComponentIds": [
        "live.screen.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.background",
      "displayName": "Background",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomBackgroundLayer.tsx",
      "componentId": "primitive.image.v1",
      "allowedComponentIds": [
        "primitive.image.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "decorative",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.safe-area",
      "displayName": "Safe area",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.container.v1",
      "allowedComponentIds": [
        "primitive.container.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.header",
      "displayName": "Header",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "live.room-header.v1",
      "allowedComponentIds": [
        "live.room-header.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host",
        "binding.live.viewer-count"
      ],
      "actionIds": [
        "live.room.leave",
        "live.host.follow"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.back",
      "displayName": "Back",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.room.leave"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.back"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.room-title",
      "displayName": "Room title",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.room-badge",
      "displayName": "Room badge",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.badge.v1",
      "allowedComponentIds": [
        "primitive.badge.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room-state"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.host-avatar",
      "displayName": "Host avatar",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.avatar.v1",
      "allowedComponentIds": [
        "primitive.avatar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host"
      ],
      "actionIds": [
        "live.host.follow"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.host-name",
      "displayName": "Host name",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.host-badges",
      "displayName": "Host badges",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.badge.v1",
      "allowedComponentIds": [
        "primitive.badge.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.follow",
      "displayName": "Follow host",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.host.follow"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.follow"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.viewer-count",
      "displayName": "Viewer count",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomViewersOverlay.tsx",
      "componentId": "live.viewer-counter.v1",
      "allowedComponentIds": [
        "live.viewer-counter.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.viewer-count"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.viewer"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.viewer-list-trigger",
      "displayName": "Viewer list",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomViewersOverlay.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.viewer-count"
      ],
      "actionIds": [
        "live.room.share"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.network-indicator",
      "displayName": "Network",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveMediaSession.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.network-quality",
        "binding.live.connection"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.share",
      "displayName": "Share",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.room.share"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.share"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.more-menu",
      "displayName": "More menu",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.user.report",
        "live.user.moderate"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.report",
      "displayName": "Report",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.user.report"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.report"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.moderation-menu",
      "displayName": "Moderation",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.menu.v1",
      "allowedComponentIds": [
        "primitive.menu.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.permissions"
      ],
      "actionIds": [
        "live.user.moderate",
        "live.user.block"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.stage",
      "displayName": "Stage",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.container.v1",
      "allowedComponentIds": [
        "primitive.container.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [
        "participants",
        "seats",
        "effects"
      ],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.bottom-controls",
      "displayName": "Bottom controls",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.toolbar.v1",
      "allowedComponentIds": [
        "primitive.toolbar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.media.toggle-mic",
        "live.media.toggle-camera"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [
        "primary-actions",
        "secondary-actions"
      ],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.leave-button",
      "displayName": "Leave",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.room.leave"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.leaveRoom"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.end-room-button",
      "displayName": "End room",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.permissions"
      ],
      "actionIds": [
        "live.room.end"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.endLive"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.leave-room",
      "displayName": "Leave room",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.room.leave"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.leaveRoom"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.leave-confirmation",
      "displayName": "Leave confirmation",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.dialog.v1",
      "allowedComponentIds": [
        "primitive.dialog.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.room.leave"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.leave.confirm.viewer",
        "live.leave.confirm.guest",
        "live.leave.confirm.hostGrace",
        "live.leave.confirm.hostHandoff",
        "live.leave.confirm.hostEndRequired"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.end-live",
      "displayName": "End live",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.permissions"
      ],
      "actionIds": [
        "live.room.end"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.endLive"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.end-live-confirmation",
      "displayName": "End live confirmation",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.dialog.v1",
      "allowedComponentIds": [
        "primitive.dialog.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.room.end"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.end.confirm",
        "live.end.confirm.pk"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.ending-state",
      "displayName": "Ending state",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room-state"
      ],
      "actionIds": [
        "live.room.end"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.ending"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.realtime-dashboard",
      "displayName": "Host realtime dashboard",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.dashboard"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.realtime-dashboard-trigger",
      "displayName": "Host dashboard trigger",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.dashboard"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.live-duration",
      "displayName": "Live duration",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.duration"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.current-viewers",
      "displayName": "Current viewers",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.viewer-count"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.currentViewers"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.peak-viewers",
      "displayName": "Peak viewers",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.peakViewers"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.unique-viewers",
      "displayName": "Unique viewers",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.uniqueViewers"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.participants",
      "displayName": "Participants",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.participants"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.participants"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.seat-requests",
      "displayName": "Seat requests",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.seat-requests"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.seatRequests"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.comments-count",
      "displayName": "Comments count",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.comments"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.comments"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.comments-rate",
      "displayName": "Comments rate",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.commentsRate"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.reactions-count",
      "displayName": "Reactions count",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.reactions"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.reactions"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.likes-count",
      "displayName": "Likes count",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.reactions"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.likes"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.shares-count",
      "displayName": "Shares count",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.shares"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.followers-gained",
      "displayName": "Followers gained",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.followersGained"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.follows-count",
      "displayName": "Follows count",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.follows"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.follow-count",
      "displayName": "Followers total",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.followCount"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.gifts-count",
      "displayName": "Gifts count",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.gift-events"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.gifts"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.gift-value",
      "displayName": "Gift value",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.giftValue"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.coins-received",
      "displayName": "Coins received",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.gift-events"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.coinsReceived"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.cash-convertible",
      "displayName": "Convert cash",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.cashConvertible"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.network-quality",
      "displayName": "Network quality",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.network-quality"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.networkQuality"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.upload-bitrate",
      "displayName": "Upload bitrate",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.uploadBitrate"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.video-fps",
      "displayName": "Video FPS",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.videoFps"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.packet-loss",
      "displayName": "Packet loss",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.packetLoss"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.reconnect-state",
      "displayName": "Reconnect state",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.connection"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.reconnect"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.pk-state",
      "displayName": "PK state",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team",
        "experience.live.solo-video",
        "experience.live.multi-guest-video"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.pk-session"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.pkState"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.pk-score",
      "displayName": "PK score",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveHeaderInfo.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team",
        "experience.live.solo-video",
        "experience.live.multi-guest-video"
      ],
      "bindingIds": [
        "binding.live.host-dashboard",
        "binding.live.pk-score"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.pkScore"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.host.final-summary",
      "displayName": "Final host summary",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.host-dashboard"
      ],
      "actionIds": [
        "live.room.end"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "live.host.summary"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.mic-toggle",
      "displayName": "Mic",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.media-state"
      ],
      "actionIds": [
        "live.media.toggle-mic"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.camera-toggle",
      "displayName": "Camera",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.media-state"
      ],
      "actionIds": [
        "live.media.toggle-camera"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.camera-switch",
      "displayName": "Switch camera",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.media.switch-camera"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.speaker-toggle",
      "displayName": "Speaker",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.media.toggle-speaker"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.comment-feed",
      "displayName": "Comments",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.list.v1",
      "allowedComponentIds": [
        "primitive.list.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.comments"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.sayHi"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.comment-item-template",
      "displayName": "Comment item",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.list-item.v1",
      "allowedComponentIds": [
        "primitive.list-item.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.comments"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.comment-composer",
      "displayName": "Composer",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.input.v1",
      "allowedComponentIds": [
        "primitive.input.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.comment.send"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.sayHi"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.comment-send",
      "displayName": "Send comment",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.comment.send"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.send"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.reaction-trigger",
      "displayName": "Reaction trigger",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.reaction.send"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.reaction-layer",
      "displayName": "Reactions",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.reactions"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "decorative",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.gift-trigger",
      "displayName": "Gift trigger",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomFooterTrayActions.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.gift.open"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.gifts"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.gift-panel",
      "displayName": "Gift panel",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/LiveGiftsPanel.tsx",
      "componentId": "live.gift-panel.v1",
      "allowedComponentIds": [
        "live.gift-panel.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.gift-catalog"
      ],
      "actionIds": [
        "live.gift.send"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.gift-item-template",
      "displayName": "Gift item",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/LiveGiftsPanel.tsx",
      "componentId": "primitive.list-item.v1",
      "allowedComponentIds": [
        "primitive.list-item.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.gift-catalog"
      ],
      "actionIds": [
        "live.gift.send"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.gift-effect-layer",
      "displayName": "Gift effects",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GiftPlayOverlay.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.gift-events"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "decorative",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.face-effect-trigger",
      "displayName": "Face effect trigger",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/LiveBeautySheet.tsx",
      "componentId": "primitive.icon-button.v1",
      "allowedComponentIds": [
        "primitive.icon-button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.effect.select"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.face-effect-panel",
      "displayName": "Face effect panel",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/LiveBeautySheet.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.effect.select",
        "live.effect.clear"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.face-effect-layer",
      "displayName": "Face effect layer",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveMediaSession.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.seat-request-trigger",
      "displayName": "Seat request",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.seats"
      ],
      "actionIds": [
        "live.seat.request"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.seat-request-panel",
      "displayName": "Seat requests",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.seat-requests"
      ],
      "actionIds": [
        "live.seat.accept",
        "live.seat.reject"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.toast-layer",
      "displayName": "Toasts",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.dialog-layer",
      "displayName": "Dialogs",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.dialog.v1",
      "allowedComponentIds": [
        "primitive.dialog.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.sheet-layer",
      "displayName": "Sheets",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.loading-state",
      "displayName": "Loading",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.loading"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.empty-state",
      "displayName": "Empty",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "common.empty"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.error-state",
      "displayName": "Error",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.error"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.offline-state",
      "displayName": "Offline",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.offline"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.reconnecting-state",
      "displayName": "Reconnecting",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLiveMediaSession.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.connection"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.retry"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.ended-state",
      "displayName": "Ended",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/pages/Room.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "common.end"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.announcement-pin",
      "displayName": "Announcement pin",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomAnnouncementChatPin.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.seat-ban-banner",
      "displayName": "Seat ban banner",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SeatBanCountdownBanner.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.user.moderate"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.voice-changer",
      "displayName": "Voice changer",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/VoiceChangerSheet.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.effect.select"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.gift-recharge",
      "displayName": "Gift recharge",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/LiveGiftRechargeModal.tsx",
      "componentId": "primitive.dialog.v1",
      "allowedComponentIds": [
        "primitive.dialog.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.gift.open"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "common.gifts"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.pip",
      "displayName": "Live PIP",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/RoomLivePipWindow.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio",
        "experience.live.solo-video",
        "experience.live.multi-guest-audio",
        "experience.live.multi-guest-video",
        "experience.live.party-audio",
        "experience.live.party-video",
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.shared.pk-invite-sheet",
      "displayName": "PK invite sheet",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKInviteSheet.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team",
        "experience.live.solo-video",
        "experience.live.multi-guest-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.pk.invite",
        "live.pk.accept",
        "live.pk.reject"
      ],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-audio.stage",
      "displayName": "Solo audio stage",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "live.audio-seat.v1",
      "allowedComponentIds": [
        "live.audio-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio"
      ],
      "bindingIds": [
        "binding.live.media-state"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-audio.host-avatar",
      "displayName": "Solo audio host avatar",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.avatar.v1",
      "allowedComponentIds": [
        "primitive.avatar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio"
      ],
      "bindingIds": [
        "binding.live.host"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-audio.speaking-ring",
      "displayName": "Speaking ring",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.ring.v1",
      "allowedComponentIds": [
        "primitive.ring.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio"
      ],
      "bindingIds": [
        "binding.live.audio-level"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-audio.waveform",
      "displayName": "Waveform",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.animation.v1",
      "allowedComponentIds": [
        "primitive.animation.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "decorative",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-audio.audio-status",
      "displayName": "Audio status",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio"
      ],
      "bindingIds": [
        "binding.live.media-state"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-audio.background-art",
      "displayName": "Audio background art",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.image.v1",
      "allowedComponentIds": [
        "primitive.image.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "decorative",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-audio.host-controls",
      "displayName": "Solo audio host controls",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.toolbar.v1",
      "allowedComponentIds": [
        "primitive.toolbar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.media.toggle-mic",
        "live.room.end"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-video.stage",
      "displayName": "Solo video stage",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-video.video-surface",
      "displayName": "Video surface",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-video"
      ],
      "bindingIds": [
        "binding.live.media-state"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-video.video-placeholder",
      "displayName": "Video placeholder",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-video.camera-status",
      "displayName": "Camera status",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-video"
      ],
      "bindingIds": [
        "binding.live.media-state"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-video.host-overlay",
      "displayName": "Host overlay",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-video.effect-surface",
      "displayName": "Effect surface",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "decorative",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.solo-video.host-controls",
      "displayName": "Solo video host controls",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx",
      "componentId": "primitive.toolbar.v1",
      "allowedComponentIds": [
        "primitive.toolbar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.solo-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.media.toggle-camera",
        "live.media.toggle-mic"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-grid",
      "displayName": "Audio seat grid",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.audio-seat.v1",
      "allowedComponentIds": [
        "live.audio-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.seats"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-template",
      "displayName": "Audio seat template",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.audio-seat.v1",
      "allowedComponentIds": [
        "live.audio-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.seats"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.empty-seat-template",
      "displayName": "Empty audio seat",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.audio-seat.v1",
      "allowedComponentIds": [
        "live.audio-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.seat.request"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-avatar",
      "displayName": "Seat avatar",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.avatar.v1",
      "allowedComponentIds": [
        "primitive.avatar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-name",
      "displayName": "Seat name",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-badges",
      "displayName": "Seat badges",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.badge.v1",
      "allowedComponentIds": [
        "primitive.badge.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-speaking-ring",
      "displayName": "Seat speaking ring",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.ring.v1",
      "allowedComponentIds": [
        "primitive.ring.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.audio-level"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-mic-status",
      "displayName": "Seat mic",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-lock-status",
      "displayName": "Seat lock",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.seat.lock",
        "live.seat.unlock"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.seat-menu",
      "displayName": "Seat menu",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.menu.v1",
      "allowedComponentIds": [
        "primitive.menu.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.seat.mute",
        "live.seat.remove"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.request-queue",
      "displayName": "Audio request queue",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.list.v1",
      "allowedComponentIds": [
        "primitive.list.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.seat-requests"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-audio.invitation-panel",
      "displayName": "Invitation panel",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-audio",
        "experience.live.party-audio"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.seat.invite"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.stage",
      "displayName": "Multi-guest video stage",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.tile-grid",
      "displayName": "Video tile grid",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.seats",
        "binding.live.participants"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.tile-template",
      "displayName": "Video tile template",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.empty-tile-template",
      "displayName": "Empty video tile",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.seat.request"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.video-surface",
      "displayName": "Tile video surface",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "media-critical",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.video-placeholder",
      "displayName": "Tile placeholder",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.participant-name",
      "displayName": "Participant name",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.participant-badges",
      "displayName": "Participant badges",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.badge.v1",
      "allowedComponentIds": [
        "primitive.badge.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.audio-level",
      "displayName": "Tile audio level",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.meter.v1",
      "allowedComponentIds": [
        "primitive.meter.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.audio-level"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.mic-status",
      "displayName": "Tile mic",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.camera-status",
      "displayName": "Tile camera",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.tile-menu",
      "displayName": "Tile menu",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.menu.v1",
      "allowedComponentIds": [
        "primitive.menu.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.seat.mute",
        "live.seat.remove"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.focused-speaker",
      "displayName": "Focused speaker",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/MultiGuestView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.multi-guest-video.request-queue",
      "displayName": "Video request queue",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GuestManagementOverlay.tsx",
      "componentId": "primitive.list.v1",
      "allowedComponentIds": [
        "primitive.list.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.multi-guest-video",
        "experience.live.party-video"
      ],
      "bindingIds": [
        "binding.live.seat-requests"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.root",
      "displayName": "PK root",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "live.pk-scoreboard.v1",
      "allowedComponentIds": [
        "live.pk-scoreboard.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-session"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.local-side",
      "displayName": "PK local side",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-teams"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.opponent-side",
      "displayName": "PK opponent side",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-teams"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.local-host",
      "displayName": "PK local host",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.avatar.v1",
      "allowedComponentIds": [
        "primitive.avatar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.opponent-host",
      "displayName": "PK opponent host",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.avatar.v1",
      "allowedComponentIds": [
        "primitive.avatar.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.local-team-template",
      "displayName": "PK local team template",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.opponent-team-template",
      "displayName": "PK opponent team template",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": true,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.vs-badge",
      "displayName": "VS badge",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.badge.v1",
      "allowedComponentIds": [
        "primitive.badge.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.invite-state",
      "displayName": "PK invite",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.status.v1",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.pk.invite"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.accept-panel",
      "displayName": "PK accept",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.pk.accept",
        "live.pk.reject"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.countdown",
      "displayName": "PK countdown",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-timer"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.timer",
      "displayName": "PK timer",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-timer"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.scoreboard",
      "displayName": "PK scoreboard",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "live.pk-scoreboard.v1",
      "allowedComponentIds": [
        "live.pk-scoreboard.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-score"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.local-score",
      "displayName": "Local score",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-score"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.opponent-score",
      "displayName": "Opponent score",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.label.v1",
      "allowedComponentIds": [
        "primitive.label.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-score"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.score-progress",
      "displayName": "Score progress",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.meter.v1",
      "allowedComponentIds": [
        "primitive.meter.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.pk-score"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "high-frequency",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.gift-score-layer",
      "displayName": "Gift score layer",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.gift-events"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "decorative",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.result-overlay",
      "displayName": "PK result",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.overlay.v1",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.winner-state",
      "displayName": "Winner",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.loser-state",
      "displayName": "Loser",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.draw-state",
      "displayName": "Draw",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.empty-state.v1",
      "allowedComponentIds": [
        "primitive.empty-state.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.pk.end-button",
      "displayName": "End PK",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/PKBattleStage.tsx",
      "componentId": "primitive.button.v1",
      "allowedComponentIds": [
        "primitive.button.v1"
      ],
      "allowedExperienceIds": [
        "experience.live.pk-1v1",
        "experience.live.pk-team"
      ],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [
        "live.pk.end"
      ],
      "required": true,
      "replaceable": true,
      "removable": false,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": null
    },
    {
      "nodeId": "node.live.karaoke.stage",
      "displayName": "Karaoke / chorus stage",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/ChorusPerformanceStage.tsx",
      "componentId": "live.audio-seat.v1",
      "allowedComponentIds": [
        "live.audio-seat.v1"
      ],
      "allowedExperienceIds": [],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": "Karaoke"
    },
    {
      "nodeId": "node.live.watch-together.stage",
      "displayName": "Watch Together stage",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/WatchTogetherView.tsx",
      "componentId": "live.video-seat.v1",
      "allowedComponentIds": [
        "live.video-seat.v1"
      ],
      "allowedExperienceIds": [],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": "Radio"
    },
    {
      "nodeId": "node.live.commerce.panel",
      "displayName": "Commerce live panel",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/CommerceLivePanel.tsx",
      "componentId": "primitive.sheet.v1",
      "allowedComponentIds": [
        "primitive.sheet.v1"
      ],
      "allowedExperienceIds": [],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": "Commerce-Live"
    },
    {
      "nodeId": "node.live.game.stage",
      "displayName": "Game live stage",
      "sourcePath": "artifacts/instacollab/src/smule-rooms/components/GameLiveView.tsx",
      "componentId": "live.screen.v1",
      "allowedComponentIds": [
        "live.screen.v1"
      ],
      "allowedExperienceIds": [],
      "bindingIds": [
        "binding.live.room"
      ],
      "actionIds": [],
      "required": true,
      "replaceable": true,
      "removable": true,
      "translationKeys": [
        "nav.live"
      ],
      "assetIds": [],
      "childSlotIds": [],
      "performanceClass": "chrome",
      "template": false,
      "fallbackNodeId": "node.live.shared.error-state",
      "extraUiMode": "Game-Live"
    }
  ],
  "layouts": [
    {
      "layoutId": "layout.live.solo-audio.default",
      "experienceId": "experience.live.solo-audio",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "audio",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    },
    {
      "layoutId": "layout.live.solo-video.default",
      "experienceId": "experience.live.solo-video",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "video",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    },
    {
      "layoutId": "layout.live.multi-guest-audio.default",
      "experienceId": "experience.live.multi-guest-audio",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "audio",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    },
    {
      "layoutId": "layout.live.multi-guest-video.default",
      "experienceId": "experience.live.multi-guest-video",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "video",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    },
    {
      "layoutId": "layout.live.party-audio.default",
      "experienceId": "experience.live.party-audio",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "audio",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    },
    {
      "layoutId": "layout.live.party-video.default",
      "experienceId": "experience.live.party-video",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "video",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    },
    {
      "layoutId": "layout.live.pk-1v1.default",
      "experienceId": "experience.live.pk-1v1",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "mixed",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    },
    {
      "layoutId": "layout.live.pk-team.default",
      "experienceId": "experience.live.pk-team",
      "slots": [
        "background",
        "header",
        "identity",
        "stage",
        "participants",
        "seats",
        "status",
        "comments",
        "reactions",
        "gifts",
        "effects",
        "primary-actions",
        "secondary-actions",
        "navigation",
        "dialogs",
        "system-overlays"
      ],
      "mediaMode": "mixed",
      "requiredNodeIds": [
        "node.live.shared.root",
        "node.live.shared.background",
        "node.live.shared.safe-area",
        "node.live.shared.header",
        "node.live.shared.back",
        "node.live.shared.room-title",
        "node.live.shared.room-badge",
        "node.live.shared.host-avatar",
        "node.live.shared.host-name",
        "node.live.shared.host-badges",
        "node.live.shared.follow",
        "node.live.shared.viewer-count",
        "node.live.shared.viewer-list-trigger",
        "node.live.shared.network-indicator",
        "node.live.shared.share",
        "node.live.shared.more-menu",
        "node.live.shared.report",
        "node.live.shared.moderation-menu",
        "node.live.shared.stage",
        "node.live.shared.bottom-controls",
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.host.ending-state",
        "node.live.host.realtime-dashboard",
        "node.live.host.realtime-dashboard-trigger",
        "node.live.host.live-duration",
        "node.live.host.current-viewers",
        "node.live.host.peak-viewers",
        "node.live.host.unique-viewers",
        "node.live.host.participants",
        "node.live.host.seat-requests",
        "node.live.host.comments-count",
        "node.live.host.comments-rate",
        "node.live.host.reactions-count",
        "node.live.host.likes-count",
        "node.live.host.shares-count",
        "node.live.host.followers-gained",
        "node.live.host.follows-count",
        "node.live.host.follow-count",
        "node.live.host.gifts-count",
        "node.live.host.gift-value",
        "node.live.host.coins-received",
        "node.live.host.cash-convertible",
        "node.live.host.network-quality",
        "node.live.host.upload-bitrate",
        "node.live.host.video-fps",
        "node.live.host.packet-loss",
        "node.live.host.reconnect-state",
        "node.live.host.pk-state",
        "node.live.host.pk-score",
        "node.live.host.final-summary",
        "node.live.shared.mic-toggle",
        "node.live.shared.camera-toggle",
        "node.live.shared.camera-switch",
        "node.live.shared.speaker-toggle",
        "node.live.shared.comment-feed",
        "node.live.shared.comment-item-template",
        "node.live.shared.comment-composer",
        "node.live.shared.comment-send",
        "node.live.shared.reaction-trigger",
        "node.live.shared.reaction-layer",
        "node.live.shared.gift-trigger",
        "node.live.shared.gift-panel",
        "node.live.shared.gift-item-template",
        "node.live.shared.gift-effect-layer",
        "node.live.shared.face-effect-trigger",
        "node.live.shared.face-effect-panel",
        "node.live.shared.face-effect-layer",
        "node.live.shared.seat-request-trigger",
        "node.live.shared.seat-request-panel",
        "node.live.shared.toast-layer",
        "node.live.shared.dialog-layer",
        "node.live.shared.sheet-layer",
        "node.live.shared.loading-state",
        "node.live.shared.empty-state",
        "node.live.shared.error-state",
        "node.live.shared.offline-state",
        "node.live.shared.reconnecting-state",
        "node.live.shared.ended-state",
        "node.live.shared.announcement-pin",
        "node.live.shared.seat-ban-banner",
        "node.live.shared.voice-changer",
        "node.live.shared.gift-recharge",
        "node.live.shared.pip",
        "node.live.shared.pk-invite-sheet"
      ],
      "cannotObscure": [
        "node.live.shared.leave-button",
        "node.live.shared.end-room-button",
        "node.live.shared.leave-room",
        "node.live.shared.leave-confirmation",
        "node.live.host.end-live",
        "node.live.host.end-live-confirmation",
        "node.live.shared.moderation-menu",
        "node.live.shared.network-indicator"
      ]
    }
  ],
  "actions": [
    {
      "id": "live.room.join",
      "mapsToExistingAction": "live.join",
      "backendCommandSupported": true,
      "note": "stream/start + livekit token"
    },
    {
      "id": "live.room.leave",
      "mapsToExistingAction": "live.leave",
      "backendCommandSupported": true,
      "note": "POST /api/live/rooms/:roomId/leave"
    },
    {
      "id": "live.room.end",
      "mapsToExistingAction": "live.close",
      "backendCommandSupported": true,
      "note": "POST /api/live/rooms/:roomId/end"
    },
    {
      "id": "live.room.share",
      "mapsToExistingAction": null,
      "backendCommandSupported": true,
      "note": "share payload only"
    },
    {
      "id": "live.host.follow",
      "mapsToExistingAction": "profile.follow",
      "backendCommandSupported": true,
      "note": "follow API"
    },
    {
      "id": "live.comment.send",
      "mapsToExistingAction": "chat.sendMessage",
      "backendCommandSupported": true,
      "note": "party chat / live comments"
    },
    {
      "id": "live.reaction.send",
      "mapsToExistingAction": null,
      "backendCommandSupported": true,
      "note": "ephemeral reaction"
    },
    {
      "id": "live.gift.open",
      "mapsToExistingAction": null,
      "backendCommandSupported": true,
      "note": "open published catalog"
    },
    {
      "id": "live.gift.send",
      "mapsToExistingAction": "gift.send",
      "backendCommandSupported": true,
      "note": "POST /api/gifts/send"
    },
    {
      "id": "live.seat.request",
      "mapsToExistingAction": "seat.request",
      "backendCommandSupported": true,
      "note": "POST /api/live/:roomId/seats/:i/request"
    },
    {
      "id": "live.seat.cancel-request",
      "mapsToExistingAction": "seat.leave",
      "backendCommandSupported": true,
      "note": "leave requested seat"
    },
    {
      "id": "live.seat.invite",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "UI/cloud party invite; not on liveSeats API"
    },
    {
      "id": "live.seat.accept",
      "mapsToExistingAction": "seat.accept",
      "backendCommandSupported": true,
      "note": "POST /api/live/:roomId/seats/:i/approve"
    },
    {
      "id": "live.seat.reject",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "host reject not on liveSeats API yet"
    },
    {
      "id": "live.seat.leave",
      "mapsToExistingAction": "seat.leave",
      "backendCommandSupported": true,
      "note": "POST /api/live/:roomId/seats/:i/leave"
    },
    {
      "id": "live.seat.move",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "client seat move; no dedicated API"
    },
    {
      "id": "live.seat.lock",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "UI lock; not liveSeats"
    },
    {
      "id": "live.seat.unlock",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "UI unlock; not liveSeats"
    },
    {
      "id": "live.seat.mute",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "UI mute overlay; not liveSeats"
    },
    {
      "id": "live.seat.remove",
      "mapsToExistingAction": "seat.leave",
      "backendCommandSupported": true,
      "note": "host leave occupant"
    },
    {
      "id": "live.media.toggle-mic",
      "mapsToExistingAction": "call.toggleMic",
      "backendCommandSupported": true,
      "note": "client media + LiveKit publish from seat"
    },
    {
      "id": "live.media.toggle-camera",
      "mapsToExistingAction": "call.toggleCamera",
      "backendCommandSupported": true,
      "note": "client media"
    },
    {
      "id": "live.media.switch-camera",
      "mapsToExistingAction": "call.switchCamera",
      "backendCommandSupported": true,
      "note": "client media"
    },
    {
      "id": "live.media.toggle-speaker",
      "mapsToExistingAction": "call.toggleSpeaker",
      "backendCommandSupported": true,
      "note": "client media"
    },
    {
      "id": "live.effect.select",
      "mapsToExistingAction": null,
      "backendCommandSupported": true,
      "note": "on-device registered renderer only"
    },
    {
      "id": "live.effect.clear",
      "mapsToExistingAction": null,
      "backendCommandSupported": true,
      "note": "disable effect, keep track"
    },
    {
      "id": "live.pk.invite",
      "mapsToExistingAction": "pk.invite",
      "backendCommandSupported": false,
      "note": "live_pk_sessions table; dedicated route incomplete"
    },
    {
      "id": "live.pk.accept",
      "mapsToExistingAction": "pk.accept",
      "backendCommandSupported": false,
      "note": "live_pk_sessions table; dedicated route incomplete"
    },
    {
      "id": "live.pk.reject",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "no dedicated PK reject route"
    },
    {
      "id": "live.pk.cancel",
      "mapsToExistingAction": null,
      "backendCommandSupported": false,
      "note": "no dedicated PK cancel route"
    },
    {
      "id": "live.pk.end",
      "mapsToExistingAction": "pk.end",
      "backendCommandSupported": true,
      "note": "POST /api/live/rooms/:roomId/pk/end"
    },
    {
      "id": "live.user.report",
      "mapsToExistingAction": null,
      "backendCommandSupported": true,
      "note": "moderation report"
    },
    {
      "id": "live.user.block",
      "mapsToExistingAction": "profile.block",
      "backendCommandSupported": true,
      "note": "block API"
    },
    {
      "id": "live.user.moderate",
      "mapsToExistingAction": null,
      "backendCommandSupported": true,
      "note": "host/moderation overlay"
    }
  ],
  "bindings": [
    {
      "id": "binding.live.room",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.screen.v1",
        "live.room-header.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.room-state",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.screen.v1",
        "primitive.status.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.host",
      "domain": "live",
      "viewModelType": "UserSummaryViewModel",
      "allowedComponentIds": [
        "live.room-header.v1",
        "primitive.avatar.v1",
        "primitive.label.v1"
      ],
      "privacy": "public"
    },
    {
      "id": "binding.live.current-user-role",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.screen.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.permissions",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.screen.v1",
        "primitive.menu.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.viewer-count",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.viewer-counter.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.connection",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.network-quality",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "primitive.status.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.participants",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.video-seat.v1",
        "live.audio-seat.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.seats",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.video-seat.v1",
        "live.audio-seat.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.seat-requests",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "primitive.list.v1",
        "primitive.sheet.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.comments",
      "domain": "live",
      "viewModelType": "ChatInboxViewModel",
      "allowedComponentIds": [
        "primitive.list.v1",
        "primitive.list-item.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.reactions",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.gift-catalog",
      "domain": "live",
      "viewModelType": "GiftPanelViewModel",
      "allowedComponentIds": [
        "live.gift-panel.v1",
        "primitive.list-item.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.gift-events",
      "domain": "live",
      "viewModelType": "GiftPanelViewModel",
      "allowedComponentIds": [
        "primitive.overlay.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.media-state",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "live.video-seat.v1",
        "primitive.icon-button.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.audio-level",
      "domain": "live",
      "viewModelType": "LiveRoomViewModel",
      "allowedComponentIds": [
        "primitive.ring.v1",
        "primitive.meter.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.pk-session",
      "domain": "live",
      "viewModelType": "PkViewModel",
      "allowedComponentIds": [
        "live.pk-scoreboard.v1",
        "live.screen.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.pk-timer",
      "domain": "live",
      "viewModelType": "PkViewModel",
      "allowedComponentIds": [
        "primitive.label.v1",
        "live.pk-scoreboard.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.pk-score",
      "domain": "live",
      "viewModelType": "PkViewModel",
      "allowedComponentIds": [
        "live.pk-scoreboard.v1",
        "primitive.label.v1",
        "primitive.meter.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.pk-teams",
      "domain": "live",
      "viewModelType": "PkViewModel",
      "allowedComponentIds": [
        "live.video-seat.v1",
        "live.pk-scoreboard.v1"
      ],
      "privacy": "room-member"
    },
    {
      "id": "binding.live.host-dashboard",
      "domain": "live",
      "viewModelType": "LiveHostDashboardViewModel",
      "allowedComponentIds": [
        "primitive.sheet.v1",
        "primitive.label.v1",
        "primitive.status.v1",
        "primitive.icon-button.v1"
      ],
      "privacy": "host-only"
    }
  ],
  "forbiddenActionPairs": [
    [
      "live.room.leave",
      "live.gift.send"
    ],
    [
      "live.room.end",
      "live.gift.send"
    ],
    [
      "live.pk.scoreboard",
      "wallet.purchase"
    ],
    [
      "live.room.leave",
      "live.room.end"
    ],
    [
      "live.room.end",
      "live.room.leave"
    ],
    [
      "live.pk.end",
      "live.room.end"
    ],
    [
      "live.room.end",
      "live.pk.end"
    ],
    [
      "live.room.leave",
      "live.pk.end"
    ]
  ],
  "layoutSlots": [
    "background",
    "header",
    "identity",
    "stage",
    "participants",
    "seats",
    "status",
    "comments",
    "reactions",
    "gifts",
    "effects",
    "primary-actions",
    "secondary-actions",
    "navigation",
    "dialogs",
    "system-overlays"
  ],
  "assignmentPrecedence": [
    "admin-preview",
    "live-room-session",
    "room",
    "canary-cohort",
    "device-locale-app",
    "global-published",
    "bundled-fallback"
  ],
  "unsafeStructuralBoundaries": [
    "room-connection",
    "reconnection",
    "media-publication",
    "seat-movement",
    "seat-acceptance",
    "pk-countdown",
    "pk-score-settlement",
    "gift-purchase",
    "gift-effect-playback",
    "moderation-confirmation",
    "room-ending"
  ]
} as const;
