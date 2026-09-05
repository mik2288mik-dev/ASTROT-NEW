import type { CompatibilityEvidence, SynastryResult } from '../../types';
import type { CalculatedCompatibility } from './compatibilityEngine';
import { COMPATIBILITY_STORY_TOPICS, type CompatibilityStoryTopic } from './storyTopics';

export const COMPATIBILITY_NARRATIVE_VERSION = 'compatibility-story.v2';

export type CompatibilityWriterResponse = {
  paragraphs: Array<{
    topic: CompatibilityStoryTopic;
    text: string;
    evidenceIds: string[];
    direction: CompatibilityEvidence['direction'];
  }>;
};

export type CompatibilityNarrativeInput = {
  subjectName: string;
  partnerName: string;
  subjectGender?: 'male' | 'female' | 'unspecified';
  partnerGender?: 'male' | 'female' | 'unspecified';
  language: 'ru' | 'en';
};

export class CompatibilityNarrativeError extends Error {
  constructor(public readonly reason: string) {
    super(`SYNASTRY_NARRATIVE_INVALID:${reason}`);
    this.name = 'CompatibilityNarrativeError';
  }
}

/** The writer and validator must use the same bounded set of actual pair evidence. */
export function selectCompatibilityWriterEvidence(calculated: CalculatedCompatibility): CompatibilityEvidence[] {
  const relevantIds = new Set([
    ...calculated.sectionPlan.flatMap((section) => section.evidenceIds),
    ...calculated.directionalPatterns.flatMap((pattern) => pattern.evidenceIds),
  ]);
  return calculated.evidence
    .filter((item) => relevantIds.has(item.id))
    .sort((first, second) => second.weight - first.weight)
    .slice(0, 36);
}

const FORBIDDEN_PROSE = [
  /\d+(?:[.,]\d+)?\s*(?:%|процент|балл|из\s+(?:10|100)\b|out of\s+(?:10|100)\b)/iu,
  /(?:совместимость|compatibility\s*(?:score|rating))\s*[:=—-]?\s*\d/iu,
  /(?:он|она|партн[её]р)\s+(?:точно\s+|тайно\s+|всё ещё\s+|по-прежнему\s+)?(?:люб[иы]т|влюбл[её]н|скучает|ревнует|хочет вернуться)/iu,
  /(?:he|she|your partner)\s+(?:secretly\s+|still\s+)?(?:loves you|misses you|wants you back)/iu,
  /(?:любит тебя|влюбл[её]н[а]? в тебя|верн[её]тся к тебе|вы поженитесь|вы никогда не расстанетесь|you will get married)/iu,
  /(?:вы\s+обязательно\s+(?:будете|помиритесь)|(?:он|она)\s+(?:обязательно\s+)?верн[её]тся|суждено быть вместе|кармическ\p{L}*\s+(?:союз|связь|урок)|you are destined|(?:he|she) will (?:definitely )?come back)/iu,
  /(?:\b(?:ASC|MC|orb|sextile|trine)\b|секстил\p{L}*|квадратур\p{L}*|орбис\p{L}*|\d+(?:[.,]\d+)?\s*°)/iu,
  /(?:между вами присутствует|в этой связи наблюдается|возникает динамика|считывается|держать фокус|бережно проживать|экологично выстраивать)/iu,
];

