# FloorBeat Alerts for Android

A native Android app (Kotlin), package `in.floorbeat.alerts`, version 2.0.0. It replaces 1.0.0, a
Trusted Web Activity that was Chrome showing the site. Same package and same signing key, so
installing 2.0.0 updates 1.0.0 in place, and the home-screen icon is kept (the launcher entry keeps
its old name, `in.floorbeat.alerts.LauncherActivity`, as an alias).

The screens are alerts.floorbeat.in, shown in the phone's own web view (Android System WebView, no
Chrome needed), so an iPhone (the Home Screen web app) and Android show the same app and every change
reaches both at once. What a good Android app does itself is native:

- **Notifications through Firebase Cloud Messaging.** query-api sends each alert as a high-priority
  data message to the phone's Firebase Installation ID (FID; `notify/fcm.js` in the backend). The app
  words it in the person's language (`PushWords.kt`, the same words as the web app's service worker)
  and rings one of two channels, each with a FloorBeat sound built on the brand's heartbeat (a "beat"
  is two quick pulses): **Machine stopped** (HIGH and CRITICAL alerts) plays three climbing double-beats,
  twice, loud, in the 1.5–2.5 kHz band that carries over machine noise, at alarm volume
  (`res/raw/machine_alarm.ogg`); **Other alerts** plays one soft double chime (`res/raw/alert_chime.ogg`).
  Both are Opus in Ogg, made from scratch by `sounds/make_sounds.py` (run it to remake or tune them). Android keeps the sound a channel was made with,
  so a new sound needs a new channel id (`strings.xml`; the old channel is deleted at start). They arrive
  with the phone locked and the app closed. A tap opens that alert. An admin's ringing hours and the
  kinds that ring are kept on the server (query-api `notify/ring-rules.js`), so held-back alerts are
  never sent to the phone at all.
- **The back button** (`AppUrls.back`): back through the app's pages; an alert opened straight from a
  notification goes back to the inbox; on the inbox the app goes to the background. An open live view
  closes first (the page holds the back button, `src/lib/alerts-app/native.ts holdBack`).
- **First start:** the language, sign-in, then the phone's own "Allow notifications" question, then a
  one-time battery set-up with the maker's steps and a button to the right settings screen
  (`PhoneMaker.kt`: Xiaomi, Vivo, Oppo, Realme, OnePlus, Samsung, Huawei stop apps in the background).
- **Links** to alerts.floorbeat.in open in the app (App Links, verified by
  `public/.well-known/assetlinks.json`); other sites open in the phone's browser. No network: the
  app's own offline screen.

The page talks to the app through `window.FloorBeatAndroid` (`Bridge.kt`), given only to the app's
own origin. The web side is `src/lib/alerts-app/native.ts`; the notification switch
(`push-client.ts`) asks the app instead of the browser when it runs inside it.

## What is not in git

All kept beside the signing key in `esp-intro/keys/`, and copied in for a build:

- `keys/android/floorbeat-alerts.keystore`: the signing key (alias `floorbeat-alerts`, passwords in the
  README beside it). Every release must be signed with it, or phones refuse the update and the Play
  Store refuses the upload. Write `android/keystore.properties` for a build:
  ```
  storeFile=/Users/<you>/esp-intro/keys/android/floorbeat-alerts.keystore
  storePassword=…
  keyAlias=floorbeat-alerts
  keyPassword=…
  ```
- `keys/firebase/google-services.json`: the Firebase project's Android config. Copy it to
  `android/app/google-services.json`. Without it the app builds and runs, but without push.
- The server's side, the Firebase service-account key, goes to the backend as the `FCM_SERVICE_ACCOUNT`
  GitHub secret (base64 of the JSON); its deploy writes it into the server's `.env`.

## Building

Needs Android Studio's JDK and the Android SDK with platform 36.1 (Android Studio installs both):

