import type { NatalChartDataV2 } from '../natalChartV2Types';
import { interpretNatalChart } from './interpreter';
import { buildNatalStoryMeaningIds, buildNatalTopicPlans } from './synthesis';
import {
  NATAL_INTERPRETATION_VERSION,
  type NatalInterpretation,
} from './types';
import { assertNatalInterpretationValid } from './validation';

export * from './types';
export * from './evidence';
export * from './meanings';
export * from './interpreter';
export * from './synthesis';
export * from './validation';

export function buildNatalInterpretation(
  chart: NatalChartDataV2,
  language: 'ru' | 'en' = 'ru',
): NatalInterpretation {
  const interpreted = interpretNatalChart(chart, language);
  return assertNatalInterpretationValid({
    schemaVersion: NATAL_INTERPRETATION_VERSION,
    calculationVersion: chart.calculationVersion,
    birthTimeQuality: chart.chartQuality.birthTimeQuality,
    evidence: interpreted.evidence,
    rejectedEvidence: interpreted.rejectedEvidence,
    meanings: interpreted.meanings,
    storyMeaningIds: buildNatalStoryMeaningIds(interpreted.meanings),
    topics: buildNatalTopicPlans(interpreted.meanings),
  });
}
