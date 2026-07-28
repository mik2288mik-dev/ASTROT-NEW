import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

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
