import type {
  NatalAngleKey,
  NatalAspectType,
  NatalBodyKey,
  NatalReliability,
} from '../natalChartV2Types';

export const NATAL_INTERPRETATION_VERSION = 'natal-interpretation-v1' as const;

export type NatalMeaningTopic =
  | 'character'
  | 'emotions'
  | 'communication'
  | 'relationships'
  | 'work'
  | 'money'
  | 'home'
  | 'learning'
  | 'rest'
  | 'general';

export type NatalInterpretationEvidenceKind =
  | 'body_sign'
  | 'body_house'
  | 'body_retrograde'
  | 'angle_sign'
  | 'house_cusp'
  | 'aspect';

export type NatalInterpretationEvidence = {
  id: string;
  kind: NatalInterpretationEvidenceKind;
  reliability: Exclude<NatalReliability, 'variable_in_range'>;
  bodyKey?: NatalBodyKey;
  angleKey?: NatalAngleKey;
  house?: number;
  sign?: string;
  degree?: number;
  retrograde?: boolean;
  aspectId?: string;
  aspectType?: NatalAspectType;
  fromKey?: NatalBodyKey | NatalAngleKey;
  toKey?: NatalBodyKey | NatalAngleKey;
  orb?: number;
  phase?: string;
  sampleCoverage?: number;
};

export type RejectedNatalInterpretationEvidence = {
  id: string;
  kind: NatalInterpretationEvidenceKind;
  reason:
    | 'variable_in_range'
    | 'unstable_sign'
    | 'unstable_house'
    | 'unstable_retrograde'
    | 'unreliable_aspect'
    | 'missing_value';
};

export type NatalMeaningScope = 'personal' | 'background' | 'structural';

export type NatalMeaning = {
  id: string;
  semanticKey: string;
  scope: NatalMeaningScope;
  text: string;
  technicalText: string;
  topics: NatalMeaningTopic[];
  evidenceIds: string[];
};

export type NatalTopicPlan = {
  key: NatalMeaningTopic;
  title: string;
  meaningIds: string[];
  evidenceIds: string[];
};

export type NatalInterpretation = {
  schemaVersion: typeof NATAL_INTERPRETATION_VERSION;
  calculationVersion: string;
  birthTimeQuality: 'exact' | 'approximate' | 'unknown';
  evidence: NatalInterpretationEvidence[];
  rejectedEvidence: RejectedNatalInterpretationEvidence[];
  meanings: NatalMeaning[];
  storyMeaningIds: string[];
  topics: NatalTopicPlan[];
};
