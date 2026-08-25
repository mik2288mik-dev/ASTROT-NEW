/**
 * Локальная совместимость по знакам — текст собирается из нашей базы (профили знаков +
 * динамика стихий). Без OpenAI, мгновенно. 78 пар покрываются композицией.
 */
import type { Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { normalizeZodiacKey } from '../zodiacKeys';
import type { SignCompatibilityResult } from './signCompatibility';
import type { RelationshipContext } from './relationshipContext';

type Element = 'fire' | 'earth' | 'air' | 'water';

const ELEMENT: Record<string, Element> = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
};

type Profile = { trait: string; friction: string; talk: string; traitEn: string; frictionEn: string; talkEn: string };

const P: Record<string, Profile> = {
  aries: { trait: 'прямой азарт и желание действовать', friction: 'нетерпеливость и резкость', talk: 'говори прямо и по делу, без долгих намёков',
    traitEn: 'direct drive and a need to act', frictionEn: 'impatience and bluntness', talkEn: 'be direct and to the point' },
  taurus: { trait: 'спокойная надёжность и любовь к комфорту', friction: 'упрямство', talk: 'не дави и дай время — здесь ценят стабильность',
    traitEn: 'calm reliability and love of comfort', frictionEn: 'stubbornness', talkEn: 'don’t rush — stability matters here' },
  gemini: { trait: 'лёгкость, любопытство и общение', friction: 'непостоянство', talk: 'держи разговор живым и не грузи тяжёлым тоном',
    traitEn: 'lightness, curiosity and talk', frictionEn: 'restlessness', talkEn: 'keep it light and engaging' },
  cancer: { trait: 'забота, чувствительность и тепло', friction: 'обидчивость', talk: 'будь мягче и не отмахивайся от чувств',
    traitEn: 'care, sensitivity and warmth', frictionEn: 'touchiness', talkEn: 'be gentle and take feelings seriously' },
  leo: { trait: 'тепло, щедрость и желание быть замеченным', friction: 'гордость', talk: 'цени искренне — и получишь втрое больше',
    traitEn: 'warmth, generosity and a wish to be seen', frictionEn: 'pride', talkEn: 'give honest appreciation' },
  virgo: { trait: 'внимание к деталям и желание помочь', friction: 'критичность', talk: 'будь конкретным, а замечания — это забота, не нападение',
    traitEn: 'attention to detail and a wish to help', frictionEn: 'criticism', talkEn: 'be specific; their notes are care, not attacks' },
  libra: { trait: 'обаяние и тяга к гармонии в паре', friction: 'нерешительность', talk: 'помогай выбирать и держи атмосферу ровной',
    traitEn: 'charm and a pull toward harmony', frictionEn: 'indecision', talkEn: 'help with choices and keep things even' },
  scorpio: { trait: 'глубина, страсть и преданность', friction: 'ревность и контроль', talk: 'будь честным до конца — фальшь здесь чувствуют сразу',
    traitEn: 'depth, passion and loyalty', frictionEn: 'jealousy and control', talkEn: 'be fully honest — they sense pretense fast' },
  sagittarius: { trait: 'свобода, оптимизм и тяга к новому', friction: 'прямота и непоседливость', talk: 'дай простор и не удерживай силой',
    traitEn: 'freedom, optimism and a love of the new', frictionEn: 'bluntness and restlessness', talkEn: 'give space, don’t hold on tight' },
  capricorn: { trait: 'надёжность, цели и ответственность', friction: 'закрытость и сдержанность', talk: 'показывай дела, а не слова — здесь верят поступкам',
    traitEn: 'reliability, goals and responsibility', frictionEn: 'reserve', talkEn: 'show action, not words' },
  aquarius: { trait: 'оригинальность, ум и независимость', friction: 'отстранённость', talk: 'уважай свободу и не дави эмоциями',
    traitEn: 'originality, mind and independence', frictionEn: 'detachment', talkEn: 'respect their freedom, don’t pressure with emotion' },
  pisces: { trait: 'мягкость, воображение и сочувствие', friction: 'уход в себя', talk: 'будь бережным и не руби сплеча',
    traitEn: 'softness, imagination and empathy', frictionEn: 'withdrawing', talkEn: 'be tender and don’t cut sharply' },
};

function elementPair(a: Element, b: Element): 'same' | 'harmonious' | 'challenging' {
  if (a === b) return 'same';
  const harmonious = (a === 'fire' && b === 'air') || (a === 'air' && b === 'fire') || (a === 'earth' && b === 'water') || (a === 'water' && b === 'earth');
  return harmonious ? 'harmonious' : 'challenging';
}

