import {
  inferNatalEvidenceTopic,
  rankNatalTopicEvidence,
  selectNatalTopicEvidence,
} from '../lib/natalReading/topicSelector';
import type { NatalEvidenceFact } from '../lib/natalReading/permanentReport';

function placement(body: string): NatalEvidenceFact {
  return {
    id: `natal.position.${body}`,
    kind: 'placement',
    object: body,
    data: { key: body, sign: 'Aries' },
  };
}

function aspect(
  id: string,
  from: string,
  to: string,
  type: string,
  orb: number,
): NatalEvidenceFact {
  return {
    id,
    kind: 'aspect',
    object: id,
    data: {
      from,
      to,
      fromKey: from,
      toKey: to,
      type,
      orb,
      reliable: true,
    },
  };
}

describe('natal topic selector', () => {
  test('love uses love evidence and ignores unrelated outer-planet tension', () => {
    const facts = [
      placement('venus'),
      placement('moon'),
      placement('saturn'),
      placement('pluto'),
      aspect('venus-trine-moon', 'venus', 'moon', 'trine', 1.1),
      aspect('saturn-square-pluto', 'saturn', 'pluto', 'square', 0.05),
    ];
    const selected = selectNatalTopicEvidence(facts, 'love', { limit: 4, min: 2 });
    const ids = selected.map((fact) => fact.id);
    expect(ids).toContain('venus-trine-moon');
    expect(ids).not.toContain('saturn-square-pluto');
  });

  test('communication cannot be created by an unrelated Mars-Saturn aspect', () => {
    const facts = [
      placement('mercury'),
      placement('mars'),
      placement('saturn'),
      placement('venus'),
      aspect('mars-square-saturn', 'mars', 'saturn', 'square', 0.1),
      aspect('mercury-sextile-venus', 'mercury', 'venus', 'sextile', 1.8),
    ];
    const ids = selectNatalTopicEvidence(facts, 'communication', { limit: 4, min: 2 })
      .map((fact) => fact.id);
    expect(ids).toContain('mercury-sextile-venus');
    expect(ids).not.toContain('mars-square-saturn');
  });

  test('explicit conflict requires the direct Mercury-Mars pair', () => {
    const facts = [
      placement('mercury'),
      placement('mars'),
      placement('saturn'),
      aspect('mars-square-saturn', 'mars', 'saturn', 'square', 0.1),
      aspect('mercury-square-mars', 'mercury', 'mars', 'square', 1.2),
    ];
    const ranked = rankNatalTopicEvidence(facts, 'conflict');
    expect(ranked.some((item) => item.fact.id === 'mercury-square-mars')).toBe(true);
    expect(ranked.some((item) => item.fact.id === 'mars-square-saturn')).toBe(false);
  });

  test('topic relevance can outweigh a slightly tighter but weaker cross-topic aspect', () => {
    const facts = [
      placement('venus'),
      placement('moon'),
      placement('saturn'),
      aspect('venus-trine-moon', 'venus', 'moon', 'trine', 0.9),
      aspect('venus-square-saturn', 'venus', 'saturn', 'square', 0.1),
    ];
    const ranked = rankNatalTopicEvidence(facts, 'love');
    expect(ranked[0].fact.id).toBe('venus-trine-moon');
  });

  test.each([
    ['Почему меня раздражает медленная переписка?', 'irritation'],
    ['Как я спорю?', 'conflict'],
    ['Как я реагирую на критику?', 'criticism'],
    ['Каких отношений я хочу?', 'love'],
    ['Как я общаюсь с новыми людьми?', 'communication'],
    ['Какая работа мне подходит по стилю?', 'work'],
    ['Как я отношусь к большим покупкам?', 'money'],
    ['How much freedom do I need in a relationship?', 'autonomy'],
  ] as const)('routes a question to %s without leaking neighbouring topics', (question, expected) => {
    expect(inferNatalEvidenceTopic(question)).toBe(expected);
  });
});
