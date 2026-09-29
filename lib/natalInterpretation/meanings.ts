import type { NatalAngleKey, NatalAspectType, NatalBodyKey } from '../natalChartV2Types';
import type { NatalMeaningTopic } from './types';

type Localized = { ru: string; en: string };

export const BODY_LABELS: Record<NatalBodyKey, Localized> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  chiron: { ru: 'Хирон', en: 'Chiron' },
  northNode: { ru: 'Северный узел', en: 'North Node' },
  southNode: { ru: 'Южный узел', en: 'South Node' },
};

export const BODY_ROLES: Record<NatalBodyKey, Localized> = {
  sun: { ru: 'то, как человек выражает себя, выбирает направление и действует от своего имени', en: 'how the person expresses themselves, chooses direction, and acts from their own position' },
  moon: { ru: 'эмоциональную реакцию, привычки и то, что помогает чувствовать себя в знакомом ритме', en: 'emotional response, habits, and what supports a familiar sense of comfort' },
  mercury: { ru: 'способ думать, разбираться в информации и объяснять свою мысль', en: 'the way the person thinks, processes information, and explains an idea' },
  venus: { ru: 'вкусы, ценности, симпатию и способ сближаться с людьми', en: 'taste, values, attraction, and the way closeness is approached' },
  mars: { ru: 'способ начинать действие, добиваться результата и реагировать на сопротивление', en: 'the way action starts, results are pursued, and resistance is met' },
  jupiter: { ru: 'способ расширять знания, опыт и круг возможностей', en: 'the way knowledge, experience, and opportunities are expanded' },
  saturn: { ru: 'отношение к правилам, ответственности, ограничениям и долгой работе', en: 'the approach to rules, responsibility, limits, and long-term work' },
  uranus: { ru: 'отношение к свободе выбора, переменам и нестандартным решениям', en: 'the approach to freedom of choice, change, and unconventional solutions' },
  neptune: { ru: 'воображение, впечатлительность и способ работать с неоднозначным или неочевидным', en: 'imagination, impressionability, and handling what is ambiguous or not immediately obvious' },
  pluto: { ru: 'отношение к глубоким переменам, интенсивности и сильному влиянию', en: 'the approach to deep change, intensity, and strong influence' },
  chiron: { ru: 'тему, где накопленный опыт особенно заметно меняет взгляд на себя и свои действия', en: 'an area where accumulated experience particularly changes self-understanding and action' },
  northNode: { ru: 'направление, которое в астрологической традиции связывают с менее привычным способом действовать', en: 'a direction astrology traditionally associates with a less familiar way of acting' },
  southNode: { ru: 'направление, которое в астрологической традиции связывают с более привычным способом действовать', en: 'a direction astrology traditionally associates with a more familiar way of acting' },
};

export const BACKGROUND_SIGN_BODIES = new Set<NatalBodyKey>([
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'chiron',
  'northNode',
  'southNode',
]);

export function isBackgroundSignBody(key: NatalBodyKey): boolean {
  return BACKGROUND_SIGN_BODIES.has(key);
}

export const BODY_TOPICS: Record<NatalBodyKey, NatalMeaningTopic[]> = {
  sun: ['character', 'work', 'general'],
  moon: ['emotions', 'home', 'relationships'],
  mercury: ['communication', 'learning', 'work'],
  venus: ['relationships', 'money'],
  mars: ['character', 'work'],
  jupiter: ['learning', 'work', 'general'],
  saturn: ['work', 'money', 'general'],
  uranus: ['character', 'general'],
  neptune: ['emotions', 'general'],
  pluto: ['character', 'general'],
  chiron: ['general'],
  northNode: ['general'],
  southNode: ['general'],
};

export const SIGN_STYLE_RU: Record<string, string> = {
  Aries: 'быстрее идёшь в прямое действие, чем долго готовишься, и яснее реагируешь на понятную цель',
  Taurus: 'предпочитаешь устойчивый темп, проверяемую опору и не меняешь выбранное без причины',
  Gemini: 'быстрее понимаешь через сравнение, вопросы, разговор и несколько вариантов одновременно',
  Cancer: 'сильнее учитываешь чувство надёжности, знакомую обстановку и реакцию близкого круга',
  Leo: 'проявляешься заметнее, когда можно действовать от себя, показать результат и получить ясный отклик',
  Virgo: 'разбираешь по частям, замечаешь детали и охотнее доверяешь тому, что можно проверить на практике',
  Libra: 'сравниваешь позиции, учитываешь вторую сторону и ищешь решение, которое можно нормально согласовать',
  Scorpio: 'предпочитаешь разбираться глубже, не спешишь считать вопрос закрытым и серьёзно относишься к тому, что действительно важно',
  Sagittarius: 'смотришь шире текущей задачи, легче пробуешь новое и быстрее включаешься, когда видишь перспективу',
  Capricorn: 'ориентируешься на результат, порядок и то, что выдержит время, а не только хорошо звучит сейчас',
  Aquarius: 'оставляешь себе свободу решения, легче принимаешь необычный вариант и не любишь делать что-то только потому, что так принято',
  Pisces: 'сильнее считываешь настроение и контекст, легче работаешь через образ и интуитивное ощущение целого',
};

