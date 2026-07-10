# Releasing FridgeNotes (GitHub-built APK + Obtainium)

FridgeNotes builds a signed Android APK entirely on GitHub Actions (no Expo/EAS
cloud) and publishes it as a GitHub Release, so you can install and auto-update
the app with [Obtainium](https://github.com/ImranR98/Obtainium).

Workflow: [`.github/workflows/android-release.yml`](.github/workflows/android-release.yml)

---

## One-time setup: signing keystore

Android will only install an **update** over an existing app if the new APK is
signed with the **same key**. So you must create one release keystore and reuse
it for every build. **Keep it safe and backed up** — if you lose it, you can't
ship updates over an existing install (users would have to uninstall first).

### 1. Generate a keystore (locally, once)

```bash
keytool -genkeypair -v \
  -keystore fridgenotes-release.jks \
  -alias fridgenotes \
  -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for a keystore password and a name/org (fill in anything).
Remember the password and the alias (`fridgenotes`).

### 2. Base64-encode it for GitHub secrets

```bash
base64 -i fridgenotes-release.jks | pbcopy   # macOS (copies to clipboard)
# or: base64 -w0 fridgenotes-release.jks       # Linux
```

### 3. Add repository secrets

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
Add these four (plus `API_URL` if you want a default server baked in):

| Secret | Value |
|--------|-------|
| `ANDROID_KEYSTORE_BASE64` | the base64 string from step 2 |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password from step 1 |
| `ANDROID_KEY_ALIAS` | `fridgenotes` (the alias from step 1) |
| `ANDROID_KEY_PASSWORD` | the key password (same as keystore password unless you set a separate one) |
| `API_URL` *(optional)* | e.g. `https://notes.example.com` — baked in as the default server |

> The workflow falls back to a debug signature if `ANDROID_KEYSTORE_BASE64` is
> absent, so a manual test build works before you set this up — but debug-signed
> builds are **not** suitable for real distribution or stable Obtainium updates.

---

## Cutting a release

Bump the app version in `app.json` (`expo.version`), then tag and push:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The workflow builds the signed APK and publishes a GitHub Release named for the
tag, with `FridgeNotes-v1.1.0.apk` attached. You can also trigger a **manual**
build from the Actions tab (produces a downloadable artifact but no Release).

> Tip: keep `expo.version` and your tag in sync. Android's internal
> `versionCode` currently comes from the native project defaults — if you want
> Obtainium/Android to always see updates as "newer", bump the version each
> release.

---

## Installing & updating via Obtainium

1. Install [Obtainium](https://github.com/ImranR98/Obtainium/releases) on your phone.
2. **Add App** → paste this repo's URL:
   `https://github.com/Sc00tz/FridgeNotes-Mobile`
3. Obtainium reads the Releases and installs the latest APK. It checks for new
   releases automatically and offers one-tap updates.

Because every release is signed with the same keystore, updates install cleanly
over the previous version.

See also [`obtainium.json`](obtainium.json) for the app-source config.
