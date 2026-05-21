# Building FridgeNotes Mobile

## Prerequisites

- Node.js 18+
- An [Expo account](https://expo.dev) (free)
- EAS CLI: `npm install -g eas-cli`
- Log in: `eas login`

---

## Configuration

### 1. Set your server URL

Edit `app.json` and update `extra.apiUrl` to point at your FridgeNotes server:

```json
"extra": {
  "apiUrl": "http://192.168.1.100:5009"
}
```

Or pass it at build time via an environment variable — EAS will substitute it:

```json
// eas.json preview profile
"env": {
  "EXPO_PUBLIC_API_URL": "http://192.168.1.100:5009"
}
```

### 2. Update the app identifier (optional)

The default package is `com.fridgenotes.app`. Change it in `app.json` under `android.package` and `ios.bundleIdentifier` before your first build if you want a custom ID.

---

## Building

### Development build (runs on device via Expo Go replacement)

Use this to test on a real device without going through the Play Store. Install the resulting APK directly.

```bash
eas build --profile development --platform android
```

### Preview APK (share with testers — no Play Store needed)

Produces a standalone `.apk` you can sideload directly onto any Android device.

```bash
eas build --profile preview --platform android
```

EAS will print a download URL when the build completes (~5–10 min). Download and install:

```bash
# On the device: enable "Install from unknown sources" in Settings
# Then open the APK from Downloads
```

Or download and install via ADB:

```bash
adb install fridgenotes.apk
```

### Production AAB (Play Store submission)

Produces an `.aab` bundle for Google Play. Requires a Play Console account.

```bash
eas build --profile production --platform android
```

---

## Running locally (without EAS)

For quick iteration with Expo Go or a local dev client:

```bash
cd FridgeNotes-Mobile
npm install
npx expo start

# Press 'a' to open in Android emulator
# Scan QR code with Expo Go app on a physical device
```

Note: `expo-notifications` and `expo-haptics` require a development build or physical device — they do not work in Expo Go.

---

## Version bumping

Update `version` and `runtimeVersion` in `app.json` before each release:

```json
"version": "1.0.1",
"runtimeVersion": "1.0.1"
```

---

## Troubleshooting

**Build fails with "Metro bundler" error**  
Run `npx expo install` to sync native dependency versions, then retry.

**Notifications not firing on Android 13+**  
Ensure the device has granted notification permission. The app requests this on first launch.

**"Network request failed" in the app**  
Check that `EXPO_PUBLIC_API_URL` points to your server and the device is on the same network. On Android emulator use `10.0.2.2` instead of `localhost`.

**WebSocket not connecting**  
The `ALLOWED_ORIGIN` in your server's `.env` must match the URL the app uses to reach it. Update it and redeploy the server container.
