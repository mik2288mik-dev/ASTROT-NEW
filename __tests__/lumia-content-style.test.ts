import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  'constants.ts',
  'views',
  'components',
  'services',
  'pages/api/content',
  'lib',
].map((p) => path.join(ROOT, p));

const EXCLUDED_PATH_SNIPPETS = [
  'docs/',
  '__tests__/',
  'lib/migrations.ts',
  'lib/lumiaVoice.ts',
  'lib/notificationEngineRules.ts',
  'lib/rateLimit.ts',
  'lib/errorTracking.ts',
  'lumia 2.0/',
  'pages/api/admin/',
  'pages/api/astrology/',
  'views/admin/',
  'pages/api/content/natal/dive.ts',
  'services/contentGenerationService.ts',
  'services/astrologyService.ts',
  'lib/cache.ts',
  'lib/prompts.ts',
  'lib/natalReading/prompts.ts',
];

const FORBIDDEN_RU: Array<{ label: string; pattern: RegExp }> = [
  { label: 'вселенная подсказывает', pattern: /вселенн[а-яё\s]+подсказывает/i },
  { label: 'судьба', pattern: /\bсудьб[а-яё]*/i },
  { label: 'магия', pattern: /\bмагич/i },
  { label: 'вибрации', pattern: /\bвибрац/i },
  { label: 'сакральный', pattern: /\bсакральн/i },
  { label: 'путь души', pattern: /путь души/i },
  { label: 'глубже', pattern: /\bглубже\b/i },
  { label: 'глубинный', pattern: /\bглубинн/i },
  { label: 'кармический путь', pattern: /кармическ/i },
  { label: 'кринж', pattern: /\bкринж/i },
  { label: 'вайб', pattern: /\bвайб/i },
  { label: 'бомбануть', pattern: /\bбомбан/i },
  { label: 'рекомендуется', pattern: /\bрекомендуется\b/i },
  { label: 'следует избегать', pattern: /следует избегать/i },
  { label: 'следует', pattern: /\bследует\b/i },
  { label: 'благоприятно', pattern: /\bблагоприятн/i },
  { label: 'неблагоприятно', pattern: /\bнеблагоприятн/i },
  { label: 'эмоциональная устойчивость', pattern: /эмоциональн[а-яё\s]+устойчивост/i },
  { label: 'внутренняя трансформация', pattern: /внутренн[а-яё\s]+трансформац/i },
];

const FORBIDDEN_EN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'universe tells', pattern: /universe tells/i },
  { label: 'destiny', pattern: /\bdestiny\b/i },
  { label: 'magic', pattern: /\bmagic\b/i },
  { label: 'mystical energy', pattern: /mystical energy/i },
  { label: 'vibrations', pattern: /\bvibrations\b/i },
  { label: 'sacred', pattern: /\bsacred\b/i },
  { label: 'soul path', pattern: /soul path/i },
  { label: 'deeper', pattern: /\bdeeper\b/i },
  { label: 'deep dive', pattern: /deep dive/i },
  { label: 'cringe', pattern: /\bcringe\b/i },
  { label: 'vibe', pattern: /\bvibe\b/i },
];

const BUREAUCRATIC_RU = FORBIDDEN_RU.filter(({ label }) =>
  ['рекомендуется', 'следует избегать', 'следует', 'благоприятно', 'неблагоприятно', 'эмоциональная устойчивость'].includes(label)
);

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

function findViolations(content: string, rules: Array<{ label: string; pattern: RegExp }>) {
  const hits: string[] = [];
  for (const { label, pattern } of rules) {
    if (pattern.test(content)) hits.push(label);
  }
  return hits;
}

describe('Lumia content style', () => {
  it('docs/LUMIA_CONTENT_STYLE.md exists with required sections', () => {
    const docPath = path.join(ROOT, 'docs', 'LUMIA_CONTENT_STYLE.md');
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, 'utf8');
    expect(content).toContain('## 1. Голос LUMIA');
    expect(content).toContain('## 4. Не сухо');
    expect(content).toContain('## 5. Не эзотерично');
    expect(content).toContain('## 7. Не сленгово');
    expect(content).toContain('## 8. Натальная карта');
    expect(content).toContain('## 9. Отношения');
    expect(content).toContain('## 10. Ask Lumia');
  });

  it('runtime copy avoids forbidden RU phrases', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(dir));
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (isExcluded(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const hits = findViolations(content, FORBIDDEN_RU);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('runtime copy avoids forbidden EN phrases', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(dir));
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (isExcluded(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const hits = findViolations(content, FORBIDDEN_EN);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('runtime copy avoids bureaucratic RU phrasing', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(dir));
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (isExcluded(rel)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const hits = findViolations(content, BUREAUCRATIC_RU);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('lib/lumiaVoice.ts exports voice blocks for prompts', () => {
    const voicePath = path.join(ROOT, 'lib', 'lumiaVoice.ts');
    expect(fs.existsSync(voicePath)).toBe(true);
    const content = fs.readFileSync(voicePath, 'utf8');
    expect(content).toContain('LUMIA_VOICE_BLOCK_EN');
    expect(content).toContain('LUMIA_VOICE_BLOCK_RU');
    expect(content).toContain('appendLumiaVoice');
  });
});
