import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { buildNatalProfileCards } from '../lib/natalProfileCards';
import { renderNatalStoryShareSvg } from '../lib/natalStoryShareRenderer';
import type { NatalChartData, UserProfile } from '../types';

const outDir = path.join(process.cwd(), 'public', 'telegram-previews');

const profile: UserProfile = {
  id: 'preview',
  name: 'LUMIA',
  birthDate: '2000-03-01',
  birthTime: '09:20',
  birthPlace: 'Москва',
  isSetup: true,
  language: 'ru',
  theme: 'light',
  isPremium: true,
};

const chartData: NatalChartData = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 11, longitude: 341, house: 1, description: '' },
  moon: { planet: 'Moon', sign: 'Scorpio', degree: 18, longitude: 228, house: 9, description: '' },
  rising: { planet: 'Ascendant', sign: 'Scorpio', degree: 4, longitude: 214, house: 1, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 26, longitude: 326, house: 4, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 3, longitude: 3, house: 5, description: '' },
  mars: { planet: 'Mars', sign: 'Taurus', degree: 8, longitude: 38, house: 6, description: '' },
  jupiter: { planet: 'Jupiter', sign: 'Gemini', degree: 2, longitude: 62, house: 7, description: '' },
  saturn: { planet: 'Saturn', sign: 'Taurus', degree: 14, longitude: 44, house: 6, description: '' },
  element: 'Water',
  rulingPlanet: 'Neptune',
  timezone: 'Europe/Moscow',
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: index % 2 === 0 ? 'Scorpio' : 'Taurus',
    degree: index,
    longitude: index * 30,
  })),
  aspects: [
    { type: 'trine', angle: 120, orb: 2, from: 'Sun', to: 'Moon' },
    { type: 'square', angle: 90, orb: 3, from: 'Moon', to: 'Mars' },
  ],
  summary: '',
};

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const cards = buildNatalProfileCards({
    profile,
    chartData,
    isPremium: true,
    todayContext: {
      localHour: 14,
      shortText: 'Сегодня лучше выбрать одно главное и пройти день в спокойном темпе.',
      bestWindowLabel: '14:00-16:00: лучший момент для фокуса',
    },
  });
  const picks = [cards[0], cards[2], cards[5]].filter(Boolean);
  for (const [index, card] of picks.entries()) {
    const { svg } = renderNatalStoryShareSvg(card, 'story');
    const file = path.join(outDir, `natal-story-preview-ru-${index + 1}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
