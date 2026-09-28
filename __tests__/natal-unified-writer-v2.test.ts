import fs from 'node:fs';
import path from 'node:path';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
import {
  buildNatalUnifiedWriterPlan,
  materializeNatalUnifiedReading,
} from '../lib/natalReading/unifiedGeneration';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function validRaw(
  plan: ReturnType<typeof buildNatalUnifiedWriterPlan>,
) {
  const text = 'Обычно ты сначала разбираешься в деталях, а потом выбираешь понятный способ действовать без лишней суеты.';
  return {
    story: plan.story.map((block) => ({
      id: block.id,
      text,
      meaning_ids: [...block.meaningIds],
    })),
    topics: plan.topics.map((topic) => ({
      key: topic.key,
      title: topic.title,
      blocks: topic.blocks.map((block) => ({
        id: block.id,
        text,
        meaning_ids: [...block.meaningIds],
      })),
    })),
  };
}

describe('hardened unified natal writer', () => {
  it('uses ordinary topic names and assigns every meaning to one visible topic only', () => {
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

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(interpretation.meanings.map((meaning) => meaning.id)));
  });

  it('rejects pseudo-psychology instead of serving it', () => {
    const interpretation = buildNatalInterpretation(canonicalNatalChart());
    const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
    const raw = validRaw(plan);
    raw.story[0].text = 'Тебе важно проработать внутренний ресурс и раскрыть свой потенциал через личные границы.';

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
    padded.story[0].text = Array.from({ length: 90 }, () => 'понятно').join(' ');
    const paddedResult = materializeNatalUnifiedReading({ raw: padded, interpretation, tier: 'premium', plan });
    expect(paddedResult.reading).toBeNull();
    expect(paddedResult.errors.join(' ')).toContain('padded beyond approved material');
  });

  it('runs a semantic fidelity review and never falls back to unvalidated meaning prose', () => {
    const generation = source('lib/natalReading/unifiedGeneration.ts');
    const service = source('services/natalUnifiedReadingService.ts');

    expect(generation).toContain('validateSemanticFidelity');
    expect(generation).toContain('semantic review');
    expect(generation).toContain('NATAL_WRITER_REJECTED');
    expect(generation).not.toContain('function deterministicFallback');
    expect(service).toContain("nebo:natal-unified-reading:v2");
  });
});
