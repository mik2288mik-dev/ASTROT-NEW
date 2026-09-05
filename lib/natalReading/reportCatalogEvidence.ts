import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import {
  buildNatalModelContext,
  getNatalNarrativeEvidenceIds,
  type BuiltNatalModelContext,
  type NatalEvidenceFact,
  type NatalPersonalityDomain,
} from './permanentReport';
import {
  getNatalReportAnswer,
  getNatalReportCategory,
  NATAL_REPORT_MAIN_PREVIEW_KEYS,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
} from './reportCatalog';

export type NatalReportAnswerEvidencePlan = {
  answerKey: NatalReportAnswerKey;
  evidenceIds: string[];
  requiredEvidenceIds: string[];
  evidence: NatalEvidenceFact[];
};

const ANSWER_DOMAINS: Record<NatalReportAnswerKey, readonly NatalPersonalityDomain[]> = {
  main_how_people_see_you: ['first_impression', 'communication', 'base_portrait'],
  main_not_seen_at_once: ['misunderstood', 'central_contradictions', 'base_portrait'],
  character_decisions: ['thinking', 'base_portrait'],
  character_change_mind: ['thinking', 'central_contradictions', 'base_portrait'],
  character_irritation: ['conflict', 'control_freedom_trust', 'communication'],
  character_boredom: ['work_ambition', 'strengths', 'thinking'],
  character_stand_ground: ['control_freedom_trust', 'central_contradictions', 'thinking'],
  character_plan_breaks: ['conflict', 'central_contradictions', 'misunderstood'],
  character_best_at: ['strengths', 'work_ambition', 'base_portrait'],
  character_unusual_mix: ['central_contradictions', 'misunderstood', 'base_portrait'],
  love_people_you_like: ['relationships_deep', 'emotional_world', 'close_relationship'],
  love_show_interest: ['relationships_deep', 'communication', 'close_relationship'],
  love_attachment_speed: ['close_relationship', 'emotional_world', 'control_freedom_trust'],
  love_turnoffs: ['control_freedom_trust', 'conflict', 'relationships_deep'],
  love_lose_interest: ['relationships_deep', 'central_contradictions', 'control_freedom_trust'],
  love_need_freedom: ['control_freedom_trust', 'relationships_deep', 'central_contradictions'],
  love_nonnegotiables: ['control_freedom_trust', 'relationships_deep', 'close_relationship'],
  love_relationship_you_want: ['close_relationship', 'relationships_deep', 'control_freedom_trust'],
  love_right_person: ['relationships_deep', 'close_relationship', 'emotional_world'],
  communication_new_people: ['first_impression', 'communication', 'base_portrait'],
  communication_direct_or_unsaid: ['communication', 'thinking', 'misunderstood'],
  communication_texting: ['communication', 'relationships_deep', 'thinking'],
  communication_misunderstood: ['misunderstood', 'communication', 'conflict'],
  communication_criticism: ['conflict', 'thinking', 'central_contradictions'],
  communication_arguments: ['conflict', 'communication', 'control_freedom_trust'],
  communication_after_fight: ['conflict', 'close_relationship', 'emotional_world'],
  communication_close_people: ['close_relationship', 'communication', 'emotional_world'],
  communication_ask_for_help: ['close_relationship', 'control_freedom_trust', 'communication'],
  work_start_new: ['work_ambition', 'thinking', 'strengths'],
  work_routine: ['work_ambition', 'strengths', 'central_contradictions'],
  work_team_or_solo: ['work_ambition', 'communication', 'control_freedom_trust'],
  work_leadership: ['work_ambition', 'strengths', 'communication'],
  work_authority: ['control_freedom_trust', 'work_ambition', 'conflict'],
  work_deadlines: ['work_ambition', 'conflict', 'thinking'],
  work_interest_killers: ['work_ambition', 'central_contradictions', 'control_freedom_trust'],
  work_own_business: ['work_ambition', 'strengths', 'control_freedom_trust'],
  work_clients: ['work_ambition', 'communication', 'conflict'],
  work_best_at: ['strengths', 'work_ambition', 'thinking'],
  money_save_or_spend: ['thinking', 'control_freedom_trust', 'relationships_deep'],
  money_big_decisions: ['thinking', 'work_ambition', 'control_freedom_trust'],
  money_risk: ['control_freedom_trust', 'central_contradictions', 'work_ambition'],
  money_name_price: ['communication', 'work_ambition', 'control_freedom_trust'],
  money_unnoticed_spending: ['relationships_deep', 'thinking', 'central_contradictions'],
  money_independence: ['control_freedom_trust', 'work_ambition', 'thinking'],
  money_income_stability_freedom: ['work_ambition', 'control_freedom_trust', 'central_contradictions'],
  money_shared: ['close_relationship', 'control_freedom_trust', 'communication'],
  money_status_things: ['relationships_deep', 'work_ambition', 'thinking'],
};

