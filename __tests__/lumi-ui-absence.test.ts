import fs from 'fs';
import path from 'path';

const UI_ROOTS = [
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

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Lumi Wallet', pattern: /Lumi Wallet/i },
  { label: 'Пополнить Lumi', pattern: /Пополнить Lumi/i },
  { label: 'Открыть за Lumi', pattern: /Открыть за .* Lumi/i },
  { label: 'Недостаточно Lumi', pattern: /Недостаточно Lumi/i },
  { label: 'profile.lumiBalance in UI', pattern: /profile\.lumiBalance/ },
  { label: 'onOpenWallet', pattern: /onOpenWallet/ },
  { label: "view === 'wallet'", pattern: /view\s*===\s*['"]wallet['"]/ },
  { label: 'requestLumiPackPayment', pattern: /requestLumiPackPayment/ },
  { label: 'import Wallet', pattern: /from ['"].*\/Wallet['"]/ },
  { label: 'DailyLumiWheelCard', pattern: /DailyLumiWheelCard/ },
  { label: 'DailyLumiTasksCard', pattern: /DailyLumiTasksCard/ },
];

describe('user-facing UI has no Lumi wallet/product currency', () => {
  for (const relativePath of UI_ROOTS) {
    it(`does not expose Lumi wallet patterns in ${relativePath}`, () => {
      const absolutePath = path.join(process.cwd(), relativePath);
      expect(fs.existsSync(absolutePath)).toBe(true);
      const content = fs.readFileSync(absolutePath, 'utf8');

      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        expect({ file: relativePath, label, match: content.match(pattern)?.[0] }).toEqual({
          file: relativePath,
          label,
          match: undefined,
        });
      }
    });
  }
});
