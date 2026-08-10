import fs from 'fs';
import path from 'path';
import { ZODIAC_KEYS } from '../lib/zodiacKeys';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Horoscope product flow', () => {
  it('opens with the forecast above the 12-sign grid and scrolls every manual choice back to the reading', () => {
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
    expect(picker).toContain('ZodiacIllustration');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(source).toContain('horo-reader-controls');
    expect(source).toContain('horo-reader-sign-grid');
    expect(source).toContain('horo-reader-period-date');
    expect(source).toContain('horo-reader-article');
    expect(source).toContain('horo-reader-selected-sign');
    expect(source).toContain('ZodiacSymbol');
    expect(source).toContain('horo-reader-headline');
    expect(source).toContain("<AppTopBar title={language === 'ru' ? 'Гороскоп по знакам' : 'Sign horoscope'} />");
    expect(source).not.toContain("<h1>{language === 'ru' ? 'Гороскоп по знакам' : 'Sign horoscope'}</h1>");
    const render = source.slice(source.indexOf('return (', source.indexOf('const hasReadingFailure')));
    expect(render.indexOf('horo-reader-period-date')).toBeLessThan(render.indexOf('horo-reader-controls'));
    expect(render.indexOf('horo-reader-controls')).toBeLessThan(render.indexOf('horo-reader-selected-sign'));
    expect(render.indexOf('horo-reader-selected-sign')).toBeLessThan(render.indexOf('horo-reader-headline'));
    expect(render.indexOf('horo-reader-headline')).toBeLessThan(render.indexOf('{displayedReading.text}'));
    expect(render.indexOf('{displayedReading.text}')).toBeLessThan(render.indexOf('horo-reader-sign-grid'));
    expect(styles).toContain('.horo-reader-page .horo-uni.horo-reader-article');
    expect(styles).toContain('min-height: 112px');
    expect(styles).toContain('width: 72px');
    expect(service).toContain("'tvoi-goroskop:sign-horoscope-v4'");
    expect(styles).toContain('.horo-reader-page .horo-reader-sign-grid');
    expect(styles).toContain(".horo-reader-page .horo-act-like[data-on='true'] > span:first-child");
    expect(styles).toContain(".horo-reader-page .horo-act-like[data-on='true'] {\n  color: var(--horo-reader-muted);");
    expect(styles).toContain('color: var(--lumia-brand-negative, #e11937);');
    expect(styles).toContain('background: #ffffff');
    expect(styles).toContain('background: #eee3d5');
    expect(styles).toContain('text-align: center');
    expect(styles).toContain('background: transparent');
    expect(styles).toContain('transform: none');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('ensureWeeklySignHoroscope');
    expect(source).toContain('ensureMonthlySignHoroscope');
    expect(source).toContain('ZODIAC_KEYS');
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
    expect(source).not.toContain('drag=');
    expect(source).not.toContain("style={{ transform: 'rotate(-2deg)' }}");
    expect(source).not.toContain('loadHumanDailySection');
  });

  it('loads the selected forecast before background prefetch, restores engagement, and has no zodiac promo banner', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    const app = read('App.tsx');
    const selectedRequest = source.indexOf('const selectedReading = await');
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
    const rateLimits = read('lib/rateLimit.ts');
    const engagementLimit = rateLimits.slice(rateLimits.indexOf('HOROSCOPE_ENGAGEMENT'));
    expect(engagementLimit).toContain('maxRequests: 60');
    expect(horoscopeBranch).not.toContain('<PromoBanner');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(read('pages/api/content/horoscope/sign-daily.ts')).toContain("source: snapshot.stale ? 'stale' : 'cache'");
  });

  it('keeps all twelve Today signs free and never replaces the profile own sign while browsing', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    expect(source).toContain("period !== 'today'");
    expect(source).toContain("canAccessFeature('weekly_sign_horoscope'");
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

  it('caches weekly sign content in shared content_cache scope', () => {
    const weekly = read('lib/horoscope/signWeekly.ts');
    const cache = read('lib/horoscope/signCache.ts');
    expect(weekly).toContain("getCachedSignHoroscope('week'");
    expect(weekly).toContain("getOrGenerateSignHoroscope('week'");
    expect(cache).toContain("return 'sign_weekly_horoscope'");
    expect(cache).toContain("period === 'day' ? 'free' : 'pro'");
    expect(cache).not.toContain('WHERE user_id =');
    expect(cache).not.toContain('WHERE chart_id =');
  });
});
