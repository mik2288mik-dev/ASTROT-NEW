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
  hasNatalNarrativeDirectAddress,
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

  it.each(['ru', 'en'] as const)('separates unused chapter evidence from accepted main evidence in %s without inventing facts', (language) => {
    const mainAnchor = materialize()!;
    mainAnchor.summary[0].evidenceIds.push('invented:old-anchor-id');
    const prompt = buildNatalReportCategoryPrompt({ language, built, categoryKey: 'work', mainAnchor, reader: { name: 'Лина', gender: 'female' } });
    const planningJson = prompt.match(/CONTINUATION EVIDENCE:\n([\s\S]+?)\n\nCALCULATED EVIDENCE:/u)?.[1];
    expect(planningJson).toBeDefined();
    const planning = JSON.parse(planningJson!);
    const available = resolveNatalReportNarrativeEvidence(built, 'work').map((fact) => fact.id);
    const alreadyCited = new Set(mainAnchor.summary.flatMap((item) => item.evidenceIds));
    expect(planning.not_previously_cited_evidence_ids).toEqual(available.filter((id) => !alreadyCited.has(id)));
    expect(planning.previously_cited_evidence_ids).toEqual(available.filter((id) => alreadyCited.has(id)));
    expect(JSON.stringify(planning)).not.toContain('invented:old-anchor-id');
    expect(prompt).toContain(mainAnchor.summary[0].text);
    expect(prompt).toContain('2–3');
    expect(prompt).toContain('"gender": "female"');
    expect(prompt).not.toContain('full_answer_covers');
    expect(buildNatalReportCategoryPrompt({ language, built, categoryKey: 'main' })).not.toContain('CONTINUATION EVIDENCE:');
  });

  it('blocks the office phrases observed in live output while allowing plain descriptions', () => {
    expect(hasNatalReportCatalogCopyViolation('Окончательная профессиональная позиция строится на последовательности.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('Трезвый отбор помогает держать планку качества.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('В итоге ты умеешь действовать быстро и точно.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('Начать легче, чем закончить, если задача всё время меняется.')).toBe(false);
    expect(hasNatalReportCatalogCopyViolation('Ты можешь показать готовую работу раньше, чем обещал.')).toBe(false);
  });

  it.each([
    ['main', 'male', 'male'],
    ['work', 'female', 'female'],
    ['main', 'unspecified', 'unspecified'],
    ['work', undefined, 'unspecified'],
    ['main', 'invalid', 'unspecified'],
  ] as const)('passes the reader name and normalized gender to the %s writer (%s)', async (categoryKey, gender, expected) => {
    const requestStructured = jest.fn().mockResolvedValue({
      content: JSON.stringify(natalEditorialCategoryPayload(built, categoryKey)), responseId: 'reader-test',
    });
    const result = await generateNatalReportCategoryPack({
      profile: { ...profile, name: '  Лина  ', gender: gender as UserProfile['gender'] },
      chart, categoryKey, mainAnchor: categoryKey === 'main' ? null : materialize(), requestStructured,
    });
    expect(result.summary).toHaveLength(6);
    expect(requestStructured).toHaveBeenCalledTimes(1);
    const prompt = requestStructured.mock.calls[0][0].input as string;
    const reader = JSON.parse(prompt.match(/READER:\n(\{[\s\S]*?\})\n\nCATEGORY:/)![1]);
    expect(reader).toEqual({ name: 'Лина', gender: expected });
    expect(prompt).toContain('не определяй пол по имени');
    expect(prompt).toContain('Пол влияет только на грамматику, не на характер, выводы или примеры');
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

  it.each([
    ['ru', 'Лина, ты быстро находишь понятное объяснение.', true],
    ['ru', 'В твоём объяснении есть точный пример.', true],
    ['ru', 'Лина творчески подходит к объяснениям. Ей легко привести пример.', false],
    ['en', 'Lina, your explanation gives the listener a concrete example.', true],
    ['en', 'Lina explains things clearly. Her example helps the listener.', false],
  ] as const)('checks direct address in %s without guessing from a name', (language, text, expected) => {
    expect(hasNatalNarrativeDirectAddress([{ text }], language)).toBe(expected);
  });

  it('repairs an otherwise valid third-person chapter before returning it', async () => {
    const valid = natalEditorialCategoryPayload(built, 'work');
    const thirdPerson = {
      ...valid,
      summary: valid.summary!.map((paragraph) => ({
        ...paragraph,
        text: String(paragraph.text).replace(/(?<![\p{L}])(?:ты|тебе|тебя|твой|твоя|твоё|твое|твои|твою)(?![\p{L}])/giu, 'Лина'),
      })),
    };
    // This fixture isolates narration from existing length, evidence and copy validators.
    expect(materializeNatalReportCategoryPack({ raw: thirdPerson, built, categoryKey: 'work', language: 'ru' })).not.toBeNull();
    const requestStructured = jest.fn()
      .mockResolvedValueOnce({ content: JSON.stringify(thirdPerson), responseId: 'third-person' })
      .mockResolvedValueOnce({ content: JSON.stringify(valid), responseId: 'direct-address' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const report = await generateNatalReportCategoryPack({ profile, chart, categoryKey: 'work', mainAnchor: materialize(), requestStructured });
      expect(report.summary[0].text).toBe(valid.summary![0].text);
      expect(requestStructured).toHaveBeenCalledTimes(2);
      expect(requestStructured.mock.calls[1][0].input).toContain('NARRATOR_DIRECT_ADDRESS_REQUIRED');
      expect(requestStructured.mock.calls[1][0].input).toContain('перепиши весь рассказ как обращение');
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
