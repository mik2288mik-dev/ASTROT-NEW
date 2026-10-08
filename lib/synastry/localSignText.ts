/**
 * Локальная совместимость по знакам — текст собирается из нашей базы (профили знаков +
 * динамика пары стихий). Без OpenAI, мгновенно. 78 пар покрываются композицией.
 * Русские куски написаны так, чтобы склейка всегда оставалась грамотной: перечни
 * через двоеточие (без согласования глагола с «Рыбы»/«Овен»), готовые формы «С Овном»,
 * обращение на «ты» без родовых форм.
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

type Profile = {
  /** What the sign brings into a pair, a nominative list. */
  gives: string;
  /** The sign's weak spot, a nominative noun phrase. */
  weak: string;
  /** «С Овном»: the instrumental lead-in for how to talk with the sign. */
  with: string;
  /** How to talk with the sign, second person without gendered forms. */
  talk: string;
  traitEn: string;
  frictionEn: string;
  talkEn: string;
};

const P: Record<string, Profile> = {
  aries: { gives: 'прямота, азарт и смелость начинать первым', weak: 'нетерпение и резкие слова сгоряча', with: 'С Овном', talk: 'говори прямо и коротко, намёки здесь теряются',
    traitEn: 'direct drive and a need to act', frictionEn: 'impatience and bluntness', talkEn: 'be direct and to the point' },
  taurus: { gives: 'спокойствие, надёжность и умение создать уют', weak: 'упрямство, когда торопят', with: 'С Тельцом', talk: 'давай время подумать: решение без спешки Телец держит крепко',
    traitEn: 'calm reliability and love of comfort', frictionEn: 'stubbornness', talkEn: 'don’t rush, stability matters here' },
  gemini: { gives: 'лёгкость, любопытство и живой разговор', weak: 'переменчивость настроения и планов', with: 'С Близнецами', talk: 'держи разговор живым и лёгким, Близнецам важно, чтобы было интересно',
    traitEn: 'lightness, curiosity and talk', frictionEn: 'restlessness', talkEn: 'keep it light and engaging' },
  cancer: { gives: 'забота, тепло и чуткость к настроению', weak: 'обидчивость и привычка молчать об обиде', with: 'С Раком', talk: 'говори мягко и спрашивай о чувствах, Раку важно, чтобы их замечали',
    traitEn: 'care, sensitivity and warmth', frictionEn: 'touchiness', talkEn: 'be gentle and take feelings seriously' },
  leo: { gives: 'щедрость, тепло и яркость', weak: 'гордость и обида, когда старания не замечают', with: 'Со Львом', talk: 'хвали искренне и вслух, Льву это нужно как воздух',
    traitEn: 'warmth, generosity and a wish to be seen', frictionEn: 'pride', talkEn: 'give honest appreciation' },
  virgo: { gives: 'внимательность, практичность и забота делом', weak: 'придирчивость к мелочам', with: 'С Девой', talk: 'говори конкретно и принимай её замечания как заботу',
    traitEn: 'attention to detail and a wish to help', frictionEn: 'criticism', talkEn: 'be specific; their notes are care, not attacks' },
  libra: { gives: 'обаяние, такт и умение мирить', weak: 'долгие колебания перед выбором', with: 'С Весами', talk: 'помогай с выбором и держи спокойный тон, Весам важна гармония',
    traitEn: 'charm and a pull toward harmony', frictionEn: 'indecision', talkEn: 'help with choices and keep things even' },
  scorpio: { gives: 'глубина, страсть и верность', weak: 'ревность и желание держать всё под контролем', with: 'Со Скорпионом', talk: 'говори честно до конца, фальшь Скорпион чувствует сразу',
    traitEn: 'depth, passion and loyalty', frictionEn: 'jealousy and control', talkEn: 'be fully honest, they sense pretense fast' },
  sagittarius: { gives: 'оптимизм, свобода и тяга к новому', weak: 'резкая прямота и непоседливость', with: 'Со Стрельцом', talk: 'оставляй простор и зови в новое, Стрельцу важна свобода',
    traitEn: 'freedom, optimism and a love of the new', frictionEn: 'bluntness and restlessness', talkEn: 'give space, don’t hold on tight' },
  capricorn: { gives: 'надёжность, ясные цели и ответственность', weak: 'сдержанность и закрытость в чувствах', with: 'С Козерогом', talk: 'показывай заботу делами, Козерог верит поступкам',
    traitEn: 'reliability, goals and responsibility', frictionEn: 'reserve', talkEn: 'show action, not words' },
  aquarius: { gives: 'оригинальность, ум и независимость', weak: 'отстранённость, если давить', with: 'С Водолеем', talk: 'уважай личное пространство и говори о чувствах спокойно',
    traitEn: 'originality, mind and independence', frictionEn: 'detachment', talkEn: 'respect their freedom, don’t pressure with emotion' },
  pisces: { gives: 'мягкость, воображение и сочувствие', weak: 'привычка уходить в себя', with: 'С Рыбами', talk: 'говори бережно и давай время прийти в себя после обиды',
    traitEn: 'softness, imagination and empathy', frictionEn: 'withdrawing', talkEn: 'be tender and don’t cut sharply' },
};

