import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

const ANDROID_AUTH_ENV_NAMES = [
  'GOOGLE_AUTH_CLIENT_ID',
  'YANDEX_ANDROID_CLIENT_ID',
  'VK_ANDROID_CLIENT_ID',
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

function configuredAndroidAuthValue(name) {
  const value = String(process.env[name] || '').trim();
  return value
    && !/_REQUIRED/i.test(value)
    && !/^your[_-]/i.test(value)
    && !/^replace-with/i.test(value)
    && value !== '0';
}

const missingAndroidAuth = [
  'YANDEX_ANDROID_CLIENT_ID',
  'VK_ANDROID_CLIENT_ID',
  'VK_ID_ANDROID_CLIENT_SECRET',
].filter((name) => !configuredAndroidAuthValue(name));
if (missingAndroidAuth.length) {
  console.error(
    `[android:debug] Refusing to create an APK with broken native sign-in. Set ${missingAndroidAuth.join(', ')}.`,
  );
  process.exit(1);
}

const androidDirectory = path.resolve('android');
const wrapper = path.join(androidDirectory, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const bundledJavaHome = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const detectedAndroidHome = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  : undefined;
const androidHome = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? detectedAndroidHome;
const channel = String(process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL || 'development').trim().toLowerCase();
if (channel !== 'development') {
  console.error('[android:debug] DevelopmentDebug must use NEXT_PUBLIC_DISTRIBUTION_CHANNEL=development. Use an android:*:apk/aab release command for a store channel.');
  process.exit(1);
}
process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'development';
process.env.MOBILE_BUILD = '1';
process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
const nativeEnvironment = {
  ...process.env,
  ...(process.env.JAVA_HOME || !fs.existsSync(bundledJavaHome) ? {} : { JAVA_HOME: bundledJavaHome }),
  ...(process.env.ANDROID_HOME || !androidHome ? {} : { ANDROID_HOME: androidHome }),
  ...(process.env.ANDROID_SDK_ROOT || !androidHome ? {} : { ANDROID_SDK_ROOT: androidHome }),
};
function run(command, args, cwd = process.cwd(), shell = process.platform === 'win32') {
  const result = spawnSync(command, args, {
    cwd,
    env: nativeEnvironment,
    stdio: 'inherit',
    shell,
  });

  if (result.error) {
    console.error(`[android:debug] ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Build and sync in the same environment as Gradle. Otherwise an old or
// channel-less web bundle can be packaged into a newly compiled APK.
run('npm', ['run', 'build:mobile']);
run('npx', ['cap', 'sync', 'android']);
run(wrapper, ['assembleDevelopmentDebug'], androidDirectory);
