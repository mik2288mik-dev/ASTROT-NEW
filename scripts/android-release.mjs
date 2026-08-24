#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const SHARED_ANDROID_AUTH_ENV_NAMES = [
  'YANDEX_AUTH_CLIENT_ID',
  'VK_AUTH_CLIENT_ID',
  'VK_ID_ANDROID_CLIENT_SECRET',
];

function loadAndroidAuthEnv(channel) {
  const names = channel === 'google_play'
    ? ['GOOGLE_AUTH_CLIENT_ID', ...SHARED_ANDROID_AUTH_ENV_NAMES]
    : SHARED_ANDROID_AUTH_ENV_NAMES;
  const providedByShell = new Set(names.filter((name) => process.env[name]));
  const loaded = {};
  for (const file of ['.env', '.env.local']) {
    if (fs.existsSync(file)) Object.assign(loaded, parseEnv(fs.readFileSync(file, 'utf8')));
  }
  for (const name of names) {
    if (!providedByShell.has(name) && typeof loaded[name] === 'string') process.env[name] = loaded[name];
  }
}

const target = process.argv[2];
const tasks = {
  'rustore-apk': ['assembleRustoreRelease', 'android/app/build/outputs/apk/rustore/release/app-rustore-release.apk'],
  'rustore-aab': ['bundleRustoreRelease', 'android/app/build/outputs/bundle/rustoreRelease/app-rustore-release.aab'],
  'google-play-aab': ['bundleGooglePlayRelease', 'android/app/build/outputs/bundle/googlePlayRelease/app-google-play-release.aab'],
};
if (!tasks[target]) {
  console.error('Usage: node scripts/android-release.mjs rustore-apk|rustore-aab|google-play-aab');
  process.exit(1);
}
const channel = target.startsWith('rustore') ? 'rustore' : 'google_play';
loadAndroidAuthEnv(channel);
process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = channel;
process.env.MOBILE_BUILD = '1';
process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
process.env.STORE_RELEASE = '1';

function run(command, args, cwd = process.cwd(), useShell = process.platform === 'win32') {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: useShell, env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}

run(process.execPath, ['scripts/validate-store-release.mjs', '--release'], process.cwd(), false);
run('npm', ['run', 'build:mobile']);
run('npx', ['cap', 'sync', 'android']);
const [task, output] = tasks[target];
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [task], path.join(process.cwd(), 'android'));
const artifact = path.join(process.cwd(), output);
if (!fs.existsSync(artifact)) {
  console.error(`Expected artifact was not created: ${artifact}`);
  process.exit(1);
}
const sha256 = createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
console.log(`Artifact: ${artifact}`);
console.log(`SHA-256: ${sha256}`);
