/**
 * Human-readable dev notes shown in the Live Dev panel.
 * Append entries when you ship a feature so live testing has context.
 */

export type DevChangelogEntry = {
  date: string;
  title: string;
  summary: string;
  tasks?: string[];
  testHints?: string[];
};

/** Recently shipped — newest first */
export const DEV_CHANGELOG: DevChangelogEntry[] = [
  {
    date: '2026-06-02',
    title: 'Chat location sharing',
    summary:
      'Location share sheet: multi-attempt GPS, last-known cache, IP approximate fallback, place search (Nominatim), manual coordinates, and map preview before send. Thread card + in-app OSM map viewer.',
    tasks: ['Share location'],
    testHints: [
      'If GPS times out: Retry GPS, Approximate (ipwho + geojs fallback), or Search tab',
      'Place search uses Nominatim with app User-Agent; wait ~1s between rapid searches',
      'Coords tab: enter lat/lng or nudge pin; bubble → View map in app',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Chat file attachments',
    summary:
      'Document/File attaches in compose (preview + Send), stores in message media, shows a file card with Preview/Save, in-app PDF/image viewer, reliable data-URL download, and sidebar/reply labels. Max 15 MB.',
    tasks: ['Send chat file'],
    testHints: [
      'Messages → + → Document/File → PDF appears above compose → Send',
      'Tap View in app on card — PDF opens in iframe inside app (not new tab); images/video/audio/text too',
      'Sidebar shows 📎 filename; reply shows file name',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Private account system',
    summary:
      'Private Account toggle now sets per-user privacy, queues follow requests, gates profile grids and feed posts until approved, and shows Confirm/Delete in notifications and on your profile.',
    tasks: ['Private account', 'Follow requests'],
    testHints: [
      'Settings → Private Account ON → second account sees Request on Follow',
      'Approve request on your profile or in Notifications → their feed shows your posts',
      'Toggle private OFF → posts visible without approval',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Experiment dashboard performance',
    summary:
      'Deferred experiment analytics off the main thread tick; shared summary scan for winner; guardrail/ranking sliders save on pointer-up only (no save-per-drag).',
    tasks: ['Dating experiment'],
    testHints: [
      'Dating → ☰ → Show Experiment dashboard — should open without white screen',
      'Drag guardrail sliders — UI stays smooth; release to persist',
      'Switch 24h/72h/7d and A/B/C mode — bucket cards refresh after brief “Loading…”',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating crash fix (deck rescoring loop)',
    summary:
      'Stopped rescoring the full dating deck on every render; debounced exposure analytics saves; 500ms dwell before counting an exposure; lazy-loaded tools sheet.',
    tasks: ['Dating stability'],
    testHints: [
      'Open Dating → swipe 10+ cards — tab should stay responsive',
      'Open tools menu → experiment panel — no freeze when toggling tiers',
      'While agent edits, use npm run dev:stable and refresh manually',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating main screen + tools menu',
    summary:
      'Preferences, tiers, profile builder, top picks, and experiment tools moved behind a menu icon into a full-screen Dating tools sheet; Discover swipe card + Matches sidebar stay on the main view.',
    tasks: ['Dating UI'],
    testHints: [
      'Dating → menu (☰) opens tools sheet with sliders, tiers, profile builder, top picks',
      'Back/close returns to swipe deck + matches column',
      'Changing distance/age in tools refreshes deck index',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Stable dev + lighter Dating load',
    summary:
      'npm run dev:stable disables HMR while agents edit; DEV coalesces db re-renders per frame; Dating experiment panel is collapsed and lazy-loaded so tab + Cursor stay responsive.',
    tasks: ['dev:stable', 'DEV notify batch', 'Dating experiment lazy'],
    testHints: [
      'npm run dev:stable → agent edits several files → manual refresh → Dating/Messages still work',
      'Dating → expand “Experiment dashboard” only when needed',
      'npm run dev → rapid likes/saves still update UI within one frame',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating tab stability (crash / freeze)',
    summary:
      'Dating no longer re-counts profile exposures on every hot reload, clamps swipe index safely, and guards match→Messages navigation so agent edits + tab switches are less likely to freeze the app.',
    tasks: ['Dating exposure dedup', 'Dating index guard', 'Match chat open'],
    testHints: [
      'Open Dating → swipe a few cards → switch to Messages and back',
      'Dating → Matches → Message opens the correct thread',
      'While agent edits files (HMR), Dating tab should stay responsive',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Messages overlays + leaner bundles',
    summary:
      'Chat modals and detail panels moved to MessagesScreenOverlays; main tabs lazy-load in production and dev Live panel stays dev-only to keep verify/build clean.',
    tasks: ['Messages modals', 'Code splitting'],
    testHints: [
      'Messages → New message / Create group modals still open and select chats',
      'Messages → chat info → Group settings, Pinned, Gallery screens',
      'Production build: no Vite chunk warnings; check-health passes',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Experiment import and replay',
    summary:
      'Added experiment import/replay tooling with append/replace modes, plus structured JSON and CSV exports for external analysis and scenario replay.',
    tasks: ['Export JSON', 'Export CSV', 'Import replay (append/replace)'],
    testHints: [
      'Dating: export JSON, then import with append and verify event count increases',
      'Dating: import same file with replace and verify metrics are rebuilt from imported stream',
      'Dating: export CSV and verify summary/winner/event rows are present',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Preset audit telemetry',
    summary:
      'Experiment presets now write audit metadata with last preset name, actor user id, and applied timestamp, and the Dating dashboard displays this audit row for operator traceability.',
    tasks: ['Preset audit metadata', 'Operator trace row', 'Preset telemetry persistence'],
    testHints: [
      'Dating: apply each preset and verify last preset/actor/time updates',
      'Reload app and confirm audit metadata persists',
      'Switch users and apply preset to verify actor id reflects current user',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Experiment preset profiles',
    summary:
      'Added one-click Dating experiment policy presets (Conservative, Balanced, Aggressive) that apply persisted guardrail bundles for exposure, confidence, uplift, cooldown, and hold thresholds.',
    tasks: ['Preset profiles', 'Operator one-click tuning', 'Persisted policy bundles'],
    testHints: [
      'Dating: click each preset and verify guardrail slider values change immediately',
      'Dating: refresh or navigate away/back to confirm preset-applied values persist',
      'Dating: observe winner status behavior differences under strict vs aggressive presets',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Operator guardrail controls',
    summary:
      'Added live operator controls in Dating experiments for min exposure, confidence threshold, minimum uplift, cooldown, and hold windows; recommendations now use these persisted settings directly.',
    tasks: ['Guardrail sliders', 'Persisted stability tuning', 'Live winner policy updates'],
    testHints: [
      'Dating: move guardrail sliders and verify winner status/reason updates immediately',
      'Dating: increase min exposure and confirm status falls back to insufficient data',
      'Dating: lower confidence/min-delta thresholds and confirm significant winner appears sooner',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Sequential experiment stability locks',
    summary:
      'Added sequential-test protection for Dating experiments: winner recommendations now enforce cooldown and minimum hold windows to avoid rapid bucket flip-flopping under live traffic.',
    tasks: ['Cooldown lock', 'Minimum hold lock', 'Winner stability status'],
    testHints: [
      'Dating: verify winner can show cooldown_locked when pre-cooldown winner differs',
      'Dating: verify winner can show hold_locked when significance is not sustained in hold window',
      'Dating: confirm significant status appears only after both locks pass',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Experiment confidence guardrails',
    summary:
      'Dating experiment winner recommendations now include confidence-aware statistical guardrails with minimum sample thresholds and minimum uplift checks before declaring a significant winner.',
    tasks: ['Confidence gating', 'Sample-size threshold', 'Significance status'],
    testHints: [
      'Dating: verify winner status changes between insufficient/not significant/significant as data grows',
      'Dating: confirm confidence and delta values render in the winner card',
      'Dating: ensure low-sample windows do not report a false winner',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Experiment lifecycle controls',
    summary:
      'Extended Dating A/B/C experiments with windowed metrics (24h/72h/7d), reset controls, and automatic winner recommendation using weighted engagement scoring.',
    tasks: ['Experiment window analytics', 'Experiment winner recommendation', 'Experiment lifecycle reset'],
    testHints: [
      'Dating: switch metric window and confirm bucket numbers update',
      'Dating: use Reset Metrics and verify all bucket values return to zero',
      'Dating: swipe through deck and confirm winner recommendation appears after enough exposures',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating experiments dashboard',
    summary:
      'Added true A/B/C ranking experiment support with bucket mode selection (auto or forced), per-bucket exposure/like/pass/match metrics, and live CTR-style analytics cards in the Dating UI.',
    tasks: ['Experiment bucket mode', 'Exposure tracking', 'Bucket analytics'],
    testHints: [
      'Dating: switch experiment mode among auto/A/B/C',
      'Swipe through cards and confirm exposure/like/pass/match metrics change',
      'Compare bucket cards and verify CTR recalculates from live counters',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Adaptive ranking intelligence',
    summary:
      'Dating recommendations now learn from swipe behavior (preferred age/distance signals) and expose configurable ranking weights for distance, affinity, quality, completeness, and learned preference fit.',
    tasks: ['Learned signals', 'Ranking tuning sliders', 'Ordering update'],
    testHints: [
      'Swipe multiple profiles and confirm learned age/distance values change',
      'Adjust ranking tuning sliders and verify candidate order shifts',
      'Reset deck and verify tuning state persists while browsing',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating retention + lifecycle intelligence',
    summary:
      'Added match lifecycle intelligence with expiry windows, re-engagement nudges, read/last-active context in match cards, and profile completeness scoring that now contributes to recommendation ranking.',
    tasks: ['Match expiry', 'Re-engagement nudges', 'Last active/read context', 'Completeness scoring'],
    testHints: [
      'Open Dating Matches and verify online/seen/read/expiry metadata',
      'Open a match chat and return; activity timestamp should refresh via touchDatingMatchActivity',
      'Check re-engagement section appears for stale matches',
      'Update profile prompts/media/verified and confirm completeness bar changes',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating premium + profile + safety',
    summary:
      'Added market-level dating features: free/plus/gold tier gating for daily super-likes, dating profile builder (prompts/media/verification), and safety tools (report + block + unmatch) persisted in LocalDB.',
    tasks: ['Tier switch', 'Profile prompts/media', 'Verification toggle', 'Report profile', 'Unmatch'],
    testHints: [
      'Dating: switch free/plus/gold and check super-like remaining behavior',
      'Fill prompts/media and save in Dating Profile Builder; state should persist',
      'Toggle verified badge and confirm state is reflected immediately',
      'From Discover use Report/Block and confirm profile no longer appears',
      'From Matches use Unmatch and confirm match list updates',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating module completion pass',
    summary:
      'Expanded Insta Dating into a fuller Tinder-style system with Discover / Likes You / Matches views, swipe filters (distance + age range), super-like action, undo last swipe, and faster like-back/message flows.',
    tasks: ['Discover mode', 'Likes You list', 'Matches mode', 'Undo swipe', 'Super-like'],
    testHints: [
      'Dating: switch among Discover, Likes You, and Matches modes',
      'Adjust distance and age sliders; card deck should filter live',
      'Swipe or use action buttons for pass/like/super-like',
      'Use Undo to revert the last swipe action',
      'From Likes You use Like back; from Matches use Message to open chat',
    ],
  },
  {
    date: '2026-06-02',
    title: 'Dating system (Tinder-style)',
    summary:
      'Added a full dating flow with a dedicated sidebar tab, swipeable profile deck, like/pass actions, automatic match generation, match persistence, and matches list tied to LocalDB.',
    tasks: ['Dating swipe', 'Like/pass', 'Match list', 'Reset deck'],
    testHints: [
      'Open Dating tab from desktop sidebar',
      'Swipe card right to Like, left to Pass',
      'Use Pass/Like buttons (same behavior as swipe)',
      'Matched profiles appear in Matches panel',
      'Reset Deck clears likes/passes/matches and repopulates cards',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Full-stack stability (cloud + overlays + demo)',
    summary:
      'Cloud hydrate no longer wipes local data on fetch errors. Dev ?as=u1 restores bundled posts/reels and stops cloud overwrite. Unified media overlay lock (feed/reels/modal/chat FS). Shell resets stuck locks on load. Launch gates and nav badges stay local-only.',
    tasks: [
      'Feed like/save',
      'Reels scroll + FS',
      'Messages send',
      'Profile follow',
      'Cloud sign-in',
      'Dev ?launch=main&as=u1',
    ],
    testHints: [
      '?launch=main&as=u1 → feed shows posts, videos play',
      'Messages → u2/u3/u4 threads after empty IDB wipe',
      'Story rings on feed after restore (demo strip)',
      'Notifications tab → ~12 demo rows (not empty)',
      'Workspace → Calendar & Tasks → 3 tasks, toggle completes',
      'Open + menu → close → feed still plays',
      'Post/reel fullscreen opens once, backdrop close after ~1s',
      'Cloud sign-in with network error → local feed not wiped',
      'Like post → persists after tab switch',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Fullscreen regression fix',
    summary:
      'Restored scoped db.setFullScreenActive (only the open post/reel/modal sets it). Removed global overlay lock from feed playback and fixed StoryRing stacking locks when opening the create menu. Ghost-click guard on backdrop close kept.',
    tasks: ['Feed video autoplay', 'Create menu', 'Fullscreen tap'],
    testHints: [
      'Home feed: videos play when scrolled into view',
      'Tap + → create menu → close → feed videos resume',
      'Single-tap post fullscreen still stays open (no flash-close)',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Fullscreen media video playback',
    summary:
      'Fullscreen no longer wipes feed/reels: UI flag isFullScreenActive stays local (no cloud push), reel FS survives scroll snap, post carousel does not reset when opening FS. Video plays in the FS portal with correct URLs.',
    tasks: ['Open post fullscreen', 'Reels maximize', 'Post modal media'],
    testHints: [
      'Feed video post → maximize → video plays with controls',
      'Post modal → tap media → video visible in fullscreen',
      'Reels → expand → video plays; close returns to reel',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Cloud sync hydrate + first-login cleanup',
    summary:
      'Fixes real-account sync: wait for cloud bootstrap before pushing (no demo feed uploaded to Supabase), clear local social data on first cloud session, reset sync cursors on sign-out, and drop realtime throttle that skipped rapid updates.',
    tasks: ['Like post', 'Send message', 'Two tabs same account'],
    testHints: [
      'Sign out → sign in with Google/email → empty feed (not demo u1/u2 posts)',
      'Like a post → console [sync] pushed user_app_state (dev)',
      'Second tab: like on A → B updates within ~1s',
      'If account already has bad cloud data: Supabase → user_app_state → delete row → sign in again',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Profile setup save fixes',
    summary:
      'Cloud profile save refreshes Supabase session before write, maps DB errors (session, duplicates, missing migrations, oversized photo), caps huge base64 avatars, and saves to cloud before marking setup complete.',
    tasks: ['Profile setup Continue'],
    testHints: [
      'Sign in with Google/email → profile setup → Continue',
      'If error mentions migrations, run all files from npm run auth:check',
      'Large uploaded photos: use URL or smaller image',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Unified Supabase auth + realtime',
    summary:
      'Rebuilt cloud auth around Supabase when VITE_SUPABASE_* is set: authService (email/OAuth), sessionManager (session → db + profile realtime), and Supabase-first app_state sync. Google/Apple OAuth via Supabase (not Firebase) when Supabase is configured. Firebase-only path kept when Supabase env is missing.',
    tasks: ['Log in', 'Sign up', 'Continue with Google', 'Like post on two tabs'],
    testHints: [
      'npm run auth:check — env + migration list',
      'docs/CLOUD_AUTH.md — full dashboard checklist',
      'npm run dev:public → Google sign-in → profile setup → feed',
      'Second tab same account: edit profile on A → header on B updates',
      'Dev demo: demo@instacollab.app / demo123 (no cloud)',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Auth restore + OAuth stability',
    summary:
      'Fixed session restore hanging on “Restoring your session…”, Supabase null-session logout loops, and Firebase redirect timeouts. Google/Apple back on Firebase OAuth when configured. Email/password uses Supabase with Firebase failover.',
    tasks: ['Log in', 'Sign up', 'Continue with Google'],
    testHints: [
      'Refresh → should reach splash/auth within ~8s (not infinite spinner)',
      'Email login → welcome toast → profile or feed',
      'Dev: Continue as demo without Google',
      'Google via tunnel: npm run dev:public + oauth:setup',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Real-time cloud sync (all app data)',
    summary:
      'Signed-in cloud accounts debounce-push every local db collection (posts, messages, reels, comments, stories, notifications, settings, …) to Supabase user_app_state / Firestore user_app_state. Other tabs and devices subscribe via Realtime and merge into the local store through useDB().',
    tasks: ['Like post', 'Send message', 'Edit profile', 'Workspace task'],
    testHints: [
      'Run supabase/migrations/20260601160000_user_app_state.sql',
      'Deploy firestore.rules (user_app_state)',
      'Two browsers same account: like a post on A → feed on B updates within ~1s',
      'Live dev panel: watch db.save while editing',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Clear cache keeps you signed in',
    summary:
      'Settings → Clear Local Cache no longer wipes Supabase session tokens (sb-*) or launch progress, so you stay on the main app instead of being sent back to auth or profile setup.',
    tasks: ['Edit profile'],
    testHints: [
      'Sign in → Settings → Clear Local Cache → confirm you remain on feed/profile',
      'Cloud: session should still restore after refresh',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Public User ID (setup + 7-day cooldown)',
    summary:
      'Accounts get a customizable public User ID (3–24 chars, letters/numbers/underscores), distinct from the internal auth UID. Choose it on profile setup; change it in Settings once every 7 days. Uniqueness is enforced locally and in cloud profiles (Supabase/Firebase).',
    tasks: ['Profile setup', 'Edit profile'],
    testHints: [
      'Profile setup: edit User ID, save, copy button',
      'Settings: change User ID → should save; try again immediately → cooldown message',
      'Profile header shows public User ID (not auth UUID)',
      'Supabase: run migration 20260601150000_public_user_id.sql if saves fail',
    ],
  },
  {
    date: '2026-06-01',
    title: 'New-user launch gates (profile + trending)',
    summary:
      'New accounts must complete profile setup and trending before the main app. Returning accounts (cloud profile_setup_complete or demo u1/u2) skip both. Profile/trending progress is stored per user so a new sign-up does not inherit another account’s completion on the same device.',
    tasks: ['Sign up', 'Log in', 'Profile setup'],
    testHints: [
      'Sign up with a new email → profile setup → trending → feed',
      'Log in as demo@instacollab.app → should go straight to feed',
      'Same browser: new account after old account should still see profile + trending',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Firebase auth failover',
    summary:
      'When VITE_FIREBASE_* env is set alongside Supabase: primary Supabase Auth with instant failover to Firebase on health/network errors. Startup skips Supabase wait if it was recently unhealthy. Profiles sync to Firestore `profiles` when on Firebase. See docs/FIREBASE_AUTH.md.',
    tasks: ['Log in', 'Sign up', 'Log out', 'Profile setup'],
    testHints: [
      'Run npm run firebase:sync-env then restart dev server',
      'Enable Auth + Firestore in Firebase Console (docs/FIREBASE_AUTH.md)',
      'Break Supabase URL temporarily → sign-in should still work via Firebase',
      'Live dev: check instacollab_auth_backend in localStorage after login',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Supabase auth takeover (cloud profile sync)',
    summary:
      'With .env configured: Google/Apple/email auth, profile setup saves to public.profiles, profile edits in settings sync to Supabase (debounced), logout clears Supabase session. Demo accounts only load when Supabase env is missing.',
    tasks: ['Log in', 'Sign up', 'Log out', 'Profile setup', 'Edit profile'],
    testHints: [
      'Restart npm run dev after .env changes',
      'Auth → Google or email → profile setup → trending → feed',
      'Profile → settings → edit name → check Supabase profiles table',
      'Log out → returns to auth; session cleared on second device after sign-out',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Apple login & sign-up',
    summary:
      'Auth screen adds Continue / Sign up with Apple (Supabase OAuth, name + email scopes). Works alongside Google and email. Apple only sends the user name on the first sign-in — profile setup may need a manual display name later.',
    tasks: ['Log in', 'Sign up'],
    testHints: [
      'Supabase → Authentication → Providers → Apple: enable + Services ID, secret key, team ID',
      'Apple Developer → Services ID → configure domain + return URL (Supabase callback)',
      'Run supabase/migrations/20260601140000_apple_profile_metadata.sql if profiles migration already applied',
      'Safari or Chrome: Launch → Continue with Apple',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Profile setup UI + cloud save routing',
    summary:
      'Removed the extra LaunchBrandMark upload tile from profile setup (use the round avatar control only). Profile saves now target Supabase when you signed in with Supabase, fixing Firebase “missing or insufficient permissions” on setup.',
    tasks: ['Profile setup'],
    testHints: [
      'Sign up → profile setup → Continue (no duplicate logo uploader at top)',
      'If Firebase-only: deploy firestore.rules from repo',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Auth login / sign-up reliability',
    summary:
      'After email log in or sign up, the app syncs the cloud session into local db immediately so the auth screen does not stay stuck. Username checks no longer block sign-up when the profiles DB is unreachable. Clearer errors for unconfirmed email, OAuth redirect mismatch, and missing profiles migration.',
    tasks: ['Log in', 'Sign up'],
    testHints: [
      'Launch → email sign up → profile setup',
      'Launch → log in after sign up',
      'If Google fails: add current URL to Supabase redirect URLs',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Google login & sign-up',
    summary:
      'Auth screen offers Continue / Sign up with Google when Supabase env is set. Uses Supabase OAuth; session returns via redirect and syncs like email auth. Enable Google provider in Supabase Dashboard and add redirect URLs.',
    tasks: ['Log in', 'Sign up'],
    testHints: [
      'Supabase → Authentication → Providers → Google: enable + Client ID/secret',
      'Authentication → URL Configuration: Site URL + Redirect URLs include http://localhost:3000',
      'Run supabase/migrations/20260601130000_google_profile_metadata.sql if profiles already exist',
      'Launch → Continue with Google → profile setup if first time',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Supabase real-time auth',
    summary:
      'When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, login/signup/password reset use Supabase Auth; sessions persist and sync into local db via syncAuthUser. Profiles live in public.profiles (run supabase/migrations/20260601120000_profiles.sql). Without env vars, demo local auth still works.',
    tasks: ['Log in', 'Sign up', 'Log out', 'Profile setup'],
    testHints: [
      'Copy .env.example → .env with project URL + anon key from Supabase dashboard',
      'SQL Editor: run supabase/migrations/20260601120000_profiles.sql',
      'Sign up → confirm email if required → profile setup → trending → feed',
      'Profile → settings → Log out → auth; second device/browser can use same account',
      'Unset env vars → demo@instacollab.app / demo123 still works offline',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Launch flow: splash → main app',
    summary:
      'Full pre-home journey: splash, onboarding slides, auth (login / sign up / forgot password with demo code 123456), profile setup, trending follow gate, then main Shell. Demo accounts demo@instacollab.app and sarah@instacollab.app (password demo123). Log out from profile settings returns to auth.',
    tasks: ['Log in', 'Sign up', 'Log out', 'Profile setup'],
    testHints: [
      'Fresh load → splash → onboarding → login with demo@instacollab.app / demo123',
      'Sign up → profile setup → trending → Enter InstaCollab → home feed',
      'Profile → settings → Log out → auth screen',
      'Dev skip: ?launch=main or ?as=u2&launch=main',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Messages chat stability & media',
    summary:
      'Read/Seen only when both have the DM open (activeChatId); solo in thread still acks read in DB but labels stay Unread/Unseen for new messages; older messages keep Read; simulated reply brings peer into chat; Read/Unread tap no longer crashes; chat scroll only sticks when you are at the bottom; read receipts use normalized timestamps; single active media across the thread; multi-attachment messages auto-advance #1→#2→#3 in order and tap any track to switch; single inline chat videos no longer loop; voice/music play-pause icon syncs via audio onPlay/onPause (no double beginChatMediaPlayback); scrolling does not stop playback; fullscreen gallery/audio routing; multi music file attach; video errors no longer swap to sample fallback for blob/data URLs.',
    tasks: [
      'Send message',
      'Open shared media fullscreen',
      'Message read state',
    ],
    testHints: [
      'Two-device DM: localhost → u1, trycloudflare URL → u2 (dev auto); override with ?as=u3 or ?as=creative_sarah',
      'Messages → type in compose → peer sees Typing (header/thread/sidebar) via db; Live dev → “Switch as …” in second tab for two-user test',
      'Both in DM (online peer) → type → Typing on header + dots + sidebar; simulated reply shows peer typing before message',
      'Messages → open chat → scroll up → new messages should not yank scroll',
      'Message with 2+ audio/video → play one; when it ends, next attachment plays in order',
      'Scroll thread while playing → audio keeps going',
      'Play voice note then music in another message → previous pauses (one at a time)',
      'Attach multiple audio files from compose music picker',
      'Fullscreen gallery dots + prev/next for mixed media',
      'Open DM with online user → outgoing Seen + incoming Read after ~0.5s; back out → Unseen/Unread',
    ],
  },
  {
    date: '2026-05-28',
    title: 'Demo story strip (dev)',
    summary:
      'Feed rings seeded with LIVE (tech_tom, foodie_frank) and multi-segment stories; dev panel can re-apply.',
    testHints: [
      'Home feed → Add story + LIVE + story rings',
      'Dev panel → Seed demo stories (resets viewed state; 6 live ring kinds)',
      'Profile → only that user’s ring; own profile → Add story + your demo segments',
    ],
  },
  {
    date: '2026-05-28',
    title: 'Post archive',
    summary: 'Archive own posts from ⋯ menu; View archive on profile with grid, unarchive, and PostModal.',
    tasks: ['Archive / unarchive post'],
    testHints: [
      'Feed → your post → ⋯ → Archive (post leaves feed)',
      'Profile → View archive → grid + Unarchive',
      'Button shows count when archive has posts',
    ],
  },
  {
    date: '2026-05-28',
    title: 'Profile followers & following',
    summary: 'Click counts on profile → searchable list with follow/unfollow. Graph stored in follow_graph.',
    tasks: ['View followers / following', 'Follow / unfollow'],
    testHints: [
      'Profile → tap followers / following',
      'Follow someone from the list; counts update live',
      'Open preview card → same lists',
    ],
  },
  {
    date: '2026-05-28',
    title: 'Profile tabs (posts, reels, saved, tagged)',
    summary: 'Full grids + PostModal / reel preview; tagged uses @mentions and taggedUserIds.',
    tasks: ['Save / unsave post'],
    testHints: [
      'Profile → REELS / SAVED / TAGGED tabs',
      'Tagged: view as @designer_dude (u1) for p5/p6',
    ],
  },
  {
    date: '2026-05-28',
    title: 'App-wide data sync',
    summary: 'All screens read/write via db + resolve*; see AGENTS.md and appDataTasks.ts.',
    testHints: ['Like a post on feed → open profile saved tab', 'Follow on reels → check notifications'],
  },
];

export type DevPlannedItem = {
  id: string;
  title: string;
  notes?: string;
};

/** Planned / in progress — update as you build */
export const DEV_PLANNED: DevPlannedItem[] = [
  {
    id: 'story-archive',
    title: 'Story archive (separate from post archive)',
    notes: 'Optional parity with Instagram story archive',
  },
  {
    id: 'profile-reel-deeplink',
    title: 'Open in Reels from profile reel modal',
    notes: 'Pass initialReelId into ReelsScreen via navigate event',
  },
  {
    id: 'follow-count-sync',
    title: 'Optional: align display follower counts with graph size',
    notes: 'Today list shows real graph; profile may show higher seed totals',
  },
];
