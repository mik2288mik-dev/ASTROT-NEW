#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

const BUILD_ENV_NAMES = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_DISTRIBUTION_CHANNEL',
  'NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED',
  'STORE_BUILD_PROFILE',
  'STORE_SOURCE_DIRTY',
  'STORE_RELEASE',
];
const CHANNELS = new Set(['telegram', 'rustore', 'google_play', 'development']);

// Capacitor needs a fully static Next export. Server-rendered marketing routes
// belong to the web deployment and must not participate in the mobile bundle.
// The public/static sitemap asset remains available to the website; only the
// getServerSideProps page is parked while `next build` performs the export.
const MOBILE_EXCLUDED_PAGE_PATHS = [
  path.resolve('pages', 'sitemap.xml.ts'),
];

function loadBuildEnv() {
  const loaded = {};
  for (const file of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    if (fs.existsSync(file)) Object.assign(loaded, parseEnv(fs.readFileSync(file, 'utf8')));
  }
  for (const name of BUILD_ENV_NAMES) {
    if (process.env[name] === undefined && typeof loaded[name] === 'string') {
      process.env[name] = loaded[name];
    }
  }
}

function fail(message) {
  console.error(`[build:mobile] ${message}`);
  process.exit(1);
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function validateApiUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail('NEXT_PUBLIC_API_URL must be a valid absolute HTTPS origin.');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname && parsed.pathname !== '/')
  ) {
    fail('NEXT_PUBLIC_API_URL must be a credential-free HTTPS origin without a path, query, or fragment.');
  }
}

function parkServerRenderedPages() {
  const parked = [];
  for (const sourcePath of MOBILE_EXCLUDED_PAGE_PATHS) {
    if (!fs.existsSync(sourcePath)) continue;
    const parkedPath = `${sourcePath}.mobile-excluded`;
    if (fs.existsSync(parkedPath)) {
      fail(`Cannot park ${path.relative(process.cwd(), sourcePath)} because ${path.basename(parkedPath)} already exists.`);
    }
    fs.renameSync(sourcePath, parkedPath);
    parked.push({ sourcePath, parkedPath });
    console.log(`[build:mobile] Excluded server-rendered page ${path.relative(process.cwd(), sourcePath)}.`);
  }
  return parked;
}

function restoreServerRenderedPages(parked) {
  for (const { sourcePath, parkedPath } of [...parked].reverse()) {
    if (!fs.existsSync(parkedPath)) continue;
    fs.renameSync(parkedPath, sourcePath);
  }
}

loadBuildEnv();

const channel = String(process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL || '').trim().toLowerCase();
if (!CHANNELS.has(channel)) {
  fail('Set NEXT_PUBLIC_DISTRIBUTION_CHANNEL to telegram, rustore, google_play, or development before building.');
}

const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || '').trim();
if (!apiUrl) fail('Set NEXT_PUBLIC_API_URL before building; a mobile APK cannot use a relative /api URL.');
validateApiUrl(apiUrl);

const storeProfile = String(process.env.STORE_BUILD_PROFILE || '').trim().toLowerCase();
const storeRelease = enabled(process.env.STORE_RELEASE);
if (storeProfile) {
  if (!['alpha', 'release'].includes(storeProfile)) fail('STORE_BUILD_PROFILE must be alpha or release.');
  if (channel !== 'rustore') fail('STORE_BUILD_PROFILE may only be used with the rustore channel.');
  if (!storeRelease) fail('STORE_RELEASE must be enabled for a RuStore artifact profile.');
  if (!enabled(process.env.NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED)) {
    fail('RuStore artifact profiles require NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED=1.');
  }
}

process.env.MOBILE_BUILD = '1';
process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
process.env.NEXT_PUBLIC_ANDROID_BUILD = '1';

const nextBin = path.resolve('node_modules', 'next', 'dist', 'bin', 'next');
const parkedPages = parkServerRenderedPages();
let result;
try {
  result = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
} finally {
  restoreServerRenderedPages(parkedPages);
}

if (result.error) fail(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);

const outputDirectory = path.resolve('out');
if (!fs.existsSync(outputDirectory)) fail('Next did not produce the static mobile output directory.');

const sourceCommitOverride = [
  process.env.SOURCE_COMMIT,
  process.env.RAILWAY_GIT_COMMIT_SHA,
  process.env.GITHUB_SHA,
].map((value) => String(value || '').trim().toLowerCase()).find((value) => /^[0-9a-f]{40}$/.test(value));
let sourceCommit = sourceCommitOverride || '';
if (!sourceCommit) {
  const sourceRevision = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (sourceRevision.error || sourceRevision.status !== 0) {
    fail('Could not resolve the source commit for the mobile build marker. Set SOURCE_COMMIT in archive-only build environments.');
  }
  sourceCommit = String(sourceRevision.stdout || '').trim().toLowerCase();
}
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) fail('The resolved source commit is invalid.');

const versionCode = String(process.env.APP_VERSION_CODE || (storeProfile ? '' : '1')).trim();
const versionName = String(process.env.APP_VERSION_NAME || (storeProfile ? '' : '1.0.0')).trim();
if (!/^[1-9]\d*$/.test(versionCode)) fail('APP_VERSION_CODE must be a positive integer.');
if (!versionName) fail('APP_VERSION_NAME must not be empty.');
if (storeProfile === 'alpha' && !/^\d+\.\d+\.\d+-rc\.\d+$/.test(versionName)) {
  fail('An alpha RuStore artifact requires APP_VERSION_NAME such as 1.0.0-rc.1.');
}
if (storeProfile === 'release' && !/^\d+\.\d+\.\d+$/.test(versionName)) {
  fail('A public RuStore artifact requires a stable APP_VERSION_NAME such as 1.0.0.');
}

// This is deliberately public and contains no credential: it lets Gradle
// reject stale Capacitor assets that were built for another distribution.
const buildMarker = {
  format: 2,
  mobileBuild: true,
  channel,
  apiOrigin: new URL(apiUrl).origin,
  sourceCommit,
  profile: storeProfile || null,
  sourceDirty: enabled(process.env.STORE_SOURCE_DIRTY),
  versionCode,
  versionName,
};
fs.writeFileSync(
  path.join(outputDirectory, 'nebo-mobile-build.json'),
  `${JSON.stringify(buildMarker)}\n`,
  'utf8',
);
console.log(`[build:mobile] Wrote provenance marker for ${channel}.`);