const RELATIONSHIP_CAVEAT = /(?:не\s+(?:(?:автоматически|обязательно)\s+)?(?:подтвержда\p{L}*|доказыва\p{L}*|означа\p{L}*|говор\p{L}*|доказательств\p{L}*)[^.!?]*(?:взаимн|чувств|намерен|романтическ|интерес)|взаимность[^.!?]*(?:предполож|догад|неизвест)|(?:does not|doesn't|not a)\s+(?:prove|confirm|mean|proof)[^.!?]*(?:feeling|intention|interest|reciproc))/iu;

function fail(reason: string): never {
  throw new CompatibilityNarrativeError(reason);
}

const RUSSIAN_PERSON_FORMS = [
  ['способен', 'способна'], ['готов', 'готова'], ['уверен', 'уверена'], ['склонен', 'склонна'],
  ['согласен', 'согласна'], ['обязан', 'обязана'], ['внимателен', 'внимательна'], ['сам', 'сама'],
  ['первый', 'первая'], ['первым', 'первой'],
  ['сделал', 'сделала'], ['сказал', 'сказала'], ['ответил', 'ответила'], ['предложил', 'предложила'],
  ['решил', 'решила'], ['заметил', 'заметила'], ['понял', 'поняла'], ['начал', 'начала'],
  ['выбрал', 'выбрала'], ['согласился', 'согласилась'], ['отказался', 'отказалась'],
  ['заинтересовался', 'заинтересовалась'], ['привык', 'привыкла'], ['устал', 'устала'],
  ['был', 'была'], ['хотел', 'хотела'], ['почувствовал', 'почувствовала'],
  ['пришёл', 'пришла'], ['пришел', 'пришла'], ['мог', 'могла'], ['взял', 'взяла'],
] as const;
const RUSSIAN_PREDICATE_MODIFIERS = '(?:(?:тоже|также|уже|ещё|еще|обычно|иногда|часто|вполне|всегда|не|может|быть|сразу|пока|очень|скорее|в этом случае|в этом сценарии)\\s+){0,5}';
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function firstName(value: string): string {
  const name = value.trim();
  if (/^(?:(?:первый|второй) человек|(?:first|second) person)$/iu.test(name)) return '';
  return name.split(/\s+/u)[0] || '';
}

function readerNameForms(name: string, language: 'ru' | 'en'): string[] {
  const forms = [name];
  if (language === 'ru' && name.length > 2 && /[ая]$/iu.test(name)) {
    const stem = name.slice(0, -1);
    forms.push(...(/а$/iu.test(name) ? ['е', 'у', 'ы', 'и', 'ой'] : ['е', 'ю', 'и', 'ей']).map((ending) => stem + ending));
  }
  return forms;
}

/** Target explicit person predicates, not arbitrary Russian word endings or third parties. */
function validateReaderVoice(paragraphs: CompatibilityWriterResponse['paragraphs'], input: CompatibilityNarrativeInput): void {
  const text = paragraphs.map((paragraph) => paragraph.text).join(' ');
  const directAddress = input.language === 'ru'
    ? /(?:^|[^\p{L}])(?:ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоего|твоей|твоих|твоему|твоим|твою|твоими)(?=$|[^\p{L}])/iu
    : /\b(?:you|your|yours|yourself)\b/iu;
  if (!directAddress.test(text)) fail('reader_address_missing');
  const subject = firstName(input.subjectName);
  const partner = firstName(input.partnerName);
  const namesDistinct = subject.toLocaleLowerCase() !== partner.toLocaleLowerCase();
  if (subject && namesDistinct) {
    const forms = readerNameForms(subject, input.language).map(escapeRegex).join('|');
    // A single greeting ("Лина, ты…") or quoted mention is fine; a story about Lina is not.
    const mentions = text.match(new RegExp(`(?:^|[^\\p{L}])(?:${forms})(?=$|[^\\p{L}])(?!\\s*,)`, 'giu')) || [];
    if (mentions.length >= 3) fail('reader_third_person');
  }
  for (const person of [
    { name: subject, gender: input.subjectGender, subject: true },
    { name: partner, gender: input.partnerGender, subject: false },
  ]) {
    if (!person.gender) continue; // Older callers without person metadata retain their existing contract.
    const names = person.name && namesDistinct ? [escapeRegex(person.name)] : [];
    if (person.subject && input.language === 'ru') names.push('ты');
    if (!names.length) continue;
    if (input.language === 'ru') {
      const forbidden = RUSSIAN_PERSON_FORMS.flatMap(([male, female]) => person.gender === 'male' ? [female] : person.gender === 'female' ? [male] : [male, female]);
      const predicate = new RegExp(`(?:^|[^\\p{L}])(?:${names.join('|')})\\s+${RUSSIAN_PREDICATE_MODIFIERS}(?:${forbidden.join('|')})(?=$|[^\\p{L}])`, 'iu');
      if (predicate.test(text)) fail(person.gender === 'unspecified' ? 'unspecified_gender_inferred' : 'reader_gender_mismatch');
    } else if (person.gender === 'unspecified') {
      const apposition = new RegExp(`\\b(?:${names.join('|')})\\s*[,—-]\\s*(?:he|she|his|her|him)\\b`, 'iu');
      if (apposition.test(text)) fail('unspecified_gender_inferred');
    }
  }
}

export function validateCompatibilityNarrative(value: unknown, calculated: CalculatedCompatibility, input?: CompatibilityNarrativeInput): CompatibilityWriterResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('shape');
  const source = value as Partial<CompatibilityWriterResponse>;
  if (!Array.isArray(source.paragraphs)) fail('paragraphs_missing');
  const evidence = selectCompatibilityWriterEvidence(calculated);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  if (!evidence.length) fail('evidence_missing');
  const sparse = evidence.length < 6;
  if (source.paragraphs.length < (sparse ? 4 : 7) || source.paragraphs.length > 10) fail('paragraph_count');
  const signatures = new Set<string>();
  const usedIds = new Set<string>();
  const usedTopics = new Set<CompatibilityStoryTopic>();
  let previousTopic: CompatibilityStoryTopic | null = null;
  const paragraphs = source.paragraphs.map((paragraph) => {
    if (!paragraph || typeof paragraph !== 'object' || typeof paragraph.text !== 'string') fail('paragraph_shape');
    if (!COMPATIBILITY_STORY_TOPICS.includes(paragraph.topic)) fail('topic_missing');
    if (paragraph.topic !== previousTopic && usedTopics.has(paragraph.topic)) fail('topic_repeated');
    usedTopics.add(paragraph.topic);
    previousTopic = paragraph.topic;
    const raw = paragraph.text.trim();
    if (/\n|^\s*(?:#{1,6}\s|[-*•]\s|\d+[.)]\s)|\*\*|\?/u.test(raw)) fail('prose_format');
    const text = raw.replace(/\s+/gu, ' ');
    if (text.length < 100 || FORBIDDEN_PROSE.some((pattern) => pattern.test(text))) fail('prose_content');
    const signature = text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (signatures.has(signature)) fail('repeated_paragraph');
    signatures.add(signature);
    const ids = paragraph.evidenceIds;
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== 'string' || !evidenceById.has(id))) fail('unknown_evidence');
    if (!['mutual', 'subject_to_partner', 'partner_to_subject'].includes(paragraph.direction)) fail('direction_missing');
    if (paragraph.direction !== 'mutual') {
      // A mutual aspect alone does not establish who affects whom.
      const supported = calculated.directionalPatterns.some((pattern) =>
        pattern.direction === paragraph.direction && pattern.evidenceIds.some((id) => ids.includes(id)),
      ) || ids.some((id) => evidenceById.get(id)?.direction === paragraph.direction);
      if (!supported) fail('unsupported_direction');
    } else if (!ids.some((id) => evidenceById.get(id)?.direction === 'mutual')
      && !calculated.directionalPatterns.some((pattern) => pattern.direction === 'mutual' && pattern.evidenceIds.every((id) => ids.includes(id)))) {
      fail('unsupported_mutual_direction');
    }
    ids.forEach((id) => usedIds.add(id));
    return { topic: paragraph.topic, text, evidenceIds: [...new Set(ids)], direction: paragraph.direction };
  });
  const words = paragraphs.map((paragraph) => paragraph.text).join(' ').match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)?.length || 0;
  if (words < (sparse ? 220 : 360) || words > 800) fail('story_length');
  if (paragraphs.filter((paragraph) => RELATIONSHIP_CAVEAT.test(paragraph.text)).length > 2) fail('repeated_relationship_caveat');
  if (usedIds.size < Math.min(3, evidence.length)) fail('insufficient_evidence_variety');
  if (usedTopics.size < (sparse ? 3 : 4)) fail('topics_too_narrow');
  if (input) validateReaderVoice(paragraphs, input);
  return { paragraphs };
}

export function buildCompatibilityResult(calculated: CalculatedCompatibility, writerValue: unknown, input?: CompatibilityNarrativeInput): SynastryResult {
  const writer = validateCompatibilityNarrative(writerValue, calculated, input);
  return {
    schemaVersion: 'compatibility-v2',
    narrativeVersion: COMPATIBILITY_NARRATIVE_VERSION,
    narrativeEvidenceIds: [...new Set(writer.paragraphs.flatMap((paragraph) => paragraph.evidenceIds))],
    storyParagraphs: writer.paragraphs,
    engineVersion: calculated.engineVersion,
    // Retained for stored API compatibility; the story UI does not display scores.
    overallScore: calculated.overallScore,
    compatibilityScore: calculated.overallScore,
    verdict: calculated.verdict,
    relationshipContext: calculated.relationshipContext,
    calculationLevel: calculated.calculationLevel,
    dimensions: calculated.dimensions,
    strongestDimensions: calculated.strongestDimensions,
    challengingDimensions: calculated.challengingDimensions,
    sections: [],
    evidence: calculated.evidence,
    directionalPatterns: calculated.directionalPatterns,
    limitations: calculated.limitations,
    summary: writer.paragraphs.map((paragraph) => paragraph.text).join('\n\n'),
  };
}
