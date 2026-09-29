import type { NatalInterpretation } from './types';

export function getNatalInterpretationValidationErrors(
  interpretation: NatalInterpretation,
): string[] {
  const errors: string[] = [];
  const evidenceIds = new Set(interpretation.evidence.map((evidence) => evidence.id));
  const meaningIds = new Set(interpretation.meanings.map((meaning) => meaning.id));

  if (evidenceIds.size !== interpretation.evidence.length) {
    errors.push('duplicate evidence id');
  }
  if (meaningIds.size !== interpretation.meanings.length) {
    errors.push('duplicate meaning id');
  }

  const coveredEvidence = new Set(
    interpretation.meanings.flatMap((meaning) => meaning.evidenceIds),
  );
  for (const evidenceId of evidenceIds) {
    if (!coveredEvidence.has(evidenceId)) {
      errors.push(`reliable evidence not interpreted: ${evidenceId}`);
    }
  }

  for (const meaning of interpretation.meanings) {
    if (!meaning.text.trim()) errors.push(`empty meaning: ${meaning.id}`);
    if (!meaning.technicalText.trim()) errors.push(`empty technical meaning: ${meaning.id}`);
    if (!meaning.evidenceIds.length) errors.push(`meaning without evidence: ${meaning.id}`);
    if (meaning.evidenceIds.some((id) => !evidenceIds.has(id))) {
      errors.push(`meaning references unknown evidence: ${meaning.id}`);
    }
  }

  if (interpretation.storyMeaningIds.length !== interpretation.meanings.length) {
    errors.push('story does not include every approved meaning');
  }
  if (new Set(interpretation.storyMeaningIds).size !== interpretation.storyMeaningIds.length) {
    errors.push('story repeats an approved meaning');
  }
  if (interpretation.storyMeaningIds.some((id) => !meaningIds.has(id))) {
    errors.push('story references unknown meaning');
  }

  const topicMeaningIds = interpretation.topics.flatMap((topic) => topic.meaningIds);
  if (topicMeaningIds.length !== interpretation.meanings.length) {
    errors.push('topics do not include every approved meaning exactly once');
  }
  if (new Set(topicMeaningIds).size !== topicMeaningIds.length) {
    errors.push('topics repeat an approved meaning');
  }
  if (topicMeaningIds.some((id) => !meaningIds.has(id))) {
    errors.push('topics reference unknown meaning');
  }

  return errors;
}

export function assertNatalInterpretationValid(
  interpretation: NatalInterpretation,
): NatalInterpretation {
  const errors = getNatalInterpretationValidationErrors(interpretation);
  if (errors.length) {
    throw new Error(`NATAL_INTERPRETATION_INVALID:${errors.join('|')}`);
  }
  return interpretation;
}
