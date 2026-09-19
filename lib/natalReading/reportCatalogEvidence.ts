import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import {
  buildNatalModelContext,
  getNatalNarrativeEvidenceIds,
  type BuiltNatalModelContext,
  type NatalEvidenceFact,
} from './permanentReport';
import {
  selectNatalTopicEvidence,
  type NatalEvidenceTopicKey,
} from './topicSelector';
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

const ANSWER_TOPICS: Record<NatalReportAnswerKey, NatalEvidenceTopicKey> = {
  main_how_people_see_you: 'first_impression',
  main_not_seen_at_once: 'inner',
  character_decisions: 'decisions',
  character_change_mind: 'decisions',
  character_irritation: 'irritation',
  character_boredom: 'boredom',
  character_stand_ground: 'autonomy',
  character_plan_breaks: 'change',
  character_best_at: 'strengths',
  character_unusual_mix: 'character',
  love_people_you_like: 'love',
  love_show_interest: 'love',
  love_attachment_speed: 'closeness',
  love_turnoffs: 'turnoffs',
  love_lose_interest: 'love',
  love_need_freedom: 'autonomy',
  love_nonnegotiables: 'love',
  love_relationship_you_want: 'love',
  love_right_person: 'love',
  communication_new_people: 'first_impression',
  communication_direct_or_unsaid: 'communication',
  communication_texting: 'communication',
  communication_misunderstood: 'misunderstood',
  communication_criticism: 'criticism',
  communication_arguments: 'conflict',
  communication_after_fight: 'communication',
  communication_close_people: 'communication',
  communication_ask_for_help: 'communication',
  work_start_new: 'work',
  work_routine: 'work',
  work_team_or_solo: 'work',
  work_leadership: 'work',
  work_authority: 'authority',
  work_deadlines: 'deadlines',
  work_interest_killers: 'boredom',
  work_own_business: 'work',
  work_clients: 'work',
  work_best_at: 'strengths',
  money_save_or_spend: 'money',
  money_big_decisions: 'money',
  money_risk: 'risk',
  money_name_price: 'money',
  money_unnoticed_spending: 'money',
  money_independence: 'money',
  money_income_stability_freedom: 'money',
  money_shared: 'money',
  money_status_things: 'money',
};

const CATEGORY_TOPICS: Record<NatalReportCategoryKey, NatalEvidenceTopicKey> = {
  main: 'main',
  character: 'character',
  love: 'love',
  communication: 'communication',
  work: 'work',
  money: 'money',
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
  if (fact.kind === 'angle' || fact.kind === 'house') return true;
  if (fact.kind !== 'aspect' || fact.data.reliable === false) return false;
  const from = text(fact.data.fromKey || fact.data.from).toLocaleLowerCase('en-US');
  const to = text(fact.data.toKey || fact.data.to).toLocaleLowerCase('en-US');
  return built.evidenceIds.has(`natal.position.${from}`)
    && built.evidenceIds.has(`natal.position.${to}`);
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
  const topic = ANSWER_TOPICS[answerKey];
  const selected = selectNatalTopicEvidence(safeFacts, topic, { limit: 6, min: 2 });
  const evidenceIds = selected.map((fact) => fact.id);
  const requiredEvidenceIds = evidenceIds.slice(0, Math.min(3, evidenceIds.length));
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
  const narrativeIds = getNatalNarrativeEvidenceIds(built);
  const safeFacts = built.context.evidence.filter((fact) => (
    isStableNarrativeFact(fact, built, narrativeIds)
  ));
  return selectNatalTopicEvidence(
    safeFacts,
    CATEGORY_TOPICS[categoryKey],
    { limit: 6, min: 3 },
  );
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
