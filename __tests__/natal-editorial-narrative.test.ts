import type { UserProfile } from '../types';
import {
  NATAL_REPORT_CATALOG_CATEGORY_CACHE_KEY,
  NATAL_REPORT_CATALOG_CATEGORY_PROMPT_VERSION,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  isNatalReportCategoryPack,
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
  getNatalReportCopyValidationKinds,
  getNatalReportCatalogSystemPrompt,
  hasNatalNarrativeDirectAddress,
  hasNatalReportCatalogCopyViolation,
  isNatalReportMainSummaryLengthAllowed,
  materializeNatalReportCategoryPack,
} from '../lib/natalReading/reportCatalogGeneration';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import {
  NATAL_NARRATIVE_VOICE_VERSION,
  copiesNatalNarrativeExampleTitle,
  getNatalNarrativeSystemPrompt,
  hasNatalNarrativeVoiceViolation,
} from '../lib/natalReading/narrativeVoice';
import { natalEditorialCategoryPayload, natalEditorialMainParagraphs, natalEditorialParagraphs } from './fixtures/natalEditorialNarrative';

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
    expect(isNatalReportMainSummaryLengthAllowed(natalEditorialMainParagraphs)).toBe(true);
    expect(new Set(report!.summary.map((item) => item.text.length)).size).toBeGreaterThan(3);
    expect(new Set(report!.summary.flatMap((item) => item.evidenceIds)).size).toBeGreaterThanOrEqual(3);
    expect(report!.observations).toEqual([]);
    expect(report!.previews).toEqual([]);
    expect(report!.followUps).toHaveLength(2);
    expect(report!.summary.map((item) => item.title)).toEqual(natalEditorialCategoryPayload(built).summary!.map((item) => item.title));
    expect(report!.freeAnswers).toEqual([]);
    expect(report!.summary.every((paragraph) => !('focus' in paragraph))).toBe(true);
    expect(NATAL_REPORT_CATALOG_CONTRACT_VERSION).toBe('natal-report-catalog-v2');
    expect(NATAL_REPORT_CATALOG_CATEGORY_CACHE_KEY).toContain(`narrative.v4.${NATAL_NARRATIVE_VOICE_VERSION}`);
    expect(NATAL_REPORT_CATALOG_CATEGORY_PROMPT_VERSION).toContain(`narrative.v4.${NATAL_NARRATIVE_VOICE_VERSION}`);
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
    expect(prompt).toContain(natalEditorialMainParagraphs[5]);
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
    const voice = getNatalNarrativeSystemPrompt('ru');
    expect(voice).toContain('Связывай наблюдения');
    expect(voice).toContain('Шутка необязательна');
    expect(voice).toContain('собственные эмоциональные реакции и предпочтения читателя');
    expect(voice).not.toContain('Не приписывай человеку чувства');
    expect(voice).toContain('ТОЛЬКО ясность языка, а не факты о читателе');
    expect(voice).toContain('максимум одна точная шутка');
    expect(voice).toContain('Последний абзац заканчивает последнюю мысль');
  });

  it('allows grounded emotional preferences without treating them as biography or coaching', () => {
    for (const value of [
      'Тебе спокойнее рядом с человеком, который говорит прямо, без обидных намёков.',
      'Ты быстро сердишься, если разговор затягивается, а ответа всё ещё нет.',
      'You enjoy a quiet evening with someone who makes you laugh.',
    ]) expect(getNatalReportCopyValidationKinds(value, built)).toEqual([]);
    expect(getNatalNarrativeSystemPrompt('ru')).toContain('Не придумывай конкретно пережитое событие');
    expect(getNatalNarrativeSystemPrompt('en')).toContain('another real person\'s thoughts or feelings');
    expect(buildNatalReportCategoryPrompt({ language: 'ru', built, categoryKey: 'main' }))
      .toContain('а не как тебе себя переделать');
    expect(buildNatalReportCategoryPrompt({ language: 'en', built, categoryKey: 'main' }))
      .toContain('never how to change yourself');
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
    expect(prompt).toContain('5–8');
    expect(prompt).toContain('"gender": "female"');
    expect(prompt).not.toContain('full_answer_covers');
    expect(buildNatalReportCategoryPrompt({ language, built, categoryKey: 'main' })).not.toContain('CONTINUATION EVIDENCE:');
  });

  it('passes only the chosen chapter entry question from Main to the chapter writer', () => {
    const mainAnchor = materialize()!;
    mainAnchor.followUps = [
      { label: 'Какие задачи тебе интереснее делать самой, а какие вместе с людьми?', categoryKey: 'work', evidenceIds: mainAnchor.summary[0].evidenceIds },
      { label: 'Что тебе приятнее покупать для себя?', categoryKey: 'money', evidenceIds: mainAnchor.summary[1].evidenceIds },
    ];
    const prompt = buildNatalReportCategoryPrompt({ language: 'ru', built, categoryKey: 'work', mainAnchor });
    const anchorJson = prompt.match(/MAIN READING ANCHOR — KEEP THE SAME PERSON, DO NOT COPY IT:\n([\s\S]+?)\n\nНОВОЕ/u)?.[1];
    expect(anchorJson).toBeDefined();
    expect(JSON.parse(anchorJson!).entry_questions).toEqual([mainAnchor.followUps[0]]);
    expect(prompt).toContain('Дай на него прямой содержательный ответ');
    expect(prompt).not.toContain(mainAnchor.followUps[1].label);
    expect(prompt).toContain('Не делай из неё шесть наблюдений');
    expect(prompt).toContain('Не добавляй к каждому обязательное');
  });

  it('blocks the office phrases observed in live output while allowing plain descriptions', () => {
    expect(hasNatalReportCatalogCopyViolation('Окончательная профессиональная позиция строится на последовательности.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('Трезвый отбор помогает держать планку качества.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('В итоге ты умеешь действовать быстро и точно.')).toBe(true);
    expect(hasNatalReportCatalogCopyViolation('Начать легче, чем закончить, если задача всё время меняется.')).toBe(false);
    expect(hasNatalReportCatalogCopyViolation('Ты можешь показать готовую работу раньше, чем обещал.')).toBe(false);
  });

  it.each([
    'Тебя цепляет чужая уверенность.', 'Разговор цепляешь первым.',
    'Мягкий вход, твёрдый выбор', 'Ты предпочитаешь мягкий вывод.',
    'Когда спор затягивается, ты отвечаешь жёстко.', 'На просьбу отвечаешь жёсткостью.',
    'Твой жёсткий ответ прекращает разговор.', 'You reply harshly.',
  ])('rejects pseudo-personal wording in new narrative: %s', (value) => {
    expect(hasNatalNarrativeVoiceViolation(value)).toBe(true);
  });

  it.each([
    'Тебе нравится мягкое кресло и тишина.',
    'Ты отказываешься от просьбы, если не хочешь её выполнять.',
    'Тебе проще разобраться без чужих указаний.',
    'Для ремонта ты выбираешь твёрдый материал.',
    'Ты отвечаешь за выбор жёсткого материала.',
  ])('allows concrete descriptions without banning ordinary adjectives: %s', (value) => {
    expect(hasNatalNarrativeVoiceViolation(value)).toBe(false);
  });

  it('rejects example headlines as new personalized output while keeping saved packs readable', () => {
    const raw = natalEditorialCategoryPayload(built);
    raw.summary![0].title = 'Доверяешь не сразу';
    expect(copiesNatalNarrativeExampleTitle(String(raw.summary![0].title))).toBe(true);
    expect(getNatalReportCategoryValidationIssues({ raw, built, categoryKey: 'main' })).toContain('NARRATIVE_EXAMPLE_TITLE:0');
    const saved = materialize()!;
    saved.summary[0].title = 'Мягкий вход, твёрдый выбор';
    expect(isNatalReportCategoryPack(saved)).toBe(true);
  });

  it('repairs a pseudo-personal candidate before materialization and uses the separate narrative voice', async () => {
    const valid = natalEditorialCategoryPayload(built);
    const invalid = { ...valid, summary: valid.summary!.map((item, index) => index === 0
      ? { ...item, title: 'Мягкий вход, твёрдый выбор' } : item) };
    expect(materializeNatalReportCategoryPack({ raw: invalid, built, categoryKey: 'main', language: 'ru' })).toBeNull();
    const requestStructured = jest.fn()
      .mockResolvedValueOnce({ content: JSON.stringify(invalid), responseId: 'pseudo-personal' })
      .mockResolvedValueOnce({ content: JSON.stringify(valid), responseId: 'concrete' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const report = await generateNatalReportCategoryPack({ profile, chart, categoryKey: 'main', requestStructured });
      expect(report.summary[0].title).toBe(valid.summary![0].title);
      expect(requestStructured).toHaveBeenCalledTimes(2);
      expect(requestStructured.mock.calls[0][0].instructions).toBe(getNatalNarrativeSystemPrompt('ru'));
      expect(requestStructured.mock.calls[0][0].input).toContain('140–240');
      expect(requestStructured.mock.calls[1][0].input).toContain('NARRATIVE_PLAIN_LANGUAGE_REQUIRED:summary[0].title');
      expect(requestStructured.mock.calls[1][0].input).toContain('Не заменяй слово синонимом');
      expect(getNatalReportCatalogSystemPrompt('ru')).not.toContain('ДВЕ МИНИРЕДАКТУРЫ');
    } finally { warn.mockRestore(); }
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

  it('accepts six complete concise observations without padding retries', async () => {
    const valid = natalEditorialCategoryPayload(built);
    const paragraphs = [
      'Ты быстрее берёшься за дело, когда можешь попробовать сама. Долгое обсуждение утомляет, особенно если небольшой готовый результат помог бы объяснить идею лучше подробного разговора о ней.',
      'В разговоре ты легко предлагаешь несколько вариантов и не считаешь каждый обещанием. Тебе проще обсуждать задачу с человеком, который позволяет передумать после новых подробностей без упрёков.',
      'Перед большой покупкой ты сравниваешь варианты внимательнее, чем при выборе небольшой вещи. Чужая спешка редко убеждает: гораздо интереснее понять, за что именно ты заплатишь лишние деньги.',
      'Когда человек нравится, ты охотнее предлагаешь встречу, чем пишешь длинное признание. Ответная инициатива радует, а постоянное ожидание своего первого шага со временем начинает заметно надоедать тебе.',
      'Ты охотнее исправляешь готовую работу, чем обсуждаешь подробное описание будущей. Видимый результат помогает заметить нужную поправку и понять, какая из предложенных идей действительно пригодится в деле.',
      'Ты можешь выбрать неприметную вещь, если ею приятно пользоваться каждый день. Чужой восторг не заменяет собственного интереса: популярность сама по себе редко становится решающим доводом покупки.',
    ];
    const raw = { ...valid, summary: valid.summary!.map((item, index) => ({ ...item, text: paragraphs[index] })) };
    const words = paragraphs.join(' ').match(/[\p{L}\p{N}]+/gu)!.length;
    expect(words).toBeGreaterThanOrEqual(140);
    expect(words).toBeLessThan(180);
    const requestStructured = jest.fn().mockResolvedValue({ content: JSON.stringify(raw), responseId: 'concise' });
    const report = await generateNatalReportCategoryPack({ profile, chart, categoryKey: 'main', requestStructured });
    expect(report.summary.map((item) => item.text)).toEqual(paragraphs);
    expect(requestStructured).toHaveBeenCalledTimes(1);
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

  it('replaces hidden preview cards with grounded chapter questions and ignores bad legacy previews', () => {
    const schema = buildNatalReportCategorySchema('main') as any;
    expect(schema.properties.previews.type).toBe('object');
    expect(schema.properties.previews.required).toEqual([]);
    expect(schema.properties.follow_ups).toMatchObject({ minItems: 2, maxItems: 3 });
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

  it('keeps untitled saved readings readable while requiring titles in every new observation', () => {
    const titled = materialize()!;
    const legacy = {
      ...titled, followUps: undefined,
      summary: natalEditorialParagraphs.map((text, index) => ({ text, evidenceIds: titled.summary[index].evidenceIds })),
    };
    expect(isNatalReportCategoryPack(legacy)).toBe(true);
    expect(isNatalReportCategoryPack(titled)).toBe(true);
    const raw = natalEditorialCategoryPayload(built);
    delete raw.summary![0].title;
    expect(materializeNatalReportCategoryPack({ raw, built, categoryKey: 'main', language: 'ru' })).toBeNull();
    expect(getNatalReportCategoryValidationIssues({ raw, built, categoryKey: 'main' })).toContain('SUMMARY_TITLE_INVALID:0');
  });

  it.each([
    ['placeholder', 'Наблюдение 1', 'SUMMARY_TITLE_INVALID:0'],
    ['question', 'Как ты начинаешь новое дело?', 'SUMMARY_TITLE_INVALID:0'],
    ['copied opening', natalEditorialMainParagraphs[0].split('. ')[0] + '.', 'SUMMARY_TITLE_REPEATS_TEXT:0'],
    ['visible astrology', 'Солнце в первом доме', 'COPY_VIOLATION:summary[0].title:PERSONALITY_COPY'],
  ])('rejects a %s title before persisting it', (_name, title, issue) => {
    const raw = natalEditorialCategoryPayload(built);
    raw.summary![0].title = title;
    expect(getNatalReportCategoryValidationIssues({ raw, built, categoryKey: 'main' })).toContain(issue);
    expect(materializeNatalReportCategoryPack({ raw, built, categoryKey: 'main', language: 'ru' })).toBeNull();
  });

  it('repairs a missing observation title through the existing bounded generation loop', async () => {
    const valid = natalEditorialCategoryPayload(built);
    const invalid = { ...valid, summary: valid.summary!.map((item) => ({ ...item, title: undefined })) };
    const requestStructured = jest.fn().mockResolvedValueOnce({ content: JSON.stringify(invalid), responseId: 'missing-titles' })
      .mockResolvedValueOnce({ content: JSON.stringify(valid), responseId: 'titled' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const report = await generateNatalReportCategoryPack({ profile, chart, categoryKey: 'main', requestStructured });
      expect(requestStructured).toHaveBeenCalledTimes(2);
      expect(requestStructured.mock.calls[1][0].input).toContain('SUMMARY_TITLE_INVALID:0');
      expect(report.summary.every((item) => typeof item.title === 'string')).toBe(true);
      const schema = requestStructured.mock.calls[0][0].schema;
      expect(schema.properties.summary.items.required).toContain('title');
      expect(schema.properties.summary).toMatchObject({ minItems: 6, maxItems: 8 });
    } finally { warn.mockRestore(); }
  });

  it.each(['main', 'work'] as const)('grounds %s follow-up questions in the active reading and different chapters', (categoryKey) => {
    const raw = natalEditorialCategoryPayload(built, categoryKey);
    const report = materializeNatalReportCategoryPack({ raw, built, categoryKey, language: 'ru' })!;
    expect(report.followUps).toHaveLength(2);
    const cited = new Set(report.summary.flatMap((item) => item.evidenceIds));
    expect(report.followUps!.every((item) => item.categoryKey !== categoryKey && item.evidenceIds.every((id) => cited.has(id)))).toBe(true);
    for (const change of [
      { category_key: 'main' }, { category_key: categoryKey },
      { category_key: 'invented' }, { evidence_ids: ['invented'] },
      { category_key: raw.follow_ups![1].category_key },
    ]) {
      const invalid = { ...raw, follow_ups: [{ ...raw.follow_ups![0], ...change }, raw.follow_ups![1]] };
      expect(materializeNatalReportCategoryPack({ raw: invalid, built, categoryKey, language: 'ru' })).toBeNull();
    }
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
