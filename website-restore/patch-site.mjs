import { readFileSync, writeFileSync } from 'node:fs';

function replaceExact(path, from, to) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(from)) {
    throw new Error(`[website-restore] expected text not found in ${path}`);
  }
  writeFileSync(path, source.replace(from, to), 'utf8');
}

replaceExact(
  'components/public-site/PublicSiteShell.tsx',
  '  formatPublicationDate,\n',
  '',
);

replaceExact(
  'components/public-site/PublicSiteShell.tsx',
  '<p className={styles.eyebrow}>{PUBLIC_SITE_SEO.siteName}{legalReady ? ` · редакция от ${formatPublicationDate()}` : \'\'}</p>',
  '<p className={styles.eyebrow}>{PUBLIC_SITE_SEO.siteName}</p>',
);

replaceExact(
  'pages/support.tsx',
  'title="Поддержка NEBO — помощь по аккаунту и оплате"',
  'title="Поддержка NEBO"',
);

console.log('[website-restore] pre-regression visual snapshot applied');
