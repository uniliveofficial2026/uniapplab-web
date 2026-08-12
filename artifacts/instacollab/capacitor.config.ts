import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shells wrap the same UniLive web/PWA build (`dist/public`).
 * Optional CAP_SERVER_URL loads the live production app in the WebView
 * (seamless data flow with app.uniapplab.com) instead of bundled assets.
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim() || '';

const config: CapacitorConfig = {
  appId: 'com.uniapplab.unilive',
  appName: 'UniLive\u2019s',
  webDir: 'dist/public',
  backgroundColor: '#020617',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'app.uniapplab.com',
    allowNavigation: [
      'uniapplab.com',
      '*.uniapplab.com',
      '*.supabase.co',
      '*.livekit.cloud',
      '*.googleapis.com',
      '*.gstatic.com',
      'accounts.google.com',
      '*.google.com',
      '*.firebaseio.com',
      '*.firebaseapp.com',
    ],
    ...(serverUrl
      ? {
          url: serverUrl,
          cleartext: false,
        }
      : {}),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#020617',
      showSpinner: false,
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#020617',
  },
};

export default config;
