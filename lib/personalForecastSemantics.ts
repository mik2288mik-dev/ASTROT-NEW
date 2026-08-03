import type { NatalChartData } from '../types';
import type {
  CalculatedAstroEvidence,
  PersonalForecastPeriod,
} from './personalForecastContract';
import type {
  PersonalForecastCalculatedEvidence,
  PersonalForecastStationDirection,
} from './personalForecastEvidence';

export const PERSONAL_FORECAST_SEMANTICS_VERSION = 'personal-forecast-semantics-v3';

export type ForecastSemanticDomain =
  | 'identity_priorities'
  | 'emotional_response'
  | 'communication_decisions'
  | 'values_agreements'
  | 'action_boundaries'
  | 'growth_judgment'
  | 'responsibility_limits'
  | 'self_presentation'
  | 'change_autonomy'
  | 'imagination_clarity'
  | 'power_control'
  | 'cycle_attention';

export type ForecastLifeContext =
  | 'self_presentation'
  | 'personal_resources'
  | 'communication_learning'
  | 'home_foundation'
  | 'creative_expression'
  | 'work_routines'
  | 'partnerships'
  | 'shared_resources'
  | 'study_travel'
  | 'career_public_role'
  | 'groups_networks'
  | 'rest_private_life';

export type ForecastTransitMechanism =
  | 'focus_visibility'
  | 'tempo_fluctuation'
  | 'information_exchange'
  | 'value_alignment'
  | 'action_pressure'
  | 'expansion'
  | 'constraint_structure'
  | 'disruption'
  | 'diffusion'
  | 'intensification';

export type ForecastDynamicMechanism =
  | 'concentration'
  | 'opening'
  | 'flow'
  | 'friction'
  | 'polarization'
  | 'ongoing_activation'
  | 'sign_transition'
  | 'station_turn_direct'
  | 'station_turn_retrograde'
  | 'station_pause'
  | 'new_cycle'
  | 'culmination'
  | 'low_signal';

export type ForecastClaimAtom =
  | 'priorities_are_temporarily_active'
  | 'emotional_responses_are_temporarily_active'
  | 'communication_and_decisions_are_temporarily_active'
  | 'values_and_agreements_are_temporarily_active'
  | 'action_and_boundaries_are_temporarily_active'
  | 'growth_and_judgment_are_temporarily_active'
  | 'limits_and_commitments_are_temporarily_active'
  | 'immediate_responses_are_temporarily_active'
  | 'change_and_autonomy_are_temporarily_active'
  | 'clarity_and_imagination_are_temporarily_active'
  | 'power_and_control_are_temporarily_active'
  | 'temporary_focus_is_concentrated'
  | 'temporary_support_is_available'
  | 'temporary_friction_requires_precision'
  | 'two_sides_temporarily_require_balance'
  | 'reliable_house_defines_context'
  | 'house_context_is_temporarily_active'
  | 'context_is_entering_a_new_phase'
  | 'process_is_turning_direct'
  | 'process_is_turning_retrograde'
  | 'process_is_near_a_station'
  | 'attention_cycle_is_beginning'
  | 'attention_cycle_is_culminating'
  | 'no_single_theme_dominates_period'
  | 'ordinary_priorities_can_remain_in_place';

export type ForecastManifestationAtom =
  | 'priority_competition_becomes_visible'
  | 'response_tempo_changes'
  | 'conversation_tempo_changes'
  | 'details_require_review'
  | 'agreement_terms_become_more_noticeable'
  | 'value_mismatch_becomes_more_noticeable'
  | 'urge_to_act_becomes_more_noticeable'
  | 'boundary_response_becomes_more_noticeable'
  | 'scope_of_a_choice_becomes_more_noticeable'
  | 'expectations_expand'
  | 'constraint_or_deadline_becomes_more_noticeable'
  | 'responsibility_order_becomes_more_noticeable'
  | 'first_reaction_becomes_more_visible'
  | 'need_for_independence_becomes_more_noticeable'
  | 'unclear_signal_requires_separation_from_fact'
  | 'control_pressure_becomes_more_noticeable'
  | 'self_presentation_context_becomes_more_noticeable'
  | 'resource_choices_become_more_noticeable'
  | 'communication_or_learning_context_becomes_more_noticeable'
  | 'home_context_becomes_more_noticeable'
  | 'creative_context_becomes_more_noticeable'
  | 'routine_or_workload_context_becomes_more_noticeable'
  | 'partnership_context_becomes_more_noticeable'
  | 'shared_resource_context_becomes_more_noticeable'
  | 'study_or_travel_context_becomes_more_noticeable'
  | 'career_or_public_context_becomes_more_noticeable'
  | 'group_or_network_context_becomes_more_noticeable'
  | 'rest_or_private_context_becomes_more_noticeable'
  | 'previous_step_returns_for_review'
  | 'stalled_step_can_begin_to_move'
  | 'direction_is_not_yet_confirmed'
  | 'new_priority_becomes_visible'
  | 'existing_development_reaches_a_visible_peak'
  | 'confirmed_signals_remain_distributed';

export type ForecastRiskAtom =
  | 'defending_a_priority_before_checking_the_facts'
  | 'treating_a_temporary_reaction_as_a_final_position'
  | 'impulsive_reply_or_missed_detail'
  | 'agreeing_before_terms_are_clear'
  | 'acting_before_sequence_and_limit_are_clear'
  | 'overestimating_scope_or_probability'
  | 'ignoring_a_real_limit_or_commitment'
  | 'reacting_before_reading_the_situation'
  | 'breaking_a_working_structure_only_to_escape_pressure'
  | 'treating_an_assumption_as_a_fact'
  | 'forcing_an_outcome_to_regain_control'
  | 'overestimating_ease'
  | 'forcing_progress_during_a_review_phase'
  | 'resuming_before_the_final_check'
  | 'assuming_direction_before_it_is_confirmed'
  | 'treating_context_as_a_guaranteed_event'
  | 'treating_a_short_cycle_as_a_permanent_conclusion'
  | 'forcing_a_story_from_weak_signals';

