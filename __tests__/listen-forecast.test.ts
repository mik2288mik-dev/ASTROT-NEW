import type { ForecastSection, PersonalForecastPackage } from '../lib/personalForecastContract';
import { buildForecastListenScript, LISTEN_SCRIPT_MAX_CHARS } from '../lib/tts/forecastListenScript';
import { splitForSpeech, ttsCacheId } from '../lib/tts/openaiSpeech';

function section(id: string, title: string, text: string, role: 'body' | 'action' = 'body'): ForecastSection {
  return {
    id,
    kind: id === 'overview' ? 'overview' : 'topic',
    status: 'ready',
    diagnosticCode: null,
    title,
    text,
    contentBlocks: [{ role, text }],
    semanticFactIds: [],
    semanticFingerprint: '',
    importance: 1,
    visualTag: '',
    premiumTeaser: '',
    lockedPreview: { lead: '', blurred: '', teaser: '' },
    explanationAnchors: [],
  } as unknown as ForecastSection;
}

function forecast(sections: ForecastSection[]): PersonalForecastPackage {
  return { period: 'day', periodKey: '2026-10-03', overview: sections[0], sections: sections.slice(1) } as unknown as PersonalForecastPackage;
}

describe('listen script', () => {
  it('greets by first name, reads the opening and keeps the advice last', () => {
    const script = buildForecastListenScript({
      forecast: forecast([
        section('overview', 'Спокойный день', 'Утро лучше оставить себе. К вечеру появятся силы на разговор.'),
        section('love', 'Любовь', 'Скажи вслух то, что давно держишь в голове.'),
        section('advice', 'Совет', 'Ляг сегодня пораньше.', 'action'),
      ]),
      name: 'Аня Петрова',
      language: 'ru',
    });
    expect(script.startsWith('Привет, Аня. Твой прогноз на сегодня.')).toBe(true);
    expect(script).toContain('Спокойный день. Утро лучше оставить себе.');
    expect(script.trim().endsWith('Совет. Ляг сегодня пораньше.')).toBe(true);
  });

  it('never reads locked sections and fits about two minutes', () => {
    const long = 'Это длинное предложение про обычный день, работу и дом. '.repeat(60);
    const script = buildForecastListenScript({
      forecast: forecast([section('overview', 'День', long), section('money', 'Деньги', 'Секрет.')]),
      language: 'ru',
      lockedSectionIds: ['money'],
    });
    expect(script).not.toContain('Секрет');
    expect(script.length).toBeLessThanOrEqual(LISTEN_SCRIPT_MAX_CHARS);
    expect(script.trim().endsWith('.')).toBe(true);
  });

  it('splits long texts on paragraph and sentence boundaries', () => {
    const text = `${'Первая мысль. '.repeat(200)}\n\n${'Вторая мысль. '.repeat(10)}`;
    const parts = splitForSpeech(text, 1_000);
    expect(parts.every((part) => part.length <= 1_000)).toBe(true);
    expect(parts.join(' ').replace(/\s+/gu, ' ')).toBe(text.replace(/\s+/gu, ' ').trim());
  });

  it('caches by text, voice and style', () => {
    const a = ttsCacheId({ text: 'Привет', voice: 'coral', style: 'forecast' });
    expect(a).toMatch(/^[a-f0-9]{64}$/u);
    expect(ttsCacheId({ text: 'Привет', voice: 'coral', style: 'forecast' })).toBe(a);
    expect(ttsCacheId({ text: 'Привет', voice: 'sage', style: 'forecast' })).not.toBe(a);
    expect(ttsCacheId({ text: 'Привет', voice: 'coral', style: 'sleep' })).not.toBe(a);
  });
});
