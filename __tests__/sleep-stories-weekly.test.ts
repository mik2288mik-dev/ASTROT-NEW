import fs from 'fs';
import path from 'path';

jest.mock('../lib/db', () => ({ getPool: jest.fn() }));
jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: jest.fn(), OPENAI_LUNA_MODEL: 'test-model' }));
jest.mock('../lib/tts/ttsStore', () => ({ ensureAudio: jest.fn() }));
jest.mock('../lib/stories/repository', () => ({ storyGenerationEnabled: jest.fn(() => true) }));

import { checkWeeklyStory, cleanStoryText, moscowWeekKey, weeklyPlan } from '../lib/sleepStoriesWeekly';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('weekly bedtime stories', () => {
  it('names the week in Moscow time', () => {
    expect(moscowWeekKey(new Date('2026-10-07T12:00:00Z'))).toBe('2026-W41');
    // Sunday evening UTC is already Monday in Moscow, so it belongs to the next week.
    expect(moscowWeekKey(new Date('2026-10-11T22:30:00Z'))).toBe('2026-W42');
    expect(moscowWeekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
  });

  it('plans a different story every week, a daytime one every third week', () => {
    const plans = Array.from({ length: 12 }, (_, index) => weeklyPlan(`2026-W${String(index + 10).padStart(2, '0')}`));
    expect(plans.filter((plan) => plan.kind === 'calm').length).toBe(4);
    expect(new Set(plans.map((plan) => plan.theme)).size).toBe(12);
    expect(weeklyPlan('2026-W41')).toEqual(weeklyPlan('2026-W41'));
  });

  it('removes long dashes and markup, and rejects short or esoteric texts', () => {
    expect(cleanStoryText('Тихо — и тепло. **Дыши**')).toBe('Тихо, и тепло. Дыши');
    const paragraph = 'Ты сидишь у окна и слушаешь, как тихо шумит дождь. Вода стекает по стеклу. '.repeat(3).trim();
    const good = { title: 'Тихая баня', teaser: 'В бане тепло и спокойно', text: Array.from({ length: 10 }, () => `${paragraph} ${paragraph}`).join('\n\n') };
    expect(checkWeeklyStory(good)).toEqual([]);
    expect(checkWeeklyStory({ ...good, text: 'Коротко.' })).toEqual(expect.arrayContaining([expect.stringMatching(/^words:/)]));
    expect(checkWeeklyStory({ ...good, text: `${good.text}\n\nЭто твоя судьба и энергия.` })).toContain('banned');
  });

  it('is wired end to end: list API, audio lookup, scheduler and the show-more button', () => {
    expect(read('pages/api/sleep-stories/index.ts')).toContain('listWeeklySleepStories');
    expect(read('pages/api/audio/listen.ts')).toContain('findWeeklySleepStory');
    expect(read('instrumentation.node.ts')).toContain('scheduleWeeklySleepStory');
    const sounds = read('views/v2/SoundsRoom.tsx');
    expect(sounds).toContain('STORIES_PAGE = 5');
    expect(sounds).toContain('Показать ещё');
    expect(sounds).toContain('loadWeeklySleepStories');
  });
});
