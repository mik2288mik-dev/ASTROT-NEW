import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Dashboard period tabs without redesign', () => {
  it('preserves Today surfaces and loads Week or Month only after the matching tab click', () => {
    const dashboard = read('views/Dashboard.tsx');

    for (const preserved of [
      'StickerScreen',
      'StickerSlot',
      'useDailyQuestionStories',
      'DailyQuestionStoryModal',
      'HomeFaq',
      'home-day-hero',
      'home-sphere-card',
      'home-daily-question-card',
      'home-product-card--natal',
      'home-product-card--compat',
      'home-product-card--matrix',
      'cardBackgroundStyle',
    ]) {
      expect(dashboard).toContain(preserved);
    }

    expect(dashboard).toContain("type HomePeriod = 'today' | 'week' | 'month' | 'year'");
    expect(dashboard).toContain("useState<HomePeriod>('today')");
    expect(dashboard).toContain('tab.id === activePeriod');
    expect(dashboard).toContain('onClick={() => selectPeriod(tab.id)}');
    expect(dashboard).toContain("if (period !== 'today') void loadPeriod(period);");
    expect(dashboard).not.toContain('useEffect(');

    for (const service of [
      'getCachedWeeklySignHoroscope',
      'ensureWeeklySignHoroscope',
      'getCachedMonthlySignHoroscope',
      'ensureMonthlySignHoroscope',
    ]) {
      expect(dashboard).toContain(service);
    }

    expect(dashboard).toContain("activePeriod === 'today'");
    expect(dashboard).toContain('dailyQuestionStories.length');
    expect(dashboard).toContain('periodReading.focus');
    expect(dashboard).toContain('periodReading.chance');
    expect(dashboard).toContain('periodReading.risk');
    expect(dashboard).toContain('periodReading.advice');
    expect(dashboard).toContain('periodReading.context');
  });
});
