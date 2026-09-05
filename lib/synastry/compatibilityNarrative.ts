import type { CompatibilityEvidence, SynastryResult } from '../../types';
import type { CalculatedCompatibility } from './compatibilityEngine';

export const COMPATIBILITY_NARRATIVE_VERSION = 'compatibility-story.v1';

export type CompatibilityWriterResponse = {
  paragraphs: Array<{
    text: string;
    evidenceIds: string[];
    direction: CompatibilityEvidence['direction'];
  }>;
};

export type CompatibilityNarrativeInput = {
  subjectName: string;
  partnerName: string;
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

export function validateCompatibilityNarrative(value: unknown, calculated: CalculatedCompatibility): CompatibilityWriterResponse {
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
  const paragraphs = source.paragraphs.map((paragraph) => {
    if (!paragraph || typeof paragraph !== 'object' || typeof paragraph.text !== 'string') fail('paragraph_shape');
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
    return { text, evidenceIds: [...new Set(ids)], direction: paragraph.direction };
  });
  const words = paragraphs.map((paragraph) => paragraph.text).join(' ').match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)?.length || 0;
  if (words < (sparse ? 220 : 360) || words > 800) fail('story_length');
  if (paragraphs.filter((paragraph) => RELATIONSHIP_CAVEAT.test(paragraph.text)).length > 2) fail('repeated_relationship_caveat');
  if (usedIds.size < Math.min(3, evidence.length)) fail('insufficient_evidence_variety');
  return { paragraphs };
}

export function buildCompatibilityResult(calculated: CalculatedCompatibility, writerValue: unknown, _input?: CompatibilityNarrativeInput): SynastryResult {
  const writer = validateCompatibilityNarrative(writerValue, calculated);
  return {
    schemaVersion: 'compatibility-v2',
    narrativeVersion: COMPATIBILITY_NARRATIVE_VERSION,
    narrativeEvidenceIds: [...new Set(writer.paragraphs.flatMap((paragraph) => paragraph.evidenceIds))],
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
