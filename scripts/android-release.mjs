#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const root = process.cwd();
const rustoreConfigPath = path.join(root, 'config', 'rustore-release.json');
const signingPropertiesPath = path.join(root, 'android', 'signing.properties');
const signingEnvNames = [
  'RELEASE_STORE_FILE',
  'RELEASE_STORE_PASSWORD',
  'RELEASE_KEY_ALIAS',
  'RELEASE_KEY_PASSWORD',
];
const sharedAndroidAuthEnvNames = [
  'YANDEX_ANDROID_CLIENT_ID',
  'VK_ANDROID_CLIENT_ID',
  'VK_ID_ANDROID_CLIENT_SECRET',
];
const rustoreAnalyticsEnvNames = ['MYTRACKER_SDK_KEY'];
const rustoreTasks = {
  'rustore-alpha-apk': {
    profile: 'alpha',
    format: 'apk',
    gradleTask: 'assembleRustoreRelease',
    rawOutput: 'android/app/build/outputs/apk/rustore/release/app-rustore-release.apk',
  },
  'rustore-alpha-aab': {
    profile: 'alpha',
    format: 'aab',
    gradleTask: 'bundleRustoreRelease',
    rawOutput: 'android/app/build/outputs/bundle/rustoreRelease/app-rustore-release.aab',
  },
  'rustore-release-apk': {
    profile: 'release',
    format: 'apk',
    gradleTask: 'assembleRustoreRelease',
    rawOutput: 'android/app/build/outputs/apk/rustore/release/app-rustore-release.apk',
  },
  'rustore-release-aab': {
    profile: 'release',
    format: 'aab',
    gradleTask: 'bundleRustoreRelease',
    rawOutput: 'android/app/build/outputs/bundle/rustoreRelease/app-rustore-release.aab',
  },
};

function fail(message) {
  console.error(`[android-release] ${message}`);
  process.exit(1);
}

function run(command, args, cwd = root, useShell = process.platform === 'win32') {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: useShell, env: process.env });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: process.env,
  });
  if (result.error || result.status !== 0) fail(`Could not run ${command} ${args.join(' ')}.`);
  return String(result.stdout || '').trim();
}

function loadEnvFiles(names) {
  const providedByShell = new Set(names.filter((name) => process.env[name]));
  const loaded = {};
  for (const file of ['.env', '.env.local']) {
    const absolutePath = path.join(root, file);
    if (fs.existsSync(absolutePath)) Object.assign(loaded, parseEnv(fs.readFileSync(absolutePath, 'utf8')));
  }
  for (const name of names) {
    if (!providedByShell.has(name) && typeof loaded[name] === 'string') process.env[name] = loaded[name];
  }
}

function loadSigningProperties() {
  if (!fs.existsSync(signingPropertiesPath)) return;
  const loaded = parseEnv(fs.readFileSync(signingPropertiesPath, 'utf8'));
  for (const name of signingEnvNames) {
    if (!process.env[name] && typeof loaded[name] === 'string') process.env[name] = loaded[name];
  }
}

function requireString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) fail(`${label} is missing from config/rustore-release.json.`);
  return normalized;
}

