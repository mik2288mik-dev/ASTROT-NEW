import { existsSync, rmSync, writeFileSync } from 'node:fs';
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

// The Android/WebView application has a large global style/runtime surface.
// Replace _app only inside this ephemeral Docker build so the public website
// ships its own minimal runtime instead of mobile app CSS and diagnostics.
writeFileSync(
  path.join(root, 'pages/_app.tsx'),
  `import type { AppProps } from 'next/app';\nimport Head from 'next/head';\nimport '../styles/PublicWebsiteBase.css';\nimport { PublicAnalytics } from '../components/public-site/PublicAnalytics';\n\nexport default function PublicWebsiteApp({ Component, pageProps }: AppProps) {\n  return (\n    <>\n      <Head>\n        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n        <meta name="theme-color" content="#070707" />\n      </Head>\n      <PublicAnalytics />\n      <Component {...pageProps} />\n    </>\n  );\n}\n`,
  'utf8',
);

const env = {
  ...process.env,
  MEOU_PUBLIC_SITE: '1',
  NEXT_PUBLIC_MEOU_PUBLIC_SITE: '1',
};

const build = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
  cwd: root,
  env,
  stdio: 'inherit',
});

if (build.error) throw build.error;
if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1);

const audit = spawnSync(process.execPath, [path.join(root, 'scripts/audit-public-seo.mjs')], {
  cwd: root,
  env,
  stdio: 'inherit',
});

if (audit.error) throw audit.error;
process.exit(audit.status ?? 1);