export type ForecastActionAtom =
  | 'name_one_priority_and_one_tradeoff'
  | 'pause_before_answering_from_a_temporary_reaction'
  | 'verify_wording_numbers_and_sequence'
  | 'state_terms_and_boundaries_explicitly'
  | 'choose_the_next_action_not_the_whole_battle'
  | 'test_scope_against_available_time_and_facts'
  | 'separate_fixed_limits_from_negotiable_conditions'
  | 'observe_the_first_reaction_before_acting_on_it'
  | 'change_one_constraint_at_a_time'
  | 'separate_observation_from_interpretation'
  | 'identify_what_can_and_cannot_be_controlled'
  | 'use_support_for_one_specific_step'
  | 'revisit_the_unresolved_step'
  | 'restart_only_after_a_final_check'
  | 'wait_for_direction_to_confirm'
  | 'apply_the_factor_only_inside_the_reliable_context'
  | 'observe_the_transition_before_committing'
  | 'name_one_observable_priority_for_the_cycle'
  | 'keep_plans_proportional_to_confirmed_signals';

export type ForecastForbiddenClaimClass =
  | 'permanent_personality'
  | 'guaranteed_event'
  | 'medical_or_psychological_diagnosis'
  | 'invented_biography'
  | 'third_party_intention'
  | 'quantified_outcome'
  | 'event_as_already_happened'
  | 'unsupported_life_domain'
  | 'unsupported_house_or_angle'
  | 'specific_relationship_event'
  | 'specific_financial_event'
  | 'specific_relocation_event'
  | 'retrograde_claim_without_direction';

export type ForecastSemanticTiming = {
  scope: 'temporary';
  period: PersonalForecastPeriod;
  phase: CalculatedAstroEvidence['status'];
  startsAt: string | null;
  endsAt: string | null;
  exactAt: string | null;
};

export type ForecastSemanticFact = {
  id: string;
  semanticVersion: typeof PERSONAL_FORECAST_SEMANTICS_VERSION;
  evidenceIds: string[];
  evidenceFingerprint: string;
  semanticFingerprint: string;
  sourceKind: CalculatedAstroEvidence['kind'];
  transitPlanet: string | null;
  natalPoint: string | null;
  aspect: string | null;
  house: number | null;
  domain: ForecastSemanticDomain;
  lifeContext: ForecastLifeContext | null;
  mechanism: {
    transit: ForecastTransitMechanism;
    dynamic: ForecastDynamicMechanism;
    stationDirection: PersonalForecastStationDirection | null;
  };
  timing: ForecastSemanticTiming;
  confidence: 'high' | 'medium' | 'low';
  strength: number;
  allowedClaimAtoms: ForecastClaimAtom[];
  allowedManifestationAtoms: ForecastManifestationAtom[];
  allowedRiskAtoms: ForecastRiskAtom[];
  allowedActionAtoms: ForecastActionAtom[];
  forbiddenClaimClasses: ForecastForbiddenClaimClass[];
};

type DomainRule = {
  domain: ForecastSemanticDomain;
  claim: ForecastClaimAtom;
  manifestations: ForecastManifestationAtom[];
  risk: ForecastRiskAtom;
  action: ForecastActionAtom;
};

const POINT_RULES: Record<string, DomainRule> = {
  sun: {
    domain: 'identity_priorities',
    claim: 'priorities_are_temporarily_active',
    manifestations: ['priority_competition_becomes_visible'],
    risk: 'defending_a_priority_before_checking_the_facts',
    action: 'name_one_priority_and_one_tradeoff',
  },
  moon: {
    domain: 'emotional_response',
    claim: 'emotional_responses_are_temporarily_active',
    manifestations: ['response_tempo_changes'],
    risk: 'treating_a_temporary_reaction_as_a_final_position',
    action: 'pause_before_answering_from_a_temporary_reaction',
  },
  mercury: {
    domain: 'communication_decisions',
    claim: 'communication_and_decisions_are_temporarily_active',
    manifestations: ['conversation_tempo_changes', 'details_require_review'],
    risk: 'impulsive_reply_or_missed_detail',
    action: 'verify_wording_numbers_and_sequence',
  },
  venus: {
    domain: 'values_agreements',
    claim: 'values_and_agreements_are_temporarily_active',
    manifestations: ['agreement_terms_become_more_noticeable', 'value_mismatch_becomes_more_noticeable'],
    risk: 'agreeing_before_terms_are_clear',
    action: 'state_terms_and_boundaries_explicitly',
  },
  mars: {
    domain: 'action_boundaries',
    claim: 'action_and_boundaries_are_temporarily_active',
    manifestations: ['urge_to_act_becomes_more_noticeable', 'boundary_response_becomes_more_noticeable'],
    risk: 'acting_before_sequence_and_limit_are_clear',
    action: 'choose_the_next_action_not_the_whole_battle',
  },
  jupiter: {
    domain: 'growth_judgment',
    claim: 'growth_and_judgment_are_temporarily_active',
    manifestations: ['scope_of_a_choice_becomes_more_noticeable', 'expectations_expand'],
    risk: 'overestimating_scope_or_probability',
    action: 'test_scope_against_available_time_and_facts',
  },
  saturn: {
    domain: 'responsibility_limits',
    claim: 'limits_and_commitments_are_temporarily_active',
    manifestations: ['constraint_or_deadline_becomes_more_noticeable', 'responsibility_order_becomes_more_noticeable'],
    risk: 'ignoring_a_real_limit_or_commitment',
    action: 'separate_fixed_limits_from_negotiable_conditions',
  },
  rising: {
    domain: 'self_presentation',
    claim: 'immediate_responses_are_temporarily_active',
    manifestations: ['first_reaction_becomes_more_visible'],
    risk: 'reacting_before_reading_the_situation',
    action: 'observe_the_first_reaction_before_acting_on_it',
  },
  mc: {
    domain: 'identity_priorities',
    claim: 'priorities_are_temporarily_active',
    manifestations: ['priority_competition_becomes_visible'],
    risk: 'defending_a_priority_before_checking_the_facts',
    action: 'name_one_priority_and_one_tradeoff',
  },
  uranus: {
    domain: 'change_autonomy',
    claim: 'change_and_autonomy_are_temporarily_active',
    manifestations: ['need_for_independence_becomes_more_noticeable'],
    risk: 'breaking_a_working_structure_only_to_escape_pressure',
    action: 'change_one_constraint_at_a_time',
  },
  neptune: {
    domain: 'imagination_clarity',
    claim: 'clarity_and_imagination_are_temporarily_active',
    manifestations: ['unclear_signal_requires_separation_from_fact'],
    risk: 'treating_an_assumption_as_a_fact',
    action: 'separate_observation_from_interpretation',
  },
  pluto: {
    domain: 'power_control',
    claim: 'power_and_control_are_temporarily_active',
    manifestations: ['control_pressure_becomes_more_noticeable'],
    risk: 'forcing_an_outcome_to_regain_control',
    action: 'identify_what_can_and_cannot_be_controlled',
  },
};

