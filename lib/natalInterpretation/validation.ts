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

  for (const meaning of interpretation.meanings) {
    if (!meaning.text.trim()) errors.push(`empty meaning: ${meaning.id}`);
    if (!meaning.technicalText.trim()) errors.push(`empty technical meaning: ${meaning.id}`);
    if (!meaning.evidenceIds.length) errors.push(`meaning without evidence: ${meaning.id}`);
    if (meaning.evidenceIds.some((id) => !evidenceIds.has(id))) {
      errors.push(`meaning references unknown evidence: ${meaning.id}`);
    }
  }

  if (new Set(interpretation.storyMeaningIds).size !== interpretation.storyMeaningIds.length) {
    errors.push('story repeats an approved meaning');
  }
  if (interpretation.storyMeaningIds.some((id) => !meaningIds.has(id))) {
    errors.push('story references unknown meaning');
  }

  const topicMeaningIds = interpretation.topics.flatMap((topic) => topic.meaningIds);
  for (const topic of interpretation.topics) {
    if (new Set(topic.meaningIds).size !== topic.meaningIds.length) {
      errors.push(`topic repeats an approved meaning: ${topic.key}`);
    }
    if (topic.evidenceIds.some(id => !evidenceIds.has(id))) {
      errors.push(`topic references unknown evidence: ${topic.key}`);
    }
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
