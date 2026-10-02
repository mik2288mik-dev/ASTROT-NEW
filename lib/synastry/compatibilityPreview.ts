import type { CompatibilityEvidence } from '../../types';
import type { CalculatedCompatibility } from './compatibilityEngine';
import type { CompatibilityQuestionAnswer } from './compatibilityQuestions';
import { compatibilityFactIsEasy, plainCompatibilityFact } from './compatibilityPlainFacts';
import type { RelationshipContext } from './relationshipContext';
import type { PairTalkDay } from './pairTalkCalendar';

/**
 * Free compatibility result: calculated locally, no AI. Every question gets its
 * short answer; the strongest and the weakest get a full plain explanation,
 * the rest stay closed until the full reading.
 */

export const COMPATIBILITY_PREVIEW_VERSION = 'compatibility-preview.v1';

export type CompatibilityPreviewQuestion = CompatibilityQuestionAnswer & {
  explanation: string | null;
  locked: boolean;
};

export type CompatibilityPreview = {
  previewVersion: typeof COMPATIBILITY_PREVIEW_VERSION;
  engineVersion: string;
  relationshipContext: RelationshipContext;
  calculationLevel: CalculatedCompatibility['calculationLevel'];
  overallScore: number;
  questions: CompatibilityPreviewQuestion[];
  /** What the full reading adds, named concretely for this pair. */
  lockedExtras: string[];
  limitations: string[];
  /** Overall result of the same pair for every relationship type, for the topic switcher. */
  topics?: Array<{ context: Exclude<RelationshipContext, 'ex'>; overallScore: number }>;
  /** Days ahead when an important talk is easier or harder. */
  talkDays?: PairTalkDay[];
};

function explain(
  question: CompatibilityQuestionAnswer,
  calculated: CalculatedCompatibility,
  evidenceById: Map<string, CompatibilityEvidence>,
  usedFacts: Set<string>,
  language: 'ru' | 'en',
): string | null {
  const positive = question.answer === 'yes' || question.answer === 'likely';
  const dimensions = calculated.dimensions.filter((item) => question.dimensionIds.includes(item.id));
  const primary = dimensions.flatMap((item) => (positive ? item.supportiveEvidenceIds : item.challengingEvidenceIds));
  const secondary = dimensions.flatMap((item) => (positive ? item.challengingEvidenceIds : item.supportiveEvidenceIds));
  // The everyday wording of a fact must point the same way as the answer:
  // a contact can raise attraction and still read as pressure, so it cannot explain a «yes».
  const factFor = (id: string, easy: boolean): string | null => {
    const evidence = evidenceById.get(id);
    if (!evidence || compatibilityFactIsEasy(evidence) !== easy) return null;
    return plainCompatibilityFact(evidence, language);
  };
  const facts: string[] = [];
  for (const id of primary) {
    const fact = factFor(id, positive);
    if (fact && !usedFacts.has(fact) && !facts.includes(fact)) facts.push(fact);
    if (facts.length === 2) break;
  }
  if (!facts.length) return null;
  // One honest counterweight keeps a «yes» from sounding like a promise and a «no» from sounding final.
  if (question.answer === 'mixed' || facts.length < 2) {
    for (const id of secondary) {
      const fact = factFor(id, !positive);
      if (fact && !usedFacts.has(fact) && !facts.includes(fact)) {
        facts.push((language === 'en' ? 'At the same time: ' : 'При этом ') + fact.charAt(0).toLowerCase() + fact.slice(1));
        break;
      }
    }
  }
  facts.forEach((fact) => usedFacts.add(fact));
  return facts.join(' ');
}

export function buildCompatibilityPreview(
  calculated: CalculatedCompatibility,
  names: { subject: string; partner: string },
  language: 'ru' | 'en',
): CompatibilityPreview {
  const evidenceById = new Map(calculated.evidence.map((item) => [item.id, item]));
  const answered = calculated.questions.filter((item) => item.score != null);
  const byScore = [...answered].sort((first, second) => (second.score! - first.score!) || (second.confidence - first.confidence));
  const usedFacts = new Set<string>();
  const explanations = new Map<string, string>();

  // Strongest side first, then the hardest: try candidates in order until one has real facts behind it.
  for (const candidates of [byScore, [...byScore].reverse()]) {
    for (const question of candidates) {
      if (explanations.has(question.id)) continue;
      const text = explain(question, calculated, evidenceById, usedFacts, language);
      if (text) {
        explanations.set(question.id, text);
        break;
      }
    }
  }

  const ru = language !== 'en';
  const lockedExtras: string[] = [];
  const directions = new Set(calculated.directionalPatterns.map((item) => item.direction));
  if (directions.has('subject_to_partner') || directions.has('partner_to_subject')) {
    lockedExtras.push(ru
      ? `Кто на кого как влияет: ${names.subject} и ${names.partner}`
      : `Who affects whom and how: ${names.subject} and ${names.partner}`);
  }
  if (directions.has('mutual')) {
    lockedExtras.push(ru ? 'Спор, который у вас повторяется, и как его не повторять' : 'The argument that keeps repeating and how to stop it');
  }
  lockedExtras.push(ru ? 'Что делать в каждой ситуации — по каждому вопросу' : 'What to do in each situation, for every question');
  lockedExtras.push(ru ? 'На каких данных основан каждый ответ' : 'What each answer is based on');

  return {
    previewVersion: COMPATIBILITY_PREVIEW_VERSION,
    engineVersion: calculated.engineVersion,
    relationshipContext: calculated.relationshipContext,
    calculationLevel: calculated.calculationLevel,
    overallScore: calculated.overallScore,
    questions: calculated.questions.map((question) => ({
      ...question,
      explanation: explanations.get(question.id) || null,
      locked: question.score != null && !explanations.has(question.id),
    })),
    lockedExtras,
    limitations: calculated.limitations,
  };
}