const TRANSIT_MECHANISMS: Record<string, ForecastTransitMechanism> = {
  sun: 'focus_visibility',
  moon: 'tempo_fluctuation',
  mercury: 'information_exchange',
  venus: 'value_alignment',
  mars: 'action_pressure',
  jupiter: 'expansion',
  saturn: 'constraint_structure',
  uranus: 'disruption',
  neptune: 'diffusion',
  pluto: 'intensification',
};

const ASPECT_DYNAMICS: Record<string, ForecastDynamicMechanism> = {
  conjunction: 'concentration',
  sextile: 'opening',
  square: 'friction',
  trine: 'flow',
  opposition: 'polarization',
};

const DYNAMIC_CLAIMS: Partial<Record<ForecastDynamicMechanism, ForecastClaimAtom>> = {
  concentration: 'temporary_focus_is_concentrated',
  opening: 'temporary_support_is_available',
  flow: 'temporary_support_is_available',
  friction: 'temporary_friction_requires_precision',
  polarization: 'two_sides_temporarily_require_balance',
};

type ContextRule = {
  context: ForecastLifeContext;
  manifestation: ForecastManifestationAtom;
};

const HOUSE_CONTEXTS: Record<number, ContextRule> = {
  1: { context: 'self_presentation', manifestation: 'self_presentation_context_becomes_more_noticeable' },
  2: { context: 'personal_resources', manifestation: 'resource_choices_become_more_noticeable' },
  3: { context: 'communication_learning', manifestation: 'communication_or_learning_context_becomes_more_noticeable' },
  4: { context: 'home_foundation', manifestation: 'home_context_becomes_more_noticeable' },
  5: { context: 'creative_expression', manifestation: 'creative_context_becomes_more_noticeable' },
  6: { context: 'work_routines', manifestation: 'routine_or_workload_context_becomes_more_noticeable' },
  7: { context: 'partnerships', manifestation: 'partnership_context_becomes_more_noticeable' },
  8: { context: 'shared_resources', manifestation: 'shared_resource_context_becomes_more_noticeable' },
  9: { context: 'study_travel', manifestation: 'study_or_travel_context_becomes_more_noticeable' },
  10: { context: 'career_public_role', manifestation: 'career_or_public_context_becomes_more_noticeable' },
  11: { context: 'groups_networks', manifestation: 'group_or_network_context_becomes_more_noticeable' },
  12: { context: 'rest_private_life', manifestation: 'rest_or_private_context_becomes_more_noticeable' },
};

const BASE_FORBIDDEN_CLAIMS: ForecastForbiddenClaimClass[] = [
  'permanent_personality',
  'guaranteed_event',
  'medical_or_psychological_diagnosis',
  'invented_biography',
  'third_party_intention',
  'quantified_outcome',
  'event_as_already_happened',
  'unsupported_life_domain',
  'specific_relationship_event',
  'specific_financial_event',
  'specific_relocation_event',
];

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function chartReliability(chartData: NatalChartData): {
  ascendantReliable: boolean;
  housesReliable: boolean;
} {
  const quality = chartData.chartQuality;
  const birthTimeQuality = chartData.birthTimeQuality
    || quality?.birthTimeQuality
    || 'unknown';
  const exact = birthTimeQuality === 'exact';
  return {
    ascendantReliable: exact && quality?.ascendantReliable !== false,
    housesReliable: (
      exact
      && quality?.housesReliable !== false
      && quality?.houseBasedPersonalization !== false
      && Array.isArray(chartData.houses)
      && chartData.houses.length >= 12
    ),
  };
}

function validHouse(value: number | null | undefined): number | null {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12
    ? Number(value)
    : null;
}

function confidenceFor(
  evidence: PersonalForecastCalculatedEvidence,
  options?: { weaker?: boolean },
): ForecastSemanticFact['confidence'] {
  let score = Math.max(0, Math.min(100, Number(evidence.strength) || 0));
  if (evidence.status === 'exact') score += 10;
  if (evidence.status === 'applying') score += 5;
  if (typeof evidence.orb === 'number' && evidence.orb <= 1) score += 5;
  if (options?.weaker) score -= 15;
  return score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
}

function dynamicRisk(
  dynamic: ForecastDynamicMechanism,
  rule: DomainRule,
): ForecastRiskAtom[] {
  if (dynamic === 'friction' || dynamic === 'polarization' || dynamic === 'concentration') {
    return [rule.risk];
  }
  return ['overestimating_ease'];
}

function dynamicAction(
  dynamic: ForecastDynamicMechanism,
  rule: DomainRule,
): ForecastActionAtom[] {
  if (dynamic === 'opening' || dynamic === 'flow') {
    return ['use_support_for_one_specific_step', rule.action];
  }
  return [rule.action];
}

function stationDynamic(
  direction: PersonalForecastStationDirection,
): ForecastDynamicMechanism {
  if (direction === 'direct') return 'station_turn_direct';
  if (direction === 'retrograde') return 'station_turn_retrograde';
  return 'station_pause';
}

