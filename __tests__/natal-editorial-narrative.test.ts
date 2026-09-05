import type { UserProfile } from '../types';
import {
  NATAL_REPORT_CATALOG_CATEGORY_CACHE_KEY,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  type NatalReportCategoryKey,
} from '../lib/natalReading/reportCatalog';
import {
  buildNatalReportCatalogContext,
  resolveNatalReportNarrativeEvidence,
} from '../lib/natalReading/reportCatalogEvidence';
import {
  buildNatalReportCategoryPrompt,
  buildNatalReportCategorySchema,
  generateNatalReportCategoryPack,
  getNatalReportCategoryValidationIssues,
  getNatalReportCatalogSystemPrompt,
  hasNatalReportCatalogCopyViolation,
  isNatalReportMainSummaryLengthAllowed,
  materializeNatalReportCategoryPack,
} from '../lib/natalReading/reportCatalogGeneration';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { natalEditorialCategoryPayload, natalEditorialParagraphs } from './fixtures/natalEditorialNarrative';

const profile: UserProfile = {
  id: 'editorial-test-user', name: 'Лина', birthDate: '1990-01-01', birthTime: '08:15',
  birthPlace: 'Москва', language: 'ru', isSetup: true, theme: 'light', isPremium: true,
};
const chart = canonicalNatalChart();
const built = buildNatalReportCatalogContext(profile, chart);

function materialize(categoryKey: NatalReportCategoryKey = 'main') {
  return materializeNatalReportCategoryPack({
    raw: natalEditorialCategoryPayload(built, categoryKey), built, categoryKey, language: 'ru',
  });
}

