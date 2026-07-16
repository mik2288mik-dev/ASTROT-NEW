/**
 * Локальная совместимость по знакам — текст собирается из нашей базы (профили знаков +
 * динамика стихий). Без OpenAI, мгновенно. 78 пар покрываются композицией.
 */
import type { Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { normalizeZodiacKey } from '../zodiacKeys';
import type { SignCompatibilityResult } from './signCompatibility';

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

type ComboCopy = { attract: string; tension: string; talk: string };

// Гендерный слой поверх базы по знакам/стихиям. 4 комбинации (м+ж, ж+м, м+м, ж+ж) —
// тёплые, современные формулировки про динамику пары, без грубых стереотипов.
const COMBO_RU: Record<'mf' | 'fm' | 'mm' | 'ff', ComboCopy> = {
  mf: {
    attract: 'Его инициатива и её чуткость хорошо дополняют друг друга — в этом контрасте много притяжения.',
    tension: 'Ему чаще важны ясность и действия, ей — внимание к настроению: разный язык близости иногда путает.',
    talk: 'Ему говори прямую просьбу, ей показывай, что её чувства замечены, — и держите оба этих слоя.',
  },
  fm: {
    attract: 'Её энергия ведёт, его спокойная опора держит — баланс, где инициатива по очереди у каждого.',
    tension: 'Ей может хотеться больше динамики, ему — устойчивости; молчаливая борьба за темп выматывает обоих.',
    talk: 'Договоритесь, где ведёт она, а где он, — тогда роли перестанут соперничать.',
  },
  mm: {
    attract: 'Двое мужчин понимают азарт и амбиции друг друга — союз на уважении, драйве и общем деле.',
    tension: 'Сложнее всего с соперничеством и нежеланием первым показать слабое место.',
    talk: 'Признавайте вклад друг друга вслух и не превращайте близость в соревнование.',
  },
  ff: {
    attract: 'Две женщины дают паре глубину, эмпатию и тонкое чувствование друг друга почти без слов.',
    tension: 'Риск — раствориться в эмоциях друг друга и копить недосказанное, пока не накопится.',
    talk: 'Оставляйте друг другу воздух и говорите о потребностях прямо, без намёков.',
  },
};

const COMBO_EN: Record<'mf' | 'fm' | 'mm' | 'ff', ComboCopy> = {
  mf: {
    attract: 'His drive and her attunement complement each other — there’s real pull in that contrast.',
    tension: 'He tends to want clarity and action, she wants attention to mood: two languages of closeness can confuse.',
    talk: 'Give him a direct ask, show her that her feelings are seen — keep both layers.',
  },
  fm: {
    attract: 'Her energy leads, his steady support holds — a balance where initiative takes turns.',
    tension: 'She may want more momentum, he wants stability; a silent tug over pace drains both.',
    talk: 'Agree where she leads and where he does — then the roles stop competing.',
  },
  mm: {
    attract: 'Two men get each other’s drive and ambition — a bond built on respect and a shared mission.',
    tension: 'The hard part is rivalry and not wanting to show a weak spot first.',
    talk: 'Name each other’s contribution out loud and don’t turn closeness into a contest.',
  },
  ff: {
    attract: 'Two women bring depth, empathy and a fine read on each other, almost without words.',
    tension: 'The risk is dissolving into each other’s emotions and storing up the unsaid.',
    talk: 'Leave each other air and state needs directly, without hints.',
  },
};

function comboKey(gA: CompatGender, gB: CompatGender): 'mf' | 'fm' | 'mm' | 'ff' {
  return `${gA === 'male' ? 'm' : 'f'}${gB === 'male' ? 'm' : 'f'}` as 'mf' | 'fm' | 'mm' | 'ff';
}

export function buildLocalSignCompatibility(
  first: string,
  second: string,
  language: Language,
  genderFirst?: string | null,
  genderSecond?: string | null,
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
  // Гендерный слой включаем только когда известны ОБА пола — иначе остаёмся нейтральными.
  const combo = gA && gB ? (ru ? COMBO_RU : COMBO_EN)[comboKey(gA, gB)] : null;
  const labelA = genderedSign(nameA, gA, ru);
  const labelB = genderedSign(nameB, gB, ru);

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

  // Вплетаем гендерный слой (если оба пола известны).
  if (combo) {
    attraction = `${attraction} ${combo.attract}`;
    difficulty = `${difficulty} ${combo.tension}`;
    communication = `${communication} ${combo.talk}`;
  }

  return {
    signA: a,
    signB: b,
    attraction,
    difficulty,
    communication,
    limitation: ru
      ? 'Это общий разбор по двум знакам с учётом пола. Время и место рождения, Луна и Венера могут заметно изменить картину.'
      : 'A general two-sign reading that accounts for gender. Birth time and place, the Moon and Venus can change the picture.',
  };
}
