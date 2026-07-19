import fs from 'fs';
import path from 'path';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';
import {
  cardBackgroundStyle,
  getDailyQuestionCardBackground,
  getHeroCardBackground,
  getPersonalCardBackground,
  getUniversalCardBackground,
} from '../lib/cardBackgrounds';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('card background library', () => {
  it('keeps the original 30 enabled daily assets documented', () => {
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

  it('adds three original no-cat illustrated variants for every product', () => {
    for (const theme of ['natal', 'compatibility', 'matrix']) {
      for (const variant of ['01', '02', '03']) {
        const file = `public/assets/card-backgrounds/products/${theme}_${variant}.svg`;
        expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
        expect(read(file)).toContain('<svg');
      }
    }
  });

  it('adds three illustrated variants for every premium Today question', () => {
    for (const theme of ['advantage', 'conversation', 'attention']) {
      for (const variant of ['01', '02', '03']) {
        const file = `public/assets/card-backgrounds/questions/question_${theme}_${variant}.svg`;
        expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
        expect(read(file)).toContain('<svg');
      }
      const first = getDailyQuestionCardBackground(theme as 'advantage' | 'conversation' | 'attention', '42', '2026-07-19');
      const second = getDailyQuestionCardBackground(theme as 'advantage' | 'conversation' | 'attention', '42', '2026-07-19');
      expect(first?.id).toBe(second?.id);
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
  it('connects the library to Dashboard, premium stories, and expanded destination covers', () => {
    const dashboard = read('views/Dashboard.tsx');
    const personalDaily = read('views/DailyContentScreens.tsx');
    const natal = read('views/v2/NatalMagazine.tsx');
    const compatibility = read('views/Synastry.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');
    const app = read('pages/_app.tsx');

    expect(dashboard).toContain('getHeroCardBackground');
    expect(dashboard).toContain('getPersonalCardBackground');
    expect(dashboard).toContain('getUniversalCardBackground');
    expect(dashboard).toContain('buildDailyQuestionStories');
    expect(dashboard).toContain('daily-question-story');
    expect(dashboard).toContain("onRequestPremium?.('daily_questions')");
    expect(dashboard).toContain('home-product-card--natal');
    expect(dashboard).toContain('home-product-card--compat');
    expect(dashboard).toContain('home-product-card--matrix');
    expect(personalDaily).toContain('getPersonalCardBackground(activeSection');
    expect(personalDaily).toContain("activeBackground ? ' has-card-background' : ''");
    expect(natal).toContain("getUniversalCardBackground('natal'");
    expect(compatibility).toContain("getUniversalCardBackground('compatibility'");
    expect(matrix).toContain("getUniversalCardBackground('matrix'");
    expect(app).toContain("../styles/homeContentHierarchy.css");
    expect(app).toContain("../styles/readingBackgrounds.css");
  });

  it('does not show a ready-state text CTA inside the clickable hero', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).toContain('const dayHeroCta: string | null');
    expect(dashboard).toContain(': null;');
    expect(dashboard).toContain('{dayHeroCta ? (');
  });
});