describe('natal editorial narrative', () => {
  it('returns a complete Main reading with varied paragraphs and paragraph-level evidence', () => {
    const report = materialize();
    expect(report).not.toBeNull();
    expect(isNatalReportMainSummaryLengthAllowed(natalEditorialParagraphs)).toBe(true);
    expect(new Set(report!.summary.map((item) => item.text.length)).size).toBeGreaterThan(3);
    expect(new Set(report!.summary.flatMap((item) => item.evidenceIds)).size).toBeGreaterThanOrEqual(3);
    expect(report!.observations).toEqual([]);
    expect(report!.previews).toHaveLength(6);
    expect(report!.freeAnswers).toEqual([]);
    expect(report!.summary.every((paragraph) => !('focus' in paragraph))).toBe(true);
    expect(NATAL_REPORT_CATALOG_CONTRACT_VERSION).toBe('natal-report-catalog-v2');
    expect(NATAL_REPORT_CATALOG_CATEGORY_CACHE_KEY).toContain('narrative.v2');
  });

  it.each(['character', 'love', 'communication', 'work', 'money'] as const)(
    'gives %s an immediate narrative without generating hidden question cards',
    (categoryKey) => {
      const report = materialize(categoryKey);
      expect(report?.summary).toHaveLength(6);
      expect(report?.observations).toEqual([]);
      expect(report?.previews).toEqual([]);
      expect(report?.freeAnswers).toEqual([]);
      const schema = buildNatalReportCategorySchema(categoryKey) as any;
      expect(schema.properties.summary).toMatchObject({ minItems: 5, maxItems: 8 });
      expect(schema.properties.summary.items.properties.text).toMatchObject({ minLength: 80, maxLength: 1200 });
      expect(schema.properties.previews.properties).toEqual({});
      expect(schema.properties.free_answers.maxItems).toBe(0);
    },
  );

  it('continues the complete free anchor and lets evidence select the chapter, not the question catalog', () => {
    const prompt = buildNatalReportCategoryPrompt({ language: 'ru', built, categoryKey: 'work', mainAnchor: materialize() });
    expect(prompt).toContain(natalEditorialParagraphs[5]);
    expect(prompt).toContain('Продолжи главную линию');
    expect(prompt).toContain('не пытайся охватить весь список');
    expect(prompt).toContain('narrative_evidence_ids');
    expect(prompt).not.toContain('required_evidence_ids');
    expect(prompt).not.toContain('200–210');
    expect(prompt).not.toContain('1990-01-01');
    expect(prompt).not.toContain('Москва');
    const mainPrompt = buildNatalReportCategoryPrompt({ language: 'ru', built, categoryKey: 'main' });
    expect(mainPrompt).not.toContain('Как тебя видят');
    expect(mainPrompt).not.toContain('Что в тебе не сразу замечают');
    const voice = getNatalReportCatalogSystemPrompt('ru');
    expect(voice).toContain('Связывай наблюдения');
    expect(voice).toContain('Шутка необязательна');
    expect(voice).toContain('Не приписывай человеку чувства');
    expect(voice).toContain('ТОЛЬКО ясность языка, а не факты о читателе');
    expect(voice).toContain('максимум одна точная шутка');
    expect(voice).toContain('Последний абзац заканчивает последнюю мысль');
  });

  it('blocks the office phrases observed in live output while allowing plain descriptions', () => {
    expect(hasNatalReportCatalogCopyViolation('Окончательная профессиональная позиция строится на последовательности.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('Трезвый отбор помогает держать планку качества.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('В итоге ты умеешь действовать быстро и точно.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('Начать легче, чем закончить, если задача всё время меняется.')).toBe(false);
    expect(hasNatalReportCatalogCopyViolation('Ты можешь показать готовую работу раньше, чем обещал.')).toBe(false);
  });

  it('repairs an underlength candidate instead of returning a teaser', async () => {
    const valid = natalEditorialCategoryPayload(built);
    const short = { ...valid, summary: valid.summary!.slice(0, 3) };
    const requestStructured = jest.fn().mockResolvedValueOnce({ content: JSON.stringify(short), responseId: 'short' })
      .mockResolvedValueOnce({ content: JSON.stringify(valid), responseId: 'valid' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const report = await generateNatalReportCategoryPack({ profile, chart, categoryKey: 'main', requestStructured });
      expect(report.summary).toHaveLength(6);
      expect(requestStructured).toHaveBeenCalledTimes(2);
      expect(requestStructured.mock.calls[1][0].input).toContain('SUMMARY_WORDS_TOO_SHORT');
      expect(requestStructured.mock.calls[0][0].maxOutputTokens).toBe(6000);
    } finally { warn.mockRestore(); }
  });

  it('rejects repeated paragraphs and single-fact padding', () => {
    const raw = natalEditorialCategoryPayload(built);
    raw.summary![1] = raw.summary![0];
    expect(getNatalReportCategoryValidationIssues({ raw, built, categoryKey: 'main' })).toContain('SUMMARY_REPEATED_COPY');
    expect(materializeNatalReportCategoryPack({ raw, built, categoryKey: 'main', language: 'ru' })).toBeNull();
    const narrow = natalEditorialCategoryPayload(built);
    narrow.summary = narrow.summary!.map((item) => ({ ...item, evidence_ids: ['natal.position.sun'] }));
    expect(getNatalReportCategoryValidationIssues({ raw: narrow, built, categoryKey: 'main' })).toContain('SUMMARY_EVIDENCE_TOO_NARROW');
    const sameArea = natalEditorialCategoryPayload(built);
    sameArea.summary = sameArea.summary!.map((item) => ({ ...item, focus: 'communication' }));
    expect(getNatalReportCategoryValidationIssues({ raw: sameArea, built, categoryKey: 'main' })).toContain('SUMMARY_FOCUS_REPEATED');
    expect(materializeNatalReportCategoryPack({ raw: sameArea, built, categoryKey: 'main', language: 'ru' })).toBeNull();
  });

  it('enforces fixed preview keys at generation and drops bad auxiliary links without losing the article', () => {
    const schema = buildNatalReportCategorySchema('main') as any;
    expect(schema.properties.previews.type).toBe('object');
    expect(schema.properties.previews.required).toHaveLength(6);
    const raw = natalEditorialCategoryPayload(built);
    raw.previews = {
      main_how_people_see_you: { preview: 'Венера в Овне.', evidence_ids: ['natal.position.sun'] },
      main_not_seen_at_once: { preview: 'Обычный вывод достаточно длинный, но он ссылается на выдуманный расчёт.', evidence_ids: ['invented'] },
    };
    const report = materializeNatalReportCategoryPack({ raw, built, categoryKey: 'main', language: 'ru' });
    expect(report?.summary).toHaveLength(6);
    expect(report?.previews).toEqual([]);
    raw.summary![0].evidence_ids = ['invented'];
    expect(materializeNatalReportCategoryPack({ raw, built, categoryKey: 'main', language: 'ru' })).toBeNull();
  });

  it('excludes unknown-time structures from both the writer and accepted explanations', () => {
    const unknown = canonicalNatalChart({ time: { mode: 'unknown', localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null } });
    const unknownBuilt = buildNatalReportCatalogContext(profile, unknown);
    const evidence = resolveNatalReportNarrativeEvidence(unknownBuilt, 'main');
    expect(evidence.length).toBeGreaterThan(3);
    expect(evidence.some((fact) => fact.kind === 'house' || fact.kind === 'angle')).toBe(false);
    expect(resolveNatalReportNarrativeEvidence(built, 'main').some((fact) => fact.kind === 'angle')).toBe(true);
    const raw = natalEditorialCategoryPayload(unknownBuilt);
    raw.summary![0].evidence_ids = ['natal.angle.ascendant'];
    expect(getNatalReportCategoryValidationIssues({ raw, built: unknownBuilt, categoryKey: 'main' })).toContain('SUMMARY_EVIDENCE_INVALID');
    expect(materializeNatalReportCategoryPack({ raw, built: unknownBuilt, categoryKey: 'main', language: 'ru' })).toBeNull();
  });
});
