import fs from 'fs';
import path from 'path';
import { ZODIAC_KEYS } from '../lib/zodiacKeys';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Horoscope product flow', () => {
  it('keeps the 12-sign grid, restores Today/Week/Month, and renders no sticker art in the reading', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    const picker = read('components/fresh-ui/ZodiacSignGrid.tsx');
    const service = read('services/astrologyService.ts');
    const styles = read('styles/zodiacReader.css');

    expect(ZODIAC_KEYS).toHaveLength(12);
    expect(source).toContain('ZodiacSignGrid');
    expect(source).toContain('FreshTabs');
    expect(source).toContain("type Period = 'today' | 'week' | 'month';");
    expect(source).toContain("{ id: 'today', label: language === 'ru' ? 'Сегодня' : 'Today' }");
    expect(source).toContain("{ id: 'week', label: language === 'ru' ? 'Неделя' : 'Week' }");
    expect(source).toContain("{ id: 'month', label: language === 'ru' ? 'Месяц' : 'Month' }");
    expect(source).toContain('activeTab={period}');
    expect(source).toContain('onTabChange={choosePeriod}');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('ensureWeeklySignHoroscope');
    expect(source).toContain('ensureMonthlySignHoroscope');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(source).toContain('getCachedWeeklySignHoroscope');
    expect(source).toContain('getCachedMonthlySignHoroscope');
    expect(source).toContain('getMoscowIsoWeekKey');
    expect(source).toContain('getMoscowMonthKey');
    expect(source).not.toContain('EditorialSticker');
    expect(source).not.toContain('selectZodiacLegacyAsset');
    expect(source).not.toContain('horo-zodiac-sticker--inline');

    expect(source).toContain('active={sign}');
    expect(source).toContain("normalizeZodiacKey(String(chartData?.sun?.sign || ''))");
    expect(source).toContain("closest<HTMLElement>('.lumia-main-scroll')");
    expect(source).toContain('pendingReadingScrollRef');
    expect(picker).toContain('signs.map');
    expect(picker).toContain('onClick={() => onPick(sign)}');
    expect(picker).toContain('zodiac-sign-picker--persistent');
    expect(source).toContain('horo-reader-sign-grid');
    expect(source).toContain('horo-reader-period-date');
    expect(source).toContain('horo-reader-selected-sign');
    expect(source).toContain('ZodiacSymbol');
    expect(source).toContain('horo-reader-headline');
    expect(source).toContain("<AppTopBar title={language === 'ru' ? 'Гороскоп по знакам' : 'Sign horoscope'} />");
    expect(source).toContain('{displayedReading.headline}');
    expect(source).toContain('{displayedReading.text}');
    expect(source).not.toContain('displayedReading.astrology');
    expect(source).not.toContain('AstrologyDetailsToggle');
    expect(source).not.toContain('horo-reader-personal');
    expect(source).not.toContain('loadHumanDailySection');
    expect(styles).toContain('.horo-reader-page .horo-reader-sign-grid');
    expect(service).toContain("'tvoi-goroskop:sign-horoscope-v4'");
  });

  it('loads the selected period before background prefetch and restores engagement', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    const app = read('App.tsx');
    const selectedRequest = source.indexOf('const selectedReading = period');
    const backgroundPrefetch = source.indexOf('void prefetchSignHoroscopePeriod');
    const horoscopeBranchStart = app.indexOf("view === 'horoscope'");
    const horoscopeBranchEnd = app.indexOf("view === 'chart'", horoscopeBranchStart);
    const horoscopeBranch = app.slice(horoscopeBranchStart, horoscopeBranchEnd);

    expect(selectedRequest).toBeGreaterThan(-1);
    expect(backgroundPrefetch).toBeGreaterThan(selectedRequest);
    expect(source).not.toContain('const prefetched = await prefetchSignHoroscopePeriod');
    expect(source).toContain('HoroscopeActivityBar');
    expect(source).toContain('userId={profile.id ? String(profile.id) : undefined}');
    expect(source).toContain('date={displayedEngagementDate}');
    expect(source).toContain('period={displayedPeriod}');
    const activity = read('components/Horoscope/HoroscopeActivityBar.tsx');
    expect(activity).toContain('markHoroscopeView(userId, sign, date, period)');
    expect(read('pages/api/content/horoscope/engagement.ts')).toContain('buildHoroscopeEngagementKey');
    expect(read('pages/api/content/horoscope/reactions.ts')).toContain('buildHoroscopeEngagementKey');
    expect(horoscopeBranch).not.toContain('<PromoBanner');
  });

  it('keeps browsing signs independent from the saved profile sign', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    expect(source).not.toContain('FREE_EXTRA_QUOTA');
    expect(source).not.toContain('PREMIUM_EXTRA_QUOTA');
    expect(source).not.toContain('lumia:horo-extra-signs');
    expect(source).not.toContain('selectedZodiacSign: normalized');
    expect(source).not.toContain('saveProfile(updated)');
  });

  it('exposes Zodiac and keeps Ask out of bottom tabs', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    expect(tabs).toContain("id: 'zodiac'");
    expect(tabs).toContain("active: view === 'horoscope'");
    expect(tabs).not.toContain("id: 'ask'");
    expect(tabs).not.toContain("active: view === 'oracle'");
    expect(tabs).toContain("'dashboard', 'horoscope', 'chart', 'synastry', 'settings'");
  });

  it('keeps weekly and monthly sign content on their dedicated DeepSeek-backed routes', () => {
    const service = read('services/astrologyService.ts');
    expect(service).toContain('/api/content/horoscope/sign-weekly');
    expect(service).toContain('/api/content/horoscope/sign-monthly');
    expect(read('pages/api/content/horoscope/sign-weekly.ts')).toBeTruthy();
    expect(read('pages/api/content/horoscope/sign-monthly.ts')).toBeTruthy();
  });
});