function stationAtoms(direction: PersonalForecastStationDirection): {
  claim: ForecastClaimAtom;
  manifestation: ForecastManifestationAtom;
  risk: ForecastRiskAtom;
  action: ForecastActionAtom;
} {
  if (direction === 'direct') {
    return {
      claim: 'process_is_turning_direct',
      manifestation: 'stalled_step_can_begin_to_move',
      risk: 'resuming_before_the_final_check',
      action: 'restart_only_after_a_final_check',
    };
  }
  if (direction === 'retrograde') {
    return {
      claim: 'process_is_turning_retrograde',
      manifestation: 'previous_step_returns_for_review',
      risk: 'forcing_progress_during_a_review_phase',
      action: 'revisit_the_unresolved_step',
    };
  }
  return {
    claim: 'process_is_near_a_station',
    manifestation: 'direction_is_not_yet_confirmed',
    risk: 'assuming_direction_before_it_is_confirmed',
    action: 'wait_for_direction_to_confirm',
  };
}

function timingFor(
  evidence: PersonalForecastCalculatedEvidence,
  period: PersonalForecastPeriod,
): ForecastSemanticTiming {
  return {
    scope: 'temporary',
    period,
    phase: evidence.status,
    startsAt: evidence.startsAt || null,
    endsAt: evidence.endsAt || null,
    exactAt: evidence.exactAt || null,
  };
}

type DraftFact = Omit<
  ForecastSemanticFact,
  'id' | 'semanticVersion' | 'evidenceFingerprint' | 'semanticFingerprint'
> & {
  evidenceCanonical: string;
  semanticCanonical: string;
};

function sourceCanonical(
  evidence: PersonalForecastCalculatedEvidence,
  effectiveHouse: number | null,
): string {
  return [
    evidence.id,
    evidence.kind,
    evidence.transitPlanet || '',
    evidence.natalPoint || '',
    evidence.aspect || '',
    effectiveHouse || '',
    evidence.status,
    evidence.orb ?? '',
    evidence.startsAt || '',
    evidence.endsAt || '',
    evidence.exactAt || '',
    evidence.motion?.stationDirection || '',
    evidence.ingress?.fromSign || '',
    evidence.ingress?.toSign || '',
    evidence.calculationSource,
  ].join('|');
}

function baseForbidden(
  hasGroundedHouseOrAngle: boolean,
  stationDirection: PersonalForecastStationDirection | null,
): ForecastForbiddenClaimClass[] {
  return unique([
    ...BASE_FORBIDDEN_CLAIMS,
    ...(!hasGroundedHouseOrAngle ? ['unsupported_house_or_angle' as const] : []),
    ...(stationDirection === 'unknown' ? ['retrograde_claim_without_direction' as const] : []),
  ]);
}

type ForecastRankTopic =
  | 'priorities'
  | 'reactions'
  | 'communication'
  | 'relationships'
  | 'decisions'
  | 'workload'
  | 'money'
  | 'home'
  | 'work'
  | 'friends'
  | 'private_life'
  | 'cycle';

type RankingCandidate = {
  fact: ForecastSemanticFact;
  evidence: PersonalForecastCalculatedEvidence;
  evidenceCanonicals: string[];
  topic: ForecastRankTopic;
  score: number;
  corroborationScore: number;
};

const ASPECT_ORB_LIMITS: Record<string, number> = {
  conjunction: 8,
  opposition: 8,
  square: 6,
  trine: 6,
  sextile: 4,
};

const NATAL_TARGET_SCORES: Record<string, number> = {
  sun: 25,
  moon: 25,
  rising: 25,
  ascendant: 25,
  mc: 25,
  mercury: 22,
  venus: 22,
  mars: 22,
  jupiter: 16,
  saturn: 16,
  uranus: 12,
  neptune: 12,
  pluto: 12,
};

const ASPECT_PRIORITY_SCORES: Record<string, number> = {
  conjunction: 15,
  opposition: 14,
  square: 14,
  trine: 11,
  sextile: 8,
};

const PERIOD_PLANET_FACTORS: Record<PersonalForecastPeriod, Record<string, number>> = {
  day: {
    moon: 1,
    mercury: 1,
    venus: 0.98,
    mars: 1,
    sun: 0.86,
    jupiter: 0.62,
    saturn: 0.58,
    uranus: 0.52,
    neptune: 0.52,
    pluto: 0.52,
  },
  week: {
    moon: 0.58,
    mercury: 1,
    venus: 1,
    mars: 1,
    sun: 0.92,
    jupiter: 0.78,
    saturn: 0.75,
    uranus: 0.68,
    neptune: 0.68,
    pluto: 0.68,
  },
  month: {
    moon: 0.35,
    mercury: 0.78,
    venus: 0.84,
    mars: 0.95,
    sun: 0.7,
    jupiter: 1,
    saturn: 0.96,
    uranus: 0.9,
    neptune: 0.9,
    pluto: 0.9,
  },
  year: {
    moon: 0.15,
    mercury: 0.35,
    venus: 0.4,
    mars: 0.45,
    sun: 0.3,
    jupiter: 1,
    saturn: 1,
    uranus: 1,
    neptune: 1,
    pluto: 1,
  },
};

const STRONG_TOPIC_THRESHOLDS: Record<PersonalForecastPeriod, number> = {
  day: 58,
  week: 58,
  month: 56,
  year: 54,
};

const SINGLE_ASPECT_THRESHOLDS: Record<PersonalForecastPeriod, number> = {
  day: 72,
  week: 70,
  month: 68,
  year: 68,
};

const CORROBORATION_SUPPORT_THRESHOLDS: Record<PersonalForecastPeriod, number> = {
  day: 48,
  week: 48,
  month: 46,
  year: 44,
};

function isFastDailyTransit(planet: string | null): boolean {
  return planet === 'moon'
    || planet === 'mercury'
    || planet === 'venus'
    || planet === 'mars';
}

function exactnessScore(evidence: PersonalForecastCalculatedEvidence): number {
  if (evidence.kind !== 'transit_to_natal' || typeof evidence.orb !== 'number') return 0;
  const limit = ASPECT_ORB_LIMITS[evidence.aspect || ''] || 8;
  return Math.max(0, Math.min(40, 40 * (1 - Math.max(0, evidence.orb) / limit)));
}

