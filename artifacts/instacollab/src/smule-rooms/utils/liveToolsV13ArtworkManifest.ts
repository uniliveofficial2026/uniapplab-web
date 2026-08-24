/** Approved V13 live-tool artwork manifest — asset id → runtime URL → panel/component. */
export const LIVE_TOOLS_V13_ARTWORK_MANIFEST = [
  // Gifts — approved-v12 PNGs
  { assetId: 'UG-001', filename: 'UG-001_enchanted-rose.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-001_enchanted-rose.png' },
  { assetId: 'UG-002', filename: 'UG-002_royal-crown.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-002_royal-crown.png' },
  { assetId: 'UG-003', filename: 'UG-003_crystal-heart.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-003_crystal-heart.png' },
  { assetId: 'UG-004', filename: 'UG-004_treasure-chest.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-004_treasure-chest.png' },
  { assetId: 'UG-005', filename: 'UG-005_moon-carriage.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-005_moon-carriage.png' },
  { assetId: 'UG-006', filename: 'UG-006_crystal-castle.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-006_crystal-castle.png' },
  { assetId: 'UG-007', filename: 'UG-007_purple-supercar.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-007_purple-supercar.png' },
  { assetId: 'UG-008', filename: 'UG-008_violet-phoenix.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-008_violet-phoenix.png' },
  { assetId: 'UG-009', filename: 'UG-009_royal-swans.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-009_royal-swans.png' },
  { assetId: 'UG-010', filename: 'UG-010_flying-kiss.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-010_flying-kiss.png' },
  { assetId: 'UG-011', filename: 'UG-011_galaxy-microphone.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-011_galaxy-microphone.png' },
  { assetId: 'UG-012', filename: 'UG-012_victory-dragon.png', panel: 'gifts', component: 'LiveGiftsPanel', url: '/live-gifts/approved-v12/UG-012_victory-dragon.png' },
  // Games
  { assetId: 'game-live-trivia', filename: 'live-trivia.svg', panel: 'game-center', component: 'GameLivePanel', url: '/live-tools-v13/games/live-trivia.svg' },
  { assetId: 'game-greedy-tap', filename: 'greedy-tap.svg', panel: 'game-center', component: 'GameLivePanel', url: '/live-tools-v13/games/greedy-tap.svg' },
  { assetId: 'game-lucky-wheel', filename: 'lucky-wheel.svg', panel: 'game-center', component: 'GameLivePanel', url: '/live-tools-v13/games/lucky-wheel.svg' },
  { assetId: 'game-fishing-master', filename: 'fishing-master.svg', panel: 'game-center', component: 'GameLivePanel', url: '/live-tools-v13/games/fishing-master.svg' },
  { assetId: 'game-crash', filename: 'crash.svg', panel: 'game-center', component: 'GameLivePanel', url: '/live-tools-v13/games/crash.svg' },
  { assetId: 'game-ludo-king', filename: 'ludo-king.svg', panel: 'game-center', component: 'GameLivePanel', url: '/live-tools-v13/games/ludo-king.svg' },
  // Voice
  { assetId: 'voice-original', filename: 'original.svg', panel: 'voice-changer', component: 'VoiceChangerSheet', url: '/live-tools-v13/voices/original.svg' },
  { assetId: 'voice-deep', filename: 'deep.svg', panel: 'voice-changer', component: 'VoiceChangerSheet', url: '/live-tools-v13/voices/deep.svg' },
  { assetId: 'voice-robot', filename: 'robot.svg', panel: 'voice-changer', component: 'VoiceChangerSheet', url: '/live-tools-v13/voices/robot.svg' },
  { assetId: 'voice-chipmunk', filename: 'chipmunk.svg', panel: 'voice-changer', component: 'VoiceChangerSheet', url: '/live-tools-v13/voices/chipmunk.svg' },
  { assetId: 'voice-echo', filename: 'echo.svg', panel: 'voice-changer', component: 'VoiceChangerSheet', url: '/live-tools-v13/voices/echo.svg' },
  { assetId: 'voice-radio', filename: 'radio.svg', panel: 'voice-changer', component: 'VoiceChangerSheet', url: '/live-tools-v13/voices/radio.svg' },
] as const;

export const LIVE_TOOLS_V13_REFERENCE_IMAGES = {
  gifts: '/reference-approved/live-tools-v13/01-approved-gift-panel.png',
  gameCenter: '/reference-approved/live-tools-v13/02-approved-game-center.png',
  voiceChanger: '/reference-approved/live-tools-v13/03-approved-voice-changer.png',
  beautyEffects: '/reference-approved/live-tools-v13/04-approved-beauty-effects.png',
  guests: '/reference-approved/live-tools-v13/approved-guest-panel.jpeg',
} as const;
