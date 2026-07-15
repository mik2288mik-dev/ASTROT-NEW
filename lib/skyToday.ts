export const SKY_MOON_PHASE_KEYS = [
  'new-moon',
  'waxing-crescent',
  'first-quarter',
  'waxing-gibbous',
  'full-moon',
  'waning-gibbous',
  'last-quarter',
  'waning-crescent',
] as const;

export type SkyMoonPhaseKey = (typeof SKY_MOON_PHASE_KEYS)[number];

export type SkyTodaySnapshot = {
  date: string;
  moon: {
    sign: string;
    degree: number;
    phaseKey: SkyMoonPhaseKey;
    phaseLabel: string;
    illumination: number;
  };
  mercury: {
    sign: string;
    degree: number;
    retrograde: boolean;
    motionLabel: string;
    speedLongitude: number;
  };
  source: 'swisseph';
};

export type MoonPhaseCalculation = {
  elongation: number;
  phaseKey: SkyMoonPhaseKey;
  phaseLabel: string;
  illumination: number;
};

const PHASE_LABELS_RU: Record<SkyMoonPhaseKey, string> = {
  'new-moon': 'Новолуние',
  'waxing-crescent': 'Растущий серп',
  'first-quarter': 'Первая четверть',
  'waxing-gibbous': 'Растущая Луна',
  'full-moon': 'Полнолуние',
  'waning-gibbous': 'Убывающая Луна',
  'last-quarter': 'Последняя четверть',
  'waning-crescent': 'Убывающий серп',
};

const PHASE_LABELS_EN: Record<SkyMoonPhaseKey, string> = {
  'new-moon': 'New Moon',
  'waxing-crescent': 'Waxing crescent',
  'first-quarter': 'First quarter',
  'waxing-gibbous': 'Waxing Moon',
  'full-moon': 'Full Moon',
  'waning-gibbous': 'Waning Moon',
  'last-quarter': 'Last quarter',
  'waning-crescent': 'Waning crescent',
};

