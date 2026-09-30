import { natalWriterPayload } from './fixtures/natalWriterPayload';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
import {
  buildNatalUnifiedWriterPlan,
  materializeNatalUnifiedReading,
} from '../lib/natalReading/unifiedGeneration';
import { projectNatalUnifiedReadingForTier } from '../lib/natalReading/unifiedReading';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function validRaw(plan: ReturnType<typeof buildNatalUnifiedWriterPlan>) {
  return natalWriterPayload(buildNatalInterpretation(canonicalNatalChart()), plan);
}

describe('hardened unified natal writer', () => {
  it('uses ordinary topic names and a short relevant selection for each topic', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const titles = interpretation.topics.map((topic) => topic.title);
    const ids = interpretation.topics.flatMap((topic) => topic.meaningIds);

    expect(titles.every((title) => [
      'Характер',
      'Эмоции',
      'Общение',
      'Отношения',
      'Работа',
      'Деньги',
      'Дом',
      'Учёба',
      'Отдых',
      'В целом',
    ].includes(title))).toBe(true);
    expect(titles).not.toContain('Дом и привычный уклад');
    expect(titles).not.toContain('Учёба и новое');
    expect(titles).not.toContain('Нагрузка и восстановление');

    expect(ids.every(id => interpretation.meanings.some(meaning => meaning.id === id))).toBe(true);
    expect(interpretation.topics.every(topic => topic.meaningIds.length <= 8
      && new Set(topic.meaningIds).size === topic.meaningIds.length)).toBe(true);
  });

  it('accepts concise everyday copy when ids and topic structure are unchanged', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);

    const result = materializeNatalUnifiedReading({
      raw,
      interpretation,
      tier: 'premium',
      plan,
    });

    expect(result.errors).toEqual([]);
    expect(result.reading).not.toBeNull();
    expect(result.reading?.topics.map((topic) => topic.title)).toEqual(plan.topics.map((topic) => topic.title));
  });

  it('rejects pseudo-psychology instead of serving it', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    raw.story[0].text = 'Твой архетип связан с подсознательным самосаботажем и теневой стороной характера.';

    const result = materializeNatalUnifiedReading({
      raw,
      interpretation,
      tier: 'premium',
      plan,
    });

    expect(result.reading).toBeNull();
    expect(result.errors.join(' ')).toContain('pseudo-psychology/coaching language');
  });

  it('rejects advice, visible astrology, renamed topics and padded filler', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');

    const advice = validRaw(plan);
    advice.story[0].text = 'Тебе нужно сохранять баланс и помнить, что любые решения лучше принимать только после паузы.';
    expect(materializeNatalUnifiedReading({ raw: advice, interpretation, tier: 'premium', plan }).reading).toBeNull();

    const astrology = validRaw(plan);
    astrology.story[0].text = 'Солнце в этом положении делает твои решения более прямыми и заметными для окружающих людей.';
    expect(materializeNatalUnifiedReading({ raw: astrology, interpretation, tier: 'premium', plan }).reading).toBeNull();

    const renamed = validRaw(plan);
    renamed.topics[0].title = 'Твои внутренние сценарии';
    expect(materializeNatalUnifiedReading({ raw: renamed, interpretation, tier: 'premium', plan }).reading).toBeNull();

    const padded = validRaw(plan);
    padded.story[0].text = Array.from({ length: 300 }, () => 'слово').join(' ');
    const paddedResult = materializeNatalUnifiedReading({ raw: padded, interpretation, tier: 'premium', plan });
    expect(paddedResult.reading).toBeNull();
    expect(paddedResult.errors.join(' ')).toContain('padded beyond approved material');
  });

  it('derives the free story from the same full reading instead of generating a second story', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    const result = materializeNatalUnifiedReading({
      raw,
      interpretation,
      tier: 'premium',
      plan,
    });
    expect(result.reading).not.toBeNull();

    const full = result.reading!;
    const free = projectNatalUnifiedReadingForTier(full, 'free');
    expect(free.story.length).toBeLessThan(full.story.length);
    expect(free.story).toEqual(full.story.slice(0, free.story.length));
    expect(free.topics).toEqual([]);
  });

  it('runs a semantic fidelity review and never falls back to unvalidated meaning prose', () => {
    const generation = source('lib/natalReading/unifiedGeneration.ts');
    const service = source('services/natalUnifiedReadingService.ts');
    const ui = source('components/NatalReading/NatalUnifiedReport.tsx');

    expect(generation).toContain('validateSemanticFidelity');
    expect(generation).toContain('semantic review');
    expect(generation).toContain('NATAL_WRITER_REJECTED');
    expect(generation).not.toContain('function deterministicFallback');
    expect(service).toContain("nebo:natal-unified-reading:v4");
    expect(ui).toContain("const tier: NatalUnifiedReadingTier = isPremium ? 'premium' : 'free';");
    expect(ui).not.toContain("mode === 'topics' && isPremium ? 'premium' : 'free'");
  });
  it('accepts a grounded subset rather than forcing every minor detail into prose', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    const result = materializeNatalUnifiedReading({ raw, interpretation, tier: 'premium', plan });
    expect(result.reading!.story[0].meaningIds).toHaveLength(1);
    expect(plan.story[0].meaningIds.length).toBeGreaterThan(1);
    const cited = new Set(result.reading!.meaningIds);
    expect(new Set(result.reading!.evidenceIds)).toEqual(new Set(interpretation.meanings.filter(meaning => cited.has(meaning.id)).flatMap(meaning => meaning.evidenceIds)));
    raw.story[0].meaning_ids = ['invented-id'];
    expect(materializeNatalUnifiedReading({ raw, interpretation, tier: 'premium', plan }).reading).toBeNull();
  });
  it.each([
    'Самоподача и отношения могут требовать разных решений и включаются вместе.',
    'Реакция чаще идёт напрямую, без дополнительного внутреннего пересмотра.',
    'Ты выбираешь понятный способ действовать. Ты выбираешь понятный способ действовать.',
  ])('rejects the actual pseudo-prose and repetitions: %s', text => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    raw.story[0].text = text;
    const result = materializeNatalUnifiedReading({ raw, interpretation, tier: 'premium', plan });
    expect(result.reading).toBeNull();
    expect(result.errors.some(error => /technical pseudo-prose|repeated sentence/.test(error))).toBe(true);
  });
  it('rejects a duplicated paragraph in different visible topics', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    raw.topics[1].blocks[0].text = raw.topics[0].blocks[0].text;
    expect(materializeNatalUnifiedReading({ raw, interpretation, tier: 'premium', plan }).errors.join(' ')).toContain('repeated paragraph');
  });

  it('lets the author connect paragraphs using the whole story material', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    expect(plan.story.length).toBeGreaterThan(1);
    expect(plan.story.every(block => block.meaningIds.length === interpretation.storyMeaningIds.length)).toBe(true);
    expect(plan.story[0].focusMeaningIds).not.toEqual(plan.story[1].focusMeaningIds);
    const raw = validRaw(plan);
    const id = plan.story[0].focusMeaningIds![1];
    raw.story[1] = { ...raw.story[1], text: interpretation.meanings.find(meaning => meaning.id === id)!.text, meaning_ids: [id] };
    expect(materializeNatalUnifiedReading({ raw, interpretation, tier: 'premium', plan }).errors).toEqual([]);
  });

  it('rejects copying the story into a topic and restating an observation in the next paragraph', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    raw.topics[0].blocks[0].text = raw.story[0].text;
    expect(materializeNatalUnifiedReading({ raw, interpretation, tier: 'premium', plan }).errors.join(' ')).toContain('repeated paragraph');
    const repeated = validRaw(plan);
    repeated.story[1].meaning_ids = repeated.story[0].meaning_ids;
    repeated.story[1].text = 'Первый шаг тебе даётся проще, когда уже понятно, за какое дело хочется взяться.';
    expect(materializeNatalUnifiedReading({ raw: repeated, interpretation, tier: 'premium', plan }).errors.join(' ')).toContain('paragraph adds no new observation');
  });

  it.each([
    'Ты выбираешь дело. Тебе нравится начать сразу. Для тебя имеет значение первый шаг.',
    'В отношениях складываются договорённости и сочетание настойчивости и чувствительности.',
  ])('rejects robotic openings and the rejected tone: %s', text => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    raw.story[0].text = text;
    expect(materializeNatalUnifiedReading({ raw, interpretation, tier: 'premium', plan }).reading).toBeNull();
  });
});
