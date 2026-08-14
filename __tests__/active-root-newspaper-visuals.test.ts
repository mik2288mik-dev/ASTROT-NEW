import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('active root visual contract', () => {
  it('keeps the personal horoscope as one clean reading without visible evidence', () => {
    const dashboard = read('views/Dashboard.tsx');
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const styles = read('styles/aiPersonalHoroscope.css');

    expect(dashboard).toContain('<AiPersonalHoroscopeReading');
    expect(dashboard).not.toContain('AstrologyDetailsToggle');
    expect(reading).not.toContain('explanationAnchors');
    expect(reading).not.toContain('inlineAstroAccent');
    expect(reading).toContain('ai-personal-horoscope-opening');
    expect(reading).toContain('ai-personal-horoscope-forecast');
    expect(reading).toContain('ai-personal-horoscope-advice');
    expect(styles).toContain('background: #ffffff;');
  });

  it('scopes the white paper skin to every active non-v2 root', () => {
    const roots = {
      'views/Dashboard.tsx': 'forecast-feed-page',
      'views/Settings.tsx': 'settings-editorial-page',
      'views/MyCharts.tsx': 'charts-editorial-page',
      'views/Onboarding.tsx': 'onboarding-editorial-page',
      'views/AuthGate.tsx': 'auth-editorial-page',
      'views/Paywall.tsx': 'pw2',
    };

    for (const [file, rootClass] of Object.entries(roots)) {
      expect(read(file)).toContain(rootClass);
    }

    const styles = read('styles/newspaperVisual.css');
    expect(styles).toContain('--news-paper: var(--app-canvas)');
    expect(styles).toContain('--news-action: #1478ff');
    expect(styles).not.toContain('--news-action: #1d1d1b');
    expect(styles).toContain('.forecast-feed-page .forecast-feed-status button');
    expect(styles).toContain('background: var(--news-action) !important');
    expect(styles).not.toMatch(/\.lumia-bottom-(?:nav|bar)/);
  });

  it('removes old diary sticker planning from the active personal horoscope', () => {
    const dashboard = read('views/Dashboard.tsx');
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const onboarding = read('views/Onboarding.tsx');

    expect(dashboard).not.toContain('resolvePersonalForecastVisuals');
    expect(dashboard).not.toContain('resolveDiaryEditorialPauses');
    expect(dashboard).not.toContain('resolveDiaryTodayVisualPlan');
    expect(reading).not.toContain('EditorialSticker');
    expect(onboarding).not.toContain('selectPersonalEditorialAsset');
    expect(onboarding).not.toContain('selectZodiacLegacyAsset');
    expect(onboarding).not.toContain('EditorialSticker');
    expect(onboarding).not.toContain('Math.random');
  });
});
