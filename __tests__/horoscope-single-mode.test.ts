import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('horoscope single-card navigation', () => {
  it('Dashboard quick action cards open focused horoscope layers', () => {
    const source = read('views/Dashboard.tsx');

    expect(source).toContain("openHoroscope('sign', { mode: 'single', source: 'home_card_today' })");
    expect(source).toContain("openHoroscope('love', { mode: 'single', source: 'home_card_love' })");
    expect(source).toContain(
      "openHoroscope('work_money', { mode: 'single', dailySectionKey: 'daily_money', source: 'home_card_money' })"
    );
    expect(source).toContain(
      "openHoroscope('work_money', { mode: 'single', dailySectionKey: 'daily_work_business', source: 'home_card_work' })"
    );
    expect(source).toContain(
      "openHoroscope('work_money', { mode: 'single', dailySectionKey: 'daily_goals', source: 'home_card_goals' })"
    );
    expect(source).toContain("openHoroscope('chart', { mode: 'single', source: 'home_card_rhythm' })");
    expect(source).not.toContain('prefetchHomeCardLayer');
    expect(source).not.toContain('prefetchAllHomeCardDailyContent');
  });

  it('App stores horoscope openMode and dailySectionKey and passes them to Horoscope', () => {
    const source = read('App.tsx');

    expect(source).toContain("useState<HoroscopeOpenMode>('overview')");
    expect(source).toContain('useState<HoroscopeDailySectionKey | undefined>(undefined)');
    expect(source).toContain('const mode = options?.mode ?? \'overview\'');
    expect(source).toContain('setHoroscopeOpenMode(mode)');
    expect(source).toContain('setHoroscopeDailySectionKey(options?.dailySectionKey)');
    expect(source).toContain('openMode={horoscopeOpenMode}');
    expect(source).toContain('dailySectionKey={horoscopeDailySectionKey}');
    expect(source).not.toContain('prefetchHomeCardLayer');
  });

  it('Horoscope single mode renders only the selected layer', () => {
    const source = read('views/Horoscope.tsx');

    expect(source).toContain("openMode = 'overview'");
    expect(source).toContain("const isSingleMode = openMode === 'single'");
    expect(source).toContain("isSingleMode ? layers.filter((layer) => layer.id === initialLayer) : layers");
    expect(source).toContain('visibleLayers.map((layer, index)');
    expect(source).not.toContain('layers.map((layer, index)');
    expect(source).toContain('data-horoscope-open-mode={openMode}');
    expect(source).toContain('data-horoscope-layer={layer.id}');
  });

  it('Horoscope routes money and work cards to different daily sections', () => {
    const source = read('views/Horoscope.tsx');

    expect(source).toContain('dailySectionKey?: HoroscopeDailySectionKey');
    expect(source).toContain("if (layer === 'work_money') return dailySectionKey ?? 'daily_work_business'");
    expect(source).toContain('daily_money');
    expect(source).toContain('HUMAN_DAILY_SECTION_META');
  });

  it('Horoscope opens daily cards through cache-first safe refill', () => {
    const source = read('views/Horoscope.tsx');

    expect(source).toContain('getCachedHumanDailySection');
    expect(source).toContain('getCachedFullDaypartForecast');
    expect(source).toContain('loadHumanDailySection');
    expect(source).toContain('ensureFullDaypartForecast');
    expect(source).toContain('maxInProgressRetries: 45');
    expect(source).not.toContain('ensureDailySignHoroscope');
    expect(source).not.toMatch(/Повторить|Try again|Готовим|Вернись/);
  });

  it('Horoscope single mode keeps Premium CTA and no one-off Stars copy', () => {
    const source = read('views/Horoscope.tsx');
    const lockedLayerBlock = source.match(/const renderLockedLayer[\s\S]*?const renderSignSlide/)?.[0] ?? '';

    expect(lockedLayerBlock).toContain('Open in Premium');
    expect(source).not.toMatch(/Открыть за .*Stars|open .*Stars|one-off/i);
    expect(source).not.toContain('requestStarsOneOffPayment');
  });
});
