import type { CompatibilityEvidence } from '../../types';

/**
 * Plain-language meaning of one calculated contact between two charts.
 * Written for the free reading: no planets, aspects or degrees in the text,
 * ordinary words only, addressed to the pair as «вы».
 */

type Tone = 'flow' | 'tension' | 'merge';
type Phrase = { flow: [string, string]; tension: [string, string]; merge?: [string, string] };

const PAIRS: Record<string, Phrase> = {
  'moon|sun': {
    flow: ['Вам спокойно рядом: то, что важно одному, второй поддерживает без лишних просьб.', 'You feel at ease together: what matters to one, the other supports without being asked.'],
    tension: ['То, что важно одному, второй иногда не замечает, и от этого кажется, что тебя не слышат.', 'What matters to one sometimes goes unnoticed by the other, which can feel like not being heard.'],
    merge: ['Вы хорошо чувствуете друг друга: что важно одному, второй понимает почти сразу.', 'You read each other well: the other quickly understands what matters to you.'],
  },
  'moon|moon': {
    flow: ['У вас похожие привычки и похожее представление о домашнем уюте.', 'You have similar habits and a similar idea of a cosy home.'],
    tension: ['Чтобы успокоиться, вам нужно разное: одному, поговорить, другому, побыть одному.', 'You calm down differently: one wants to talk, the other wants some time alone.'],
    merge: ['Настроение одного быстро передаётся другому, и хорошее, и плохое.', 'One person’s mood quickly passes to the other, good or bad.'],
  },
  'moon|venus': {
    flow: ['Вы умеете проявлять заботу так, как другому приятно.', 'You show care in the way the other person enjoys.'],
    tension: ['Вы по-разному показываете заботу, и знаки внимания одного другой может не заметить.', 'You show care differently, so one person’s gestures can go unnoticed.'],
    merge: ['Вам приятно заботиться друг о друге, и это видно в мелочах.', 'You enjoy looking after each other, and it shows in small things.'],
  },
  'mars|venus': {
    flow: ['Между вами есть взаимный интерес и симпатия.', 'There is mutual interest and liking between you.'],
    tension: ['Интерес друг к другу сильный, но и споры из-за него начинаются быстро.', 'The interest is strong, but so are the arguments it sparks.'],
    merge: ['Между вами сильное притяжение.', 'There is a strong pull between you.'],
  },
  'venus|venus': {
    flow: ['Вам нравятся похожие вещи, поэтому проще решить, куда пойти и как провести время.', 'You like similar things, so it is easy to decide where to go and how to spend time.'],
    tension: ['У вас разные вкусы: в отдыхе, в покупках, в том, что считать красивым.', 'Your tastes differ: in rest, in shopping, in what you find beautiful.'],
  },
  'mars|mars': {
    flow: ['У вас похожий темп: когда надо действовать, вы не тормозите друг друга.', 'You move at a similar pace and do not slow each other down.'],
    tension: ['В споре оба стоят на своём, и уступить трудно обоим.', 'In an argument you both hold your ground, and neither finds it easy to give in.'],
    merge: ['Вы оба быстро берётесь за дело, и так же быстро можете столкнуться.', 'You both jump into action quickly, and can clash just as quickly.'],
  },
  'mercury|mercury': {
    flow: ['Вы легко понимаете ход мыслей друг друга и быстро договариваетесь.', 'You follow each other’s thinking easily and agree quickly.'],
    tension: ['Вы рассуждаете по-разному, поэтому одни и те же слова иногда понимаете по-разному.', 'You think differently, so the same words can mean different things to you.'],
  },
  'mercury|moon': {
    flow: ['Вы умеете говорить о чувствах так, чтобы другого не задеть.', 'You can talk about feelings without hurting each other.'],
    tension: ['Слова одного иногда звучат для другого резче, чем задумано.', 'One person’s words sometimes sound harsher to the other than intended.'],
  },
  'mercury|sun': {
    flow: ['Вам интересно разговаривать: один хорошо понимает, к чему клонит другой.', 'You enjoy talking: one easily sees where the other is going.'],
    tension: ['Вы часто смотрите на одну ситуацию с разных сторон и спорите о мелочах.', 'You often see the same situation from opposite sides and argue over details.'],
  },
  'mars|mercury': {
    flow: ['Вы быстро переходите от разговора к делу.', 'You move quickly from talking to doing.'],
    tension: ['В споре легко перейти на резкий тон, особенно когда кто-то устал или спешит.', 'Arguments easily turn sharp, especially when one of you is tired or in a hurry.'],
  },
  'sun|sun': {
    flow: ['У вас похожие цели, и рядом друг с другом легко быть собой.', 'You have similar goals, and it is easy to be yourselves together.'],
    tension: ['У вас разные цели и разный взгляд на то, что главное.', 'You have different goals and different views on what matters most.'],
  },
};

