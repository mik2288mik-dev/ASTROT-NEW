/**
 * Матрица судьбы — библиотека 22 старших арканов (контент в нашей базе, без ИИ).
 * Тексты приземлённые и психологичные: архетип + сильная сторона + зона роста.
 */

export const MATRIX_TITLE = { ru: 'Матрица судьбы', en: 'Destiny Matrix' };
export const MATRIX_SUBTITLE = {
  ru: 'Расчёт по дате рождения — без времени и места',
  en: 'From your birth date — no time or place needed',
};
export const MATRIX_HOME_LABEL = { ru: 'Матрица судьбы — она только твоя', en: 'Destiny Matrix — yours alone' };
export const MATRIX_HOME_SUB = { ru: 'Бесплатно, по твоей дате рождения', en: 'Free, from your birth date' };

export type Arcana = {
  n: number;
  name: string;
  nameEn: string;
  keyword: string;
  keywordEn: string;
  essence: string;
  essenceEn: string;
};

export const ARCANA: Record<number, Arcana> = {
  1: { n: 1, name: 'Маг', nameEn: 'Magician', keyword: 'воля и действие', keywordEn: 'will & action',
    essence: 'Ты создаёшь свою реальность через действие и слово. Сила — в инициативе и умении начинать первым; зона роста — не распыляться и доводить начатое до результата.',
    essenceEn: 'You shape your reality through action and words. Strength: initiative; growth: focus and finishing what you start.' },
  2: { n: 2, name: 'Жрица', nameEn: 'High Priestess', keyword: 'интуиция и знание', keywordEn: 'intuition',
    essence: 'Ты чувствуешь больше, чем говоришь. Сила — в наблюдательности и тихом внутреннем знании; важно доверять себе и не прятаться за молчанием.',
    essenceEn: 'You sense more than you say. Strength: intuition; growth: trust yourself and speak up.' },
  3: { n: 3, name: 'Императрица', nameEn: 'Empress', keyword: 'забота и творчество', keywordEn: 'care & creation',
    essence: 'Ты создаёшь уют и наполняешь людей вокруг. Сила — в творчестве, тепле и умении заботиться; зона роста — не растворяться в других и оставлять ресурс себе.',
    essenceEn: 'You create warmth and nourish people. Strength: creativity and care; growth: keep some energy for yourself.' },
  4: { n: 4, name: 'Император', nameEn: 'Emperor', keyword: 'опора и порядок', keywordEn: 'structure',
    essence: 'Тебе нужны порядок, правила и контроль над своей территорией. Сила — в надёжности и лидерстве; зона роста — меньше жёсткости, больше гибкости.',
    essenceEn: 'You need order and control of your space. Strength: reliability and leadership; growth: less rigidity.' },
  5: { n: 5, name: 'Иерофант', nameEn: 'Hierophant', keyword: 'смысл и наставничество', keywordEn: 'meaning',
    essence: 'Ты ищешь смысл и любишь учиться и учить. Сила — в принципах и опыте, которым делишься; важно не застрять в догмах и старых правилах.',
    essenceEn: 'You seek meaning and love to learn and teach. Strength: principles; growth: don’t get stuck in dogma.' },
  6: { n: 6, name: 'Влюблённые', nameEn: 'Lovers', keyword: 'выбор и отношения', keywordEn: 'choice & love',
    essence: 'Твоя тема — отношения и выбор по любви, а не по выгоде. Сила — в искренности; урок — учиться выбирать и брать ответственность за свой выбор.',
    essenceEn: 'Your theme is relationships and choosing by love, not convenience. Growth: choose and own your choice.' },
  7: { n: 7, name: 'Колесница', nameEn: 'Chariot', keyword: 'движение к цели', keywordEn: 'drive',
    essence: 'Ты идёшь к цели через волю и баланс противоположностей. Сила — в драйве и умении держать курс; зона роста — не гнать без остановок и пауз.',
    essenceEn: 'You move toward goals through willpower. Strength: drive; growth: don’t push without rest.' },
  8: { n: 8, name: 'Справедливость', nameEn: 'Justice', keyword: 'честность и баланс', keywordEn: 'fairness',
    essence: 'Тебе важны правда, равновесие и честные правила. Сила — в объективности; урок — не судить слишком строго ни себя, ни других.',
    essenceEn: 'You value truth and balance. Strength: objectivity; growth: judge yourself and others less harshly.' },
  9: { n: 9, name: 'Отшельник', nameEn: 'Hermit', keyword: 'глубина и зрелость', keywordEn: 'depth',
    essence: 'Тебе нужно время наедине, чтобы понять себя и других. Сила — в самостоятельности и зрелости; зона роста — не уходить в изоляцию.',
    essenceEn: 'You need solitude to understand yourself. Strength: maturity; growth: don’t isolate.' },
  10: { n: 10, name: 'Колесо Фортуны', nameEn: 'Wheel of Fortune', keyword: 'перемены и шанс', keywordEn: 'change',
    essence: 'Твоя жизнь идёт волнами, и ты умеешь ловить момент. Сила — в гибкости и удаче; урок — принимать перемены, а не цепляться за стабильность.',
    essenceEn: 'Your life moves in waves and you catch the moment. Growth: accept change instead of clinging.' },
  11: { n: 11, name: 'Сила', nameEn: 'Strength', keyword: 'самообладание', keywordEn: 'inner strength',
    essence: 'Твоя мощь — в спокойной уверенности и умении управлять эмоциями. Сила — в выдержке и тепле; зона роста — не подавлять чувства, а проживать их.',
    essenceEn: 'Your power is calm confidence and emotional self-mastery. Growth: feel emotions instead of suppressing them.' },
  12: { n: 12, name: 'Повешенный', nameEn: 'Hanged Man', keyword: 'иной взгляд', keywordEn: 'new angle',
    essence: 'Твой рост — через смену угла зрения и умение отпускать. Сила — в терпении и принятии; урок — не застревать в роли жертвы.',
    essenceEn: 'You grow by shifting perspective and letting go. Growth: don’t stay in the victim role.' },
  13: { n: 13, name: 'Смерть', nameEn: 'Death', keyword: 'обновление', keywordEn: 'renewal',
    essence: 'Ты умеешь завершать и начинать заново. Сила — в способности отпускать отжившее; урок — не бояться перемен, они расчищают место для нового.',
    essenceEn: 'You can end things and begin again. Strength: letting go; growth: don’t fear change.' },
  14: { n: 14, name: 'Умеренность', nameEn: 'Temperance', keyword: 'мера и гармония', keywordEn: 'balance',
    essence: 'Твоя тема — гармония и умение соединять крайности. Сила — в спокойствии и постепенности; зона роста — не избегать острых решений ради мира.',
    essenceEn: 'Your theme is balance and blending extremes. Growth: don’t avoid hard decisions for the sake of peace.' },
  15: { n: 15, name: 'Дьявол', nameEn: 'Devil', keyword: 'желания и ресурсы', keywordEn: 'desire & resources',
    essence: 'Ты сильно чувствуешь желания, деньги и страсть. Сила — в энергии и притягательности; урок — отличать здоровое влечение от зависимостей.',
    essenceEn: 'You feel desire, money and passion strongly. Growth: tell healthy drive from attachments.' },
  16: { n: 16, name: 'Башня', nameEn: 'Tower', keyword: 'прорыв и правда', keywordEn: 'breakthrough',
    essence: 'Твоя жизнь время от времени резко перестраивается, убирая ложное. Сила — в честности и способности начать с нуля; урок — не держаться за то, что уже рухнуло.',
    essenceEn: 'Your life occasionally breaks down to clear what’s false. Growth: don’t hold onto what already fell.' },
  17: { n: 17, name: 'Звезда', nameEn: 'Star', keyword: 'надежда и талант', keywordEn: 'hope & talent',
    essence: 'Ты несёшь свет и веру и вдохновляешь людей. Сила — в искренности и таланте; важно не растерять веру в себя в трудные периоды.',
    essenceEn: 'You carry hope and inspire people. Strength: sincerity and talent; growth: keep faith in yourself in hard times.' },
  18: { n: 18, name: 'Луна', nameEn: 'Moon', keyword: 'чувства и воображение', keywordEn: 'feeling & imagination',
    essence: 'У тебя богатый внутренний мир и сильная интуиция. Сила — в чувствительности и творчестве; урок — отличать реальные сигналы от тревог и страхов.',
    essenceEn: 'You have a rich inner world and strong intuition. Growth: tell real signals from fears.' },
  19: { n: 19, name: 'Солнце', nameEn: 'Sun', keyword: 'радость и ясность', keywordEn: 'joy & clarity',
    essence: 'Ты согреваешь людей и заражаешь оптимизмом. Сила — в открытости, тепле и умении радоваться; зона роста — меньше зависеть от внешнего признания.',
    essenceEn: 'You warm people and spread optimism. Growth: depend less on outside approval.' },
  20: { n: 20, name: 'Суд', nameEn: 'Judgement', keyword: 'призвание', keywordEn: 'calling',
    essence: 'Твоя тема — пробуждение к настоящему делу и честная переоценка пройденного. Сила — услышать своё призвание; урок — простить прошлое и идти дальше.',
    essenceEn: 'Your theme is waking up to your true work and an honest review of your path. Growth: forgive the past.' },
  21: { n: 21, name: 'Мир', nameEn: 'World', keyword: 'целостность и масштаб', keywordEn: 'wholeness',
    essence: 'Ты стремишься к завершённости и большому масштабу. Сила — доводить до результата и видеть картину целиком; урок — не откладывать жизнь до «идеального момента».',
    essenceEn: 'You aim for wholeness and big scale. Growth: don’t postpone life until things are perfect.' },
  22: { n: 22, name: 'Шут', nameEn: 'Fool', keyword: 'свобода и начало', keywordEn: 'freedom & new start',
    essence: 'Ты лёгок на подъём и открыт новому. Сила — в свободе, оптимизме и вере в свой путь; урок — не прыгать без оглядки и доводить начатое до конца.',
    essenceEn: 'You’re open and ready for anything new. Strength: freedom and optimism; growth: look before you leap and finish what you begin.' },
};

export function getArcana(n: number): Arcana {
  return ARCANA[n] || ARCANA[22];
}
