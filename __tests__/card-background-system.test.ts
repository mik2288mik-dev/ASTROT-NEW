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
  it('connects the forecast resolver and product backgrounds to their screens', () => {
    const dashboard = read('views/Dashboard.tsx');
    const personalForecast = read('views/PersonalForecastScreen.tsx');
    const natal = read('views/v2/NatalMagazine.tsx');
    const compatibility = read('views/Synastry.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');
    const app = read('pages/_app.tsx');

    expect(dashboard).toContain('resolveForecastVisualScreen');
    expect(dashboard).toContain('buildForecastVisualRequests');
    expect(dashboard).toContain('getUniversalCardBackground');
    expect(dashboard).toContain('home-product-card--natal');
    expect(dashboard).toContain('home-product-card--compat');
    expect(dashboard).toContain('home-product-card--matrix');
    expect(personalForecast).toContain('resolveForecastVisualScreen');
    expect(personalForecast).toContain('forecastVisualStyle');
    expect(natal).toContain("getUniversalCardBackground('natal'");
    expect(compatibility).toContain("getUniversalCardBackground('compatibility'");
    expect(matrix).toContain("getUniversalCardBackground('matrix'");
    expect(app).toContain("../styles/homeContentHierarchy.css");
    expect(app).toContain("../styles/readingBackgrounds.css");
  });

  it('does not generate a hero CTA or hook', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).not.toMatch(/heroCta|heroHook|hero_hook/i);
  });
});
