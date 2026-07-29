import fs from 'fs';
import path from 'path';
import { ZODIAC_KEYS } from '../lib/zodiacKeys';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Horoscope product flow', () => {
  it('keeps sign reader distinct from personal daily and opens a selected sign from the 3 by 4 grid', () => {
    const source = read('views/v2/HoroscopeReader.tsx');
    const picker = read('components/fresh-ui/ZodiacSignGrid.tsx');
    const styles = read('styles/zodiacReader.css');
    expect(ZODIAC_KEYS).toHaveLength(12);
    expect(source).toContain('ZodiacSignGrid');
    expect(source).toContain('setHasReaderSelection(true)');
    expect(picker).toContain('signs.map');
    expect(picker).toContain('setExpanded(false)');
    expect(picker).toContain('setExpanded(true)');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(source).toContain('horo-reader-controls');
    expect(source).toContain('horo-reader-article');
    expect(source).toContain('horo-reader-headline');
    expect(styles).toContain('.horo-reader-page .horo-uni.horo-reader-article');
    expect(styles).toContain('background: transparent');
    expect(styles).toContain('transform: none');
    expect(source).toContain('ensureDailySignHoroscope');
    expect(source).toContain('getCachedDailySignHoroscope');
    expect(source).toContain('ensureWeeklySignHoroscope');
    expect(source).toContain('ensureMonthlySignHoroscope');
    expect(source).toContain('ZODIAC_KEYS');
    expect(source).not.toContain('drag=');
    expect(source).not.toContain("style={{ transform: 'rotate(-2deg)' }}");
    expect(source).not.toContain('scrollIntoView');
    expect(source).not.toContain('loadHumanDailySection');
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
    expect(weekly).toContain("content_type = 'sign_weekly_horoscope'");
    expect(weekly).toContain("VALUES ('sign_weekly_horoscope'");
    expect(weekly).not.toContain('user_id =');
    expect(weekly).not.toContain('chart_id =');
  });
});
