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
];
const CHANNELS = new Set(['telegram', 'rustore', 'google_play', 'development']);

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

loadBuildEnv();

const channel = String(process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL || '').trim().toLowerCase();
if (!CHANNELS.has(channel)) {
  fail('Set NEXT_PUBLIC_DISTRIBUTION_CHANNEL to telegram, rustore, google_play, or development before building.');
}

const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || '').trim();
if (!apiUrl) fail('Set NEXT_PUBLIC_API_URL before building; a mobile APK cannot use a relative /api URL.');
validateApiUrl(apiUrl);

process.env.MOBILE_BUILD = '1';
process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';

const nextBin = path.resolve('node_modules', 'next', 'dist', 'bin', 'next');
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);
