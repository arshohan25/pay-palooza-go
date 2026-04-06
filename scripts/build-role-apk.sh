#!/usr/bin/env bash
set -euo pipefail

ROLE="${1:-}"
VALID_ROLES=("admin" "agent" "distributor" "merchant" "super-distributor")

if [[ -z "$ROLE" ]]; then
  echo "Usage: ./scripts/build-role-apk.sh <role>"
  echo "Available roles: ${VALID_ROLES[*]}"
  exit 1
fi

MANIFEST="public/manifest-${ROLE}.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Error: Manifest not found at $MANIFEST"
  exit 1
fi

echo "==> Building APK for role: $ROLE"

# 1. Copy role manifest over default
cp "$MANIFEST" public/manifest.json
echo "    ✔ Copied $MANIFEST → public/manifest.json"

# 2. Build web assets
npm run build
echo "    ✔ Web build complete"

# 3. Sync to Android
npx cap sync android
echo "    ✔ Synced to Android"

echo ""
echo "==> Next steps:"
echo "    1. Open Android Studio: npx cap open android"
echo "    2. Build → Build Bundle(s) / APK(s) → Build APK(s)"
echo "    3. Find your APK in android/app/build/outputs/apk/debug/"
echo ""
echo "    For a signed release APK:"
echo "    cd android && ./gradlew assembleRelease"
