import type { CapacitorConfig } from '@capacitor/cli';

// Native-shell config for the Android (and future iOS) app. The app bundles
// the Vite build from `dist/` and talks to the same deployed Worker API as the
// website (VITE_API_URL is baked in at build time — set it before
// `npm run android:sync`).
const config: CapacitorConfig = {
  appId: 'com.swapmyshow.app',
  appName: 'SwapMyShow',
  webDir: 'dist',
  android: {
    // Served from https://localhost inside the WebView; this origin must be in
    // the backend's ALLOWED_ORIGINS (see backend/wrangler.jsonc).
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Brand purple, matching --brand in src/index.css.
      backgroundColor: '#7c3aed',
      launchShowDuration: 800,
      launchAutoHide: true,
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#7c3aed',
      style: 'LIGHT',
    },
  },
};

export default config;
