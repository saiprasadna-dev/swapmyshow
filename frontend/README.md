# SwapMyShow Frontend

React 19 + Vite single-page app. Deployed to Cloudflare Pages as the website,
and wrapped with **Capacitor** as the Android app (`android/`). One codebase
drives both; everything talks to the Cloudflare Worker API in `../backend`.

## Web development

```sh
npm install
cp .env.example .env.local   # set VITE_API_URL (+ VITE_GOOGLE_CLIENT_ID for Google sign-in)
npm run dev                  # http://localhost:5173
npm run build                # type-check + production build into dist/
```

`VITE_API_URL` is baked in at build time — point it at `http://127.0.0.1:8787`
for a local backend (`cd ../backend && npm run dev`) or at the deployed Worker.

## Android app (Capacitor)

The `android/` folder is a generated native project that loads the Vite build
from `dist/`. The app uses email + password sign-in (Google sign-in is
web-only for now) and calls the same deployed Worker API.

### Build & run (needs Android Studio on your machine)

1. Install [Android Studio](https://developer.android.com/studio) (bundles the
   Android SDK and JDK).
2. Make sure `VITE_API_URL` in your env points at the **deployed** Worker
   (the phone can't reach your laptop's 127.0.0.1).
3. Sync the web build into the native project and open it:

   ```sh
   npm run android:sync   # npm run build + cap sync android
   npm run android:open   # opens the project in Android Studio
   ```

4. In Android Studio press **Run** on an emulator or a USB-connected phone
   (debug builds need no signing).

The backend must allow the app's origin — `https://localhost` is already in
`ALLOWED_ORIGINS` (see `../backend/wrangler.jsonc`); redeploy the Worker after
changing it.

### Release to the Play Store (summary)

1. One-time signing key (back it up — losing it means losing update rights):

   ```sh
   keytool -genkey -v -keystore swapmyshow.keystore -alias swapmyshow \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Android Studio → **Build → Generate Signed App Bundle** → `.aab`.
3. [Play Console](https://play.google.com/console) (one-time $25): create the
   app, fill the store listing (title, descriptions, ≥2 screenshots, 512×512
   icon, 1024×500 feature graphic), content rating, and the data-safety form
   (collects name/email/phone + user content; no ads; no in-app payments —
   swaps are settled peer-to-peer).
   Privacy policy URL: `https://swapmyshow.in/privacy.html`.
4. Upload the `.aab` to **Internal testing** first, then promote. New personal
   developer accounts must run a closed test (~12 testers for 14 days) before
   production.

### Shipping updates

Website updates deploy automatically via Pages. For the Android app, re-run
`npm run android:sync`, bump `versionCode`/`versionName` in
`android/app/build.gradle`, rebuild the signed bundle, and upload it.

## Notes

- Icons/splash screens live in `android/app/src/main/res/` (generated,
  brand-purple). The adaptive-icon background color is set in
  `res/values/ic_launcher_background.xml`.
- The hardware back button navigates between screens (see the Capacitor
  listener in `src/App.tsx`); the status bar is brand purple.
- Native-only behaviour is gated on `Capacitor.isNativePlatform()` so the
  website is completely unaffected.