function phasePriorityScore(status: CalculatedAstroEvidence['status']): number {
  if (status === 'exact') return 10;
  if (status === 'applying') return 9;
  if (status === 'separating') return 3;
  if (status === 'active') return 2;
  return 0;
}

function periodPlanetFactor(
  period: PersonalForecastPeriod,
  planet: string | null,
  activatedByFastTransit: boolean,
): number {
  if (!planet) return 0.5;
  const factor = PERIOD_PLANET_FACTORS[period][planet] ?? 0.55;
  if (
    period === 'day'
    && !isFastDailyTransit(planet)
    && activatedByFastTransit
  ) {
    return Math.max(factor, 0.78);
  }
  return factor;
}

function nonAspectBaseScore(
  evidence: PersonalForecastCalculatedEvidence,
  period: PersonalForecastPeriod,
): number {
  if (evidence.kind === 'station') {
    const knownTurn = evidence.motion?.stationDirection
      && evidence.motion.stationDirection !== 'unknown';
    const byPeriod: Record<PersonalForecastPeriod, number> = {
      day: 68,
      week: 70,
      month: 72,
      year: 76,
    };
    return byPeriod[period] - (knownTurn ? 0 : 12);
  }
  if (evidence.kind === 'lunation') {
    return ({ day: 66, week: 70, month: 72, year: 0 })[period];
  }
  if (evidence.kind === 'ingress') {
    return ({ day: 32, week: 40, month: 54, year: 62 })[period];
  }
  if (evidence.kind === 'transit_house') return 22;
  return 0;
}

function domainRankingTopic(fact: ForecastSemanticFact): ForecastRankTopic {
  if (fact.natalPoint === 'mc') return 'work';
  if (fact.domain === 'communication_decisions') return 'communication';
  if (fact.domain === 'values_agreements') return 'relationships';
  if (fact.domain === 'emotional_response') return 'reactions';
  if (fact.domain === 'responsibility_limits') return 'workload';
  if (fact.domain === 'identity_priorities') return 'priorities';
  if (fact.domain === 'cycle_attention') return 'cycle';
  return 'decisions';
}

function rankingTopic(fact: ForecastSemanticFact): ForecastRankTopic {
  // For an aspect to the natal chart, the natal target defines what is
  // activated. A reliable house only says where it may be noticed.
  if (fact.sourceKind === 'transit_to_natal') return domainRankingTopic(fact);
  if (fact.lifeContext === 'personal_resources' || fact.lifeContext === 'shared_resources') {
    return 'money';
  }
  if (fact.lifeContext === 'home_foundation') return 'home';
  if (fact.lifeContext === 'work_routines' || fact.lifeContext === 'career_public_role') {
    return 'work';
  }
  if (fact.lifeContext === 'groups_networks') return 'friends';
  if (fact.lifeContext === 'partnerships') return 'relationships';
  if (fact.lifeContext === 'rest_private_life') return 'private_life';
  if (fact.lifeContext === 'communication_learning' || fact.lifeContext === 'study_travel') {
    return 'communication';
  }
  return domainRankingTopic(fact);
}

function rawPriorityScore(
  evidence: PersonalForecastCalculatedEvidence,
  period: PersonalForecastPeriod,
  activatedByFastTransit: boolean,
): number {
  const planetFactor = periodPlanetFactor(
    period,
    evidence.transitPlanet || null,
    activatedByFastTransit,
  );
  if (evidence.kind !== 'transit_to_natal') {
    return Math.max(0, Math.min(100, nonAspectBaseScore(evidence, period) * planetFactor));
  }
  const score = (
    exactnessScore(evidence)
    + (NATAL_TARGET_SCORES[evidence.natalPoint || ''] || 8)
    + (ASPECT_PRIORITY_SCORES[evidence.aspect || ''] || 0)
    + phasePriorityScore(evidence.status)
  );
  return Math.max(0, Math.min(100, score * planetFactor));
}

