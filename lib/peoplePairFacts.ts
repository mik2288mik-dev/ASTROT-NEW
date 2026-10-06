import type { NatalChartData, PlanetPosition } from '../types';

/**
 * «Ты и твои люди»: the two tightest real contacts between two saved charts,
 * in plain words. Texts speak to «вы» so they never guess anyone's gender.
 */

type Body = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'saturn';
type Kind = 'soft' | 'hard';
type Aspect = { name: string; angle: number; orb: number; kind: Kind | 'conj' };

const BODIES: Body[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'saturn'];
const ASPECTS: Aspect[] = [
  { name: 'соединение', angle: 0, orb: 7, kind: 'conj' },
  { name: 'оппозиция', angle: 180, orb: 7, kind: 'hard' },
  { name: 'трин', angle: 120, orb: 6, kind: 'soft' },
  { name: 'квадрат', angle: 90, orb: 6, kind: 'hard' },
  { name: 'секстиль', angle: 60, orb: 4, kind: 'soft' },
];
const BODY_RU: Record<Body, string> = { sun: 'Солнце', moon: 'Луна', mercury: 'Меркурий', venus: 'Венера', mars: 'Марс', saturn: 'Сатурн' };

/** [soft text, hard text] per pair; a conjunction reads as the soft one unless Saturn or Mars is involved. */
const COPY: Record<string, [string, string]> = {
  'sun-sun': ['Вы смотрите на жизнь похоже, легко понимаете, чего хочет другой.', 'Вы оба хотите быть главными, помогает заранее делить, кто за что отвечает.'],
  'moon-sun': ['Один задаёт направление, другой создаёт уют, вместе спокойно.', 'Планы одного иногда не совпадают с настроением другого, сверяйтесь чаще.'],
  'mercury-sun': ['Вам легко объяснять друг другу свои идеи, понимаете с полуслова.', 'Один говорит, другой не слышит, проговаривайте важное медленнее.'],
  'sun-venus': ['Классическое притяжение: вам просто нравиться друг другу.', 'Притяжение есть, но вкусы и ожидания разные, договаривайтесь словами.'],
  'mars-sun': ['Вместе много энергии: легко начинать общие дела и подталкивать друг друга.', 'Искры летят быстро, споры вспыхивают на ровном месте, делайте паузу.'],
  'saturn-sun': ['С этим человеком легко строить надолго: обещания держатся.', 'Один может казаться другому строгим, хвалите чаще, чем поправляете.'],
  'moon-moon': ['Вы одинаково чувствуете, легко успокоить друг друга.', 'Настроения расходятся, то, что одному уютно, другому тесно.'],
  'mercury-moon': ['Вы умеете говорить о чувствах так, что обоим понятно.', 'Логика одного иногда ранит чувства другого, мягче формулируйте.'],
  'moon-venus': ['Тепло и нежность даются вам без усилий.', 'Хочется заботы по-разному, спросите, что для другого значит «забота».'],
  'mars-moon': ['Один защищает, другой поддерживает, надёжная связка.', 'Резкость одного задевает другого сильнее, чем кажется.'],
  'moon-saturn': ['Рядом с этим человеком спокойно и надёжно.', 'Сдержанность одного другому может казаться холодом, говорите о чувствах вслух.'],
  'mercury-mercury': ['Вы думаете на одной волне, разговоры текут легко.', 'Спорите о мелочах, договоритесь, кто решает в чём.'],
  'mercury-venus': ['Вам приятно разговаривать, комплименты и шутки попадают в цель.', 'Слова одного другой понимает буквально, уточняйте, что имели в виду.'],
  'mars-mercury': ['Обсуждаете быстро и по делу, хорошо решать задачи вместе.', 'Разговор легко превращается в спор, держите тон спокойным.'],
  'mercury-saturn': ['С этим человеком легко договориться о серьёзном: планы, деньги, быт.', 'Один торопит, другой тормозит, заранее ставьте сроки.'],
  'venus-venus': ['Похожие вкусы: легко выбрать фильм, кафе и подарок.', 'Разные вкусы, зато друг у друга есть чему научиться.'],
  'mars-venus': ['Сильная симпатия и химия, вас тянет друг к другу.', 'Притяжение сильное, но и обиды острые, не копите недосказанное.'],
  'saturn-venus': ['Чувства у вас серьёзные и долгие.', 'Один ждёт тепла, другой проявляет его сдержанно, не путайте это с равнодушием.'],
  'mars-mars': ['Вы заряжаете друг друга, хорошо вместе в спорте и делах.', 'Два лидера, договоритесь, кто ведёт в каком деле.'],
  'mars-saturn': ['Один горит, другой направляет, получается доводить начатое.', 'Один спешит, другой сдерживает, злиться на это бесполезно, лучше делить роли.'],
  'saturn-saturn': ['Вы похоже относитесь к обязательствам, на вас можно положиться.', 'Каждый держится своих правил, проговаривайте общие.'],
};

export type PairFact = { title: string; text: string; tight: boolean };

function longitude(position: PlanetPosition | null | undefined): number | null {
  const value = Number(position?.longitude);
  return Number.isFinite(value) ? ((value % 360) + 360) % 360 : null;
}

function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86_400_000);
}

/**
 * The tightest contacts of two saved charts. With `dayKey` the window slides over all real
 * contacts of the pair, so the block shows different ones every day instead of the same two.
 */
export function buildPairFacts(mine: NatalChartData | null | undefined, theirs: NatalChartData | null | undefined, limit = 2, dayKey?: string): PairFact[] {
  if (!mine || !theirs) return [];
  const found: Array<{ key: string; orb: number; fact: PairFact }> = [];
  for (const a of BODIES) {
    for (const b of BODIES) {
      const la = longitude((mine as unknown as Record<string, PlanetPosition | null>)[a]);
      const lb = longitude((theirs as unknown as Record<string, PlanetPosition | null>)[b]);
      if (la === null || lb === null) continue;
      const distance = Math.abs(((la - lb + 540) % 360) - 180);
      const separation = 180 - distance;
      for (const aspect of ASPECTS) {
        const orb = Math.abs(separation - aspect.angle);
        if (orb > aspect.orb) continue;
        const key = [a, b].sort().join('-');
        const copy = COPY[key];
        if (!copy) continue;
        const hard = aspect.kind === 'hard' || (aspect.kind === 'conj' && (a === 'saturn' || b === 'saturn' || (a === 'mars' && b === 'mars')));
        found.push({
          key,
          orb,
          fact: {
            title: `${BODY_RU[a]} и ${BODY_RU[b]} ${
              aspect.kind === 'conj' ? 'рядом' : hard ? 'в напряжении' : 'в гармонии'
            }`,
            text: hard ? copy[1] : copy[0],
            tight: orb <= 2,
          },
        });
        break;
      }
    }
  }
  const seen = new Set<string>();
  const unique = found
    .sort((x, y) => x.orb - y.orb)
    .filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
  if (!dayKey || unique.length <= limit) return unique.slice(0, limit).map((item) => item.fact);
  const start = dayNumber(dayKey) % unique.length;
  return Array.from({ length: limit }, (_, offset) => unique[(start + offset) % unique.length].fact);
}
