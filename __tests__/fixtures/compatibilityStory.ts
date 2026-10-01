import type { CompatibilityEvidence } from '../../types';
import type { CalculatedCompatibility } from '../../lib/synastry/compatibilityEngine';
import type { CompatibilityQuestionId } from '../../lib/synastry/compatibilityQuestions';
import { selectCompatibilityWriterEvidence, type CompatibilityWriterResponse } from '../../lib/synastry/compatibilityNarrative';

const ANSWERS = [
  'Скорее да. Вам легче начать разговор, чем долго ходить вокруг важного. Один приносит новую мысль, второй замечает, где она не сходится с жизнью, и вместе вы приходите к решению. Обычно на это уходит меньше времени, чем вы оба ожидаете.',
  'По-разному. Когда вопрос касается личного выбора, уточнение одного может прозвучать для другого как давление. Помогает сразу говорить, нужен ли ответ сейчас или можно подумать до вечера. Тогда никто не чувствует, что его торопят.',
  'Непросто. Спор чаще начинается не из-за самого дела, а из-за тона. Оба уверены, что говорят нормально. Помогает остановиться и спросить, что именно второй услышал в ваших словах. Часто выясняется, что вы говорили об одном и том же.',
  'Скорее да. Бытовые дела вы делите без долгих обсуждений: каждый берёт то, что ему ближе. Проблемы появляются, только когда один устал и молча ждёт, что второй сам догадается. Короткая просьба вслух решает это быстрее любых намёков.',
  'По-разному. Одному важно иногда побыть одному, второй воспринимает это как холод. Достаточно заранее сказать, сколько нужно времени, и тогда пауза не становится поводом для обиды. Через пару часов разговор обычно идёт спокойнее.',
  'Да. Вы выполняете договорённости и не бросаете начатое при первой трудности. Это хорошая основа: даже после ссоры вам есть к чему вернуться и на что опереться в обычной жизни. Об этом стоит помнить, когда спорите о мелочах.',
];

/** A compact provider response for delivery tests; never a production fallback. */
export function compatibilityStory(
  evidence: Array<Pick<CompatibilityEvidence, 'id' | 'direction'>>,
  questionIds: string[],
): CompatibilityWriterResponse {
  const mutual = evidence.filter((item) => item.direction === 'mutual');
  const evidenceId = (index: number) => mutual[index % mutual.length]?.id || evidence[index % evidence.length]?.id || 'missing-fixture-evidence';
  return {
    summary: 'Вам легче начать разговор, чем долго ходить вокруг важного. Проблемы появляются, когда один уже хочет решить всё сейчас, а второму надо сначала договорить. Если назвать это прямо, вместо обиды остаётся обычный разговор.',
    paragraphs: questionIds.map((questionId, index) => ({
      questionId: questionId as CompatibilityQuestionId,
      text: ANSWERS[index % ANSWERS.length],
      evidenceIds: [evidenceId(index)],
      direction: 'mutual' as const,
    })),
  };
}

export function answerableQuestionIds(calculated: Pick<CalculatedCompatibility, 'questions'>): string[] {
  return calculated.questions.filter((question) => question.score != null).map((question) => question.id);
}

/** Writer response for a calculated pair. */
export function compatibilityStoryFor(calculated: CalculatedCompatibility): CompatibilityWriterResponse {
  return compatibilityStory(selectCompatibilityWriterEvidence(calculated), answerableQuestionIds(calculated));
}

/** Writer response built from the exact prompt the endpoint sent to the provider. */
export function compatibilityStoryFromPrompt(input: { evidence: Array<Pick<CompatibilityEvidence, 'id' | 'direction'>>; questions: Array<{ questionId: string }> }): CompatibilityWriterResponse {
  return compatibilityStory(input.evidence, input.questions.map((question) => question.questionId));
}
