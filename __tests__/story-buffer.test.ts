const rows: Array<Record<string, unknown>> = [];
jest.mock('../lib/db', () => ({
  getPool: () => ({
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.startsWith('SELECT * FROM story_episodes')) {
        return { rows: rows.filter((row) => row.series_id === params[0]).sort((a, b) => Number(a.number) - Number(b.number)) };
      }
      if (sql.includes('INSERT INTO story_episodes')) {
        const [series_id, number, release_date, title, body, summary, facts, hook, status, issues] = params as string[];
        rows.push({ series_id, number, release_date, title, body, summary, facts: JSON.parse(facts), hook, status, issues: JSON.parse(issues), updated_at: new Date() });
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected sql ${sql}`);
    },
  }),
}));
jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: jest.fn(), OPENAI_LUNA_MODEL: 'test-model' }));
import { ensureEpisodeBuffer, STORY_BUFFER_DAYS } from '../lib/stories/repository';
import type { PreviousEpisode, WrittenEpisode } from '../lib/stories/episodeWriter';

const body = 'Савва Громов чинил фильтр, а Ирина Вольская смотрела на кольца Сатурна и думала о сигнале. '.repeat(60);

describe('story buffer', () => {
  it('writes episodes one by one ahead of today, each seeing the previous ones', async () => {
    const seen: number[] = [];
    const writer = async (_series: unknown, number: number, previous: PreviousEpisode[]): Promise<WrittenEpisode> => {
      seen.push(previous.length);
      const hook = `В конце серии ${number} Ёж сказал, что сигнал повторился.`;
      return { title: `Серия про сигнал ${number}`, text: `${body}\n\n${hook}`, summary: `Итог серии ${number}.`, facts: [`факт ${number}`], hook, charactersUsed: ['Савва', 'Ирина'], newCharacters: [] };
    };
    const written = await ensureEpisodeBuffer('polyn-station', { today: '2026-10-03', writer });
    expect(written).toBe(STORY_BUFFER_DAYS);
    expect(seen).toEqual(Array.from({ length: STORY_BUFFER_DAYS }, (_, index) => index));
    const dates = rows.map((row) => row.release_date);
    expect(dates[0]).toBe('2026-10-03');
    expect(dates[dates.length - 1]).toBe('2026-10-12');
    expect(rows.every((row) => row.status === 'ready')).toBe(true);

    // Next day only the missing day is added.
    expect(await ensureEpisodeBuffer('polyn-station', { today: '2026-10-04', writer })).toBe(1);
    expect(rows[rows.length - 1].release_date).toBe('2026-10-13');
  });
});
