import fs from 'fs';
import path from 'path';
import { ZODIAC_KEYS } from '../lib/zodiacKeys';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Horoscope product flow', () => {
  it('keeps the current reader layout, restores Today/Week/Month, and has no inline stickers', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    const picker = read('components/fresh-ui/ZodiacSignGrid.tsx');
    const service = read('services/astrologyService.ts');
    const styles = read('styles/zodiacReader.css');

    expect(ZODIAC_KEYS).toHaveLength(12);
    expect(source).toContain('ZodiacSignGrid');
    expect(source).not.toContain('hasReaderSelection');
    expect(source).toContain('active={sign}');
    expect(source).toContain("normalizeZodiacKey(String(chartData?.sun?.sign || ''))");
    expect(source.indexOf('const calculated =')).toBeLessThan(source.indexOf('calculated || fromBirth'));
    expect(source).toContain("closest<HTMLElement>('.lumia-main-scroll')");
    expect(source).toContain('scrollContainer.scrollTo({');
    expect(source).toContain('pendingReadingScrollRef');
    expect(picker).toContain('signs.map');
    expect(picker).toContain('onClick={() => onPick(sign)}');
    expect(picker).not.toContain('setExpanded');
    expect(picker).toContain('zodiac-sign-picker--persistent');
    expect(source).not.toContain('horo-reader-controls');
    expect(source).toContain('horo-reader-sign-grid');
    expect(source).toContain('horo-reader-period-date');
    expect(source).toContain('horo-reader-article');
    expect(source).toContain('horo-reader-selected-sign');
    expect(source).toContain('ZodiacSymbol');
    expect(source).toContain('horo-reader-headline');
    expect(source).toContain("<AppTopBar title={language === 'ru' ? 'Гороскоп по знакам' : 'Sign horoscope'} />");

    expect(source).toContain("type Period = 'today' | 'week' | 'month';");
    expect(source).toContain("{ id: 'today', label: language === 'ru' ? 'Сегодня' : 'Today' }");
    expect(source).toContain("{ id: 'week', label: language === 'ru' ? 'Неделя' : 'Week' }");
    expect(source).toContain("{ id: 'month', label: language === 'ru' ? 'Месяц' : 'Month' }");
    expect(source).toContain('<FreshTabs');
    expect(source).toContain('activeTab={period}');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('ensureWeeklySignHoroscope');
    expect(source).toContain('ensureMonthlySignHoroscope');
    expect(source).toContain('getCachedWeeklySignHoroscope');
    expect(source).toContain('getCachedMonthlySignHoroscope');

    expect(source).not.toContain('selectZodiacLegacyAsset');
    expect(source).not.toContain('<EditorialSticker');
    expect(source).not.toContain('horo-zodiac-sticker--inline');

    const render = source.slice(source.indexOf('return (', source.indexOf('const hasReadingFailure')));
    expect(render.indexOf('horo-reader-period-date')).toBeLessThan(render.indexOf('<FreshTabs'));
    expect(render.indexOf('<FreshTabs')).toBeLessThan(render.indexOf('horo-reader-selected-sign'));
    expect(render.indexOf('horo-reader-selected-sign')).toBeLessThan(render.indexOf('horo-reader-headline'));
    expect(render.indexOf('horo-reader-headline')).toBeLessThan(render.indexOf('{displayedReading.text}'));
    expect(render.indexOf('{displayedReading.text}')).toBeLessThan(render.indexOf('horo-reader-sign-grid'));

    expect(styles).toContain('.horo-reader-page .horo-uni.horo-reader-article');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(styles).toContain('.horo-reader-page .horo-reader-sign-grid');
    expect(service).toContain("'tvoi-goroskop:sign-horoscope-v4'");
    expect(source).toContain('ZODIAC_KEYS');
    expect(source).toContain('{displayedReading.headline}');
    expect(source).toContain('{displayedReading.text}');
    expect(source).not.toContain('displayedReading.astrology');
    expect(source).not.toContain('AstrologyDetailsToggle');
    expect(source).not.toContain('selectPersonalEditorialAsset');
    expect(source).not.toContain('InfoNote');
    expect(source).not.toContain('horo-reader-personal');
    expect(source).not.toContain('drag=');
    expect(source).not.toContain('loadHumanDailySection');
  });

  it('loads the selected period before background prefetch, restores engagement, and has no zodiac promo banner', () => {
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

  it('keeps all twelve Today signs free and keeps Week/Month on the existing Premium gate', () => {
    const source = read('views/v2/HoroscopeReader.tsx');

    expect(source).toContain("type Period = 'today' | 'week' | 'month';");
    expect(source).toContain("const [period, setPeriod] = useState<Period>('today');");
    expect(source).toContain("period !== 'today'");
    expect(source).toContain("canAccessFeature('weekly_sign_horoscope'");
    expect(source).toContain('Сегодня доступны все 12 знаков бесплатно. Неделя и месяц открываются в Premium.');
    expect(source).not.toContain('FREE_EXTRA_QUOTA');
    expect(source).not.toContain('PREMIUM_EXTRA_QUOTA');
    expect(source).not.toContain('lumia:horo-extra-signs');
    expect(source).not.toContain('lumia:horo-own-opened');
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

  it('keeps sign-period generation on the existing DeepSeek sign-horoscope path', () => {
    const weekly = read('lib/horoscope/signWeekly.ts');
    const monthly = read('lib/horoscope/signMonthly.ts');
    const cache = read('lib/horoscope/signCache.ts');
    const signGeneration = read('lib/horoscope/signGeneration.ts');

    expect(weekly).toContain("getCachedSignHoroscope('week'");
    expect(weekly).toContain("getOrGenerateSignHoroscope('week'");
    expect(monthly).toContain("getCachedSignHoroscope('month'");
    expect(monthly).toContain("getOrGenerateSignHoroscope('month'");
    expect(cache).toContain("return 'sign_weekly_horoscope'");
    expect(cache).toContain("period === 'day' ? 'free' : 'pro'");
    expect(signGeneration).toContain('DeepSeek');
  });
});
