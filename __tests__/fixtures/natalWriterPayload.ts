import type { NatalInterpretation } from '../../lib/natalInterpretation';
import type { NatalUnifiedWriterPlan } from '../../lib/natalReading/unifiedReading';

// Structured-output fixture, not an AI quality assertion. Each block cites a
// real observation; semantic review is mocked separately in recovery tests.
export function natalWriterPayload(interpretation: NatalInterpretation, plan: NatalUnifiedWriterPlan) {
  const byId = new Map(interpretation.meanings.map(meaning => [meaning.id, meaning]));
  const block = (item: NatalUnifiedWriterPlan['story'][number], title = '') => ({
    id: item.id,
    text: `${title ? `${title}: ` : ''}${byId.get(item.meaningIds[0])!.text}`,
    meaning_ids: [item.meaningIds[0]],
  });
  return { story: plan.story.map(item => block(item)), topics: plan.topics.map(topic => ({
    key: topic.key, title: topic.title, blocks: topic.blocks.map(item => block(item, topic.title)),
  })) };
}