export function normalizeSkyLongitude(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function calculateMoonPhaseFromLongitudes(
  sunLongitude: number,
  moonLongitude: number,
): MoonPhaseCalculation {
  const elongation = normalizeSkyLongitude(moonLongitude - sunLongitude);
  const phaseIndex = Math.floor((elongation + 22.5) / 45) % SKY_MOON_PHASE_KEYS.length;
  const phaseKey = SKY_MOON_PHASE_KEYS[phaseIndex];
  const illumination = ((1 - Math.cos((elongation * Math.PI) / 180)) / 2) * 100;

  return {
    elongation: Number(elongation.toFixed(6)),
    phaseKey,
    phaseLabel: PHASE_LABELS_RU[phaseKey],
    illumination: Math.round(illumination),
  };
}

const ZODIAC_RU: Record<string, string> = {
  Aries: 'Овне',
  Taurus: 'Тельце',
  Gemini: 'Близнецах',
  Cancer: 'Раке',
  Leo: 'Льве',
  Virgo: 'Деве',
  Libra: 'Весах',
  Scorpio: 'Скорпионе',
  Sagittarius: 'Стрельце',
  Capricorn: 'Козероге',
  Aquarius: 'Водолее',
  Pisces: 'Рыбах',
};

const PHASE_MEANING_RU: Record<SkyMoonPhaseKey, string> = {
  'new-moon': 'Луна находится рядом с Солнцем, поэтому её освещённая сторона почти не видна с Земли.',
  'waxing-crescent': 'После новолуния освещённая часть диска постепенно увеличивается.',
  'first-quarter': 'Луна прошла около четверти орбиты от новолуния, и с Земли видна половина диска.',
  'waxing-gibbous': 'Освещённая часть уже больше половины и продолжает расти к полнолунию.',
  'full-moon': 'Луна находится напротив Солнца, поэтому её видимая сторона освещена почти полностью.',
  'waning-gibbous': 'После полнолуния освещённая часть диска постепенно уменьшается.',
  'last-quarter': 'Луна прошла около трёх четвертей орбиты от новолуния, и снова видна половина диска.',
  'waning-crescent': 'Перед новолунием остаётся тонкая освещённая часть лунного диска.',
};

const PHASE_MEANING_EN: Record<SkyMoonPhaseKey, string> = {
  'new-moon': 'The Moon is close to the Sun, so its illuminated side is almost invisible from Earth.',
  'waxing-crescent': 'After the New Moon, the illuminated part of the lunar disc gradually increases.',
  'first-quarter': 'The Moon is about a quarter of an orbit past the New Moon, with half of the disc visible.',
  'waxing-gibbous': 'More than half of the disc is illuminated and the visible portion is still growing.',
  'full-moon': 'The Moon is opposite the Sun, so its visible side is almost fully illuminated.',
  'waning-gibbous': 'After the Full Moon, the illuminated portion of the disc gradually decreases.',
  'last-quarter': 'The Moon is about three quarters of an orbit past the New Moon, with half of the disc visible again.',
  'waning-crescent': 'A thin illuminated portion remains before the next New Moon.',
};

const MOON_PHASE_VARIANTS_RU: Record<SkyMoonPhaseKey, readonly string[]> = {
  'new-moon': [
    'Эмоциональный фон тише обычного, а новые впечатления ещё не успели набрать вес.',
    'Реакции чаще остаются внутри, поэтому внешняя суета ощущается чуть дальше.',
    'Настроение легче складывается с чистого листа, без длинного шлейфа прошлых дней.',
    'Общий ритм сдержанный: чувства проявляются мягче и не требуют немедленного ответа.',
    'В воздухе меньше эмоционального шума, зато тонкие перемены заметнее.',
  ],
  'waxing-crescent': [
    'Эмоциональный тон постепенно набирает яркость, интерес просыпается раньше уверенности.',
    'Новые впечатления цепляют быстрее, хотя общая картина ещё только собирается.',
    'Фон становится живее: любопытство уже включилось, а напряжение пока невысокое.',
    'Чувства проявляются яснее день за днём, оставляя место для проб и наблюдений.',
    'Настроение легче откликается на свежие идеи и небольшие перемены вокруг.',
  ],
  'first-quarter': [
    'Эмоции заметнее сталкиваются с реальностью, поэтому внутренние противоречия слышны громче.',
    'Фон собранный и деятельный: реакции становятся чётче, а сомнения — конкретнее.',
    'Напряжение между привычным и новым ощущается яснее, без обязательной драмы.',
    'Настроение быстрее показывает, где ожидания не совпали с происходящим.',
    'Внутренний импульс усиливается, и эмоциональные решения выглядят определённее.',
  ],
  'waxing-gibbous': [
    'Чувства набирают объём, а детали происходящего получают больше эмоционального веса.',
    'Общий фон становится насыщеннее: ожидания растут вместе с вниманием к результату.',
    'Реакции выразительнее, потому что накопившиеся впечатления уже складываются в картину.',
    'Эмоциональная вовлечённость выше, и незавершённость замечается особенно быстро.',
    'Настроение тянется к ясности: хочется понимать, к чему ведёт начатое.',
  ],
  'full-moon': [
    'Эмоциональный фон яркий: чувства и чужие реакции заметны без дополнительной подсветки.',
    'Настроения проявляются открыто, поэтому контрасты между людьми считываются быстрее.',
    'Накопившиеся впечатления выходят на передний план и требуют больше внимания.',
    'Общий тон насыщенный: даже привычные темы получают сильный эмоциональный отклик.',
    'Реакции становятся выразительнее, а скрытые разногласия — заметнее.',
  ],
  'waning-gibbous': [
    'Эмоциональный накал постепенно снижается, оставляя больше места для осмысления.',
    'Фон становится ровнее: впечатления уже прожиты и теперь складываются в выводы.',
    'Реакции теряют остроту, зато последствия недавних разговоров видны яснее.',
    'Настроение чаще возвращается к уже случившемуся, чтобы расставить внутренние акценты.',
    'Эмоции всё ещё насыщенные, но в них больше понимания и меньше первого импульса.',
  ],
  'last-quarter': [
    'Фон становится требовательнее к несостыковкам: старые решения снова проходят проверку.',
    'Эмоциональные реакции быстрее отделяют рабочее от того, что уже потеряло смысл.',
    'Внутренние противоречия видны чётче, зато и выводы формулируются честнее.',
    'Настроение меньше держится за первый импульс и внимательнее смотрит на результат.',
    'Общий тон трезвый: незакрытые вопросы заметны, но уже не звучат так громко.',
  ],
  'waning-crescent': [
    'Фон становится тише: реакции быстрее остывают, а мелкие несостыковки видны яснее.',
    'Эмоциональный ритм смягчается, и недавние впечатления постепенно теряют остроту.',
    'Настроение спокойнее отвечает на внешний шум, оставляя больше воздуха между реакциями.',
    'Чувства звучат негромко, зато оттенки усталости и облегчения различаются точнее.',
    'Общий тон сдержанный: эмоциональные хвосты дня уже не требуют главной роли.',
  ],
};

const MOON_SIGN_VARIANTS_RU: Record<string, readonly string[]> = {
  Aries: ['В Овне чувства вспыхивают быстро и так же быстро меняют направление.', 'Овен добавляет реакциям прямоту и короткий путь от импульса к выражению.', 'Здесь эмоции говорят первым тоном, без длинных вступлений.', 'Огненный акцент делает настроение смелее и резче на поворотах.', 'Реакции чаще выглядят решительными, даже когда внутри ещё нет полной ясности.'],
  Taurus: ['В Тельце фон держится за понятность, комфорт и предсказуемый ритм.', 'Телец делает чувства устойчивее и внимательнее к телесному комфорту.', 'Эмоции здесь набирают силу медленно, зато дольше сохраняют выбранный тон.', 'Особенно заметно, насколько обстановка удобна, надёжна и спокойна.', 'Настроение лучше считывает простые удовольствия и хуже переносит резкие перемены.'],
  Gemini: ['В Близнецах настроение быстрее меняется вслед за новостями и разговорами.', 'Близнецы переводят чувства в слова, вопросы и обмен впечатлениями.', 'Эмоциональный фон становится подвижнее и любопытнее к разным версиям происходящего.', 'Реакциям проще переключаться, когда появляется новая информация.', 'Настроение живо откликается на интонации, сообщения и случайные наблюдения.'],
  Cancer: ['В Раке сильнее считываются близость, безопасность и знакомые эмоциональные сигналы.', 'Рак делает фон мягче, глубже и внимательнее к атмосфере между людьми.', 'Настроение острее замечает заботу, дистанцию и перемены в домашнем ритме.', 'Чувства здесь лучше помнят контекст и тон, чем сухие формулировки.', 'Эмоциональная чувствительность выше там, где речь идёт о своих и привычном.'],
  Leo: ['Во Льве эмоциям важны тепло, признание и возможность проявиться открыто.', 'Лев добавляет настроению выразительность и желание получить живой отклик.', 'Реакции становятся заметнее, когда затронуты достоинство или творческий азарт.', 'Эмоциональный фон ярче отвечает на внимание, щедрость и холодность.', 'Чувства чаще проявляются крупным жестом, даже если повод совсем небольшой.'],
  Virgo: ['В Деве эмоции быстрее замечают детали, порядок и практическую сторону ситуации.', 'Дева переводит настроение в наблюдения: что работает, а что требует поправки.', 'Фон становится точнее и чувствительнее к мелким несостыковкам.', 'Реакции чаще выражаются через конкретную заботу, а не громкие слова.', 'Эмоциональная ясность приходит через детали, ритм и понятные действия.'],
  Libra: ['В Весах сильнее ощущаются тон общения, взаимность и баланс интересов.', 'Весы делают настроение внимательнее к реакции другого человека.', 'Эмоциональный фон ищет красивую и честную форму для разногласий.', 'Реакции становятся мягче снаружи, но острее считывают несправедливость.', 'Особенно заметно, где диалог равный, а где баланс держится только на вежливости.'],
  Scorpio: ['В Скорпионе чувства звучат глубже и неохотно остаются поверхностными.', 'Скорпион усиливает внимание к подтексту, доверию и скрытому напряжению.', 'Эмоциональный фон плотнее: нюансы близости и дистанции считываются быстро.', 'Реакции становятся собраннее там, где затронуты уязвимость и контроль.', 'Настроение меньше верит внешней простоте и внимательнее слушает второй слой.'],
  Sagittarius: ['В Стрельце настроение тянется к простору, смыслу и более широкой картине.', 'Стрелец добавляет реакциям открытость и желание смотреть дальше текущей сцены.', 'Эмоциональный фон легче оживает от новых тем, маршрутов и перспектив.', 'Чувства быстрее возвращают масштаб, когда мелочи начинают занимать весь кадр.', 'Реакции становятся прямее и оптимистичнее рядом с ощущением свободы.'],
  Capricorn: ['В Козероге эмоции проявляются сдержаннее и охотнее опираются на факты.', 'Козерог делает фон собранным, внимательным к границам и ответственности.', 'Настроение серьёзнее оценивает надёжность слов и устойчивость договорённостей.', 'Чувства здесь не исчезают, просто предпочитают доказательства громким заявлениям.', 'Эмоциональная реакция становится точнее там, где понятны роли и последствия.'],
  Aquarius: ['В Водолее настроение легче держит дистанцию и замечает необычные связи.', 'Водолей добавляет чувствам независимость и интерес к непривычным точкам зрения.', 'Эмоциональный фон становится прохладнее снаружи, но живее в идеях.', 'Реакции чаще включаются на свободу, равенство и право быть не как все.', 'Настроение лучше переносит перемены, когда в них есть логика и свежий смысл.'],
  Pisces: ['В Рыбах фон становится тоньше и сильнее откликается на атмосферу.', 'Рыбы усиливают эмпатию, воображение и чувствительность к невысказанному.', 'Эмоции легче смешиваются с музыкой, образами и настроением окружающих.', 'Реакции становятся мягче, а границы между своим и чужим чувством — тоньше.', 'Настроение быстрее улавливает полутона, которые не помещаются в прямые слова.'],
};

const MERCURY_SIGN_VARIANTS_RU: Record<string, readonly string[]> = {
  Aries: ['В общении больше прямоты, быстрых формулировок и готовности сразу обозначить позицию.', 'Мысли идут коротким маршрутом, а разговор быстрее переходит к сути.', 'Идеи звучат смело, но тон иногда опережает аргументы.', 'Диалоги становятся динамичнее: ответ нередко появляется раньше полной картины.', 'В речи заметнее решительность и соревновательный оттенок.'],
  Taurus: ['Мысли движутся основательно, а словам важны практичность и надёжная опора.', 'В общении ценятся ясные условия, спокойный темп и конкретный результат.', 'Идеи проверяются на пользу, поэтому быстрые перемены принимаются не сразу.', 'Формулировки звучат весомее, когда подкреплены фактами и понятными примерами.', 'Разговор легче держится вокруг реального опыта, денег, качества и устойчивости.'],
  Gemini: ['Общение становится подвижнее: вопросов, сообщений и быстрых связей между темами больше.', 'Мысли легко переключаются, а любопытство собирает сразу несколько версий.', 'Слова приходят быстро, и разговор охотно меняет направление вслед за новой деталью.', 'Информационный фон живой: заметнее игра формулировок, фактов и контекстов.', 'Диалоги ускоряются, потому что каждая реплика открывает ещё одну тему.'],
  Cancer: ['В разговорах сильнее слышны интонация, память и эмоциональный контекст.', 'Мысли чаще возвращаются к знакомому опыту и тому, как слова повлияют на близких.', 'Общение становится мягче, но особенно чувствительным к холодной подаче.', 'Формулировки убедительнее, когда в них есть забота и ощущение безопасности.', 'Слова легче цепляют прошлые истории, семейные темы и личные ассоциации.'],
  Leo: ['В общении заметнее уверенная подача и желание быть услышанным.', 'Мысли ищут яркую форму, а речь охотно занимает центр внимания.', 'Формулировки становятся выразительнее; спор чаще начинается из-за тона, чем из-за темы.', 'Идеи подаются крупно, с акцентом на личную позицию и творческий жест.', 'Диалог оживает от признания, юмора и возможности рассказать историю эффектно.'],
  Virgo: ['Мысли становятся точнее, а разговоры быстрее находят ошибки и рабочие детали.', 'В общении ценятся конкретика, порядок и формулировки без лишнего тумана.', 'Информация раскладывается по полкам, поэтому несостыковки видны особенно хорошо.', 'Речь становится практичнее: важны сроки, факты и понятная последовательность.', 'Диалог легче движется, когда задачу можно уточнить, измерить или исправить.'],
  Libra: ['В общении больше внимания к форме, взаимности и точному балансу аргументов.', 'Мысли охотно рассматривают обе стороны, а словам нужна корректная подача.', 'Диалог становится дипломатичнее, хотя выбор окончательной позиции занимает больше времени.', 'Формулировки ищут справедливость и способ сохранить контакт при разногласиях.', 'Разговор легче складывается через сравнение, уточнение интересов и красивую логику.'],
  Scorpio: ['Мысли идут глубже поверхности, а в разговоре особенно заметен подтекст.', 'Общение становится собраннее: случайным словам доверяют меньше, точным — больше.', 'Формулировки ищут суть, мотив и то, что осталось за кадром.', 'Диалог может быть немногословным, но вопросы попадают прямо в чувствительные места.', 'Информационный фон плотный: тайны, риски и степень доверия оцениваются внимательнее.'],
  Sagittarius: ['Мысли смотрят шире, а разговоры легко выходят к смыслам, планам и убеждениям.', 'В общении больше прямоты, юмора и желания связать детали в большую картину.', 'Идеи звучат свободнее, хотя нюансы иногда уступают место главной мысли.', 'Диалог оживает вокруг обучения, путешествий, взглядов и будущих возможностей.', 'Формулировки становятся смелее, когда можно говорить о перспективах без тесных рамок.'],
  Capricorn: ['Мысли выстраиваются по делу, а словам важны структура и последствия.', 'В общении сильнее ценятся компетентность, сроки и проверяемые обещания.', 'Формулировки становятся сдержаннее, зато яснее показывают ответственность.', 'Диалог легче строится вокруг правил, задач и реалистичного плана.', 'Информационный фон серьёзнее: статус и надёжность источника имеют больший вес.'],
  Aquarius: ['Мысли ищут нестандартные связи, а разговоры тянутся к новым системам и идеям.', 'В общении больше независимости и готовности обсуждать непривычные версии.', 'Формулировки могут звучать прохладно, зато хорошо держат логику и общий принцип.', 'Диалог оживает рядом с технологиями, сообществами и будущими изменениями.', 'Идеи свободнее пересобирают привычные правила и проверяют их на актуальность.'],
  Pisces: ['Мысли идут через образы и ассоциации, а в словах важен не только буквальный смысл.', 'Общение становится мягче и чувствительнее к паузам, намёкам и атмосфере.', 'Формулировки легче передают впечатление, чем строгую последовательность фактов.', 'Диалог охотно движется через метафоры, музыку, интуицию и эмоциональные оттенки.', 'Информационный фон размывает жёсткие границы, зато помогает услышать невысказанное.'],
};

const MERCURY_MOTION_VARIANTS_RU = {
  direct: [
    'Прямое движение поддерживает более последовательный обмен информацией.',
    'При прямом движении новые темы чаще развиваются без возврата к старым формулировкам.',
    'Прямой статус делает общий ритм переговоров более линейным.',
    'Информационный поток чаще движется вперёд, сохраняя понятную последовательность.',
    'Прямое движение подчёркивает развитие уже обозначенных идей и договорённостей.',
  ],
  retrograde: [
    'Ретроградный статус чаще возвращает в разговор прежние темы и недостающие детали.',
    'В информационном фоне больше пересмотров, повторных обсуждений и смены формулировок.',
    'Ретроградное движение делает заметнее старые вопросы, которые считались закрытыми.',
    'Разговоры чаще идут через уточнение контекста и восстановление потерянных связей.',
    'Общий ритм коммуникации становится менее линейным и чаще обращается к прошлым версиям.',
  ],
} as const;

const SIMPLE_PHASE_TONE_EN: Record<SkyMoonPhaseKey, string> = {
  'new-moon': 'The emotional background is quieter, with fresh impressions still taking shape.',
  'waxing-crescent': 'Curiosity is growing before the overall mood has fully settled.',
  'first-quarter': 'Reactions feel more decisive as expectations meet practical reality.',
  'waxing-gibbous': 'Feelings gain volume and unfinished details attract more attention.',
  'full-moon': 'Emotions and contrasts are easier to notice in the shared atmosphere.',
  'waning-gibbous': 'The emotional charge is easing into reflection and clearer conclusions.',
  'last-quarter': 'Old decisions and loose ends stand out more clearly in the general mood.',
  'waning-crescent': 'The background is becoming quieter and recent reactions lose intensity.',
};

const SIMPLE_SIGN_TONE_EN: Record<string, string> = {
  Aries: 'Aries adds speed and directness.', Taurus: 'Taurus favors steadiness and tangible comfort.',
  Gemini: 'Gemini makes reactions more verbal and changeable.', Cancer: 'Cancer heightens sensitivity to closeness and safety.',
  Leo: 'Leo adds warmth, pride, and visible expression.', Virgo: 'Virgo draws attention to details and practical care.',
  Libra: 'Libra highlights reciprocity and the tone of a dialogue.', Scorpio: 'Scorpio brings subtext and questions of trust forward.',
  Sagittarius: 'Sagittarius opens the frame toward meaning and possibility.', Capricorn: 'Capricorn favors restraint, structure, and reliable signals.',
  Aquarius: 'Aquarius adds distance and interest in unconventional links.', Pisces: 'Pisces heightens empathy, imagery, and atmosphere.',
};

function stableVariantIndex(dateKey: string, salt: string): number {
  const dateSeed = Number(dateKey.replace(/\D/g, '')) || 0;
  const saltSeed = Array.from(salt).reduce((total, char) => total + char.charCodeAt(0), 0);
  return Math.abs(dateSeed + saltSeed) % 5;
}

function inSignRu(sign: string): string {
  const signName = ZODIAC_RU[sign] || sign;
  return `${sign === 'Leo' ? 'во' : 'в'} ${signName}`;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export type SkyTodayNarrative = {
  moonLabel: string;
  moonPosition: string;
  moonDescription: string;
  phaseMeaning: string;
  mercuryPosition: string;
  mercuryDescription: string;
  mercuryMotionMeaning: string;
};

export function getSkyTodayNarrative(
  snapshot: SkyTodaySnapshot,
  language: 'ru' | 'en',
): SkyTodayNarrative {
  const moonIndex = stableVariantIndex(snapshot.date, `${snapshot.moon.phaseKey}:${snapshot.moon.sign}`);
  const mercuryIndex = stableVariantIndex(snapshot.date, `${snapshot.mercury.sign}:${snapshot.mercury.retrograde}`);

  if (language === 'en') {
    const phaseLabel = PHASE_LABELS_EN[snapshot.moon.phaseKey];
    const motionLabel = snapshot.mercury.retrograde ? 'retrograde' : 'direct';
    const connectors = ['In this phase,', 'Across the shared mood,', 'At the moment,', 'In the current sky,', 'As a general tone,'];
    const mercuryMotion = snapshot.mercury.retrograde
      ? 'Retrograde motion often brings previous topics and missing context back into conversations.'
      : 'Direct motion supports a more sequential flow of information and developing ideas.';
    return {
      moonLabel: phaseLabel,
      moonPosition: `${phaseLabel} · ${snapshot.moon.illumination}% · in ${snapshot.moon.sign}`,
      moonDescription: `${connectors[moonIndex]} ${SIMPLE_PHASE_TONE_EN[snapshot.moon.phaseKey]} ${SIMPLE_SIGN_TONE_EN[snapshot.moon.sign] || ''}`,
      phaseMeaning: PHASE_MEANING_EN[snapshot.moon.phaseKey],
      mercuryPosition: `In ${snapshot.mercury.sign} · ${motionLabel}`,
      mercuryDescription: `${SIMPLE_SIGN_TONE_EN[snapshot.mercury.sign] || 'Communication reflects the current sign.'} ${mercuryMotion}`,
      mercuryMotionMeaning: mercuryMotion,
    };
  }

  const moonPhaseVariants = MOON_PHASE_VARIANTS_RU[snapshot.moon.phaseKey];
  const moonSignVariants = MOON_SIGN_VARIANTS_RU[snapshot.moon.sign] || MOON_SIGN_VARIANTS_RU.Gemini;
  const mercurySignVariants = MERCURY_SIGN_VARIANTS_RU[snapshot.mercury.sign] || MERCURY_SIGN_VARIANTS_RU.Gemini;
  const motionKey = snapshot.mercury.retrograde ? 'retrograde' : 'direct';
  const motionVariants = MERCURY_MOTION_VARIANTS_RU[motionKey];
  const phaseLabel = PHASE_LABELS_RU[snapshot.moon.phaseKey];
  const motionLabel = snapshot.mercury.retrograde ? 'ретроградный' : 'прямой';

  return {
    moonLabel: phaseLabel,
    moonPosition: `${phaseLabel} · ${snapshot.moon.illumination}% · ${inSignRu(snapshot.moon.sign)}`,
    moonDescription: `${moonPhaseVariants[moonIndex]} ${moonSignVariants[moonIndex]}`,
    phaseMeaning: PHASE_MEANING_RU[snapshot.moon.phaseKey],
    mercuryPosition: `${capitalize(inSignRu(snapshot.mercury.sign))} · ${motionLabel}`,
    mercuryDescription: `${mercurySignVariants[mercuryIndex]} ${motionVariants[mercuryIndex]}`,
    mercuryMotionMeaning: snapshot.mercury.retrograde
      ? 'Ретроградность — видимое с Земли обратное движение планеты. Это не поломка и не обещание событий, а часть обычного цикла.'
      : 'Прямое движение — обычное видимое движение планеты вперёд по зодиаку относительно наблюдателя с Земли.',
  };
}

export function formatSkyDegree(value: number, language: 'ru' | 'en'): string {
  return `${value.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}°`;
}
