import fs from 'fs';
import path from 'path';
import { buildDailyRadioScript, formatRadioDate } from '../lib/tts/dailyRadioScript';
import {
  buildNatalListenScript,
  buildSignListenScript,
  cleanForSpeech,
  NATAL_TOPIC_LISTEN_MAX_CHARS,
  SIGN_LISTEN_MAX_CHARS,
} from '../lib/tts/readingListenScript';
import { FREE_SELF_TEST_IDS, SELF_TESTS } from '../lib/selfTests/engine';
import { FREE_STORY_SERIES, isFreeStorySeries } from '../lib/stories/access';
import { questionForDay } from '../lib/dailyQuestion';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Радио NEBO script', () => {
  it('names the day and runs through the pieces in order, leaving out what is missing', () => {
    expect(formatRadioDate('2026-10-07')).toBe('среда, 7 октября');
    const script = buildDailyRadioScript({
      dayKey: '2026-10-07',
      name: 'Анна Петрова',
      sky: 'Убывающий серп. Луна в Льве.',
      forecast: 'Сегодня лучше начать с главного.',
      sign: { label: 'Рыбы', headline: 'День мягкого ритма', text: 'Не спеши с ответами.' },
      question: questionForDay('2026-10-07'),
    });
    expect(script.startsWith('Привет, Анна. Это Радио NEBO')).toBe(true);
    const order = ['Начнём с неба', 'Теперь про тебя лично', 'твоему знаку, Рыбы', 'вопрос дня', 'до встречи в эфире'].map((part) => script.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(script).not.toMatch(/[—–]/u);

    const bare = buildDailyRadioScript({ dayKey: '2026-10-07', question: null });
    expect(bare).not.toContain('Начнём с неба');
    expect(bare).not.toContain('твоему знаку');
    expect(bare).toContain('Хорошего дня');
  });
});

describe('listening to a sign horoscope and the natal reading', () => {
  it('cleans text for speech and names the sign and the period', () => {
    expect(cleanForSpeech('Тихо — и **тепло**')).toBe('Тихо, и тепло');
    const script = buildSignListenScript({ sign: 'pisces', period: 'week', headline: 'Неделя спокойствия', text: 'Мягкий ритм.' }, 'ru');
    expect(script.startsWith('Гороскоп для знака Рыбы на неделю.')).toBe(true);
    const long = buildSignListenScript({ sign: 'leo', period: 'day', headline: 'Заголовок', text: 'Предложение номер один. '.repeat(400) }, 'ru');
    expect(long.length).toBeLessThanOrEqual(SIGN_LISTEN_MAX_CHARS);
    expect(long.endsWith('.')).toBe(true);
  });

  it('reads the natal story or one topic by key', () => {
    const reading = {
      story: [{ text: 'Первый абзац рассказа.' }, { text: 'Второй абзац.' }],
      topics: [{ key: 'love', title: 'Любовь', blocks: [{ text: 'Текст про любовь. '.repeat(500) }] }],
    };
    expect(buildNatalListenScript(reading, 'story', null, 'ru')).toContain('Рассказ о твоей натальной карте.');
    const topic = buildNatalListenScript(reading, 'topic', 'love', 'ru');
    expect(topic?.startsWith('Любовь.')).toBe(true);
    expect((topic ?? '').length).toBeLessThanOrEqual(NATAL_TOPIC_LISTEN_MAX_CHARS);
    expect(buildNatalListenScript(reading, 'topic', 'money', 'ru')).toBeNull();
  });
});

describe('what is free and what is NEBO Premium', () => {
  it('opens one test and one story series for everyone', () => {
    expect([...FREE_SELF_TEST_IDS]).toEqual(['temperament']);
    expect(SELF_TESTS.length).toBeGreaterThan(1);
    expect([...FREE_STORY_SERIES]).toEqual(['quiet-lane']);
    expect(isFreeStorySeries('quiet-lane')).toBe(true);
    expect(isFreeStorySeries('polyn-station')).toBe(false);
  });

  it('keeps only the two-minute breathing free in Anti-stress and wires the Premium prompts', () => {
    const anti = read('views/v2/AntistressRoom.tsx');
    expect(anti).toContain("id !== 'sigh'");
    expect(anti).toContain("next === 'body' || next === 'ground' || next === 'habits' || next === 'diary'");
    const app = read('App.tsx');
    expect(app).toContain("requestPremium('antistress'");
    expect(app).toContain("requestPremium('tests'");
    for (const file of ['views/Dashboard.tsx', 'views/v2/HoroscopeReaderClassic.tsx', 'components/NatalReading/NatalUnifiedReport.tsx', 'views/v2/StoriesRoom.tsx']) {
      const source = read(file);
      expect(source).not.toContain('ListenForecastButton');
      expect(source).not.toContain('DailyRadioCard');
    }
    expect(read('views/Paywall.tsx')).not.toMatch(/Радио NEBO|озвучк/u);
  });
});
