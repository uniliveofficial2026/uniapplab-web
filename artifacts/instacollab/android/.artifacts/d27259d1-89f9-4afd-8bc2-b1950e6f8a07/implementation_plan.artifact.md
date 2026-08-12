# Fix Google Access Token, UI Overflow, and App Branding

This plan addresses the "google access token issues" by ensuring the token is correctly extracted from the Supabase session, fixes the splash screen overflow, and ensures consistent branding.

## User Review Required

> [!IMPORTANT]
> **Google Access Token:** We found that when using Supabase as the primary backend, the Google access token (required for Workspace features like Google Drive and Docs) was not being extracted from the session. We will update the `AuthProvider` to correctly populate this token.

> [!NOTE]
> **App Logo:** You mentioned you already have your logo for PWA and APK. We will ensure the splash screen uses this logo cleanly without redundant text that causes overflow.

## Proposed Changes

### Web Application Components

#### [MODIFY] [AuthProvider.tsx](file:///Volumes/Wei2TB/Universal-Fixer/artifacts/instacollab/src/lib/auth/AuthProvider.tsx)
- Use `useCloudAuth` to listen for Supabase session changes.
- Extract `provider_token` from the Supabase session and set it as the `googleAccessToken`. This will fix the "Link Account" loop in the Workspace tab.

#### [MODIFY] [SplashScreen.tsx](file:///Volumes/Wei2TB/Universal-Fixer/artifacts/instacollab/src/components/launch/SplashScreen.tsx)
- Remove the redundant `h1` tag displaying the app name (since it's in the logo).
- Reduce vertical gaps and logo size to ensure the layout fits on all Android devices.

#### [MODIFY] [googleOAuthSetup.ts](file:///Volumes/Wei2TB/Universal-Fixer/artifacts/instacollab/src/lib/auth/googleOAuthSetup.ts)
- Add a helper to detect "disallowed_useragent" and provide user-friendly instructions if Google blocks the WebView login.

## Verification Plan

### Automated Tests
- Run `pnpm run build` and `npx cap sync android`.

### Manual Verification
- **Google Login:** Open the **Workspace** tab, click **Link Account**, and verify that after login, the Google Drive files are visible (token is active).
- **Splash Screen:** Verify the "UniLive" welcome screen fits vertically on the device without scrolling or cutting off buttons.
- **Logo:** Verify the logo displays correctly on the splash screen and home screen.