```sh
cd android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties
./gradlew testDebugUnitTest                       # the pure rules: AppUrls, PushWords, PushMessage, PhoneMaker
./gradlew assembleRelease bundleRelease           # app-release.apk (the download) and app-release.aab (the Play Store)
```

A test build can be pointed at a server on the computer running the emulator:
`./gradlew assembleDebug -PappUrl=http://10.0.2.2:3105`. Test builds also allow plain HTTP to that
address, let a computer debug the web view, and take a push from adb, as Firebase would hand one over:

```sh
adb shell am broadcast -a floorbeat.alerts.DEBUG_PUSH -p in.floorbeat.alerts \
  --es notification_id ntf-1 --es title 'Loom 3 is DOWN' --es severity HIGH --es url /alerts/ntf-1 \
  --es view '{"kind":"machine_down","machine":"Loom 3","at":"2026-11-21T10:00:00Z"}'
```

## Releasing

1. Raise `versionCode` (by one) and `versionName` in `app/build.gradle.kts`.
2. Build with the signing key and the Firebase config in place (above).
3. Copy `app/build/outputs/apk/release/app-release.apk` to
   `marketing/public/downloads/floorbeat-alerts.apk` (the download on floorbeat.in/app). Keep each
   version's `.apk` and `.aab` with the key.

Firebase Messaging 25.1 and later register a phone by its Firebase Installation ID (on in the manifest,
`firebase_messaging_installation_id_enabled`); the older registration tokens are deprecated, so the app
reports its FID through `onRegistered` and the server sends to `message.fid`.

# FloorBeat for Android (the dashboard app)

A second app in this project: module `dashboard/`, package `in.floorbeat.dashboard`, version 1.0.0.
It is the factory's dashboard as an app. Its screens are dashboard.floorbeat.in, shown in the phone's
own web view: one address for every factory, the person's own factory once signed in
(`src/middleware.ts`, `src/lib/dashboard-app.ts`). An iPhone gets the same from its Home Screen
(`public/dashboard-app.webmanifest`). It shows no notifications: alerts ring from FloorBeat Alerts.

- **Sign-in:** an email and a password. Which factory is asked in a next step, only when they fit
  accounts at more than one (`src/components/auth/sign-in-steps.tsx`, shared with FloorBeat Alerts).
- **The back button:** an open form or menu closes first (the page holds the button:
  `holdBackOnce` in `src/lib/alerts-app/native.ts`), then back through the pages, then the app goes
  to the background (`AppLinks.back`).
- **Links** to dashboard.floorbeat.in open in the app (App Links; `public/.well-known/assetlinks.json`
  lists the package with the same signing key as FloorBeat Alerts). A site, a phone number or an email
  address opens outside it.
- **No network:** the app's own offline screen. The sign-in is kept between starts.
- **The bottom bar** is the dashboard's own, set per factory by our staff (staff console, Pages &
  branding, "Phone bottom bar").
- **The icon:** the brand's mark on the dashboard's dark blue with its pulse in orange, so the two
  apps are told apart (`res/drawable/ic_launcher_foreground.xml`; the web's copy is
  `src/components/dashboard-app/app-mark.tsx`).

```sh
./gradlew :dashboard:testDebugUnitTest                              # the pure rules: AppLinks
./gradlew :dashboard:assembleRelease :dashboard:bundleRelease       # dashboard-release.apk and .aab
```

A test build against a server on the computer running the emulator:
`./gradlew :dashboard:assembleDebug -PdashboardUrl=http://10.0.2.2:3105`, with the dashboard's dev
server started with `DASHBOARD_APP_HOST=10.0.2.2` (that address is then the app's).

Releasing: raise `versionCode` and `versionName` in `dashboard/build.gradle.kts`, build with the
signing key in place (`keystore.properties`, above; it needs no Firebase file), and copy
`dashboard/build/outputs/apk/release/dashboard-release.apk` to
`marketing/public/downloads/floorbeat-dashboard.apk` (the download on floorbeat.in/app).
