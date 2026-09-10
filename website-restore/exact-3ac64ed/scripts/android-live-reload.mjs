import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const bundledJavaHome = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const detectedAndroidHome = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  : undefined;
const androidHome = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? detectedAndroidHome;
const nativeEnvironment = {
  ...process.env,
  ...(process.env.JAVA_HOME || !existsSync(bundledJavaHome) ? {} : { JAVA_HOME: bundledJavaHome }),
  ...(process.env.ANDROID_HOME || !androidHome ? {} : { ANDROID_HOME: androidHome }),
  ...(process.env.ANDROID_SDK_ROOT || !androidHome ? {} : { ANDROID_SDK_ROOT: androidHome }),
};

function run(command, args, options = {}) {
  return spawn(command, args, { stdio: 'inherit', ...options });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function waitForDevServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:3000');
      if (response.ok || response.status < 500) return;
    } catch {
      // The Next development server is still starting.
    }
    await delay(500);
  }
  throw new Error('The Android development server did not start on port 3000.');
}

const devServer = run(npm, ['run', 'dev:android']);
let stopping = false;

function stopDevServer() {
  if (!stopping) {
    stopping = true;
    devServer.kill();
  }
}

process.once('SIGINT', stopDevServer);
process.once('SIGTERM', stopDevServer);

try {
  await waitForDevServer();
  const runResult = await waitForExit(run(npx, [
    'cap', 'run', 'android',
    '--live-reload',
    '--host', 'localhost',
    '--port', '3000',
    '--forwardPorts', '3000:3000',
  ], {
    env: { ...nativeEnvironment, CAPACITOR_LIVE_RELOAD: '1' },
  }));

  if (runResult !== 0) process.exitCode = runResult;
  else console.log('\nLive Reload is active. Keep this window open while editing; press Ctrl+C when finished.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (process.exitCode && process.exitCode !== 0) stopDevServer();
}