const OUTER: Record<string, Phrase> = {
  jupiter: {
    flow: ['Один из вас умеет подбодрить второго и поверить в его планы.', 'One of you knows how to encourage the other and believe in their plans.'],
    tension: ['Один из вас иногда обещает больше, чем потом получается сделать.', 'One of you sometimes promises more than gets done.'],
  },
  saturn: {
    flow: ['Вы серьёзно относитесь к договорённостям и выполняете их.', 'You take agreements seriously and keep them.'],
    tension: ['Один из вас бывает слишком строг к другому, и это ощущается как контроль.', 'One of you can be too strict with the other, and it feels like control.'],
  },
  uranus: {
    flow: ['Рядом друг с другом вы не скучаете, и каждый оставляет другому свободу.', 'You do not get bored together, and each leaves the other room.'],
    tension: ['Планы у вас часто меняются в последний момент, и одному не хватает предсказуемости.', 'Plans often change at the last minute, and one of you misses predictability.'],
  },
  neptune: {
    flow: ['Вы хорошо чувствуете настроение друг друга без слов.', 'You sense each other’s mood without words.'],
    tension: ['Вы легко додумываете за другого, поэтому ожидания лучше говорить прямо.', 'You tend to guess for each other, so it is better to say expectations out loud.'],
  },
  pluto: {
    flow: ['Ваша связь серьёзная: вы сильно влияете друг на друга.', 'Your bond is serious: you strongly influence each other.'],
    tension: ['Один из вас может давить, а второй остро на это реагирует.', 'One of you can push hard, and the other reacts strongly to pressure.'],
  },
};

const HOUSES: Record<number, [string, string]> = {
  1: ['Рядом друг с другом каждый чувствует, что может быть собой.', 'Each of you feels free to be yourself with the other.'],
  2: ['Вы похоже относитесь к деньгам и вещам.', 'You treat money and possessions in a similar way.'],
  3: ['Вам легко разговаривать каждый день, даже о мелочах.', 'Everyday conversation comes easily, even about small things.'],
  4: ['Рядом друг с другом вы чувствуете себя как дома.', 'You feel at home with each other.'],
  5: ['Вам весело вместе, и общий отдых получается.', 'You have fun together, and shared free time works out.'],
  6: ['Вы хорошо делите повседневные дела.', 'You share everyday chores well.'],
  7: ['Вы воспринимаете друг друга как партнёров на равных.', 'You see each other as equal partners.'],
  8: ['Вы делитесь друг с другом личным, поэтому доверие для вас особенно важно.', 'You share personal things, so trust matters a lot to you.'],
  9: ['Вам интересно обсуждать взгляды и планы на будущее.', 'You enjoy discussing views and plans for the future.'],
  10: ['Вы помогаете друг другу в делах и в работе.', 'You help each other in work and career.'],
  11: ['Вы как хорошие друзья: общие интересы и общие знакомые.', 'You are like good friends: shared interests and shared people.'],
  12: ['Часть чувств вы держите при себе, и другой о них может не знать.', 'You keep some feelings to yourselves, and the other may not know about them.'],
};

const ANGLES: Record<'ascendant' | 'mc', Phrase> = {
  ascendant: {
    flow: ['Вы легко нашли общий язык с первой встречи.', 'You got on easily from the first meeting.'],
    tension: ['Первое впечатление друг о друге могло быть непростым, но оно не главное.', 'Your first impression of each other may have been awkward, but it is not what matters most.'],
  },
  mc: {
    flow: ['Вы поддерживаете друг друга в делах и решениях.', 'You support each other’s work and decisions.'],
    tension: ['В рабочих вопросах вы часто тянете в разные стороны.', 'On practical matters you often pull in different directions.'],
  },
};

const OUTER_KEYS = new Set(Object.keys(OUTER));

function toneOf(aspect: string | undefined): Tone | null {
  if (aspect === 'trine' || aspect === 'sextile') return 'flow';
  if (aspect === 'square' || aspect === 'opposition') return 'tension';
  if (aspect === 'conjunction') return 'merge';
  return null;
}

function pick(phrase: Phrase, tone: Tone, language: 'ru' | 'en'): string {
  const entry = tone === 'merge' ? (phrase.merge || phrase.flow) : phrase[tone];
  return entry[language === 'en' ? 1 : 0];
}

/** Whether a contact reads as easy (true) or as friction (false) in everyday words. */
export function compatibilityFactIsEasy(evidence: CompatibilityEvidence): boolean | null {
  const technical = evidence.technical || {};
  if (evidence.type === 'house_overlay') return Number(technical.house) !== 12;
  const tone = toneOf(technical.aspect as string | undefined);
  if (!tone) return null;
  if (tone !== 'merge') return tone === 'flow';
  const keys = [String(technical.subjectKey || ''), String(technical.partnerKey || '')];
  return !(keys.includes('uranus') || keys.includes('neptune'));
}

export function plainCompatibilityFact(evidence: CompatibilityEvidence, language: 'ru' | 'en'): string | null {
  const technical = evidence.technical || {};
  const index = language === 'en' ? 1 : 0;
  if (evidence.type === 'house_overlay') {
    const house = Number(technical.house);
    return HOUSES[house]?.[index] || null;
  }
  const tone = toneOf(technical.aspect as string | undefined);
  if (!tone) return null;
  const a = String(technical.subjectKey || '');
  const b = String(technical.partnerKey || '');
  if (evidence.type === 'angle') {
    const angle = b === 'mc' ? ANGLES.mc : ANGLES.ascendant;
    return pick(angle, tone === 'merge' ? 'flow' : tone, language);
  }
  if (evidence.type !== 'aspect') return null;
  const pair = PAIRS[[a, b].sort().join('|')];
  if (pair) return pick(pair, tone, language);
  const outer = OUTER_KEYS.has(a) ? a : OUTER_KEYS.has(b) ? b : null;
  // Both planets slow and generational: the same for a whole age group, not about this pair.
  if (outer && !(OUTER_KEYS.has(a) && OUTER_KEYS.has(b))) {
    return pick(OUTER[outer], tone === 'merge' ? (outer === 'uranus' || outer === 'neptune' ? 'tension' : 'flow') : tone, language);
  }
  return null;
}