function confidenceForRank(score: number): ForecastSemanticFact['confidence'] {
  if (score >= 75) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function independentSupportSignature(candidate: RankingCandidate): string {
  return [
    candidate.fact.sourceKind,
    candidate.fact.transitPlanet || '',
    candidate.fact.natalPoint || '',
  ].join('|');
}

function isMeaningfulIndependentSupport(
  focal: RankingCandidate,
  supporter: RankingCandidate,
  period: PersonalForecastPeriod,
): boolean {
  if (
    supporter.fact.sourceKind === 'transit_house'
    || supporter.fact.sourceKind === 'ingress'
    || supporter.fact.sourceKind === 'period_aggregate'
    || independentSupportSignature(focal) === independentSupportSignature(supporter)
  ) {
    return false;
  }
  return rawPriorityScore(supporter.evidence, period, false)
    >= CORROBORATION_SUPPORT_THRESHOLDS[period];
}

function topicIsStrong(
  candidate: RankingCandidate,
  period: PersonalForecastPeriod,
): boolean {
  if (candidate.score < STRONG_TOPIC_THRESHOLDS[period]) return false;
  if (candidate.corroborationScore >= 5) return true;
  if (candidate.fact.sourceKind === 'transit_to_natal') {
    return candidate.score >= SINGLE_ASPECT_THRESHOLDS[period];
  }
  if (candidate.fact.sourceKind === 'station') {
    return (
      candidate.fact.mechanism.stationDirection !== null
      && candidate.fact.mechanism.stationDirection !== 'unknown'
      && candidate.score >= STRONG_TOPIC_THRESHOLDS[period] + 5
    );
  }
  if (candidate.fact.sourceKind === 'lunation') {
    return candidate.score >= STRONG_TOPIC_THRESHOLDS[period] + 8;
  }
  return false;
}

function compileOne(
  evidence: PersonalForecastCalculatedEvidence,
  period: PersonalForecastPeriod,
  chartData: NatalChartData,
): DraftFact | null {
  const calculationSource = String(evidence.calculationSource || '')
    .trim()
    .toLowerCase();
  if (calculationSource.split(':').at(-1) !== 'swisseph') return null;
  const reliability = chartReliability(chartData);
  const rawHouse = validHouse(evidence.house);
  const effectiveHouse = reliability.housesReliable ? rawHouse : null;
  const contextRule = effectiveHouse ? HOUSE_CONTEXTS[effectiveHouse] : null;
  const transitPlanet = evidence.transitPlanet || null;
  const transitMechanism = transitPlanet ? TRANSIT_MECHANISMS[transitPlanet] : null;
  if (!transitPlanet || !transitMechanism) return null;

  let rule: DomainRule | null = null;
  let dynamic: ForecastDynamicMechanism | null = null;
  let stationDirection: PersonalForecastStationDirection | null = null;
  let claims: ForecastClaimAtom[] = [];
  let manifestations: ForecastManifestationAtom[] = [];
  let risks: ForecastRiskAtom[] = [];
  let actions: ForecastActionAtom[] = [];
  let weaker = false;

  if (evidence.kind === 'transit_to_natal') {
    const natalPoint = evidence.natalPoint || '';
    if (natalPoint === 'rising' && !reliability.ascendantReliable) return null;
    if (natalPoint === 'mc' && !reliability.housesReliable) return null;
    rule = POINT_RULES[natalPoint] || null;
    const transitRule = POINT_RULES[transitPlanet] || null;
    dynamic = evidence.aspect ? ASPECT_DYNAMICS[evidence.aspect] || null : null;
    if (!rule || !transitRule || !dynamic) return null;
    claims = [
      rule.claim,
      transitRule.claim,
      ...(DYNAMIC_CLAIMS[dynamic] ? [DYNAMIC_CLAIMS[dynamic]!] : []),
    ];
    // The natal point defines the affected function, while the transiting
    // planet defines how the pressure arrives. Keep both in the compiled
    // fact so two different transiting planets cannot collapse into the same
    // generic copy for the same natal point and aspect.
    manifestations = [
      ...transitRule.manifestations,
      ...rule.manifestations,
    ];
    risks = unique([transitRule.risk, ...dynamicRisk(dynamic, rule)]);
    actions = unique([transitRule.action, ...dynamicAction(dynamic, rule)]);
  } else if (evidence.kind === 'station') {
    rule = POINT_RULES[transitPlanet] || null;
    if (!rule) return null;
    stationDirection = evidence.motion?.stationDirection || 'unknown';
    dynamic = stationDynamic(stationDirection);
    const atoms = stationAtoms(stationDirection);
    claims = [rule.claim, atoms.claim];
    manifestations = [...rule.manifestations, atoms.manifestation];
    risks = [atoms.risk];
    actions = [atoms.action, rule.action];
    weaker = stationDirection === 'unknown';
  } else if (evidence.kind === 'ingress') {
    if (!contextRule || !evidence.ingress?.fromSign || !evidence.ingress?.toSign) return null;
    rule = POINT_RULES[transitPlanet] || null;
    if (!rule) return null;
    dynamic = 'sign_transition';
    claims = [rule.claim, 'context_is_entering_a_new_phase'];
    manifestations = [...rule.manifestations];
    risks = ['treating_context_as_a_guaranteed_event'];
    actions = ['observe_the_transition_before_committing', rule.action];
    weaker = true;
  } else if (evidence.kind === 'transit_house') {
    if (!contextRule) return null;
    rule = POINT_RULES[transitPlanet] || null;
    if (!rule) return null;
    dynamic = 'ongoing_activation';
    claims = [rule.claim, 'house_context_is_temporarily_active'];
    manifestations = [...rule.manifestations];
    risks = ['treating_context_as_a_guaranteed_event'];
    actions = [rule.action];
    weaker = true;
  } else if (evidence.kind === 'lunation') {
    rule = POINT_RULES.moon;
    dynamic = evidence.aspect === 'opposition' ? 'culmination' : 'new_cycle';
    claims = [
      rule.claim,
      dynamic === 'culmination'
        ? 'attention_cycle_is_culminating'
        : 'attention_cycle_is_beginning',
    ];
    manifestations = [
      dynamic === 'culmination'
        ? 'existing_development_reaches_a_visible_peak'
        : 'new_priority_becomes_visible',
    ];
    risks = ['treating_a_short_cycle_as_a_permanent_conclusion'];
    actions = ['name_one_observable_priority_for_the_cycle'];
    weaker = true;
  } else {
    return null;
  }

  if (!rule || !dynamic) return null;
  if (contextRule) {
    claims.push('reliable_house_defines_context');
    manifestations.push(contextRule.manifestation);
    actions.push('apply_the_factor_only_inside_the_reliable_context');
  }
  const semanticCanonical = [
    PERSONAL_FORECAST_SEMANTICS_VERSION,
    period,
    evidence.kind,
    transitPlanet,
    evidence.natalPoint || '',
    evidence.aspect || '',
    rule.domain,
    contextRule?.context || '',
    dynamic,
    stationDirection || '',
  ].join('|');
  return {
    evidenceIds: [evidence.id],
    sourceKind: evidence.kind,
    transitPlanet,
    natalPoint: evidence.natalPoint || null,
    aspect: evidence.aspect || null,
    house: effectiveHouse,
    domain: rule.domain,
    lifeContext: contextRule?.context || null,
    mechanism: {
      transit: transitMechanism,
      dynamic,
      stationDirection,
    },
    timing: timingFor(evidence, period),
    confidence: confidenceFor(evidence, { weaker }),
    strength: Math.max(1, Math.min(100, Math.round(evidence.strength))),
    allowedClaimAtoms: unique(claims),
    allowedManifestationAtoms: unique(manifestations),
    allowedRiskAtoms: unique(risks),
    allowedActionAtoms: unique(actions),
    forbiddenClaimClasses: baseForbidden(
      !!contextRule
        || (evidence.natalPoint === 'rising' && reliability.ascendantReliable)
        || (evidence.natalPoint === 'mc' && reliability.housesReliable),
      stationDirection,
    ),
    evidenceCanonical: sourceCanonical(evidence, effectiveHouse),
    semanticCanonical,
  };
}

function earlierIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a.localeCompare(b) <= 0 ? a : b;
}

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a.localeCompare(b) >= 0 ? a : b;
}

