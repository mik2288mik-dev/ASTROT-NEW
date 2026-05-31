import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = ['lib', 'pages/api', 'services', 'views', 'components', 'docs'].map((p) =>
  path.join(ROOT, p)
);

const SCAN_FILES = ['constants.ts', 'types.ts'].map((rel) => path.join(ROOT, rel));

const EXCLUDED_PATH_SNIPPETS = [
  'node_modules',
  '.next',
  'coverage',
  '__tests__',
  'lib/migrations.ts',
  'views/admin/',
  'views/AdminPanel.tsx',
  'pages/api/admin/',
  'pages/api/astrology/',
];

const PAYMENT_FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'one-off Stars', pattern: /\bone-off Stars\b/i },
  { label: 'one-off Lumi', pattern: /\bone-off Lumi\b/i },
  { label: 'Stars unlock', pattern: /\bStars unlock\b/i },
  { label: 'Lumi unlock', pattern: /\bLumi unlock\b/i },
  { label: 'unlock за Stars', pattern: /unlock за Stars/i },
  { label: 'unlock за Lumi', pattern: /unlock за Lumi/i },
  { label: 'Premium или Stars', pattern: /Premium или Stars/i },
  { label: 'разовое открытие', pattern: /разовое открытие/i },
  { label: 'купить отдельный прогноз', pattern: /купить отдельн(?:ый|ого) прогноз/i },
  { label: 'collect Lumi', pattern: /\bcollect Lumi\b/i },
  { label: 'daily Lumi reward', pattern: /\bdaily Lumi reward\b/i },
  { label: 'Забери Lumi', pattern: /Забери Lumi/i },
  { label: 'requestStarsOneOffPayment', pattern: /requestStarsOneOffPayment/ },
  { label: 'STARS_PAYMENT_REQUIRED', pattern: /STARS_PAYMENT_REQUIRED/ },
  { label: 'allowStarsUnlock', pattern: /allowStarsUnlock/ },
];

const COPY_FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Premium replaces free', pattern: /Premium replaces free/i },
  { label: 'Premium only horoscope', pattern: /Premium only horoscope/i },
  { label: 'гороскоп только Premium', pattern: /гороскоп только Premium/i },
  { label: 'доступно только Premium', pattern: /доступно только Premium/i },
  { label: 'купить прогноз', pattern: /купить прогноз/i },
  { label: 'открыть за Stars', pattern: /открыть за Stars/i },
  { label: 'открыть за Lumi', pattern: /открыть за Lumi/i },
  { label: 'без Premium ничего', pattern: /без Premium ничего/i },
];

const DOC_ALLOW_LINE = /removed|удален|deprecated|no longer|not supported|не использ|legacy|historical|changelog|one-off content purchases removed/i;

function collectFiles(target: string, out: string[] = []): string[] {
  if (!fs.existsSync(target)) return out;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (/\.(tsx?|jsx?|md)$/.test(target)) out.push(target);
    return out;
  }
  for (const entry of fs.readdirSync(target)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    collectFiles(path.join(target, entry), out);
  }
  return out;
}

function isExcluded(rel: string): boolean {
  return EXCLUDED_PATH_SNIPPETS.some((snippet) => rel.includes(snippet.replace(/\\/g, '/')));
}

function scanForbiddenPatterns(
  files: string[],
  patterns: Array<{ label: string; pattern: RegExp }>,
  options?: { allowDocDeprecation?: boolean }
): string[] {
  const violations: string[] = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (const { label, pattern } of patterns) {
      if (pattern.test(content)) {
        if (options?.allowDocDeprecation && rel.startsWith('docs/')) {
          const badLines = lines.filter((line) => pattern.test(line) && !DOC_ALLOW_LINE.test(line));
          if (badLines.length === 0) continue;
          violations.push(`${rel}: ${label}`);
          continue;
        }
        violations.push(`${rel}: ${label}`);
      }
    }
  }

  return violations;
}

describe('product model guard', () => {
  const runtimeFiles = [
    ...SCAN_DIRS.flatMap((dir) => collectFiles(dir)),
    ...SCAN_FILES.filter((file) => fs.existsSync(file)),
  ].filter((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    return !isExcluded(rel);
  });

  it('blocks legacy one-off Stars and Lumi payment patterns', () => {
    const violations = scanForbiddenPatterns(runtimeFiles, PAYMENT_FORBIDDEN, {
      allowDocDeprecation: true,
    });
    expect(violations).toEqual([]);
  });

  it('blocks copy that implies Premium replaces Free or daily is premium-only', () => {
    const userFacingFiles = runtimeFiles.filter((file) => {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      return !rel.startsWith('docs/');
    });
    const violations = scanForbiddenPatterns(userFacingFiles, COPY_FORBIDDEN);
    expect(violations).toEqual([]);
  });

  describe('forecast additive architecture', () => {
    it('serves forecast/daily on the free access tier without premiumRequired', () => {
      const source = fs.readFileSync(path.join(ROOT, 'pages/api/content/forecast/daily.ts'), 'utf8');
      expect(source).not.toMatch(/PREMIUM_REQUIRED/);
      expect(source).not.toMatch(/premiumRequired:\s*true/);
      expect(source).toMatch(/accessTier:\s*['"]free['"]/);
      expect(source).toMatch(/contentVariant:\s*['"]daily['"]/);
    });

    it('requires Premium for forecast/daypart layers', () => {
      const source = fs.readFileSync(path.join(ROOT, 'pages/api/content/forecast/daypart.ts'), 'utf8');
      expect(source).toMatch(/PREMIUM_REQUIRED/);
      expect(source).toMatch(/premiumRequired:\s*true/);
    });

    it('builds premium weekly fallback on top of the free weekly baseline', () => {
      const source = fs.readFileSync(path.join(ROOT, 'lib/forecastContent.ts'), 'utf8');
      expect(source).toMatch(/buildFreeWeeklyFallback/);
      expect(source).toMatch(/buildPremiumWeeklyFallback[\s\S]*\.\.\.base/);
    });
  });
});