export const SIGN_STYLE_EN: Record<string, string> = {
  Aries: 'you move into direct action faster than into long preparation and respond best to a clear target',
  Taurus: 'you prefer a steady pace and tangible support and do not change course without a reason',
  Gemini: 'you understand faster through comparison, questions, conversation, and several options at once',
  Cancer: 'you give more weight to security, familiar surroundings, and the response of close people',
  Leo: 'you show yourself more clearly when you can act from your own position, show a result, and receive clear feedback',
  Virgo: 'you break things into parts, notice details, and trust what can be checked in practice',
  Libra: 'you compare positions, account for the other side, and look for a solution that can be agreed clearly',
  Scorpio: 'you dislike a superficial approach, test longer, engage more deeply, and take trust seriously',
  Sagittarius: 'you look beyond the immediate task, try new things more easily, and engage faster when you see perspective',
  Capricorn: 'you orient toward results, order, and what will hold up over time rather than what only sounds good now',
  Aquarius: 'you keep room for independent choice, accept unusual options more easily, and dislike doing something only because it is customary',
  Pisces: 'you read mood and context strongly and work more easily through imagery and an intuitive sense of the whole',
};

export const HOUSE_AREAS_RU: Record<number, string> = {
  1: 'самоподача, первые реакции и самостоятельные начинания',
  2: 'личные деньги, вещи, устойчивость и то, что человек считает ценным',
  3: 'повседневное общение, обучение, короткие поездки и обмен информацией',
  4: 'дом, личное пространство, семья и привычный уклад',
  5: 'увлечения, творчество, удовольствие, романтический интерес и самовыражение',
  6: 'повседневные обязанности, рабочие привычки, порядок и нагрузка',
  7: 'партнёрство, близкие отношения и договорённости один на один',
  8: 'общие деньги, обязательства, доверие и ситуации высокой вовлечённости',
  9: 'дальнее обучение, мировоззрение, путешествия и расширение опыта',
  10: 'работа, ответственность, репутация и заметный результат',
  11: 'друзья, команды, сообщества и общие планы',
  12: 'уединение, восстановление, закрытая часть жизни и то, что не хочется выставлять наружу',
};

export const HOUSE_TOPICS: Record<number, NatalMeaningTopic[]> = {
  1: ['character'],
  2: ['money'],
  3: ['communication', 'learning'],
  4: ['home', 'emotions'],
  5: ['relationships', 'general'],
  6: ['work', 'rest'],
  7: ['relationships'],
  8: ['relationships', 'money'],
  9: ['learning'],
  10: ['work'],
  11: ['relationships', 'general'],
  12: ['rest', 'emotions'],
};

export const ANGLE_LABELS: Record<NatalAngleKey, string> = {
  ascendant: 'Асцендент',
  mc: 'MC',
  descendant: 'Десцендент',
  ic: 'IC',
};

export const ANGLE_ROLES_RU: Record<NatalAngleKey, string> = {
  ascendant: 'в том, как человек входит в новую обстановку и проявляет себя в первом контакте',
  mc: 'в том, как человек подходит к заметным целям, работе и внешнему результату',
  descendant: 'в том, как человек подходит к сотрудничеству и отношениям один на один',
  ic: 'в том, как человек устраивает личное пространство и привычный домашний уклад',
};

export const ANGLE_TOPICS: Record<NatalAngleKey, NatalMeaningTopic[]> = {
  ascendant: ['character', 'communication'],
  mc: ['work'],
  descendant: ['relationships'],
  ic: ['home', 'emotions'],
};

export const ASPECT_LABELS_RU: Record<NatalAspectType, string> = {
  conjunction: 'соединение',
  sextile: 'секстиль',
  square: 'квадрат',
  trine: 'тригон',
  opposition: 'оппозиция',
};

export const ASPECT_DYNAMICS_RU: Record<NatalAspectType, string> = {
  conjunction: 'две функции обычно включаются вместе и заметно влияют друг на друга',
  sextile: 'две функции могут довольно легко сотрудничать, когда обе действительно задействованы',
  square: 'две функции могут одновременно требовать разных действий, поэтому их приходится сознательно координировать',
  trine: 'две функции обычно сочетаются без большого внутреннего трения и легко поддерживают друг друга',
  opposition: 'две функции чаще ощущаются как два полюса, между которыми приходится распределять внимание',
};

export const TOPIC_TITLES_RU: Record<NatalMeaningTopic, string> = {
  general: 'В целом',
  character: 'Характер',
  emotions: 'Эмоции',
  communication: 'Общение',
  relationships: 'Отношения',
  work: 'Работа',
  money: 'Деньги',
  home: 'Дом',
  learning: 'Учёба',
  rest: 'Отдых',
};

export function signStyle(sign: string, language: 'ru' | 'en'): string | null {
  return (language === 'en' ? SIGN_STYLE_EN : SIGN_STYLE_RU)[sign] || null;
}

export function bodyLabel(key: NatalBodyKey, language: 'ru' | 'en'): string {
  return BODY_LABELS[key][language];
}

export function bodyRole(key: NatalBodyKey, language: 'ru' | 'en'): string {
  return BODY_ROLES[key][language];
}