const CATEGORY_FALLBACK_BODIES: Record<NatalReportCategoryKey, readonly string[]> = {
  main: ['sun', 'mercury', 'moon', 'mars', 'jupiter'],
  character: ['sun', 'mercury', 'mars', 'jupiter', 'saturn'],
  love: ['venus', 'moon', 'mars', 'saturn', 'mercury'],
  communication: ['mercury', 'mars', 'sun', 'moon', 'venus'],
  work: ['mars', 'saturn', 'jupiter', 'mercury', 'sun'],
  money: ['venus', 'jupiter', 'saturn', 'mercury', 'mars'],
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isStableNarrativeFact(
  fact: NatalEvidenceFact,
  built: BuiltNatalModelContext,
  narrativeIds: ReadonlySet<string>,
): boolean {
  if (!narrativeIds.has(fact.id)) return false;
  if (fact.kind === 'placement') return Boolean(text(fact.data.sign));
  if (fact.kind !== 'aspect' || fact.data.reliable === false) return false;
  const from = text(fact.data.fromKey || fact.data.from).toLocaleLowerCase('en-US');
  const to = text(fact.data.toKey || fact.data.to).toLocaleLowerCase('en-US');
  return built.evidenceIds.has(`natal.position.${from}`)
    && built.evidenceIds.has(`natal.position.${to}`);
}

function fallbackPlacementIds(
  built: BuiltNatalModelContext,
  categoryKey: NatalReportCategoryKey,
  safeIds: ReadonlySet<string>,
): string[] {
  return CATEGORY_FALLBACK_BODIES[categoryKey]
    .map((body) => `natal.position.${body}`)
    .filter((id) => safeIds.has(id));
}

export function buildNatalReportCatalogContext(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
): BuiltNatalModelContext {
  return buildNatalModelContext(profile, chart);
}

export function resolveNatalReportAnswerEvidence(
  built: BuiltNatalModelContext,
  answerKey: NatalReportAnswerKey,
): NatalReportAnswerEvidencePlan {
  const definition = getNatalReportAnswer(answerKey);
  if (!definition) throw new Error('NATAL_REPORT_ANSWER_NOT_FOUND');
  const narrativeIds = getNatalNarrativeEvidenceIds(built);
  const evidenceById = new Map(built.context.evidence.map((fact) => [fact.id, fact]));
  const safeFacts = built.context.evidence.filter((fact) => (
    isStableNarrativeFact(fact, built, narrativeIds)
  ));
  const safeIds = new Set(safeFacts.map((fact) => fact.id));
  const fallbackIds = fallbackPlacementIds(built, definition.categoryKey, safeIds);
  const mappedItems = ANSWER_DOMAINS[answerKey]
    .map((domain) => built.reportPlanByKey.get(domain))
    .filter((item): item is NonNullable<typeof item> => item != null);
  const mappedRequired = unique(mappedItems.flatMap((item) => item.requiredEvidenceIds))
    .filter((id) => safeIds.has(id));
  const mappedAllowed = unique(mappedItems.flatMap((item) => item.evidenceIds))
    .filter((id) => safeIds.has(id));
  const requiredEvidenceIds = unique([
    ...mappedRequired,
    ...fallbackIds,
  ]).slice(0, 3);
  const evidenceIds = unique([
    ...requiredEvidenceIds,
    ...mappedAllowed,
    ...fallbackIds,
  ]).slice(0, 10);
  if (evidenceIds.length === 0 || requiredEvidenceIds.length === 0) {
    throw new Error(`NATAL_REPORT_EVIDENCE_EMPTY:${answerKey}`);
  }
  return {
    answerKey,
    evidenceIds,
    requiredEvidenceIds,
    evidence: evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((fact): fact is NatalEvidenceFact => fact != null),
  };
}

export function resolveNatalReportCategoryEvidence(
  built: BuiltNatalModelContext,
  categoryKey: NatalReportCategoryKey,
): NatalReportAnswerEvidencePlan[] {
  const category = getNatalReportCategory(categoryKey);
  if (!category) throw new Error('NATAL_REPORT_CATEGORY_NOT_FOUND');
  const answerKeys: readonly NatalReportAnswerKey[] = categoryKey === 'main'
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : category.answerKeys;
  return answerKeys.map((answerKey) => (
    resolveNatalReportAnswerEvidence(built, answerKey)
  ));
}

/** A chapter draws from a compact shared set, without covering every question. */
export function resolveNatalReportNarrativeEvidence(
  built: BuiltNatalModelContext,
  categoryKey: NatalReportCategoryKey,
): NatalEvidenceFact[] {
  const safeIds = getNatalNarrativeEvidenceIds(built);
  const plans = resolveNatalReportCategoryEvidence(built, categoryKey);
  const selected = new Set(plans.flatMap((plan) => plan.evidenceIds));
  const angles = categoryKey === 'work' ? ['mc']
    : categoryKey === 'love' ? ['descendant']
    : categoryKey === 'main' ? ['ascendant', 'mc']
    : categoryKey === 'character' ? ['ascendant'] : [];
  const houses: Record<NatalReportCategoryKey, number[]> = {
    main: [1, 7, 10], character: [1], love: [5, 7],
    communication: [3, 9], work: [6, 10], money: [2, 8],
  };
  for (const angle of angles) selected.add(`natal.angle.${angle}`);
  for (const house of houses[categoryKey]) selected.add(`natal.house.${house}`);
  return built.context.evidence.filter((fact) => safeIds.has(fact.id) && selected.has(fact.id));
}

export function buildNatalReportEvidencePromptContext(
  built: BuiltNatalModelContext,
  plans: readonly NatalReportAnswerEvidencePlan[],
  narrativeEvidence: readonly NatalEvidenceFact[] = [],
) {
  const evidenceById = new Map(built.context.evidence.map((fact) => [fact.id, fact]));
  const evidenceIds = unique([
    ...plans.flatMap((plan) => plan.evidenceIds),
    ...narrativeEvidence.map((fact) => fact.id),
  ]);
  return {
    birthTimeQuality: built.birthTimeQuality,
    reliability: {
      anglesIncluded: built.anglesIncluded,
      housesIncluded: built.housesIncluded,
    },
    narrative_evidence_ids: narrativeEvidence.map((fact) => fact.id),
    answers: plans.map((plan) => ({
      answer_key: plan.answerKey,
      allowed_evidence_ids: plan.evidenceIds,
      required_evidence_ids: plan.requiredEvidenceIds,
    })),
    evidence: evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((fact): fact is NatalEvidenceFact => fact != null),
  };
}