function requireHttpsUrl(value, label, originOnly = false) {
  const normalized = requireString(value, label);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    fail(`${label} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail(`${label} must be a credential-free HTTPS URL.`);
  }
  if (originOnly && parsed.pathname !== '/') fail(`${label} must not contain a path.`);
  return originOnly ? parsed.origin : parsed.href.replace(/\/$/, '');
}

function loadRustoreConfig() {
  if (!fs.existsSync(rustoreConfigPath)) fail('config/rustore-release.json is missing.');
  let config;
  try {
    config = JSON.parse(fs.readFileSync(rustoreConfigPath, 'utf8'));
  } catch (error) {
    fail(`config/rustore-release.json is invalid JSON: ${error.message}`);
  }
  if (config.schemaVersion !== 1) fail('Unsupported RuStore release config schemaVersion.');

  const app = config.app || {};
  const products = config.products || {};
  const profiles = config.profiles || {};
  const normalized = {
    app: {
      displayName: requireString(app.displayName, 'app.displayName'),
      packageName: requireString(app.packageName, 'app.packageName'),
      consoleAppId: requireString(app.consoleAppId, 'app.consoleAppId'),
      apiOrigin: requireHttpsUrl(app.apiOrigin, 'app.apiOrigin', true),
      publicOrigin: requireHttpsUrl(app.publicOrigin, 'app.publicOrigin', true),
      developerName: requireString(app.developerName, 'app.developerName'),
      supportEmail: requireString(app.supportEmail, 'app.supportEmail'),
      publicationDate: requireString(app.publicationDate, 'app.publicationDate'),
      privacyUrl: requireHttpsUrl(app.privacyUrl, 'app.privacyUrl'),
      termsUrl: requireHttpsUrl(app.termsUrl, 'app.termsUrl'),
      accountDeletionUrl: requireHttpsUrl(app.accountDeletionUrl, 'app.accountDeletionUrl'),
    },
    products: {
      month: requireString(products.month, 'products.month'),
      quarter: requireString(products.quarter, 'products.quarter'),
      year: requireString(products.year, 'products.year'),
    },
    profiles: {
      alpha: profiles.alpha || {},
      release: profiles.release || {},
    },
  };

  if (!/^\d+$/.test(normalized.app.consoleAppId)) fail('app.consoleAppId must be numeric.');
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/.test(normalized.app.packageName)) {
    fail('app.packageName is not a valid Android application ID.');
  }
  if (!/^\S+@\S+\.\S+$/.test(normalized.app.supportEmail)) fail('app.supportEmail is invalid.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.app.publicationDate)) {
    fail('app.publicationDate must use YYYY-MM-DD.');
  }
  const productIds = Object.values(normalized.products);
  if (new Set(productIds).size !== 3 || productIds.some((id) => !/^[A-Za-z0-9_.-]+$/.test(id))) {
    fail('The three RuStore product IDs must be distinct and use only letters, digits, dots, dashes, or underscores.');
  }

  const alpha = normalized.profiles.alpha;
  const release = normalized.profiles.release;
  if (!/^\d+\.\d+\.\d+-rc\.\d+$/.test(String(alpha.versionName || ''))) {
    fail('profiles.alpha.versionName must look like 1.0.0-rc.1.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(String(release.versionName || ''))) {
    fail('profiles.release.versionName must look like 1.0.0.');
  }
  if (!Number.isInteger(alpha.versionCode) || alpha.versionCode < 1) {
    fail('profiles.alpha.versionCode must be a positive integer.');
  }
  if (!Number.isInteger(release.versionCode) || release.versionCode <= alpha.versionCode) {
    fail('profiles.release.versionCode must be greater than profiles.alpha.versionCode.');
  }
  if (alpha.payMode !== 'sandbox') fail('profiles.alpha.payMode must be sandbox.');
  if (release.payMode !== 'production') fail('profiles.release.payMode must be production.');
  return normalized;
}

function setExactEnv(name, value) {
  const normalized = String(value);
  const existing = String(process.env[name] || '').trim();
  if (existing && existing !== normalized) {
    fail(`${name} conflicts with config/rustore-release.json; remove the override or update the config deliberately.`);
  }
  process.env[name] = normalized;
}

function applyRustoreProfile(config, profileName) {
  const profile = config.profiles[profileName];
  const productIds = [config.products.month, config.products.quarter, config.products.year];
  const values = {
    NEXT_PUBLIC_APP_NAME: config.app.displayName,
    NEXT_PUBLIC_API_URL: config.app.apiOrigin,
    NEXT_PUBLIC_DISTRIBUTION_CHANNEL: 'rustore',
    NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED: '1',
    NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH: config.products.month,
    NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER: config.products.quarter,
    NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR: config.products.year,
    NEXT_PUBLIC_DEVELOPER_NAME: config.app.developerName,
    NEXT_PUBLIC_SUPPORT_EMAIL: config.app.supportEmail,
    NEXT_PUBLIC_PUBLIC_BASE_URL: config.app.publicOrigin,
    NEXT_PUBLIC_PRIVACY_POLICY_URL: config.app.privacyUrl,
    NEXT_PUBLIC_TERMS_URL: config.app.termsUrl,
    NEXT_PUBLIC_ACCOUNT_DELETION_URL: config.app.accountDeletionUrl,
    NEXT_PUBLIC_LEGAL_PUBLICATION_DATE: config.app.publicationDate,
    RUSTORE_CONSOLE_APP_ID: config.app.consoleAppId,
    RUSTORE_PACKAGE_NAME: config.app.packageName,
    RUSTORE_PAY_SCHEME: `${config.app.packageName}.rustore`,
    RUSTORE_ALLOWED_PRODUCT_IDS: productIds.join(','),
    RUSTORE_PAY_MODE: profile.payMode,
    APP_VERSION_CODE: profile.versionCode,
    APP_VERSION_NAME: profile.versionName,
    STORE_BUILD_PROFILE: profileName,
    MOBILE_BUILD: '1',
    NEXT_PUBLIC_MOBILE_BUILD: '1',
    STORE_RELEASE: '1',
  };
  for (const [name, value] of Object.entries(values)) setExactEnv(name, value);
  return profile;
}

function getSourceState() {
  const commit = commandOutput('git', ['rev-parse', '--verify', 'HEAD']).toLowerCase();
  const status = commandOutput('git', ['status', '--porcelain', '--untracked-files=all']);
  return { commit, dirty: status.length > 0 };
}

function verifySigningFile() {
  for (const name of signingEnvNames) {
    if (!String(process.env[name] || '').trim()) fail(`${name} is missing from android/signing.properties or the shell.`);
  }
  const configuredPath = String(process.env.RELEASE_STORE_FILE).trim();
  const storePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(root, 'android', 'app', configuredPath);
  if (!fs.existsSync(storePath)) fail(`Release keystore does not exist: ${storePath}`);
}

function writeArtifactMetadata({ artifact, config, profileName, profile, sourceState, sha256 }) {
  const metadata = {
    schemaVersion: 1,
    artifact: path.basename(artifact),
    sha256,
    displayName: config.app.displayName,
    packageName: config.app.packageName,
    consoleAppId: config.app.consoleAppId,
    profile: profileName,
    versionName: profile.versionName,
    versionCode: profile.versionCode,
    payMode: profile.payMode,
    sourceCommit: sourceState.commit,
    sourceDirty: sourceState.dirty,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(`${artifact}.json`, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

function printInspection(config) {
  loadEnvFiles([...sharedAndroidAuthEnvNames, ...rustoreAnalyticsEnvNames]);
  loadSigningProperties();
  console.log('RuStore release configuration');
  console.log(`- App: ${config.app.displayName}`);
  console.log(`- Package: ${config.app.packageName}`);
  console.log(`- Console app ID: ${config.app.consoleAppId}`);
  console.log(`- API: ${config.app.apiOrigin}`);
  console.log(`- Products: ${Object.values(config.products).join(', ')}`);
  console.log(`- Alpha: ${config.profiles.alpha.versionName} (${config.profiles.alpha.versionCode}), sandbox`);
  console.log(`- Release: ${config.profiles.release.versionName} (${config.profiles.release.versionCode}), production`);
  console.log(`- Signing properties: ${signingEnvNames.every((name) => process.env[name]) ? 'configured' : 'missing'}`);
  for (const name of sharedAndroidAuthEnvNames) {
    console.log(`- ${name}: ${String(process.env[name] || '').trim() ? 'configured' : 'missing'}`);
  }
  console.log(`- MyTracker Android: ${String(process.env.MYTRACKER_SDK_KEY || '').trim() ? 'configured' : 'disabled (no SDK key)'}`);
}

const target = process.argv[2];
if (target === 'inspect') {
  printInspection(loadRustoreConfig());
  process.exit(0);
}

if (target === 'google-play-aab') {
  loadEnvFiles(['GOOGLE_AUTH_CLIENT_ID', ...sharedAndroidAuthEnvNames]);
  process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'google_play';
  process.env.MOBILE_BUILD = '1';
  process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
  process.env.STORE_RELEASE = '1';
  run(process.execPath, ['scripts/validate-store-release.mjs', '--release'], root, false);
  run('npm', ['run', 'build:mobile']);
  run('npx', ['cap', 'sync', 'android']);
  run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['bundleGooglePlayRelease'], path.join(root, 'android'));
  const artifact = path.join(root, 'android/app/build/outputs/bundle/googlePlayRelease/app-google-play-release.aab');
  if (!fs.existsSync(artifact)) fail(`Expected artifact was not created: ${artifact}`);
  console.log(`Artifact: ${artifact}`);
  console.log(`SHA-256: ${createHash('sha256').update(fs.readFileSync(artifact)).digest('hex')}`);
  process.exit(0);
}

const task = rustoreTasks[target];
if (!task) {
  fail('Usage: node scripts/android-release.mjs inspect|rustore-alpha-apk|rustore-alpha-aab|rustore-release-apk|rustore-release-aab|google-play-aab');
}

const config = loadRustoreConfig();
loadEnvFiles([...sharedAndroidAuthEnvNames, ...rustoreAnalyticsEnvNames]);
loadSigningProperties();
const profile = applyRustoreProfile(config, task.profile);
const sourceState = getSourceState();
process.env.STORE_SOURCE_DIRTY = sourceState.dirty ? '1' : '0';
if (task.profile === 'release' && sourceState.dirty) {
  fail('The public release requires a clean working tree. Commit or otherwise resolve local changes first.');
}
verifySigningFile();

run(
  process.execPath,
  ['scripts/validate-store-release.mjs', '--mobile-artifact', `--profile=${task.profile}`],
  root,
  false,
);
run('npm', ['run', 'build:mobile']);
run('npx', ['cap', 'sync', 'android']);
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [task.gradleTask], path.join(root, 'android'));

const rawArtifact = path.join(root, task.rawOutput);
if (!fs.existsSync(rawArtifact)) fail(`Expected artifact was not created: ${rawArtifact}`);
const safeVersion = profile.versionName.replace(/[^0-9A-Za-z.-]+/g, '-');
const dirtySuffix = sourceState.dirty ? '-dirty' : '';
const artifact = path.join(
  path.dirname(rawArtifact),
  `NEBO-rustore-${task.profile}-${safeVersion}-vc${profile.versionCode}${dirtySuffix}.${task.format}`,
);
fs.copyFileSync(rawArtifact, artifact);
const sha256 = createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
writeArtifactMetadata({ artifact, config, profileName: task.profile, profile, sourceState, sha256 });
console.log(`Artifact: ${artifact}`);
console.log(`Metadata: ${artifact}.json`);
console.log(`SHA-256: ${sha256}`);
if (sourceState.dirty) console.log('Source state: dirty (allowed for closed alpha only).');
