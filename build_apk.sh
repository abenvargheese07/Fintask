#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_DIR/app" ]; then
    PROJECT_ROOT="$SCRIPT_DIR"
else
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

APP_DIR="$PROJECT_ROOT/app"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"
DOWNLOADS_DIR="$PROJECT_ROOT/backend/downloads"

mkdir -p "$ARTIFACTS_DIR"
mkdir -p "$DOWNLOADS_DIR"

# Set JDK 21 if installed in user's home or standard macOS location
if [ -d "$HOME/.jdks/jdk-21.0.12.1+1/Contents/Home" ]; then
    export JAVA_HOME="$HOME/.jdks/jdk-21.0.12.1+1/Contents/Home"
fi

BUILD_MODE="${1:---release}"

echo "🔨 Building Flutter Android APK ($BUILD_MODE)..."
cd "$APP_DIR"

flutter build apk $BUILD_MODE

# Locate the newly generated APK
APK_PATH=""
CANDIDATES=(
    "$APP_DIR/build/app/outputs/flutter-apk/app-release.apk"
    "$APP_DIR/build/app/outputs/flutter-apk/app-debug.apk"
    "$APP_DIR/build/app/outputs/apk/release/app-release.apk"
    "$APP_DIR/build/app/outputs/apk/debug/app-debug.apk"
)

for cand in "${CANDIDATES[@]}"; do
    if [ -f "$cand" ]; then
        APK_PATH="$cand"
        break
    fi
done

if [ -n "$APK_PATH" ] && [ -f "$APK_PATH" ]; then
    echo "📦 Copying generated APK to artifacts/ and backend/downloads/..."
    cp -f "$APK_PATH" "$ARTIFACTS_DIR/fintask.apk"
    cp -f "$APK_PATH" "$DOWNLOADS_DIR/fintask.apk"

    APK_SIZE=$(du -h "$ARTIFACTS_DIR/fintask.apk" | cut -f1)
    echo "✅ Success! Latest APK copied to:"
    echo "   -> $ARTIFACTS_DIR/fintask.apk ($APK_SIZE)"
    echo "   -> $DOWNLOADS_DIR/fintask.apk ($APK_SIZE)"
else
    echo "⚠️ APK build completed, check artifacts/ for the copied binary."
fi
