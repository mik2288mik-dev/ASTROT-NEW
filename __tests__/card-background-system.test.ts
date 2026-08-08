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
  it('connects newspaper visuals without restoring heavy product backgrounds', () => {
    const dashboard = read('views/Dashboard.tsx');
    const visuals = read('lib/personalForecastVisuals.ts');
    const sectionBlock = read('components/PersonalForecastFeed/ForecastSectionBlock.tsx');
    const promotion = read('components/PersonalForecastFeed/ForecastPromotion.tsx');
    const promoBanner = read('components/PromoBanner.tsx');
    const feedStyles = read('styles/personalForecastFeed.css');
    const natal = read('views/v2/NatalMagazine.tsx');
    const compatibility = read('views/v2/UnionRoom.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');
    const app = read('pages/_app.tsx');

    expect(visuals).toContain('selectMainEditorialSticker');
    expect(visuals).toContain('resolvePersonalForecastVisuals');
    expect(visuals).toContain("'--forecast-section-image'");
    expect(visuals).toContain("'--forecast-section-position-mobile'");
    expect(dashboard).toContain('resolvePersonalForecastVisuals');
    expect(dashboard).toContain('forecastSectionVisualStyle');
    expect(dashboard).toContain('visual?.assignments[section.id]');
    expect(sectionBlock).toContain("hasVisual ? 'has-visual' : 'has-visual-fallback'");
    expect(sectionBlock).toContain('style={style}');
    expect(promotion).toContain('<PromoBanner');
    expect(promoBanner).toContain('selectPromoBanner');
    expect(promoBanner).toContain('loading="lazy"');
    expect(promoBanner).toContain('data-banner-shape={shape}');
    expect(promoBanner).toContain('data-banner-layout={layout}');
    expect(feedStyles).toContain("data-banner-shape='compact'");
    expect(feedStyles).toContain('.forecast-feed-promo-pair');
    expect(feedStyles).toContain('aspect-ratio: 4 / 3');
    expect(feedStyles).toContain('object-fit: contain');
    expect(dashboard).not.toMatch(
      /\bresolveForecastVisualScreen\b|\bbuildForecastVisualRequests\b|\bforecastVisualStyle\b/,
    );
    expect(dashboard).not.toMatch(/home-day-hero|home-sphere-card|pd-reading-card/);
    expect(natal).toContain('selectNatalEditorialSticker');
    expect(natal).toContain('editorialSticker={natalSticker}');
    expect(compatibility).toContain('selectSynastryEditorialSticker');
    expect(compatibility).toContain('<EditorialSticker');
    expect(matrix).not.toContain('selectMainEditorialSticker');
    expect(matrix).not.toContain('EditorialSticker');
    expect(natal).not.toContain('getUniversalCardBackground');
    expect(compatibility).not.toContain('getUniversalCardBackground');
    expect(matrix).not.toContain('getUniversalCardBackground');
    expect(app).toContain("../styles/homeContentHierarchy.css");
    expect(app).toContain("../styles/readingBackgrounds.css");
    expect(app).toContain("../styles/personalForecastFeed.css");
    expect(app).toContain("../styles/newspaperVisual.css");
  });

  it('does not generate a hero CTA or hook', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).not.toMatch(/heroCta|heroHook|hero_hook/i);
  });
});
