import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const remove = [
  'pages/api',
  'pages/auth',
  'pages/index.tsx',
];

for (const relative of remove) {
  const target = path.join(root, relative);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
  cwd: root,
  env: {
    ...process.env,
    MEOU_PUBLIC_SITE: '1',
    NEXT_PUBLIC_MEOU_PUBLIC_SITE: '1',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
