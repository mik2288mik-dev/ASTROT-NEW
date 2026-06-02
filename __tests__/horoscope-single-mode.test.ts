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
    expect(source).toContain("openHoroscope('work_money', { mode: 'single', source: 'home_card_money' })");
    expect(source).toContain("openHoroscope('work_money', { mode: 'single', source: 'home_card_work' })");
    expect(source).toContain("openHoroscope('chart', { mode: 'single', source: 'home_card_rhythm' })");
  });

  it('App stores horoscope openMode and passes it to Horoscope', () => {
    const source = read('App.tsx');

    expect(source).toContain("useState<HoroscopeOpenMode>('overview')");
    expect(source).toContain('const mode = options?.mode ?? \'overview\'');
    expect(source).toContain('setHoroscopeOpenMode(mode)');
    expect(source).toContain('openMode={horoscopeOpenMode}');
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

  it('Horoscope single mode keeps Premium CTA and no one-off Stars copy', () => {
    const source = read('views/Horoscope.tsx');
    const lockedLayerBlock = source.match(/const renderLockedLayer[\s\S]*?const renderSignSlide/)?.[0] ?? '';

    expect(lockedLayerBlock).toContain('Open in Premium');
    expect(source).not.toMatch(/Открыть за .*Stars|open .*Stars|one-off/i);
    expect(source).not.toContain('requestStarsOneOffPayment');
  });
});
