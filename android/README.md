# FloorBeat Alerts for Android

The Android app is a Trusted Web Activity: a thin, signed Android package that opens
https://alerts.floorbeat.in full-screen, with notifications. The web app is the app; this package
only gives Android users an install from floorbeat.in/app (and, later, the Play Store). Package
`in.floorbeat.alerts`.

- `twa-manifest.json` — the Bubblewrap manifest (what is built). Bump `appVersion` and
  `appVersionCode` for every new build.
- The signing key is **not in git**: `esp-intro/keys/android/floorbeat-alerts.keystore` (alias
  `floorbeat-alerts`, password in the README beside it). Every build must be signed with it, or
  phones refuse the update and the Play Store refuses the upload. Its certificate's SHA-256 is
  published at `public/.well-known/assetlinks.json` (this repo), which is what lets the app open the
  site without a browser bar.
- Built packages: `marketing/public/downloads/floorbeat-alerts.apk` (the download on
  floorbeat.in/app). Keep each version's `.apk` and `.aab` (the Play Store upload) with the key.

## Rebuilding

Needs JDK 17 (Bubblewrap checks for exactly 17), the Android command-line tools and
`@bubblewrap/cli`. None of this is kept in the repo; the steps below were last run 2026-11-17.

```sh
WORK=/tmp/fb-android && mkdir -p $WORK && cd $WORK
# JDK 17 (Temurin, Apple Silicon) and the Android command-line tools
curl -sSL -o jdk17.tar.gz 'https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse' && tar -xzf jdk17.tar.gz
curl -sSL -o cmdline-tools.zip 'https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip'
mkdir -p sdk/cmdline-tools && unzip -q cmdline-tools.zip -d sdk/cmdline-tools && mv sdk/cmdline-tools/cmdline-tools sdk/cmdline-tools/latest
ln -s $WORK/sdk/cmdline-tools/latest $WORK/sdk/tools      # Bubblewrap wants <sdk>/tools to exist
export JAVA_HOME=$(ls -d $WORK/jdk-17*/Contents/Home) PATH=$JAVA_HOME/bin:$PATH
yes | sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=$WORK/sdk --licenses >/dev/null
sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=$WORK/sdk "platforms;android-36" "build-tools;36.0.0" "build-tools;35.0.0" "build-tools;34.0.0" "platform-tools"
npm i @bubblewrap/cli
printf '{"jdkPath":"%s","androidSdkPath":"%s"}\n' "$(ls -d $WORK/jdk-17*)" "$WORK/sdk" > ~/.bubblewrap/config.json
# the project, from this repo's manifest
mkdir app && cp <this repo>/android/twa-manifest.json app/ && cd app
export BUBBLEWRAP_KEYSTORE_PASSWORD=… BUBBLEWRAP_KEY_PASSWORD=…        # from keys/android/README.md
npx bubblewrap update --skipVersionUpgrade     # generates the Android project (fetches the icons from alerts.floorbeat.in)
npx bubblewrap build --skipPwaValidation       # app-release-signed.apk + app-release-bundle.aab
```

Check before publishing: `apksigner verify --print-certs app-release-signed.apk` shows the SHA-256
in `assetlinks.json`; `aapt2 dump badging` shows `in.floorbeat.alerts` and the new version. Then copy
the APK to `marketing/public/downloads/floorbeat-alerts.apk` and keep the `.aab` with the key.
Deploying the website publishes the download; the deploy's link checks open it.

Gotchas met: `androidSdkPath` must be the SDK root (Bubblewrap hands it to Gradle as ANDROID_HOME)
with a `tools` link so Bubblewrap accepts it; the template compiles against platform 36 and Gradle
also wants build-tools 35; minimum Android is 7.0 (API 24, what the browser helper library needs).
An update of the web app needs no new package; only a change to this manifest (name, colours,
icons, version) does.
