import type { CompatibilityEvidence } from '../../types';
import type { CompatibilityWriterResponse } from '../../lib/synastry/compatibilityNarrative';

/** A compact provider response for delivery tests; never a production fallback. */
export function compatibilityStory(evidence: Array<Pick<CompatibilityEvidence, 'id' | 'direction'>>): CompatibilityWriterResponse {
  const mutual = evidence.filter((item) => item.direction === 'mutual');
  const evidenceId = (index: number) => mutual[index % mutual.length]?.id || evidence[index % evidence.length]?.id || 'missing-fixture-evidence';
  return {
    summary: 'Вам легче начать разговор, чем долго ходить вокруг важного. Проблемы появляются не из-за разницы во взглядах, а когда один уже хочет решить всё сейчас, а второму надо сначала договорить. Если назвать это прямо, вместо обиды обычно остаётся обычный разговор — без конкурса на самого упрямого.',
    paragraphs: [
      {
        topic: 'what_works',
        text: 'У вас получается не бросать разговор после первого несогласия. Один приносит новую мысль, второй замечает, где она не сходится с реальностью. Вместе это даёт не идеальное согласие, а нормальный обмен: можно спорить, уточнять и всё-таки прийти к общему решению.',
        evidenceIds: [evidenceId(0)],
        direction: 'mutual',
      },
      {
        topic: 'misunderstandings',
        text: 'Труднее становится, когда вопрос касается личного выбора. Уточнение может прозвучать как давление, хотя человек просто пытается разобраться. Тогда вы спорите уже не о самом деле, а о тоне. И оба могут быть уверены, что говорят вполне нормально.',
        evidenceIds: [evidenceId(1)],
        direction: 'mutual',
      },
      {
        topic: 'say_it_early',
        text: 'Лучше сразу сказать, нужен ли сейчас ответ или время подумать. Фраза «я вернусь к этому вечером» обычно полезнее, чем молчание с надеждой, что второй сам всё поймёт. Так разговор не превращается в угадайку и не тянется дольше самого повода.',
        evidenceIds: [evidenceId(2)],
        direction: 'mutual',
      },
      {
        topic: 'dont_inflate',
        text: 'Не каждое несогласие говорит о том, что с вами что-то не так. Иногда один просто хочет обсудить ещё один вариант, а второй уже устал обсуждать. Если не делать из этого проверку отношения, мелочь остаётся мелочью — редкий и очень полезный навык.',
        evidenceIds: [evidenceId(3)],
        direction: 'mutual',
      },
    ],
  };
}
