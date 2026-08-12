import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

const ANDROID_AUTH_ENV_NAMES = [
  'YANDEX_AUTH_CLIENT_ID',
  'VK_AUTH_CLIENT_ID',
  'VK_ID_ANDROID_CLIENT_SECRET',
];

function loadAndroidAuthEnv() {
  const providedByShell = new Set(ANDROID_AUTH_ENV_NAMES.filter((name) => process.env[name]));
  const loaded = {};
  for (const file of ['.env', '.env.local']) {
    if (fs.existsSync(file)) Object.assign(loaded, parseEnv(fs.readFileSync(file, 'utf8')));
  }
  for (const name of ANDROID_AUTH_ENV_NAMES) {
    if (!providedByShell.has(name) && typeof loaded[name] === 'string') process.env[name] = loaded[name];
  }
}

loadAndroidAuthEnv();

const androidDirectory = path.resolve('android');
const wrapper = path.join(androidDirectory, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL || 'development';
const result = spawnSync(wrapper, ['assembleDevelopmentDebug'], {
  cwd: androidDirectory,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`[android:debug] ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
