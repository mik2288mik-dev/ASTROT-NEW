import { episodeAccess, releasedEpisodeNumbers } from '../lib/stories/access';
import { buildEpisodePrompt, checkEpisodeConsistency, episodeBeat, parseWrittenEpisode, type WrittenEpisode } from '../lib/stories/episodeWriter';
import { findStorySeries, STORY_SERIES } from '../lib/stories/series';
import { storyGenerationEnabled } from '../lib/stories/repository';
import { DEFAULT_NATIVE_NOTIFICATION_SETTINGS, planNativeNotifications } from '../lib/nativeNotificationPolicy';

const series = findStorySeries('quiet-lane')!;
const paragraph = 'Вера Соколова открыла магазин рано утром, когда переулок ещё спал, и долго смотрела на мокрые камни за окном. Тима принёс кофе и рассказал, что ночью у рынка кто-то оставил странные следы. ';

function episode(overrides: Partial<WrittenEpisode> = {}): WrittenEpisode {
  const hook = 'На пороге лежал конверт без подписи, и внутри была фотография этого самого переулка.';
  return {
    title: 'Следы у рынка',
    text: `${paragraph.repeat(25)}\n\n${hook}`,
    summary: 'Вера и Тима находят странные следы у рынка.',
    facts: ['У рынка появились следы', 'Вера получила конверт'],
    hook,
    charactersUsed: ['Вера Соколова', 'Тимофей Зуев'],
    newCharacters: [],
    ...overrides,
  };
}

describe('story series', () => {
  it('has four genres with bibles, narrators and story lines', () => {
    expect(STORY_SERIES.map((item) => item.genre)).toEqual(['detective', 'romance', 'scifi', 'comedy']);
    expect(new Set(STORY_SERIES.map((item) => item.narrator)).size).toBe(4);
    for (const item of STORY_SERIES) {
      expect(item.characters.length).toBeGreaterThanOrEqual(4);
      expect(item.arcs.every((arc) => arc.beats.length >= 3)).toBe(true);
    }
  });

  it('builds each episode on the bible and on what already happened', () => {
    expect(episodeBeat(series, 1).arc).toBe('Анонимные письма');
    expect(episodeBeat(series, 2).arc).toBe('Маленькие дела недели');
    expect(episodeBeat(series, 4).beat).toContain('Второе письмо');
    const prompt = buildEpisodePrompt(series, 3, [
      { number: 1, title: 'Конверт', summary: 'Вера получила старую фотографию.', facts: ['Письмо пришло без марки'] },
      { number: 2, title: 'Книга', summary: 'Пропала редкая книга.', facts: [] },
    ]);
    expect(prompt.input).toContain('Серия 1 «Конверт»: Вера получила старую фотографию.');
    expect(prompt.input).toContain('Письмо пришло без марки');
    expect(prompt.input).toContain('Вера Соколова');
    expect(prompt.instructions).toContain('крючок');
  });

  it('parses the writer answer and checks connectedness', () => {
    const parsed = parseWrittenEpisode(JSON.stringify(episode()))!;
    expect(parsed.title).toBe('Следы у рынка');
    expect(checkEpisodeConsistency(series, parsed, [])).toEqual([]);
    expect(checkEpisodeConsistency(series, episode({ text: 'Коротко.', hook: 'Коротко.' }), [])[0]).toContain('Слишком коротко');
    expect(checkEpisodeConsistency(series, episode({ charactersUsed: ['Вера', 'Аркадий'] }), []).join(' ')).toContain('Незнакомый герой «Аркадий»');
    expect(checkEpisodeConsistency(series, episode({ charactersUsed: ['Вера', 'Аркадий'], newCharacters: ['Аркадий'] }), [])).toEqual([]);
    expect(checkEpisodeConsistency(series, episode({ hook: 'Совсем другой финал, которого нет в тексте.' }), [])).toContain('Нет крючка в конце серии');
    expect(parseWrittenEpisode('not json')).toBeNull();
  });

  it('releases episodes in order and stops at a held one', () => {
    const rows = [
      { number: 1, releaseDate: '2026-10-01', status: 'ready' as const },
      { number: 2, releaseDate: '2026-10-02', status: 'approved' as const },
      { number: 3, releaseDate: '2026-10-03', status: 'needs_review' as const },
      { number: 4, releaseDate: '2026-10-04', status: 'ready' as const },
    ];
    expect(releasedEpisodeNumbers(rows, '2026-10-05')).toEqual([1, 2]);
    expect(releasedEpisodeNumbers(rows, '2026-10-01')).toEqual([1]);
  });

  it('opens the first three free, then one a day per series, all with NEBO Premium', () => {
    expect(episodeAccess({ number: 3, premium: false, unlocked: false, usedTodayInSeries: true })).toBe('open');
    expect(episodeAccess({ number: 4, premium: false, unlocked: false, usedTodayInSeries: false })).toBe('free_unlock_available');
    expect(episodeAccess({ number: 5, premium: false, unlocked: false, usedTodayInSeries: true })).toBe('locked');
    expect(episodeAccess({ number: 5, premium: false, unlocked: true, usedTodayInSeries: true })).toBe('open');
    expect(episodeAccess({ number: 40, premium: true, unlocked: false, usedTodayInSeries: true })).toBe('open');
  });

  it('keeps every series except Тихий переулок for NEBO Premium', () => {
    expect(episodeAccess({ seriesId: 'quiet-lane', number: 2, premium: false, unlocked: false, usedTodayInSeries: false })).toBe('open');
    expect(episodeAccess({ seriesId: 'stair-neighbours', number: 1, premium: false, unlocked: false, usedTodayInSeries: false })).toBe('locked');
    expect(episodeAccess({ seriesId: 'polyn-station', number: 4, premium: false, unlocked: true, usedTodayInSeries: false })).toBe('locked');
    expect(episodeAccess({ seriesId: 'family-chat', number: 1, premium: true, unlocked: false, usedTodayInSeries: true })).toBe('open');
  });

  it('generates only on the main server, never on the OpenAI relay host', () => {
    expect(storyGenerationEnabled({ OPENAI_API_KEY: 'k', OPENAI_RELAY_DIRECT: '1' } as any)).toBe(false);
    expect(storyGenerationEnabled({ OPENAI_API_KEY: 'k' } as any)).toBe(true);
    expect(storyGenerationEnabled({} as any)).toBe(false);
    expect(storyGenerationEnabled({ STORY_GENERATION_ENABLED: '0', OPENAI_API_KEY: 'k' } as any)).toBe(false);
  });

  it('turns the daily invite into «Вышла новая серия» for readers, without extra pushes', () => {
    const base = {
      accountId: '42', language: 'ru' as const, isSetup: true,
      settings: { ...DEFAULT_NATIVE_NOTIFICATION_SETTINGS, enabled: true }, now: new Date(2026, 9, 5, 8, 0),
    };
    const plain = planNativeNotifications(base);
    const reader = planNativeNotifications({ ...base, storyReadAt: new Date(2026, 9, 5, 7, 0).getTime() });
    expect(reader.length).toBe(plain.length);
    expect(reader.some((item) => item.kind === 'story' && item.route === 'stories')).toBe(true);
    expect(reader.filter((item) => item.kind === 'invite').length).toBeLessThan(plain.filter((item) => item.kind === 'invite').length);
  });
});
