/**
 * Config plugin: inject a release signingConfig into the generated
 * android/app/build.gradle during `expo prebuild`.
 *
 * Because this is a managed Expo project, the native android/ directory is
 * regenerated on every build, so we can't hand-edit build.gradle. This plugin
 * rewrites it at prebuild time to sign release builds with a keystore whose
 * path/credentials come from environment variables (set by CI from repo
 * secrets). When those env vars are absent (e.g. a local dev build), it falls
 * back to the debug keystore so the build still succeeds.
 *
 * Env vars consumed (see .github/workflows/android-release.yml + RELEASING.md):
 *   FRIDGENOTES_UPLOAD_STORE_FILE, FRIDGENOTES_UPLOAD_STORE_PASSWORD,
 *   FRIDGENOTES_UPLOAD_KEY_ALIAS, FRIDGENOTES_UPLOAD_KEY_PASSWORD
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const RELEASE_SIGNING_CONFIG = `
        release {
            def storeFilePath = System.getenv("FRIDGENOTES_UPLOAD_STORE_FILE")
            if (storeFilePath != null) {
                storeFile file(storeFilePath)
                storePassword System.getenv("FRIDGENOTES_UPLOAD_STORE_PASSWORD")
                keyAlias System.getenv("FRIDGENOTES_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("FRIDGENOTES_UPLOAD_KEY_PASSWORD")
            }
        }`;

function addSigningConfig(gradle) {
  // Add a `release` entry inside signingConfigs { ... } next to the default debug one.
  if (gradle.includes('FRIDGENOTES_UPLOAD_STORE_FILE')) {
    return gradle; // already applied
  }
  const signingConfigsRe = /signingConfigs\s*\{/;
  if (!signingConfigsRe.test(gradle)) {
    throw new Error('withReleaseSigning: could not find signingConfigs block in build.gradle');
  }
  gradle = gradle.replace(signingConfigsRe, (match) => `${match}${RELEASE_SIGNING_CONFIG}`);

  // Point the release build type at the release signingConfig, but only when a
  // keystore is actually provided; otherwise keep debug signing so local/CI
  // builds without secrets don't fail.
  gradle = gradle.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{)([\s\S]*?)(signingConfig\s+signingConfigs\.debug)/,
    (full, head, mid, sign) => {
      const replacement = 'signingConfig System.getenv("FRIDGENOTES_UPLOAD_STORE_FILE") != null ? signingConfigs.release : signingConfigs.debug';
      return `${head}${mid}${replacement}`;
    }
  );
  return gradle;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = addSigningConfig(cfg.modResults.contents);
    } else {
      throw new Error('withReleaseSigning: unexpected build.gradle language (expected groovy)');
    }
    return cfg;
  });
};