const DYNAMIC: Record<'same' | 'harmonious' | 'challenging', { attract: string; tension: string; advice: string; attractEn: string; tensionEn: string; adviceEn: string }> = {
  same: {
    attract: 'Вы из одной стихии — похожи по темпу и легко чувствуете друг друга.',
    tension: 'Минус — можете застревать в одинаковых реакциях и усиливать общие слабости.',
    advice: 'Иногда специально вносите разнообразие, чтобы не вариться в одном и том же.',
    attractEn: 'You share an element — similar pace, easy to feel each other.',
    tensionEn: 'The risk: getting stuck in the same reactions and amplifying shared weak spots.',
    adviceEn: 'Add variety on purpose so you don’t loop in the same patterns.' },
  harmonious: {
    attract: 'Ваши стихии усиливают друг друга — один зажигает, другой поддерживает.',
    tension: 'Напряжение возможно, если один тянет вперёд, а другой хочет притормозить.',
    advice: 'Цените разницу темпов — она и есть ваша сила.',
    attractEn: 'Your elements lift each other — one sparks, the other supports.',
    tensionEn: 'Friction shows up when one pushes forward and the other wants to slow down.',
    adviceEn: 'Value the difference in pace — it’s your strength.' },
  challenging: {
    attract: 'Ваши стихии разные по природе — отсюда и притяжение, и искры.',
    tension: 'Сложнее всего с темпом и приоритетами: что для одного важно, другому кажется лишним.',
    advice: 'Не переделывайте друг друга — учитесь уважать чужой способ жить.',
    attractEn: 'Your elements differ in nature — hence both the pull and the sparks.',
    tensionEn: 'Pace and priorities clash most: what matters to one can feel like extra to the other.',
    adviceEn: 'Don’t remake each other — respect a different way of living.' },
};

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export type CompatGender = 'male' | 'female';

function asGender(value?: string | null): CompatGender | null {
  return value === 'male' || value === 'female' ? value : null;
}

/** «Мужчина-Овен» / «Женщина-Весы» (или просто знак, если пол не задан). */
function genderedSign(signName: string, gender: CompatGender | null, ru: boolean): string {
  if (!gender) return cap(signName);
  if (ru) return `${gender === 'male' ? 'Мужчина' : 'Женщина'}-${cap(signName)}`;
  return `${gender === 'male' ? 'Male' : 'Female'} ${cap(signName)}`;
}

const CONTEXT_COPY = {
  ru: {
    romance: {
      attraction: 'В любви одной искры мало — важно, выдерживает ли она обычную жизнь.',
      difficulty: 'Химия не отменяет разницу характеров.',
      communication: 'Не проверяй чувства догадками: здесь лучше один прямой вопрос, чем десять внутренних версий.',
    },
    relationship: {
      attraction: 'В отношениях важна не только искра, но и то, насколько спокойно вы проживаете обычные дни.',
      difficulty: 'Знакомые роли могут включаться раньше, чем вы успеваете назвать реальную причину напряжения.',
      communication: 'Отделяйте текущую просьбу от накопленных претензий и договаривайтесь об одном вопросе за раз.',
    },
    friendship: {
      attraction: 'В дружбе главное не эффектное знакомство, а можно ли рядом быть собой без постоянной игры.',
      difficulty: 'Даже сильная дружба портится, когда один считает близость очевидной, а второй ждёт конкретных действий.',
      communication: 'Говорите прямо о границах, времени и взаимности — дружба от этого не становится холоднее.',
    },
    work: {
      attraction: 'В работе важна не симпатия, а то, усиливаете ли вы результат друг друга.',
      difficulty: 'Главная проверка — темп, ответственность и отношение к договорённостям.',
      communication: 'Фиксируйте роли и сроки словами: рабочую совместимость лучше не строить на телепатии.',
    },
    family: {
      attraction: 'В семье связь уже дана, но качество контакта всё равно зависит от правил и уважения.',
      difficulty: 'Старые роли легко включаются автоматически и заставляют спорить не о текущей ситуации.',
      communication: 'Отделяйте конкретную просьбу от накопленной семейной истории — так разговор остаётся про настоящее.',
    },
  },
  en: {
    romance: {
      attraction: 'In love, chemistry is only the start — the real question is whether it survives ordinary life.',
      difficulty: 'Chemistry does not erase differences in character.',
      communication: 'Do not test feelings with guesses: one direct question beats ten private theories.',
    },
    relationship: {
      attraction: 'In a relationship, chemistry matters alongside how calmly you handle ordinary days together.',
      difficulty: 'Familiar roles can take over before either person names the actual source of tension.',
      communication: 'Separate the current request from old grievances and resolve one concrete issue at a time.',
    },
    friendship: {
      attraction: 'In friendship, the real test is whether you can be yourselves without constant performance.',
      difficulty: 'Even a strong friendship frays when one assumes closeness and the other waits for concrete effort.',
      communication: 'Name boundaries, time and reciprocity directly — honesty does not make friendship colder.',
    },
    work: {
      attraction: 'At work, the useful question is not whether you click, but whether you improve each other’s result.',
      difficulty: 'The real test is pace, ownership and respect for agreements.',
      communication: 'Put roles and deadlines into words: professional compatibility should not rely on telepathy.',
    },
    family: {
      attraction: 'Family creates a bond, but respect and clear rules still determine its quality.',
      difficulty: 'Old roles can switch on automatically and turn a current issue into an old argument.',
      communication: 'Separate the concrete request from the whole family history so the conversation stays in the present.',
    },
  },
} as const;

