import fs from 'fs';
import path from 'path';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';
import {
  cardBackgroundStyle,
  getHeroCardBackground,
  getPersonalCardBackground,
  getUniversalCardBackground,
} from '../lib/cardBackgrounds';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('card background library', () => {
  it('documents exactly 30 enabled production assets', () => {
    expect(manifest.assets).toHaveLength(30);
    expect(manifest.assets.every((asset) => asset.enabled)).toBe(true);
    expect(new Set(manifest.assets.map((asset) => asset.id)).size).toBe(30);
  });

  it('returns a stable hero for the same user and day', () => {
    const first = getHeroCardBackground('42', '2026-07-19');
    const second = getHeroCardBackground('42', '2026-07-19');

    expect(first).not.toBeNull();
    expect(second?.id).toBe(first?.id);
    expect(first?.path).toMatch(/^\/assets\/card-backgrounds\/hero\/hero_0[1-5]\.webp$/);
  });

  it('keeps the hero artwork when opening the overview', () => {
    const hero = getHeroCardBackground('42', '2026-07-19');
    const overview = getPersonalCardBackground('overview', '42', '2026-07-19');

    expect(overview?.id).toBe(hero?.id);
  });

  it('uses each topic only from its own image library', () => {
    expect(getPersonalCardBackground('love', '42', '2026-07-19')?.path).toContain('/love_');
    expect(getPersonalCardBackground('money', '42', '2026-07-19')?.path).toContain('/money_');
    expect(getPersonalCardBackground('family', '42', '2026-07-19')?.path).toContain('/home_');
    expect(getPersonalCardBackground('friendship', '42', '2026-07-19')?.path).toContain('/friends_');
    expect(getPersonalCardBackground('communication', '42', '2026-07-19')?.path).toContain('/communication_');
  });

  it('exposes universal product backgrounds and CSS variables', () => {
    const natal = getUniversalCardBackground('natal');
    expect(natal?.path).toBe('/assets/card-backgrounds/universal/universal_natal.webp');
    expect(cardBackgroundStyle(natal)).toEqual({
      '--card-bg-image': 'url("/assets/card-backgrounds/universal/universal_natal.webp")',
      '--card-bg-position': natal?.background_position,
    });
  });
});

describe('card background UI wiring', () => {
  it('connects the library to Dashboard and the personal horoscope cover', () => {
    const dashboard = read('views/Dashboard.tsx');
    const personalDaily = read('views/DailyContentScreens.tsx');
    const app = read('pages/_app.tsx');

    expect(dashboard).toContain('getHeroCardBackground');
    expect(dashboard).toContain('getPersonalCardBackground');
    expect(dashboard).toContain('getUniversalCardBackground');
    expect(dashboard).toContain("heroBackground ? ' has-card-background' : ''");
    expect(dashboard).toContain('style={cardBackgroundStyle(card.background)}');
    expect(personalDaily).toContain('getPersonalCardBackground(activeSection');
    expect(personalDaily).toContain("activeBackground ? ' has-card-background' : ''");
    expect(app).toContain("../styles/cardBackgrounds.css");
  });

  it('does not show a ready-state text CTA inside the clickable hero', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).toContain('const dayHeroCta: string | null');
    expect(dashboard).toContain(': null;');
    expect(dashboard).toContain('{dayHeroCta ? (');
  });
});
