import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = ['views', 'components', 'services', 'pages/api', 'lib'].map((p) => path.join(ROOT, p));

const EXCLUDED_PATH_SNIPPETS = [
  'views/admin/',
  'views/AdminPanel.tsx',
  'pages/api/admin/',
  'pages/api/astrology/',
  'lib/migrations.ts',
  '__tests__/',
  'docs/',
  'lib/migrations.ts',
  'lib/db.ts',
  'lib/starsPaymentVerify.ts',
  'services/premiumService.ts',
  'constants.ts',
];

const FORBIDDEN_PHRASES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Открыть за Stars', pattern: /Открыть за .* Stars/i },
  { label: 'разово за Stars', pattern: /разово за Stars/i },
  { label: 'Разовое открытие', pattern: /Разовое открытие/i },
  { label: 'Stars payment for content', pattern: /Stars payment.*unlock|unlock.*Stars payment/i },
  { label: 'one-off purchase', pattern: /\bone-off\b.*(?:unlock|purchase|Stars|Lumi)/i },
  { label: 'unlock with Stars', pattern: /unlock with Stars/i },
  { label: 'Открыть полный день за Stars', pattern: /Открыть полный день за .* Stars/i },
  { label: 'Открыть полный ответ за Stars', pattern: /Открыть полный ответ за .* Stars/i },
];

const FORBIDDEN_SYMBOLS = [
  'requestStarsOneOffPayment',
  'askLumiaWithStarsPayment',
  'getFullDaypartForecastWithStarsPayment',
  'ask_lumia_one_off',
  'forecast_full_day',
  'natal_human_section',
  'natal_human_daily',
  'synastry_full',
  'allowStarsUnlock',
  'starsContentUnlock',
  'STARS_PAYMENT_REQUIRED',
  'STARS_PAYMENT_PENDING',
];

const FORBIDDEN_PATTERNS = [
  /allowLumiSpend\s*:\s*true/,
  /loadPaid\([^,]+,\s*true\)/,
  /accessTier:\s*['"]stars['"]/,
  /accessTier:\s*['"]lumi['"]/,
  /accessTier\?:\s*['"]premium['"]\s*\|\s*['"]stars['"]/,
];

const ALLOWED_PREMIUM_PAYMENT = [
  'premium_week',
  'requestStarsPayment',
  'PREMIUM_WEEK_STARS',
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
  const runtimeFiles = SCAN_DIRS.flatMap((dir) => collectFiles(dir)).filter((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    return !isExcluded(rel);
  });

  it('runtime code avoids one-off Stars purchase copy', () => {
    const violations: string[] = [];

    for (const file of runtimeFiles) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_PHRASES.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('runtime code does not reference removed one-off symbols', () => {
    const violations: string[] = [];

    for (const file of runtimeFiles) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_SYMBOLS.filter((token) => content.includes(token));
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('runtime code does not use stars/lumi access tiers or paid unlock shortcuts', () => {
    const violations: string[] = [];

    for (const file of runtimeFiles) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source);
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
    }

    expect(violations).toEqual([]);
  });

  it('Premium Telegram Stars payment rail remains available', () => {
    const telegramService = fs.readFileSync(path.join(ROOT, 'services', 'telegramService.ts'), 'utf8');
    const invoiceCatalog = fs.readFileSync(path.join(ROOT, 'lib', 'starsInvoiceCatalog.ts'), 'utf8');
    for (const token of ALLOWED_PREMIUM_PAYMENT) {
      expect(telegramService.includes(token) || invoiceCatalog.includes(token)).toBe(true);
    }
  });

  it('Personal forecast premium content opens Premium in place from the continuous feed', () => {
    const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    const dashboard = fs.readFileSync(path.join(ROOT, 'views', 'Dashboard.tsx'), 'utf8');
    const sectionBlock = fs.readFileSync(
      path.join(ROOT, 'components', 'PersonalForecastFeed', 'ForecastSectionBlock.tsx'),
      'utf8',
    );
    const todayFeed = fs.readFileSync(
      path.join(ROOT, 'components', 'PersonalForecastFeed', 'TodayEditorialFeed.tsx'),
      'utf8',
    );

    expect(dashboard).toContain('const requestPremium = useCallback');
    expect(dashboard).toContain("onRequestPremium?.('personal_forecast_feed'");
    expect(dashboard).toContain("returnView: 'dashboard'");
    expect(dashboard).toContain("returnScrollAnchor: displayPeriod === 'day'");
    expect(dashboard).toContain('onRequestPremium={requestPremium}');
    expect(dashboard).not.toContain("phase: 'needs_premium'");
    expect(dashboard).not.toContain("!premium && activePeriod !== 'day'");
    expect(dashboard).not.toContain('is-premium-required');
    expect(dashboard).toContain('sections={storySections}');
    expect(dashboard).toContain('lockedSectionIds={lockedIds}');
    expect(todayFeed).toContain('resolveTodayPremiumTeaserInsertion');
    expect(todayFeed).toContain('id="today-premium-teaser"');
    expect(dashboard).toContain('accessContextRef.current !== requestContextKey');
    expect(dashboard).toContain("loadPeriod(activePeriod, { retry: true })");
    expect(sectionBlock).toContain('section.lockedPreview');
    expect(sectionBlock).toContain("locked ? 'is-locked' : ''");
    expect(sectionBlock).toContain('forecast-feed-locked-blur');
    expect(sectionBlock).toMatch(
      /className="forecast-feed-locked-teaser"[\s\S]*?onClick=\{onRequestPremium\}/,
    );
    expect(sectionBlock).toContain('forecast-feed-premium-cta');
    expect(sectionBlock).toContain('onClick={onRequestPremium}');
    expect(sectionBlock).toContain('Unlock with Premium');
    expect(app).toContain("'purchase_succeeded'");
    expect(app).toContain('setPremiumContinuation(destination.shouldOpenFeature ? context : null)');
    expect(app).toContain('setView(destination.view)');
    expect(`${dashboard}\n${todayFeed}\n${sectionBlock}`).not.toContain('requestStarsOneOffPayment');
  });

  it('removed Oracle chat runtime instead of routing it through payments', () => {
    expect(fs.existsSync(path.join(ROOT, 'views', 'OracleChat.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'pages', 'api', 'content', 'question', 'ask.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'pages', 'api', 'content', 'question', 'history.ts'))).toBe(false);
  });

  it('Natal unlock sheets are Premium-only', () => {
    const humanReport = fs.readFileSync(path.join(ROOT, 'components', 'NatalReading', 'HumanReport.tsx'), 'utf8');
    const storyDeck = fs.readFileSync(path.join(ROOT, 'components', 'NatalReading', 'NatalStoryDeck.tsx'), 'utf8');
    expect(humanReport).not.toContain('onStarsOpen');
    expect(storyDeck).not.toContain('onStarsOpen');
    expect(storyDeck).not.toMatch(/loadPaid\([^,]+,\s*true\)/);
  });
});