type Dynamic = { attract: string; tension: string; advice: string };

/** Every pair of elements, keyed by the two elements in alphabetical order. */
const DYNAMIC_RU: Record<string, Dynamic> = {
  'fire:fire': {
    attract: 'Два огня: вам вместе ярко и быстро, скучать точно не придётся.',
    tension: 'Вспыхиваете вы тоже вместе, поэтому споры разгораются за секунды.',
    advice: 'Договоритесь о паузе в споре: кто первым остыл, тот и предлагает мир.' },
  'earth:earth': {
    attract: 'Две земли: вам спокойно и надёжно, в делах вы понимаете друг друга с полуслова.',
    tension: 'Со временем легко увязнуть в рутине и забыть о радостях.',
    advice: 'Планируйте вместе отдых и праздники так же старательно, как дела.' },
  'air:air': {
    attract: 'Два воздуха: вам всегда есть о чём поговорить, идеи рождаются на ходу.',
    tension: 'Слов бывает больше, чем дел, и важное так и остаётся разговором.',
    advice: 'Выбирайте из идей одну и доводите её до конца вместе.' },
  'water:water': {
    attract: 'Две воды: вы чувствуете друг друга без слов, рядом тепло и спокойно.',
    tension: 'Обиды тоже чувствуются вдвойне и могут долго копиться молча.',
    advice: 'Говорите о чувствах сразу, пока они маленькие.' },
  'air:fire': {
    attract: 'Огонь и воздух: один зажигает, другой раздувает пламя, вместе вы легко загораетесь идеями.',
    tension: 'Обоим быстро становится скучно, и общие планы иногда рассыпаются.',
    advice: 'Держите рядом одно общее дело, к которому хочется возвращаться.' },
  'earth:water': {
    attract: 'Земля и вода: один даёт опору, другой тепло, вместе получается надёжно и уютно.',
    tension: 'Один показывает заботу делами, другой словами и вниманием, и каждый ждёт своего.',
    advice: 'Расскажите друг другу прямо, что для каждого значит забота.' },
  'earth:fire': {
    attract: 'Огонь и земля: один зажигает идеей, другой делает её реальной.',
    tension: 'Темп у вас разный: одному хочется сразу, другому сначала всё обдумать.',
    advice: 'Договоритесь, где вы действуете быстро, а где берёте время подумать.' },
  'fire:water': {
    attract: 'Огонь и вода: вас тянет друг к другу именно разницей, рядом всегда сильные чувства.',
    tension: 'Один вспыхивает быстро, другой глубоко переживает каждое слово.',
    advice: 'В споре сбавляйте громкость и проговаривайте, что на самом деле задело.' },
  'air:earth': {
    attract: 'Земля и воздух: один приносит идеи, другой знает, как их воплотить.',
    tension: 'Одному важны свобода и разнообразие, другому порядок и предсказуемость.',
    advice: 'Оставьте место и для общих правил, и для личного пространства каждого.' },
  'air:water': {
    attract: 'Воздух и вода: один смотрит на всё легко, другой чувствует глубоко, и этим вы интересны друг другу.',
    tension: 'Одному хочется всё обсудить, другому важнее почувствовать понимание.',
    advice: 'Сначала выслушайте чувства, потом ищите решение.' },
};

function dynamicRu(a: Element, b: Element): Dynamic {
  return DYNAMIC_RU[[a, b].sort().join(':')];
}

function elementPair(a: Element, b: Element): 'same' | 'harmonious' | 'challenging' {
  if (a === b) return 'same';
  const harmonious = (a === 'fire' && b === 'air') || (a === 'air' && b === 'fire') || (a === 'earth' && b === 'water') || (a === 'water' && b === 'earth');
  return harmonious ? 'harmonious' : 'challenging';
}

