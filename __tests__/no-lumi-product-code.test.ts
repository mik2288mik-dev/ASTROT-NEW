import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = ['views', 'components', 'services', 'pages/api', 'lib', 'App.tsx'].map((p) =>
  path.join(ROOT, p)
);

const ALLOWED_PATH_SNIPPETS = [
  'lumia-',
  'Lumia',
  'LUMIA',
  'lumia_',
  'accessTier',
  'legacy',
  'migration',
  'contentAccessTier',
  'contentArchitecture',
  'canRegenerateForLumi',
  'regenerationCostLumi',
  'lumiSpent',
  'lumi_consent',
  'state_lumi',
  'error_lumi',
  'send_lumi',
  'lumi_cta',
  'daily_lumi',
  'segment_lumi',
  'metric_lumi',
  'sort_lumi',
  'invalid_lumi',
  'update_lumi',
  'add_lumi',
  'subtract_lumi',
  'adminText',
  'notificationSlotCatalog',
  'notificationEngineRules',
  'adminNotificationSeedCatalog',
];

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Wallet.tsx import', pattern: /views\/Wallet\.tsx|from ['"].*\/Wallet['"]/ },
  { label: 'components/lumi import', pattern: /components\/lumi\/|from ['"].*\/lumi\/Daily/ },
  { label: 'Lumi Wallet UI text', pattern: /Lumi Wallet|Кошелёк Lumi|Пополнить Lumi/ },
  { label: 'Daily Lumi UI text', pattern: /Daily Lumi|Ежедневн(?:ый|ое) .*Lumi|Lumi wheel|колесо Lumi/ },
  { label: 'requestLumiPackPayment', pattern: /requestLumiPackPayment/ },
  { label: 'getLumiWallet', pattern: /getLumiWallet/ },
  { label: 'getLumiBalance', pattern: /getLumiBalance/ },
  { label: 'processDailyLogin', pattern: /processDailyLogin/ },
  { label: 'completeDailyLumiTask', pattern: /completeDailyLumiTask/ },
  { label: 'buyChartSlot', pattern: /buyChartSlot/ },
  { label: '/api/users/lumi', pattern: /\/api\/users\/lumi/ },
  { label: '/api/users/daily-login', pattern: /\/api\/users\/daily-login/ },
  { label: 'profile.lumiBalance', pattern: /profile\.lumiBalance/ },
  { label: 'lumiPacks service', pattern: /lumiPacks/ },
  { label: 'lumiService', pattern: /lumiService/ },
  { label: 'lumi_wallet constants key', pattern: /lumi_wallet:/ },
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

function isAllowed(rel: string, content: string, match: string): boolean {
  if (ALLOWED_PATH_SNIPPETS.some((snippet) => rel.includes(snippet) || match.includes(snippet))) {
    return true;
  }
  if (rel.includes('__tests__')) return true;
  if (rel.includes('constants.ts') && /state_lumi|error_lumi|lumi_cta|send_lumi/.test(match)) return true;
  return false;
}

describe('no Lumi product/runtime code', () => {
  it('has no forbidden Lumi economy references in client/runtime sources', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(dir));
    const violations: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');

      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        const m = content.match(pattern);
        if (m && !isAllowed(rel, content, m[0])) {
          violations.push(`${label} in ${rel}: ${m[0]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('removed dead Lumi economy files and endpoints', () => {
    const mustNotExist = [
      'views/Wallet.tsx',
      'services/lumiPacks.ts',
      'services/lumiService.ts',
      'services/chartSlotService.ts',
      'lib/lumiDeprecatedResponse.ts',
      'pages/api/users/lumi/index.ts',
      'pages/api/users/daily-login.ts',
      'components/lumi',
    ];

    for (const rel of mustNotExist) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(false);
    }
  });
});