export type LocalPersonSnapshot = {
  headline: string;
  body: string;
  contextLine: string;
  limitation: string;
};

export function buildLocalPersonSnapshot(
  sign: string,
  language: Language,
  context: RelationshipContext,
  gender?: string | null,
): LocalPersonSnapshot | null {
  const normalized = normalizeZodiacKey(sign);
  if (!normalized) return null;
  const key = normalized.toLowerCase();
  const profile = P[key];
  if (!profile) return null;
  const ru = language !== 'en';
  const label = genderedSign(getZodiacSign(language, key), asGender(gender), ru);
  const copy = CONTEXT_COPY[ru ? 'ru' : 'en'][context];
  return ru
    ? {
        headline: `${label}: сначала о человеке`,
        body: `По солнечному знаку здесь сильнее всего видны ${profile.trait}. Это цепляет, но слабое место тоже заметное — ${profile.friction}. Не додумывай остальное за человека: смотри, совпадают ли слова и повторяющиеся поступки.`,
        contextLine: copy.attraction,
        limitation: 'Это честный общий портрет по дате рождения. Время и место добавят Луну, Венеру, дома и сделают вывод точнее.',
      }
    : {
        headline: `${label}: the person first`,
        body: `The Sun sign points most clearly to ${profile.traitEn}. That can be compelling, but the weak spot is visible too: ${profile.frictionEn}. Do not fill in the rest for them — compare words with repeated actions.`,
        contextLine: copy.attraction,
        limitation: 'This is an honest general portrait from the birth date. Time and place add the Moon, Venus and houses for a more precise reading.',
      };
}

export function buildLocalSignCompatibility(
  first: string,
  second: string,
  language: Language,
  genderFirst?: string | null,
  genderSecond?: string | null,
  context: RelationshipContext = 'romance',
): SignCompatibilityResult | null {
  const a = normalizeZodiacKey(first);
  const b = normalizeZodiacKey(second);
  if (!a || !b) return null;
  const ka = a.toLowerCase();
  const kb = b.toLowerCase();
  const pa = P[ka];
  const pb = P[kb];
  if (!pa || !pb) return null;

  const ru = language !== 'en';
  const dyn = DYNAMIC[elementPair(ELEMENT[ka], ELEMENT[kb])];
  const nameA = getZodiacSign(language, ka);
  const nameB = getZodiacSign(language, kb);
  const same = ka === kb;

  const gA = asGender(genderFirst);
  const gB = asGender(genderSecond);
  const labelA = genderedSign(nameA, gA, ru);
  const labelB = genderedSign(nameB, gB, ru);
  const contextCopy = CONTEXT_COPY[ru ? 'ru' : 'en'][context];

  let attraction: string;
  let difficulty: string;
  let communication: string;

  if (ru) {
    attraction = same
      ? `Вы очень похожи: оба про ${pa.trait}. Это даёт быстрое узнавание и ощущение «свой человек». ${dyn.attract}`
      : `${labelA} приносит ${pa.trait}, а ${labelB} — ${pb.trait}. ${dyn.attract} Вместе это и притягивает: каждый добавляет то, чего не хватает другому.`;
    difficulty = same
      ? `Общая слабость тоже удваивается: ${pa.friction} с обеих сторон. ${dyn.tension}`
      : `Сложности появляются там, где встречаются ${pa.friction} и ${pb.friction}. ${dyn.tension}`;
    communication = `Чтобы понимать друг друга: ${pa.talk}; ${pb.talk}. ${dyn.advice}`;
  } else {
    attraction = same
      ? `You’re very alike: both about ${pa.traitEn}. That brings quick recognition. ${dyn.attractEn}`
      : `${labelA} brings ${pa.traitEn}, while ${labelB} brings ${pb.traitEn}. ${dyn.attractEn} That’s the pull: each adds what the other lacks.`;
    difficulty = same
      ? `The shared weak spot doubles too: ${pa.frictionEn} on both sides. ${dyn.tensionEn}`
      : `Difficulty shows up where ${pa.frictionEn} meets ${pb.frictionEn}. ${dyn.tensionEn}`;
    communication = `To understand each other: ${pa.talkEn}; ${pb.talkEn}. ${dyn.adviceEn}`;
  }

  attraction = `${contextCopy.attraction} ${attraction}`;
  difficulty = `${contextCopy.difficulty} ${difficulty}`;
  communication = `${contextCopy.communication} ${communication}`;

  return {
    signA: a,
    signB: b,
    attraction,
    difficulty,
    communication,
    limitation: ru
      ? 'Это общий разбор по солнечным знакам. Пол не используется как «объяснение характера»: время и место рождения, Луна и Венера могут заметно изменить картину.'
      : 'This is a general Sun-sign reading. Gender is not used to explain character; birth time and place, the Moon and Venus can change the picture.',
  };
}
