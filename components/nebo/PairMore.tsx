import React from 'react';
import { lifePathNumber, parseBirthDate, reduceNumber } from '../../lib/numerology';
import { CHINESE_ANIMALS, CHINESE_RELATIONS, chineseAdjective, chineseRelation, chineseSign, type ChineseRelation } from '../../lib/chineseZodiac';

/** Pair by numbers of destiny, canvas texts: three groups of numbers and how they meet. */
const NUM_PAIR: Record<string, [string, string]> = {
  same: ['Одно число', 'Похожие ценности и общий ритм. Легко понимать друг друга, но и спорить о том же самом.'],
  g0: ['Легко вместе', 'Оба ценят свободу и своё мнение. Интересно вместе, если не давить друг на друга.'],
  g1: ['Легко вместе', 'Оба надёжные и практичные. Вместе хорошо строить планы, дом и общее дело.'],
  g2: ['Легко вместе', 'Оба живут чувствами и заботой. Тепло вместе, важно только не утонуть в эмоциях вдвоём.'],
  'g0-g1': ['Дополняют друг друга', 'Один ищет свободу, другой порядок. Получается, если договориться о правилах.'],
  'g0-g2': ['Дополняют друг друга', 'Один думает, другой чувствует. Интересно вместе, но сказанное не всегда понимается одинаково.'],
  'g1-g2': ['Дополняют друг друга', 'Один строит, другой согревает. Хорошо для дома и семьи, если ценить вклад друг друга.'],
};
const numGroup = (n: number) => ([1, 5, 7].includes(n) ? 0 : [2, 4, 8].includes(n) ? 1 : 2);
const pairKey = (a: number, b: number) => {
  if (a === b) return 'same';
  const ga = numGroup(a);
  const gb = numGroup(b);
  return ga === gb ? `g${ga}` : `g${Math.min(ga, gb)}-g${Math.max(ga, gb)}`;
};
const RELATION_TONE: Record<ChineseRelation, string> = { trine: 'is-good', friend: 'is-good', same: 'is-ok', neutral: 'is-ok', harm: 'is-hard', clash: 'is-hard' };

/** «Ещё два взгляда на пару» (canvas PairMore): numbers of destiny and the Chinese horoscope by birth year. */
export function PairMore({ leftName, rightName, leftDate, rightDate }: { leftName: string; rightName: string; leftDate: string | null | undefined; rightDate: string | null | undefined }) {
  const a = parseBirthDate(leftDate);
  const b = parseBirthDate(rightDate);
  const ca = leftDate ? chineseSign(leftDate) : null;
  const cb = rightDate ? chineseSign(rightDate) : null;
  if (!a || !b || !ca || !cb) return null;
  const na = reduceNumber(lifePathNumber(a), false);
  const nb = reduceNumber(lifePathNumber(b), false);
  const [numTitle, numText] = NUM_PAIR[pairKey(na, nb)];
  const relation = chineseRelation(ca.animal, cb.animal);
  const first = (name: string) => name.trim().split(/\s+/)[0];
  return (
    <section className="nebo-pair-more" aria-labelledby="nebo-pair-more-title">
      <h2 id="nebo-pair-more-title">Ещё два взгляда на пару</h2>
      <div className="nebo-pair-more-card">
        <span className="nebo-tile-kicker">По числам судьбы</span>
        <div className="nebo-pair-more-duo">
          <span><b className="nebo-pair-more-num">{na}</b><small>{first(leftName)}</small></span>
          <i>и</i>
          <span><b className="nebo-pair-more-num">{nb}</b><small>{first(rightName)}</small></span>
        </div>
        <span className="nebo-pair-more-badge is-ok">{numTitle}</span>
        <p>{numText}</p>
      </div>
      <div className="nebo-pair-more-card">
        <span className="nebo-tile-kicker">По китайскому гороскопу</span>
        <div className="nebo-pair-more-duo">
          <span><b className="nebo-pair-more-glyph">{CHINESE_ANIMALS[ca.animal].hieroglyph}</b><small>{first(leftName)}<br />{chineseAdjective(ca)}</small></span>
          <i>и</i>
          <span><b className="nebo-pair-more-glyph">{CHINESE_ANIMALS[cb.animal].hieroglyph}</b><small>{first(rightName)}<br />{chineseAdjective(cb)}</small></span>
        </div>
        <span className={`nebo-pair-more-badge ${RELATION_TONE[relation]}`}>{CHINESE_RELATIONS[relation].title}</span>
        <p>{CHINESE_RELATIONS[relation].text}</p>
      </div>
    </section>
  );
}
