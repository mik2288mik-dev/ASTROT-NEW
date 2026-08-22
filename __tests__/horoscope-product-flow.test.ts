import fs from 'fs';
import path from 'path';
import { ZODIAC_KEYS } from '../lib/zodiacKeys';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Horoscope product flow', () => {
  it('keeps the 12-sign grid, restores Today/Week/Month, and renders no sticker art in the reading', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    const picker = read('components/lumia-ui/v2/LzSignPickerSheet.tsx');
    const service = read('services/astrologyService.ts');
    const styles = read('styles/editorialStudio.css');

    expect(ZODIAC_KEYS).toHaveLength(12);
    expect(source).toContain('LzSignPickerSheet');
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

    expect(source).toContain("normalizeZodiacKey(String(chartData?.sun?.sign || ''))");
    expect(source).toContain("closest<HTMLElement>('.lumia-main-scroll')");
    expect(source).toContain('pendingReadingScrollRef');
    expect(source).toContain('className="horo-reader-sign-trigger"');
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain('aria-expanded={signPickerOpen}');
    expect(source).toContain('setSignPickerOpen(true)');
    expect(source).toContain('variant="editorial"');
    expect(source).toContain('onPick={chooseSign}');
    expect(source).toContain('onClose={() => setSignPickerOpen(false)}');
    expect(picker).toContain('CosmicSheet');
    expect(picker).toContain('ZODIAC_KEYS.map');
    expect(picker).toContain('onPick(sign);');
    expect(picker).toContain('onClose();');
    expect(picker).toContain('lz-sign-grid-editorial');
    expect(picker).toContain('ZodiacIcon');
    expect(source).toContain('horo-reader-period-date');
    expect(source).toContain('horo-reader-sign-range');
    expect(source).toContain('ZodiacSymbol');
    expect(source).toContain('horo-reader-headline');
    expect(source).toContain("title={language === 'ru' ? 'Гороскоп по знакам' : 'Sign horoscope'}");
    expect(source).toContain('{displayedReading.headline}');
    expect(source).toContain('{displayedReading.text}');
    expect(source).not.toContain("'Общий фон'");
    expect(source).not.toContain("'Общение'");
    expect(source).not.toContain("'Дела'");
    expect(source).not.toContain("'Вечер'");
    expect(source).not.toContain('displayedReading.astrology');
    expect(source).not.toContain('AstrologyDetailsToggle');
    expect(source).not.toContain('selectZodiacEditorialSticker');
    expect(source).not.toContain('InfoNote');
    expect(source).not.toContain('horo-reader-personal');
    expect(source).not.toContain('loadHumanDailySection');
    expect(styles).toContain('.horo-reader-sign-trigger');
    expect(styles).toContain('.lz-sheet-panel--editorial');
    expect(styles).toContain('.lz-sign-grid-editorial');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(styles).toContain('.lz-sign-cell-editorial');
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
    expect(activity).toContain('reactionRequestVersion.current');
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
    expect(tabs).toContain('data-nav-id="zodiac"');
    expect(tabs).toContain("aria-current={view === 'horoscope' ? 'page' : undefined}");
    expect(tabs).not.toContain('data-nav-id="ask"');
    expect(tabs).not.toContain("activeSheet === 'hub'");
    expect(tabs).not.toContain('Спросить астролога');
    expect(tabs).toContain('onClick={() => runNavigationAction(onOpenNatal)}');
    expect(tabs).toContain('LUMIA_BOTTOM_NAV_VIEWS');
    expect(tabs).toContain("'matrix'");
    expect(tabs).toContain("'encyclopedia'");
    expect(tabs).toContain("'charts'");
    expect(tabs).toContain('shouldShowLumiaBottomNavigation(view)');
  });

  it('keeps weekly and monthly sign content on their dedicated DeepSeek-backed routes', () => {
    const service = read('services/astrologyService.ts');
    expect(service).toContain('/api/content/horoscope/sign-weekly');
    expect(service).toContain('/api/content/horoscope/sign-monthly');
    expect(read('pages/api/content/horoscope/sign-weekly.ts')).toBeTruthy();
    expect(read('pages/api/content/horoscope/sign-monthly.ts')).toBeTruthy();
  });
});
