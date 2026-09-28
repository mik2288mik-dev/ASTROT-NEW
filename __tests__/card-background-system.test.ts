import fs from 'fs';
import path from 'path';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';
import {
  cardBackgroundStyle,
  getUniversalCardBackground,
} from '../lib/cardBackgrounds';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('card background library', () => {
  it('keeps the enabled forecast visual inventory documented', () => {
    expect(manifest.assets).toHaveLength(30);
    expect(manifest.assets.every((asset) => asset.enabled)).toBe(true);
    expect(new Set(manifest.assets.map((asset) => asset.id)).size).toBe(30);
  });

  it('adds three original no-cat illustrated variants for every product', () => {
    for (const theme of ['natal', 'compatibility', 'matrix']) {
      for (const variant of ['01', '02', '03']) {
        const file = `public/assets/card-backgrounds/products/${theme}_${variant}.svg`;
        expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
        expect(read(file)).toContain('<svg');
      }
    }
  });

  it('returns a stable rotating product background and CSS variables', () => {
    const natal = getUniversalCardBackground('natal', '42', '2026-07-19');
    const sameNatal = getUniversalCardBackground('natal', '42', '2026-07-19');

    expect(natal?.path).toMatch(/^\/assets\/card-backgrounds\/products\/natal_0[1-3]\.svg$/);
    expect(sameNatal?.id).toBe(natal?.id);
    expect(cardBackgroundStyle(natal)).toEqual({
      '--card-bg-image': `url("${natal?.path}")`,
      '--card-bg-position': natal?.background_position,
    });
  });
});

describe('card background UI wiring', () => {
  it('keeps retired sticker systems out of active product screens', () => {
    const dashboard = read('views/Dashboard.tsx');
    const todayFeed = read('components/PersonalForecastFeed/TodayEditorialFeed.tsx');
    const sectionBlock = read('components/PersonalForecastFeed/ForecastSectionBlock.tsx');
    const natal = read('views/v2/NatalMagazine.tsx');
    const compatibility = read('views/v2/UnionRoom.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');

    expect(dashboard).not.toContain('personalForecastVisuals');
    expect(todayFeed).not.toContain('EditorialSticker');
    expect(todayFeed).not.toContain('ForecastEndEditorialVisual');
    expect(sectionBlock).not.toContain('ForecastEndEditorialVisual');
    expect(natal).not.toContain('selectNatalEditorialSticker');
    expect(compatibility).not.toContain('selectSynastryEditorialSticker');
    expect(matrix).not.toContain('EditorialSticker');
  });

  it('does not generate a hero CTA or hook', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).not.toMatch(/heroCta|heroHook|hero_hook/i);
  });
});
