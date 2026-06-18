/**
 * Локальная совместимость по знакам — текст собирается из нашей базы (профили знаков +
 * динамика стихий). Без OpenAI, мгновенно. 78 пар покрываются композицией.
 */
import type { Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { normalizeZodiacKey } from '../horoscope/signDaily';
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

export function buildLocalSignCompatibility(first: string, second: string, language: Language): SignCompatibilityResult | null {
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

  let attraction: string;
  let difficulty: string;
  let communication: string;

  if (ru) {
    attraction = same
      ? `Вы очень похожи: оба про ${pa.trait}. Это даёт быстрое узнавание и ощущение «свой человек». ${dyn.attract}`
      : `${cap(nameA)} приносит ${pa.trait}, а ${nameB} — ${pb.trait}. ${dyn.attract} Вместе это и притягивает: каждый добавляет то, чего не хватает другому.`;
    difficulty = same
      ? `Общая слабость тоже удваивается: ${pa.friction} с обеих сторон. ${dyn.tension}`
      : `Сложности появляются там, где встречаются ${pa.friction} и ${pb.friction}. ${dyn.tension}`;
    communication = `Чтобы понимать друг друга: ${pa.talk}; ${pb.talk}. ${dyn.advice}`;
  } else {
    attraction = same
      ? `You’re very alike: both about ${pa.traitEn}. That brings quick recognition. ${dyn.attractEn}`
      : `${cap(nameA)} brings ${pa.traitEn}, while ${nameB} brings ${pb.traitEn}. ${dyn.attractEn} That’s the pull: each adds what the other lacks.`;
    difficulty = same
      ? `The shared weak spot doubles too: ${pa.frictionEn} on both sides. ${dyn.tensionEn}`
      : `Difficulty shows up where ${pa.frictionEn} meets ${pb.frictionEn}. ${dyn.tensionEn}`;
    communication = `To understand each other: ${pa.talkEn}; ${pb.talkEn}. ${dyn.adviceEn}`;
  }

  return {
    signA: a,
    signB: b,
    attraction,
    difficulty,
    communication,
    limitation: ru
      ? 'Это общий разбор только по двум знакам. Время и место рождения, Луна и Венера могут заметно изменить картину.'
      : 'A general two-sign reading. Birth time and place, the Moon and Venus can change the picture.',
  };
}
