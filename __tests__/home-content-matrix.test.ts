import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('compact content-matrix home', () => {
  it('does not require chart setup and only fetches personal home for chart plus premium', () => {
    const source = read('views/v2/TodayFeed.tsx');
    expect(source).toContain('hasNatalChart');
    expect(source).toContain('hasChart && premium');
    expect(source).not.toContain('profile.isSetup');
    expect(source).not.toContain('getPremiumNatalFullLayer');
    expect(source).not.toContain('loadHumanPaidSection');
  });

  it('loads sign horoscope and local daily motivation on home', () => {
    const source = read('views/v2/TodayFeed.tsx');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(source).toContain('getDailyMotivation');
    expect(source).toContain('getLocalDailyMetrics');
    expect(source).toContain('getPulseDailyMetrics');
  });

  it('shows v2 feed blocks for horoscope, chart, union, and ask', () => {
    const source = read('views/v2/TodayFeed.tsx');
    for (const title of ['LzMetricsBento', 'LzFeedHeroCard', 'LzUnionCompact', 'LzAskPresets', 'Спроси Lumia']) {
      expect(source).toContain(title);
    }
    expect(source).toContain('onOpenHoroscopeLayer');
    expect(source).toContain('onOpenOracle');
  });

  it('sends Telegram initData headers for every human POST', () => {
    const source = read('services/natalReadingService.ts');
    const postHuman = source.slice(source.indexOf('async function postHuman'), source.indexOf('async function getHuman'));
    expect(postHuman).toContain("headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }");
    const astrology = read('services/astrologyService.ts');
    const todayHome = astrology.slice(astrology.indexOf('export const getTodayAssistantHome'), astrology.indexOf('export const submitTodayCheckIn'));
    expect(todayHome).toContain("headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }");
  });
});
