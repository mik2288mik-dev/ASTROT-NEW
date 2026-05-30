import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const UI_SCAN_DIRS = ['views', 'components'].map((p) => path.join(ROOT, p));

const EXCLUDED_PATH_SNIPPETS = [
  'views/admin/',
  'views/AdminPanel.tsx',
  '__tests__/',
  'docs/',
];

const FORBIDDEN_UI_PHRASES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Открыть за Stars', pattern: /Открыть за .* Stars/i },
  { label: 'разово за Stars', pattern: /разово за Stars/i },
  { label: 'Разовое открытие', pattern: /Разовое открытие/i },
  { label: 'Stars payment', pattern: /Stars payment/i },
  { label: 'one-off', pattern: /\bone-off\b/i },
  { label: 'unlock with Stars', pattern: /unlock with Stars/i },
  { label: 'Открыть полный день за Stars', pattern: /Открыть полный день за .* Stars/i },
  { label: 'Открыть полный ответ за Stars', pattern: /Открыть полный ответ за .* Stars/i },
];

const FORBIDDEN_UI_IMPORTS = [
  'requestStarsOneOffPayment',
  'askLumiaWithStarsPayment',
  'getFullDaypartForecastWithStarsPayment',
];

const FORBIDDEN_UI_CALLS = [
  /allowLumiSpend\s*:\s*true/,
  /loadPaid\([^,]+,\s*true\)/,
  /openPaidSection\([^,]+,\s*true\)/,
  /openDailyPaidSection\([^,]+,\s*true\)/,
];

function collectFiles(target: string, out: string[] = []): string[] {
  if (!fs.existsSync(target)) return out;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (/\.(tsx?|jsx?)$/.test(target)) out.push(target);
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

describe('Premium-only product model', () => {
  it('runtime UI avoids one-off Stars purchase copy', () => {
    const files = UI_SCAN_DIRS.flatMap((dir) => collectFiles(dir));
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (isExcluded(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_UI_PHRASES.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('UI does not import deprecated one-off Stars payment helpers', () => {
    const files = UI_SCAN_DIRS.flatMap((dir) => collectFiles(dir));
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (isExcluded(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_UI_IMPORTS.filter((token) => content.includes(token));
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('UI does not call allowLumiSpend / paid unlock shortcuts', () => {
    const files = UI_SCAN_DIRS.flatMap((dir) => collectFiles(dir));
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (isExcluded(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_UI_CALLS.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('Horoscope locked layers route non-premium users to Premium CTA', () => {
    const source = fs.readFileSync(path.join(ROOT, 'views', 'Horoscope.tsx'), 'utf8');
    expect(source).toContain('Открыть в Premium');
    expect(source).not.toContain('requestStarsOneOffPayment');
    expect(source).not.toMatch(/Открыть за .* Stars/i);
  });

  it('OracleChat routes post-free users to Premium', () => {
    const source = fs.readFileSync(path.join(ROOT, 'views', 'OracleChat.tsx'), 'utf8');
    expect(source).toContain('state_need_premium');
    expect(source).not.toContain('requestStarsOneOffPayment');
    expect(source).not.toMatch(/Открыть за .* Stars/i);
  });

  it('Natal unlock sheets are Premium-only', () => {
    const humanReport = fs.readFileSync(path.join(ROOT, 'components', 'NatalReading', 'HumanReport.tsx'), 'utf8');
    const storyDeck = fs.readFileSync(path.join(ROOT, 'components', 'NatalReading', 'NatalStoryDeck.tsx'), 'utf8');
    expect(humanReport).not.toContain('onStarsOpen');
    expect(humanReport).not.toMatch(/Открыть за .* Stars/i);
    expect(storyDeck).not.toContain('onStarsOpen');
    expect(storyDeck).not.toMatch(/loadPaid\([^,]+,\s*true\)/);
  });
});
