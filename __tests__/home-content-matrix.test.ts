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

  it('reads cached sign horoscope on home and leaves generation to the explicit read button', () => {
    const source = read('views/v2/TodayFeed.tsx');
    const dashboard = read('views/Dashboard.tsx');
    expect(source).not.toContain('ensureDailySignHoroscope');
    // Переработанная главная (Dashboard) не встраивает гороскоп знака — он открывается
    // на своём экране по карточке, поэтому здесь не должно быть ни его генерации, ни фетча.
    expect(dashboard).not.toContain('ensureDailySignHoroscope');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(dashboard).not.toContain('getCachedDailySignHoroscope');
    expect(source).toContain('generation starts from the explicit Read button');
    expect(source).toContain('getDailyMotivation');
    expect(source).toContain('getLocalDailyMetrics');
    expect(source).toContain('getPulseDailyMetrics');
  });

  it('shows v2 feed blocks for horoscope, chart, union, and ask', () => {
    const source = read('views/v2/TodayFeed.tsx');
    for (const title of ['LzMetricsBento', 'LzFeedHeroCard', 'LzUnionCompact', 'LzAskPresets', 'Спроси астролога']) {
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
