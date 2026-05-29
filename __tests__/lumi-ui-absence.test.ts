import fs from 'fs';
import path from 'path';

const USER_FACING_RUNTIME_FILES = [
  'App.tsx',
  'views/Dashboard.tsx',
  'views/Settings.tsx',
  'views/MyCharts.tsx',
  'views/OracleChat.tsx',
  'views/Horoscope.tsx',
  'views/Synastry.tsx',
  'views/NatalChart.tsx',
  'components/NatalReading/HumanReport.tsx',
  'components/NatalReading/NatalStoryDeck.tsx',
  'components/lumia-ui/LumiaBottomTabBar.tsx',
];

const NOTIFICATION_ROUTE_FILES = [
  'lib/notificationSlotCatalog.ts',
  'lib/notificationEngineRules.ts',
];

const FORBIDDEN_UI_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Lumi Wallet', pattern: /Lumi Wallet/i },
  { label: 'Пополнить Lumi', pattern: /Пополнить Lumi/i },
  { label: 'Открыть за Lumi', pattern: /Открыть за .* Lumi/i },
  { label: 'Недостаточно Lumi', pattern: /Недостаточно Lumi/i },
  { label: 'profile.lumiBalance in UI', pattern: /profile\.lumiBalance/ },
  { label: 'onOpenWallet', pattern: /onOpenWallet/ },
  { label: "view === 'wallet'", pattern: /view\s*===\s*['"]wallet['"]/ },
  { label: 'view=wallet', pattern: /view=wallet/ },
  { label: 'requestLumiPackPayment', pattern: /requestLumiPackPayment/ },
  { label: 'import Wallet', pattern: /from ['"].*\/Wallet['"]/ },
  { label: 'DailyLumiWheelCard', pattern: /DailyLumiWheelCard/ },
  { label: 'DailyLumiTasksCard', pattern: /DailyLumiTasksCard/ },
  { label: 'getLumiWallet', pattern: /getLumiWallet/ },
  { label: 'getLumiBalance', pattern: /getLumiBalance/ },
  { label: 'completeDailyLumiTask', pattern: /completeDailyLumiTask/ },
  { label: 'processDailyLogin', pattern: /processDailyLogin/ },
  { label: 'buyChartSlot', pattern: /buyChartSlot/ },
  { label: '/api/users/lumi client call', pattern: /\/api\/users\/lumi/ },
  { label: '/api/users/daily-login client call', pattern: /\/api\/users\/daily-login/ },
  { label: 'buy-slot action', pattern: /buy-slot/ },
];

function readFile(relativePath: string): string {
  const absolutePath = path.join(process.cwd(), relativePath);
  expect(fs.existsSync(absolutePath)).toBe(true);
  return fs.readFileSync(absolutePath, 'utf8');
}

describe('user-facing UI has no Lumi wallet/product currency', () => {
  for (const relativePath of USER_FACING_RUNTIME_FILES) {
    it(`does not expose Lumi patterns in ${relativePath}`, () => {
      const content = readFile(relativePath);

      for (const { label, pattern } of FORBIDDEN_UI_PATTERNS) {
        expect({ file: relativePath, label, match: content.match(pattern)?.[0] }).toEqual({
          file: relativePath,
          label,
          match: undefined,
        });
      }
    });
  }

  for (const relativePath of NOTIFICATION_ROUTE_FILES) {
    it(`does not deep-link to wallet from ${relativePath}`, () => {
      const content = readFile(relativePath);
      expect(content).not.toMatch(/view=wallet/);
      expect(content).not.toMatch(/['"]wallet['"]/);
    });
  }
});

describe('notification slot catalog defaults', () => {
  it('does not default any slot to wallet view', () => {
    const { NOTIFICATION_SLOT_CONFIG } = require('../lib/notificationSlotCatalog');
    for (const config of Object.values(NOTIFICATION_SLOT_CONFIG) as Array<{ targetView: string }>) {
      expect(config.targetView).not.toBe('wallet');
    }
  });
});
