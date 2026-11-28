# FloorBeat for Android

One native Android app (Kotlin), package `in.floorbeat.alerts`, version 3.0.1: the factory's **alerts**,
its **dashboard** and its **stock** (FloorBeat IMS) behind a home screen with a tile for each (the owner,
2026-11-27: "when user open that app, i want to show three apps inside it", "same in pwa and desktop").

Its history, which is why the package keeps the alerts' name:

- 1.0.0: FloorBeat Alerts, a Trusted Web Activity (Chrome showing alerts.floorbeat.in).
- 2.0.0: FloorBeat Alerts, native, the same package and signing key, so it installed over 1.0.0 as an update
  (the launcher entry keeps its old name, `in.floorbeat.alerts.LauncherActivity`, as an alias).
- A second app, FloorBeat (`in.floorbeat.dashboard`, 1.1.0), was the dashboard with its Stock tab.
- 3.0.0: the two became one. It is the alerts app's package, so it installs over FloorBeat Alerts as an
  update and its notifications ring straight through the update (Firebase knows this package only). The
  dashboard app's camera and photo picker moved in; its module is gone.
- 3.0.1: the offline screen shows for the network's failures only (a load cancelled for the next one,
  ERR_ABORTED, had left it over a page that loaded) and goes by itself: the app tries again the moment the
  phone's network is back, else after 2, 4, 8, 16 s and then every 30 s, and says what failed in small type
  (`Offline.kt`; the owner, 2026-11-27: "im getting this even when im online").

The screens are dashboard.floorbeat.in, shown in the phone's own web view (Android System WebView, no
Chrome needed), so an iPhone (the Home Screen web app), a computer's browser and Android show the same app
and every change reaches all of them at once (`src/lib/dashboard-app.ts`, `src/middleware.ts`):

| Address | What |
| --- | --- |
| `/` | the home screen: a tile for each of the person's apps, each with a live line (new alerts, machines running, what is in stock) |
| `/inbox` | the alerts (the alerts app's screens: `/inbox/alerts/<id>` is one alert, `/inbox/settings` its settings) |
| `/overview` | the dashboard (its other pages at their plain addresses, `/energy`…) |
| `/ims` | the stock: Add item, Available stock |

What a good Android app does itself is native:

- **Notifications through Firebase Cloud Messaging.** query-api sends each alert as a high-priority
  data message to the phone's Firebase Installation ID (FID; `notify/fcm.js` in the backend). The app
  words it in the person's language (`PushWords.kt`, the same words as the web app's service worker)
  and rings one of two channels, each with a FloorBeat sound built on the brand's heartbeat (a "beat"
  is two quick pulses): **Machine stopped** (HIGH and CRITICAL alerts) plays three climbing double-beats,
  twice, loud, in the 1.5–2.5 kHz band that carries over machine noise, at alarm volume
  (`res/raw/machine_alarm.ogg`); **Other alerts** plays one soft double chime (`res/raw/alert_chime.ogg`).
  Both are Opus in Ogg, made from scratch by `sounds/make_sounds.py` (run it to remake or tune them). Android keeps the sound a channel was made with,
  so a new sound needs a new channel id (`strings.xml`; the old channel is deleted at start). They arrive
  with the phone locked and the app closed. A tap opens that alert in the app's inbox (the server names the
  alerts app's page, `/alerts/<id>`; `AppUrls.tapPath` puts it under `/inbox`). An admin's ringing hours and
  the kinds that ring are kept on the server (query-api `notify/ring-rules.js`), so held-back alerts are
  never sent to the phone at all.
- **The back button** (`AppUrls.back`): an open form, menu or live view closes first (the page holds the
  button, `src/lib/alerts-app/native.ts holdBack`); then back through the app's pages; with nothing behind,
  an alert opened straight from a notification goes to the inbox and any other page to the home screen; on
  the home screen the app goes to the background.
- **First start:** the language, sign-in (an email and a password; which factory only when they fit more
  than one, `src/components/auth/sign-in-steps.tsx`), then the phone's own "Allow notifications" question,
  then a one-time battery set-up with the maker's steps and a button to the right settings screen
  (`PhoneMaker.kt`: Xiaomi, Vivo, Oppo, Realme, OnePlus, Samsung, Huawei stop apps in the background).
- **The camera, for the stock** (`PhotoPick.kt`): a photo field's "Take photo" (`capture`) opens the phone's
  camera app, which writes into the app's cache (`FileProvider`, `res/xml/photo_paths.xml`); "Choose from
  phone" opens the phone's picker. A page asking for the camera itself (getUserMedia) gets it after
  Android's "Allow camera", the camera only, and only on the app's own address. The page makes a photo
  small and reads its date itself (`src/lib/ims/photo.ts`). Unsent stock and photos live in the web view's
  storage (local storage, IndexedDB), which the app never clears.
- **Links** to dashboard.floorbeat.in open in the app, and so do links to the alerts' old address,
  alerts.floorbeat.in, at their page in the inbox (`AppUrls.linkPage`; App Links verified by
  `public/.well-known/assetlinks.json`, served on both hosts). Other sites, phone numbers and emails open
  outside. No network: the app's own offline screen.
- **The icon:** the brand's mark on FloorBeat's dark blue with its pulse in orange
  (`res/drawable/ic_launcher_foreground.xml`; the web's copy is `src/components/dashboard-app/app-mark.tsx`).

The page talks to the app through `window.FloorBeatAndroid` (`Bridge.kt`), given only to the app's
own origin. The web side is `src/lib/alerts-app/native.ts`; the notification switch
(`push-client.ts`) asks the app instead of the browser when it runs inside it. The app's user agent ends
`FloorBeatAlerts/<version> (Android)`, the mark it had before the apps became one.

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
./gradlew testDebugUnitTest                       # the pure rules: AppUrls, PhotoPick, PushWords, PushMessage, PhoneMaker
./gradlew assembleRelease bundleRelease           # app-release.apk (the download) and app-release.aab (the Play Store)
```

A test build can be pointed at a server on the computer running the emulator:
`./gradlew assembleDebug -PappUrl=http://10.0.2.2:3105`, with the web app started with
`DASHBOARD_APP_HOST=10.0.2.2` (that address is then the app's). Test builds also allow plain HTTP to that
address, let a computer debug the web view, and take a push from adb, as Firebase would hand one over:

```sh
adb shell am broadcast -a floorbeat.alerts.DEBUG_PUSH -p in.floorbeat.alerts \
  --es notification_id ntf-1 --es title 'Loom 3 is DOWN' --es severity HIGH --es url /alerts/ntf-1 \
  --es view '{"kind":"machine_down","machine":"Loom 3","at":"2026-11-21T10:00:00Z"}'
```

## Releasing

1. Raise `versionCode` (by one) and `versionName` in `app/build.gradle.kts`.
2. Build with the signing key and the Firebase config in place (above).
3. Copy `app/build/outputs/apk/release/app-release.apk` to `marketing/public/downloads/floorbeat.apk`
   (the download on floorbeat.in/app; the two old downloads, `floorbeat-alerts.apk` and
   `floorbeat-dashboard.apk`, lead to it: `marketing/src/redirect.ts`). Keep each version's `.apk` and
   `.aab` with the key.

Firebase Messaging 25.1 and later register a phone by its Firebase Installation ID (on in the manifest,
`firebase_messaging_installation_id_enabled`); the older registration tokens are deprecated, so the app
reports its FID through `onRegistered` and the server sends to `message.fid`.
