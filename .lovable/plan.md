

# Set Up Capacitor for Native Android APK Builds

## Overview

Configure Capacitor to wrap the existing PWA into a native Android shell, enabling APK generation for each role-specific app.

## Steps

### 1. Install Capacitor dependencies

Install the required packages:
- `@capacitor/core`
- `@capacitor/cli` (dev dependency)
- `@capacitor/android`

### 2. Initialize Capacitor

Run `npx cap init` and create `capacitor.config.ts` with:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.904c7dc7c25743d9b10405d6719732a4',
  appName: 'pay-palooza-go',
  webDir: 'dist',
  server: {
    url: 'https://904c7dc7-c257-43d9-b104-05d6719732a4.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
```

### 3. Build script for role-specific APKs

Create a helper script `scripts/build-role-apk.sh` that:
1. Copies the role-specific manifest over `manifest.json`
2. Runs `npm run build`
3. Runs `npx cap sync android`
4. Outputs instructions to build the APK via Android Studio or Gradle

### 4. What you need to do locally

After I set this up, you will need to:

1. **Export to GitHub** via the "Export to Github" button in Lovable
2. **Clone and pull** the repo locally
3. Run `npm install`
4. Run `npx cap add android` to scaffold the Android project
5. Run `npm run build && npx cap sync android`
6. Run `npx cap open android` to open in Android Studio
7. In Android Studio: **Build → Build APK** to generate the `.apk` file

For role-specific APKs, you would change the manifest before building, or create separate Capacitor configs per role.

## Files Changed

- `capacitor.config.ts` — New Capacitor configuration file
- `package.json` — Add Capacitor dependencies
- `scripts/build-role-apk.sh` — Helper script for role-specific builds

## Important Note

Capacitor requires **Android Studio** installed on your local machine to compile the APK. This cannot be done inside Lovable's editor. For full details, see the [Capacitor blog post](https://docs.lovable.dev/tips-tricks/native-mobile-apps).