function confidenceRank(value: ForecastSemanticFact['confidence']): number {
  return value === 'high' ? 3 : value === 'medium' ? 2 : 1;
}

function phaseRank(value: CalculatedAstroEvidence['status']): number {
  if (value === 'exact') return 5;
  if (value === 'applying') return 4;
  if (value === 'separating') return 3;
  if (value === 'active') return 2;
  return 1;
}

/**
 * Converts raw Swiss evidence into the only meanings the writer may express.
 * Output is language-neutral; `language` is accepted so callers can keep one
 * stable integration signature while localization remains a writer concern.
 */
export function compilePersonalForecastSemanticFacts(input: {
  evidence: readonly (CalculatedAstroEvidence | PersonalForecastCalculatedEvidence)[];
  period: PersonalForecastPeriod;
  chartData: NatalChartData;
  language?: 'ru' | 'en';
}): ForecastSemanticFact[] {
  void input.language;
  const bySemanticFingerprint = new Map<string, ForecastSemanticFact>();
  const evidenceCanonicals = new Map<string, string[]>();
  const bestEvidence = new Map<string, PersonalForecastCalculatedEvidence>();

  for (const raw of input.evidence) {
    const calculated = raw as PersonalForecastCalculatedEvidence;
    const draft = compileOne(
      calculated,
      input.period,
      input.chartData,
    );
    if (!draft) continue;
    const semanticFingerprint = `pf-sem-v2:${stableHash(draft.semanticCanonical)}`;
    const existing = bySemanticFingerprint.get(semanticFingerprint);
    const canonicals = evidenceCanonicals.get(semanticFingerprint) || [];
    canonicals.push(draft.evidenceCanonical);
    evidenceCanonicals.set(semanticFingerprint, canonicals);

    if (!existing) {
      const {
        evidenceCanonical: _evidenceCanonical,
        semanticCanonical: _semanticCanonical,
        ...fact
      } = draft;
      void _evidenceCanonical;
      void _semanticCanonical;
      bySemanticFingerprint.set(semanticFingerprint, {
        ...fact,
        id: `semantic:${semanticFingerprint}`,
        semanticVersion: PERSONAL_FORECAST_SEMANTICS_VERSION,
        evidenceFingerprint: '',
        semanticFingerprint,
      });
      bestEvidence.set(semanticFingerprint, calculated);
      continue;
    }

    existing.evidenceIds = unique([...existing.evidenceIds, ...draft.evidenceIds]).sort();
    existing.allowedClaimAtoms = unique([...existing.allowedClaimAtoms, ...draft.allowedClaimAtoms]);
    existing.allowedManifestationAtoms = unique([
      ...existing.allowedManifestationAtoms,
      ...draft.allowedManifestationAtoms,
    ]);
    existing.allowedRiskAtoms = unique([...existing.allowedRiskAtoms, ...draft.allowedRiskAtoms]);
    existing.allowedActionAtoms = unique([...existing.allowedActionAtoms, ...draft.allowedActionAtoms]);
    existing.forbiddenClaimClasses = unique([
      ...existing.forbiddenClaimClasses,
      ...draft.forbiddenClaimClasses,
    ]);
    existing.timing.startsAt = earlierIso(existing.timing.startsAt, draft.timing.startsAt);
    existing.timing.endsAt = laterIso(existing.timing.endsAt, draft.timing.endsAt);
    existing.timing.exactAt = earlierIso(existing.timing.exactAt, draft.timing.exactAt);
    if (
      draft.strength > existing.strength
      || (
        draft.strength === existing.strength
        && phaseRank(draft.timing.phase) > phaseRank(existing.timing.phase)
      )
    ) {
      existing.strength = draft.strength;
      existing.timing.phase = draft.timing.phase;
    }
    const currentBest = bestEvidence.get(semanticFingerprint);
    if (
      !currentBest
      || rawPriorityScore(calculated, input.period, false)
        > rawPriorityScore(currentBest, input.period, false)
      || (
        rawPriorityScore(calculated, input.period, false)
          === rawPriorityScore(currentBest, input.period, false)
        && phaseRank(calculated.status) > phaseRank(currentBest.status)
      )
    ) {
      bestEvidence.set(semanticFingerprint, calculated);
    }
    if (confidenceRank(draft.confidence) > confidenceRank(existing.confidence)) {
      existing.confidence = draft.confidence;
    }
  }

  const candidates: RankingCandidate[] = [...bySemanticFingerprint.values()]
    .flatMap((fact) => {
      const evidence = bestEvidence.get(fact.semanticFingerprint);
      if (!evidence) return [];
      return [{
        fact,
        evidence,
        evidenceCanonicals: evidenceCanonicals.get(fact.semanticFingerprint) || [],
        topic: rankingTopic(fact),
        score: 0,
        corroborationScore: 0,
      }];
    });
  const fastDailyTopics = new Set(
    candidates
      .filter((candidate) => (
        candidate.fact.sourceKind === 'transit_to_natal'
        && isFastDailyTransit(candidate.fact.transitPlanet)
        && rawPriorityScore(candidate.evidence, 'day', false)
          >= STRONG_TOPIC_THRESHOLDS.day
      ))
      .map((candidate) => candidate.topic),
  );
  const byTopic = new Map<ForecastRankTopic, RankingCandidate[]>();
  for (const candidate of candidates) {
    const items = byTopic.get(candidate.topic) || [];
    items.push(candidate);
    byTopic.set(candidate.topic, items);
  }
  for (const candidate of candidates) {
    const supporters = (byTopic.get(candidate.topic) || []).filter((item) => (
      item.fact.semanticFingerprint !== candidate.fact.semanticFingerprint
    ));
    const meaningfulSupporters = supporters.filter((item) => (
      isMeaningfulIndependentSupport(candidate, item, input.period)
    ));
    const aspectSupport = Math.min(10, meaningfulSupporters.filter((item) => (
      item.fact.sourceKind === 'transit_to_natal'
    )).length * 5);
    const eventSupport = meaningfulSupporters.some((item) => (
      item.fact.sourceKind === 'station' || item.fact.sourceKind === 'lunation'
    )) ? 3 : 0;
    candidate.corroborationScore = Math.min(
      10,
      aspectSupport + eventSupport,
    );
    const activatedByFastTransit = (
      input.period === 'day'
      && !isFastDailyTransit(candidate.fact.transitPlanet)
      && fastDailyTopics.has(candidate.topic)
    );
    candidate.score = Math.max(0, Math.min(100, Math.round(
      rawPriorityScore(candidate.evidence, input.period, activatedByFastTransit)
      + candidate.corroborationScore,
    )));
    candidate.fact.strength = candidate.score;
    candidate.fact.confidence = confidenceForRank(candidate.score);
  }

  const rankedTopics = [...byTopic.entries()]
    .map(([topic, items]) => {
      const hasFastDailyActivator = input.period === 'day' && fastDailyTopics.has(topic);
      const ranked = [...items].sort((left, right) => (
        (hasFastDailyActivator
          ? Number(
              right.fact.sourceKind === 'transit_to_natal'
              && isFastDailyTransit(right.fact.transitPlanet)
              && rawPriorityScore(right.evidence, 'day', false)
                >= STRONG_TOPIC_THRESHOLDS.day,
            ) - Number(
              left.fact.sourceKind === 'transit_to_natal'
              && isFastDailyTransit(left.fact.transitPlanet)
              && rawPriorityScore(left.evidence, 'day', false)
                >= STRONG_TOPIC_THRESHOLDS.day,
            )
          : 0)
        || right.score - left.score
        || phaseRank(right.fact.timing.phase) - phaseRank(left.fact.timing.phase)
        || left.fact.semanticFingerprint.localeCompare(right.fact.semanticFingerprint)
      ));
      return { topic, candidates: ranked, primary: ranked[0] };
    })
    .filter((group) => !!group.primary)
    .sort((left, right) => (
      right.primary.score - left.primary.score
      || left.topic.localeCompare(right.topic)
    ));
  const strongTopics = rankedTopics.filter((group) => topicIsStrong(
    group.primary,
    input.period,
  ));

  if (!strongTopics.length) {
    const rankedCandidates = [...candidates].sort((left, right) => (
      right.score - left.score
      || left.fact.semanticFingerprint.localeCompare(right.fact.semanticFingerprint)
    ));
    const evidenceIds = unique(
      rankedCandidates.flatMap((candidate) => candidate.fact.evidenceIds),
    ).slice(0, 8);
    const canonical = rankedCandidates
      .flatMap((candidate) => candidate.evidenceCanonicals)
      .sort()
      .join('||');
    const startsAt = rankedCandidates.reduce<string | null>(
      (value, candidate) => earlierIso(value, candidate.fact.timing.startsAt),
      null,
    );
    const endsAt = rankedCandidates.reduce<string | null>(
      (value, candidate) => laterIso(value, candidate.fact.timing.endsAt),
      null,
    );
    const semanticCanonical = [
      PERSONAL_FORECAST_SEMANTICS_VERSION,
      input.period,
      'low_signal',
      rankedCandidates.map((candidate) => candidate.fact.semanticFingerprint).sort().join('|'),
    ].join('|');
    const semanticFingerprint = `pf-sem-v2:${stableHash(semanticCanonical)}`;
    return [{
      id: `semantic:${semanticFingerprint}`,
      semanticVersion: PERSONAL_FORECAST_SEMANTICS_VERSION,
      evidenceIds,
      evidenceFingerprint: `pf-evidence-v2:${stableHash(canonical || 'no-strong-evidence')}`,
      semanticFingerprint,
      sourceKind: 'period_aggregate',
      transitPlanet: null,
      natalPoint: null,
      aspect: null,
      house: null,
      domain: 'cycle_attention',
      lifeContext: null,
      mechanism: {
        transit: 'tempo_fluctuation',
        dynamic: 'low_signal',
        stationDirection: null,
      },
      timing: {
        scope: 'temporary',
        period: input.period,
        phase: 'active',
        startsAt,
        endsAt,
        exactAt: null,
      },
      confidence: 'low',
      strength: Math.max(20, rankedCandidates[0]?.score || 20),
      allowedClaimAtoms: [
        'no_single_theme_dominates_period',
        'ordinary_priorities_can_remain_in_place',
      ],
      allowedManifestationAtoms: ['confirmed_signals_remain_distributed'],
      allowedRiskAtoms: ['forcing_a_story_from_weak_signals'],
      allowedActionAtoms: ['keep_plans_proportional_to_confirmed_signals'],
      forbiddenClaimClasses: baseForbidden(false, null),
    }];
  }

  const additionalThemeGap: Record<PersonalForecastPeriod, number> = {
    day: 10,
    week: 12,
    month: 14,
    year: 16,
  };
  const strongestScore = strongTopics[0].primary.score;
  const selectedTopics = strongTopics
    .filter((group, index) => (
      index === 0
      || (
        index < 3
        && strongestScore - group.primary.score <= additionalThemeGap[input.period]
      )
    ))
    .slice(0, 3);

  return selectedTopics.map((group) => {
    const primary = group.primary;
    const members = [
      primary,
      ...group.candidates.filter((candidate) => (
        candidate.fact.semanticFingerprint !== primary.fact.semanticFingerprint
        && isMeaningfulIndependentSupport(primary, candidate, input.period)
      )),
    ];
    const semanticCanonical = [
      PERSONAL_FORECAST_SEMANTICS_VERSION,
      input.period,
      group.topic,
      members.map((candidate) => candidate.fact.semanticFingerprint).sort().join('|'),
    ].join('|');
    const semanticFingerprint = `pf-sem-v2:${stableHash(semanticCanonical)}`;
    const canonical = members
      .flatMap((candidate) => candidate.evidenceCanonicals)
      .sort()
      .join('||');
    return {
      ...primary.fact,
      id: `semantic:${semanticFingerprint}`,
      evidenceIds: unique(members.flatMap((candidate) => candidate.fact.evidenceIds)).slice(0, 8),
      evidenceFingerprint: `pf-evidence-v2:${stableHash(canonical)}`,
      semanticFingerprint,
      confidence: confidenceForRank(primary.score),
      strength: primary.score,
    };
  });
}
