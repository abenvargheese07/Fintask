# Mobile Application Guide

The Flutter mobile and multiplatform client is located in the `app/` folder.

## Prerequisites
- Flutter SDK (>= 3.40.0)
- Android SDK & JDK 21
- Xcode (for iOS and macOS desktop builds)

## Local Development

```bash
cd app

# Fetch dependencies
flutter pub get

# Run on connected device or simulator
flutter run
```

## Android APK Compilation

You can compile the Android release APK using the automated build script:

```bash
./scripts/build_apk.sh
```

The script:
1. Compiles the Flutter app using `flutter build apk --release`.
2. Verifies the generated binary.
3. Automatically copies the binary to:
   - `artifacts/fintask.apk`
   - `backend/downloads/fintask.apk` (served directly via `/download-apk`)

## Push Notifications Setup
Fintask uses zero-login, secure push notifications through `ntfy.sh`:
1. Open the Fintask app on your phone.
2. Open Settings (gear icon in the top header).
3. The app auto-syncs with your backend's unique topic (e.g. `fintask-55m9fp`).
4. Install the free **ntfy** app from Google Play or App Store and subscribe to your topic.
5. Tap **Send Test Alert** to verify end-to-end delivery.