const DYNAMIC_EN: Record<'same' | 'harmonious' | 'challenging', { attractEn: string; tensionEn: string; adviceEn: string }> = {
  same: {
    attractEn: 'You share an element, similar pace, easy to feel each other.',
    tensionEn: 'The risk: getting stuck in the same reactions and amplifying shared weak spots.',
    adviceEn: 'Add variety on purpose so you don’t loop in the same patterns.' },
  harmonious: {
    attractEn: 'Your elements lift each other, one sparks, the other supports.',
    tensionEn: 'Friction shows up when one pushes forward and the other wants to slow down.',
    adviceEn: 'Value the difference in pace, it’s your strength.' },
  challenging: {
    attractEn: 'Your elements differ in nature, hence both the pull and the sparks.',
    tensionEn: 'Pace and priorities clash most: what matters to one can feel like extra to the other.',
    adviceEn: 'Don’t remake each other, respect a different way of living.' },
};

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export type CompatGender = 'male' | 'female' | 'unspecified';

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
      attraction: 'В любви важно, чтобы искра жила и в обычные будни.',
      difficulty: 'Влюблённость сглаживает разницу характеров только поначалу.',
      communication: 'Если сомневаешься в чувствах, спроси прямо: один честный вопрос лучше десяти догадок.',
    },
    relationship: {
      attraction: 'В отношениях важно, как вам вместе в самые обычные дни.',
      difficulty: 'Старые привычки и роли включаются быстрее, чем вы успеваете назвать настоящую причину спора.',
      communication: 'Обсуждайте один вопрос за раз и говорите о том, что происходит сейчас.',
    },
    friendship: {
      attraction: 'В дружбе главное, чтобы рядом можно было быть собой.',
      difficulty: 'Дружба остывает, когда один ждёт звонков, а другой уверен, что и так всё понятно.',
      communication: 'Говорите прямо о времени, границах и взаимности: честность дружбу только укрепляет.',
    },
    work: {
      attraction: 'В работе важно, как вы усиливаете результат друг друга.',
      difficulty: 'Главная проверка: темп, ответственность и верность договорённостям.',
      communication: 'Проговаривайте роли и сроки вслух и записывайте договорённости.',
    },
    family: {
      attraction: 'В семье связь уже есть, а тепло в ней держится на уважении и понятных правилах.',
      difficulty: 'Старые семейные роли легко включаются сами и уводят спор в прошлое.',
      communication: 'Говорите о сегодняшней просьбе и оставляйте старые семейные истории в прошлом.',
    },
  },
  en: {
    romance: {
      attraction: 'In love, chemistry is only the start, the real question is whether it survives ordinary life.',
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
      communication: 'Name boundaries, time and reciprocity directly, honesty does not make friendship colder.',
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
  const copy = CONTEXT_COPY[ru ? 'ru' : 'en'][context === 'ex' ? 'relationship' : context];
  return ru
    ? {
        headline: `${label}: сначала о человеке`,
        body: `Сильные стороны: ${profile.gives}. Слабое место: ${profile.weak}. Остальное лучше узнавать по поступкам, которые повторяются.`,
        contextLine: copy.attraction,
        limitation: 'Это общий портрет по дате рождения. Время и место рождения добавят Луну, Венеру и дома, и портрет станет точнее.',
      }
    : {
        headline: `${label}: the person first`,
        body: `The Sun sign points most clearly to ${profile.traitEn}. That can be compelling, but the weak spot is visible too: ${profile.frictionEn}. Do not fill in the rest for them, compare words with repeated actions.`,
        contextLine: copy.attraction,
        limitation: 'This is an honest general portrait from the birth date. Time and place add the Moon, Venus and houses for a more precise reading.',
      };
}

/** One line about how two Sun signs feel together — for small cards. */
export function signPairTeaser(first: string, second: string, language: Language): string | null {
  const a = normalizeZodiacKey(first)?.toLowerCase();
  const b = normalizeZodiacKey(second)?.toLowerCase();
  if (!a || !b || !ELEMENT[a] || !ELEMENT[b]) return null;
  return language === 'en'
    ? DYNAMIC_EN[elementPair(ELEMENT[a], ELEMENT[b])].attractEn
    : dynamicRu(ELEMENT[a], ELEMENT[b]).attract;
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
  const nameA = getZodiacSign(language, ka);
  const nameB = getZodiacSign(language, kb);
  const same = ka === kb;

  const gA = asGender(genderFirst);
  const gB = asGender(genderSecond);
  const labelA = genderedSign(nameA, gA, ru);
  const labelB = genderedSign(nameB, gB, ru);
  const contextCopy = CONTEXT_COPY[ru ? 'ru' : 'en'][context === 'ex' ? 'relationship' : context];

  let attraction: string;
  let difficulty: string;
  let communication: string;

  if (ru) {
    const dyn = dynamicRu(ELEMENT[ka], ELEMENT[kb]);
    attraction = same
      ? `У вас один знак, ${cap(nameA)}: ${pa.gives}. Вы быстро узнаёте друг друга и сразу чувствуете, что рядом свой человек. ${dyn.attract}`
      : `${labelA}: ${pa.gives}. ${labelB}: ${pb.gives}. ${dyn.attract}`;
    difficulty = same
      ? `Слабое место у вас тоже общее: ${pa.weak}. ${dyn.tension}`
      : `${labelA}: ${pa.weak}. ${labelB}: ${pb.weak}. ${dyn.tension}`;
    communication = same
      ? `${pa.with} ${pa.talk}. ${dyn.advice}`
      : `${pa.with} ${pa.talk}. ${pb.with} ${pb.talk}. ${dyn.advice}`;
  } else {
    const dyn = DYNAMIC_EN[elementPair(ELEMENT[ka], ELEMENT[kb])];
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
      ? 'Это разбор по знакам Солнца. Время и место рождения обоих добавят Луну и Венеру, и картина станет точнее.'
      : 'This is a general Sun-sign reading. Gender is not used to explain character; birth time and place, the Moon and Venus can change the picture.',
  };
}
