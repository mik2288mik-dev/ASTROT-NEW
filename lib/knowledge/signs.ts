import type { KnowledgeTopicSource } from './types';

type SignDefinition = {
  id: string;
  sign: string;
  aliases: Readonly<Record<'ru' | 'en', readonly string[]>>;
  keywords: Readonly<Record<'ru' | 'en', readonly string[]>>;
  copy: KnowledgeTopicSource['copy'];
};

const SIGN_DEFINITIONS = [
  {
    id: 'sign-aries',
    sign: 'Aries',
    aliases: { ru: ['овен', 'знак овна'], en: ['aries', 'ram'] },
    keywords: { ru: ['огонь', 'кардинальный', 'начало', 'прямота'], en: ['fire', 'cardinal', 'initiative', 'directness'] },
    copy: {
      ru: {
        title: 'Овен',
        summary: 'Кардинальный огненный знак, связанный с началом, прямым действием и самостоятельностью.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Овен описывает способ быстро включаться в задачу, проверять решение действием и не ждать долгих согласований.'] },
          { title: 'Что важно помнить', paragraphs: ['Это не обязательная конфликтность. В спокойной форме тот же знак даёт ясную инициативу и готовность сделать первый шаг.'] },
        ],
        shortAnswer: 'Овен — о начале, прямом действии и готовности сделать первый шаг.',
      },
      en: {
        title: 'Aries',
        summary: 'A cardinal fire sign associated with beginnings, direct action, and independence.',
        sections: [
          { title: 'Main theme', paragraphs: ['Aries describes a way of entering a task quickly, testing a decision through action, and moving without lengthy approval.'] },
          { title: 'Keep in mind', paragraphs: ['It does not automatically mean conflict. In a calm form, the same sign supports clear initiative and a willingness to take the first step.'] },
        ],
        shortAnswer: 'Aries is about beginnings, direct action, and moving first.',
      },
    },
  },
  {
    id: 'sign-taurus',
    sign: 'Taurus',
    aliases: { ru: ['телец', 'знак тельца'], en: ['taurus', 'bull'] },
    keywords: { ru: ['земля', 'фиксированный', 'устойчивость', 'осязаемое'], en: ['earth', 'fixed', 'stability', 'tangible'] },
    copy: {
      ru: {
        title: 'Телец',
        summary: 'Фиксированный земной знак, связанный с устойчивым темпом, сохранением и осязаемым результатом.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Телец описывает способ двигаться без лишней спешки, закреплять достигнутое и выбирать то, что выдерживает проверку временем.'] },
          { title: 'Что важно помнить', paragraphs: ['Устойчивость не равна пассивности. Этот знак может действовать настойчиво, если цель понятна и имеет практический смысл.'] },
        ],
        shortAnswer: 'Телец — об устойчивости, сохранении и надёжном результате.',
      },
      en: {
        title: 'Taurus',
        summary: 'A fixed earth sign associated with steady pace, preservation, and tangible results.',
        sections: [
          { title: 'Main theme', paragraphs: ['Taurus describes a way of moving without unnecessary haste, consolidating what has been achieved, and choosing what can last.'] },
          { title: 'Keep in mind', paragraphs: ['Stability is not passivity. This sign can act with persistence when the goal is clear and practically meaningful.'] },
        ],
        shortAnswer: 'Taurus is about stability, preservation, and dependable results.',
      },
    },
  },
  {
    id: 'sign-gemini',
    sign: 'Gemini',
    aliases: { ru: ['близнецы', 'знак близнецов'], en: ['gemini', 'twins'] },
    keywords: { ru: ['воздух', 'мутабельный', 'информация', 'сравнение'], en: ['air', 'mutable', 'information', 'comparison'] },
    copy: {
      ru: {
        title: 'Близнецы',
        summary: 'Мутабельный воздушный знак, связанный с вопросами, обменом сведениями и сменой точки зрения.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Близнецы описывают способ замечать несколько вариантов, быстро связывать факты и уточнять мысль в разговоре.'] },
          { title: 'Что важно помнить', paragraphs: ['Смена мнения не всегда означает непостоянство. Иногда это честная реакция на новые данные или более точную формулировку.'] },
        ],
        shortAnswer: 'Близнецы — об информации, сравнении и подвижном мышлении.',
      },
      en: {
        title: 'Gemini',
        summary: 'A mutable air sign associated with questions, information exchange, and changing perspective.',
        sections: [
          { title: 'Main theme', paragraphs: ['Gemini describes a way of noticing several options, connecting facts quickly, and refining a thought through conversation.'] },
          { title: 'Keep in mind', paragraphs: ['Changing an opinion does not always mean inconsistency. It can be an honest response to new information or a more accurate wording.'] },
        ],
        shortAnswer: 'Gemini is about information, comparison, and flexible thought.',
      },
    },
  },
  {
    id: 'sign-cancer',
    sign: 'Cancer',
    aliases: { ru: ['рак', 'знак рака'], en: ['cancer', 'crab'] },
    keywords: { ru: ['вода', 'кардинальный', 'близость', 'безопасность'], en: ['water', 'cardinal', 'closeness', 'security'] },
    copy: {
      ru: {
        title: 'Рак',
        summary: 'Кардинальный водный знак, связанный с близостью, защитой своего круга и чувством принадлежности.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Рак описывает способ ориентироваться на доверие, память и эмоциональную безопасность, прежде чем открываться или принимать решение.'] },
          { title: 'Что важно помнить', paragraphs: ['Забота не означает постоянную мягкость. Защищая важное, этот знак может быть решительным и ясно проводить границы.'] },
        ],
        shortAnswer: 'Рак — о близости, защите и том, что человек считает своим.',
      },
      en: {
        title: 'Cancer',
        summary: 'A cardinal water sign associated with closeness, protection, and a sense of belonging.',
        sections: [
          { title: 'Main theme', paragraphs: ['Cancer describes a way of looking for trust, memory, and emotional safety before opening up or making a decision.'] },
          { title: 'Keep in mind', paragraphs: ['Care does not mean constant softness. When protecting what matters, this sign can be decisive and set clear boundaries.'] },
        ],
        shortAnswer: 'Cancer is about closeness, protection, and what a person considers their own.',
      },
    },
  },
  {
    id: 'sign-leo',
    sign: 'Leo',
    aliases: { ru: ['лев', 'знак льва'], en: ['leo', 'lion'] },
    keywords: { ru: ['огонь', 'фиксированный', 'самовыражение', 'личная позиция'], en: ['fire', 'fixed', 'self-expression', 'personal expression'] },
    copy: {
      ru: {
        title: 'Лев',
        summary: 'Фиксированный огненный знак, связанный с заметным самовыражением, личной позицией и ответственностью за результат.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Лев описывает способ ясно выражать личное отношение, занимать видимое место и отвечать за сделанное.'] },
          { title: 'Что важно помнить', paragraphs: ['Заметность не всегда означает желание быть центром внимания. Это также готовность ясно обозначить свою позицию и поддержать других.'] },
        ],
        shortAnswer: 'Лев — о заметном самовыражении, личной позиции и ответственности за результат.',
      },
      en: {
        title: 'Leo',
        summary: 'A fixed fire sign associated with authorship, visibility, and loyalty to one’s chosen expression.',
        sections: [
          { title: 'Main theme', paragraphs: ['Leo describes a way of putting a personal stamp on a task, taking a visible place, and standing behind what is created in one’s name.'] },
          { title: 'Keep in mind', paragraphs: ['Visibility does not always mean seeking the center of attention. It can also mean stating a position clearly and encouraging others.'] },
        ],
        shortAnswer: 'Leo is about authorship, visible expression, and personal responsibility for the result.',
      },
    },
  },
  {
    id: 'sign-virgo',
    sign: 'Virgo',
    aliases: { ru: ['дева', 'знак девы'], en: ['virgo', 'maiden'] },
    keywords: { ru: ['земля', 'мутабельный', 'детали', 'порядок'], en: ['earth', 'mutable', 'detail', 'order'] },
    copy: {
      ru: {
        title: 'Дева',
        summary: 'Мутабельный земной знак, связанный с точностью, полезностью и настройкой рабочего порядка.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Дева описывает способ разбирать задачу на части, замечать несоответствия и улучшать то, чем можно пользоваться на практике.'] },
          { title: 'Что важно помнить', paragraphs: ['Внимание к деталям не обязано становиться придирчивостью. Оно помогает отделить существенную ошибку от неважной мелочи.'] },
        ],
        shortAnswer: 'Дева — о точности, порядке и практической полезности.',
      },
      en: {
        title: 'Virgo',
        summary: 'A mutable earth sign associated with precision, usefulness, and refining a working order.',
        sections: [
          { title: 'Main theme', paragraphs: ['Virgo describes a way of breaking a task into parts, noticing mismatches, and improving something that needs to work in practice.'] },
          { title: 'Keep in mind', paragraphs: ['Attention to detail does not have to become fault-finding. It can separate an important error from an irrelevant imperfection.'] },
        ],
        shortAnswer: 'Virgo is about precision, order, and practical usefulness.',
      },
    },
  },
  {
    id: 'sign-libra',
    sign: 'Libra',
    aliases: { ru: ['весы', 'знак весов'], en: ['libra', 'scales'] },
    keywords: { ru: ['воздух', 'кардинальный', 'равновесие', 'договорённость'], en: ['air', 'cardinal', 'balance', 'agreement'] },
    copy: {
      ru: {
        title: 'Весы',
        summary: 'Кардинальный воздушный знак, связанный с сопоставлением позиций, правилами взаимности и договорённостью.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Весы описывают способ учитывать другую сторону, искать справедливую меру и оформлять решение так, чтобы оно было понятно участникам.'] },
          { title: 'Что важно помнить', paragraphs: ['Стремление сравнить варианты не всегда означает нерешительность. Оно может быть способом увидеть последствия для всех сторон.'] },
        ],
        shortAnswer: 'Весы — о сравнении позиций, взаимности и ясных договорённостях.',
      },
      en: {
        title: 'Libra',
        summary: 'A cardinal air sign associated with comparing positions, reciprocity, and agreement.',
        sections: [
          { title: 'Main theme', paragraphs: ['Libra describes a way of considering the other side, looking for a fair measure, and shaping a decision that all participants can understand.'] },
          { title: 'Keep in mind', paragraphs: ['Comparing options does not always mean indecision. It can be a way of seeing the consequences for everyone involved.'] },
        ],
        shortAnswer: 'Libra is about comparing positions, reciprocity, and clear agreements.',
      },
    },
  },
  {
    id: 'sign-scorpio',
    sign: 'Scorpio',
    aliases: { ru: ['скорпион', 'знак скорпиона'], en: ['scorpio', 'scorpion'] },
    keywords: { ru: ['вода', 'фиксированный', 'доверие', 'глубина'], en: ['water', 'fixed', 'trust', 'depth'] },
    copy: {
      ru: {
        title: 'Скорпион',
        summary: 'Фиксированный водный знак, связанный с доверием, закрытой информацией и глубокими изменениями.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Скорпион описывает способ не довольствоваться поверхностным ответом, внимательно выбирать степень близости и сохранять важное в тайне.'] },
          { title: 'Что важно помнить', paragraphs: ['Глубина не равна постоянной драме. Этот знак также связан с выдержкой и способностью спокойно разбираться со сложной темой.'] },
        ],
        shortAnswer: 'Скорпион — о доверии, глубине и внимании к тому, что скрыто от первого взгляда.',
      },
      en: {
        title: 'Scorpio',
        summary: 'A fixed water sign associated with trust, private information, and deep change.',
        sections: [
          { title: 'Main theme', paragraphs: ['Scorpio describes a way of looking beyond a surface answer, choosing closeness carefully, and keeping important matters private.'] },
          { title: 'Keep in mind', paragraphs: ['Depth does not mean constant drama. This sign is also associated with endurance and a calm ability to examine a difficult subject.'] },
        ],
        shortAnswer: 'Scorpio is about trust, depth, and attention to what is not immediately visible.',
      },
    },
  },
  {
    id: 'sign-sagittarius',
    sign: 'Sagittarius',
    aliases: { ru: ['стрелец', 'знак стрельца'], en: ['sagittarius', 'archer'] },
    keywords: { ru: ['огонь', 'мутабельный', 'смысл', 'горизонт'], en: ['fire', 'mutable', 'meaning', 'horizon'] },
    copy: {
      ru: {
        title: 'Стрелец',
        summary: 'Мутабельный огненный знак, связанный с поиском смысла, расширением кругозора и общей картиной.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Стрелец описывает способ связывать факты с более широкой идеей, учиться через опыт и смотреть за пределы привычной среды.'] },
          { title: 'Что важно помнить', paragraphs: ['Широкий взгляд не отменяет точности. Убедительная идея всё равно требует проверки фактов и учёта конкретных обстоятельств.'] },
        ],
        shortAnswer: 'Стрелец — о смысле, обучении и расширении известного горизонта.',
      },
      en: {
        title: 'Sagittarius',
        summary: 'A mutable fire sign associated with meaning, broader horizons, and the larger picture.',
        sections: [
          { title: 'Main theme', paragraphs: ['Sagittarius describes a way of connecting facts to a wider idea, learning through experience, and looking beyond familiar surroundings.'] },
          { title: 'Keep in mind', paragraphs: ['A broad view does not replace accuracy. A persuasive idea still needs checked facts and attention to the specific situation.'] },
        ],
        shortAnswer: 'Sagittarius is about meaning, learning, and widening the known horizon.',
      },
    },
  },
  {
    id: 'sign-capricorn',
    sign: 'Capricorn',
    aliases: { ru: ['козерог', 'знак козерога'], en: ['capricorn', 'sea goat'] },
    keywords: { ru: ['земля', 'кардинальный', 'структура', 'ответственность'], en: ['earth', 'cardinal', 'structure', 'responsibility'] },
    copy: {
      ru: {
        title: 'Козерог',
        summary: 'Кардинальный земной знак, связанный со структурой, ответственностью и долгим результатом.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Козерог описывает способ видеть требования задачи, выстраивать порядок действий и учитывать последствия на длинной дистанции.'] },
          { title: 'Что важно помнить', paragraphs: ['Серьёзность не исключает гибкости и юмора. Скорее речь идёт о готовности отвечать за выбранное решение.'] },
        ],
        shortAnswer: 'Козерог — о структуре, ответственности и результате, который требует времени.',
      },
      en: {
        title: 'Capricorn',
        summary: 'A cardinal earth sign associated with structure, responsibility, and long-term results.',
        sections: [
          { title: 'Main theme', paragraphs: ['Capricorn describes a way of seeing a task’s requirements, arranging the steps, and considering consequences over the long term.'] },
          { title: 'Keep in mind', paragraphs: ['Seriousness does not rule out flexibility or humor. The central point is a willingness to take responsibility for a chosen decision.'] },
        ],
        shortAnswer: 'Capricorn is about structure, responsibility, and results that take time.',
      },
    },
  },
  {
    id: 'sign-aquarius',
    sign: 'Aquarius',
    aliases: { ru: ['водолей', 'знак водолея'], en: ['aquarius', 'water bearer'] },
    keywords: { ru: ['воздух', 'фиксированный', 'система', 'независимость'], en: ['air', 'fixed', 'system', 'independence'] },
    copy: {
      ru: {
        title: 'Водолей',
        summary: 'Фиксированный воздушный знак, связанный с системным взглядом, независимостью и устройством групп.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Водолей описывает способ смотреть на правила со стороны, замечать устройство целого и сохранять собственную позицию внутри группы.'] },
          { title: 'Что важно помнить', paragraphs: ['Независимость не означает безразличие к людям. Интерес этого знака часто направлен на общие правила и равный доступ.'] },
        ],
        shortAnswer: 'Водолей — о независимом взгляде, системах и отношениях человека с группой.',
      },
      en: {
        title: 'Aquarius',
        summary: 'A fixed air sign associated with systems thinking, independence, and how groups are organized.',
        sections: [
          { title: 'Main theme', paragraphs: ['Aquarius describes a way of viewing rules from the outside, noticing how the whole works, and keeping an independent position within a group.'] },
          { title: 'Keep in mind', paragraphs: ['Independence does not mean indifference to people. This sign often focuses on shared rules and equal access.'] },
        ],
        shortAnswer: 'Aquarius is about an independent view, systems, and a person’s relationship with a group.',
      },
    },
  },
  {
    id: 'sign-pisces',
    sign: 'Pisces',
    aliases: { ru: ['рыбы', 'знак рыб'], en: ['pisces', 'fish'] },
    keywords: { ru: ['вода', 'мутабельный', 'восприимчивость', 'воображение'], en: ['water', 'mutable', 'receptivity', 'imagination'] },
    copy: {
      ru: {
        title: 'Рыбы',
        summary: 'Мутабельный водный знак, связанный с восприимчивостью, воображением и размытыми границами между впечатлениями.',
        sections: [
          { title: 'Главная тема', paragraphs: ['Рыбы описывают способ быстро замечать общий тон разговора, связывать разрозненные впечатления и мыслить образами.'] },
          { title: 'Что важно помнить', paragraphs: ['Чуткость не отменяет ясных границ. Без них становится труднее отличать собственное состояние от чужого.'] },
        ],
        shortAnswer: 'Рыбы — о восприимчивости, воображении и связи между разными впечатлениями.',
      },
      en: {
        title: 'Pisces',
        summary: 'A mutable water sign associated with receptivity, imagination, and porous boundaries between impressions.',
        sections: [
          { title: 'Main theme', paragraphs: ['Pisces describes a way of sensing the overall tone, connecting scattered impressions, and thinking through images as well as direct statements.'] },
          { title: 'Keep in mind', paragraphs: ['Sensitivity does not remove the need for clear boundaries. Without them, it becomes harder to distinguish one’s own state from someone else’s.'] },
        ],
        shortAnswer: 'Pisces is about receptivity, imagination, and connections between different impressions.',
      },
    },
  },
] as const satisfies readonly SignDefinition[];

const INDIVIDUAL_SIGN_TOPICS: readonly KnowledgeTopicSource[] = SIGN_DEFINITIONS.map((definition) => ({
  id: definition.id,
  category: 'signs',
  aliases: definition.aliases,
  keywords: definition.keywords,
  copy: definition.copy,
  relatedTopicIds: ['signs-overview', 'sign-elements', 'sign-modalities'],
  personalizationKind: { type: 'sign', sign: definition.sign },
}));

export const SIGN_TOPICS = [
  {
    id: 'signs-overview',
    category: 'signs',
    aliases: {
      ru: ['знаки зодиака', 'зодиак', 'что такое знак'],
      en: ['zodiac signs', 'zodiac', 'what is a sign'],
    },
    keywords: {
      ru: ['двенадцать знаков', 'стиль', 'положение планеты'],
      en: ['twelve signs', 'style', 'planetary placement'],
    },
    copy: {
      ru: {
        title: 'Что описывают знаки',
        summary: 'Знак показывает, каким способом действует планета или важная точка карты.',
        sections: [
          { title: 'Знак отвечает на вопрос «как»', paragraphs: ['Планета обозначает функцию, а знак задаёт её привычный способ действия. Поэтому один и тот же знак читается по-разному у Солнца, Луны или Марса.'] },
          { title: 'Знак не равен человеку', paragraphs: ['Ни один знак не описывает личность целиком. В карте одновременно работают разные планеты, дома и аспекты.'] },
        ],
        shortAnswer: 'Знак — это способ действия конкретной планеты, а не готовое описание человека.',
      },
      en: {
        title: 'What signs describe',
        summary: 'A sign shows the manner in which a planet or key chart point operates.',
        sections: [
          { title: 'A sign answers “how”', paragraphs: ['A planet names a function, while a sign describes its familiar manner. The same sign therefore reads differently for the Sun, Moon, or Mars.'] },
          { title: 'A sign is not the whole person', paragraphs: ['No single sign describes an entire personality. Different planets, houses, and aspects work together in the chart.'] },
        ],
        shortAnswer: 'A sign is the manner of a particular planet, not a complete description of a person.',
      },
    },
    relatedTopicIds: ['sign-elements', 'sign-modalities', 'planet-in-sign'],
  },
  ...INDIVIDUAL_SIGN_TOPICS,
  {
    id: 'sign-elements',
    category: 'signs',
    aliases: {
      ru: ['стихии знаков', 'огонь земля воздух вода'],
      en: ['sign elements', 'fire earth air water'],
    },
    keywords: {
      ru: ['огненные знаки', 'земные знаки', 'воздушные знаки', 'водные знаки'],
      en: ['fire signs', 'earth signs', 'air signs', 'water signs'],
    },
    copy: {
      ru: {
        title: 'Четыре стихии знаков',
        summary: 'Огонь, Земля, Воздух и Вода объединяют знаки по общему способу воспринимать и действовать.',
        sections: [
          {
            title: 'Огонь и Земля',
            paragraphs: [
              'Огонь — Овен, Лев и Стрелец — связан с инициативой и прямым выражением. Земля — Телец, Дева и Козерог — с практикой, формой и проверяемым результатом.',
            ],
          },
          {
            title: 'Воздух и Вода',
            paragraphs: [
              'Воздух — Близнецы, Весы и Водолей — связан с мыслями, словами и связями между людьми. Вода — Рак, Скорпион и Рыбы — с чувствами, привязанностью и восприимчивостью.',
            ],
          },
        ],
        shortAnswer: 'Стихия показывает общий язык знака: действие, практика, мысль или чувство.',
      },
      en: {
        title: 'The four sign elements',
        summary: 'Fire, Earth, Air, and Water group signs by a broad way of perceiving and acting.',
        sections: [
          {
            title: 'Fire and Earth',
            paragraphs: [
              'Fire—Aries, Leo, and Sagittarius—is associated with initiative and direct expression. Earth—Taurus, Virgo, and Capricorn—is associated with practice, form, and verifiable results.',
            ],
          },
          {
            title: 'Air and Water',
            paragraphs: [
              'Air—Gemini, Libra, and Aquarius—is associated with thought, language, and connections between people. Water—Cancer, Scorpio, and Pisces—is associated with feeling, attachment, and receptivity.',
            ],
          },
        ],
        shortAnswer: 'An element gives a sign its broad language: action, practice, thought, or feeling.',
      },
    },
    relatedTopicIds: ['signs-overview', 'sign-modalities', 'planet-in-sign'],
  },
  {
    id: 'sign-modalities',
    category: 'signs',
    aliases: {
      ru: ['модальности знаков', 'кресты знаков', 'кардинальный фиксированный мутабельный'],
      en: ['sign modalities', 'qualities of signs', 'cardinal fixed mutable'],
    },
    keywords: {
      ru: ['кардинальные знаки', 'фиксированные знаки', 'мутабельные знаки'],
      en: ['cardinal signs', 'fixed signs', 'mutable signs'],
    },
    copy: {
      ru: {
        title: 'Кардинальные, фиксированные и мутабельные знаки',
        summary: 'Модальность показывает, как знак начинает, продолжает или меняет ход дела.',
        sections: [
          {
            title: 'Кардинальные и фиксированные',
            paragraphs: [
              'Кардинальные Овен, Рак, Весы и Козерог задают новое направление. Фиксированные Телец, Лев, Скорпион и Водолей удерживают выбранный курс и углубляют его.',
            ],
          },
          {
            title: 'Мутабельные',
            paragraphs: [
              'Мутабельные Близнецы, Дева, Стрелец и Рыбы приспосабливают подход к изменившимся условиям и помогают перейти от одного этапа к другому.',
            ],
          },
        ],
        shortAnswer: 'Кардинальные начинают, фиксированные удерживают, мутабельные перестраивают.',
      },
      en: {
        title: 'Cardinal, fixed, and mutable signs',
        summary: 'Modality shows how a sign begins, sustains, or changes a course of action.',
        sections: [
          {
            title: 'Cardinal and fixed',
            paragraphs: [
              'Cardinal Aries, Cancer, Libra, and Capricorn set a new direction. Fixed Taurus, Leo, Scorpio, and Aquarius sustain and deepen a chosen course.',
            ],
          },
          {
            title: 'Mutable',
            paragraphs: [
              'Mutable Gemini, Virgo, Sagittarius, and Pisces adjust an approach to changing conditions and help move from one stage to another.',
            ],
          },
        ],
        shortAnswer: 'Cardinal signs begin, fixed signs sustain, and mutable signs adapt.',
      },
    },
    relatedTopicIds: ['signs-overview', 'sign-elements', 'planet-in-sign'],
  },
  {
    id: 'planet-in-sign',
    category: 'signs',
    aliases: {
      ru: ['планета в знаке', 'что значит планета в знаке'],
      en: ['planet in a sign', 'what a planet in a sign means'],
    },
    keywords: {
      ru: ['планета', 'знак', 'функция', 'способ действия'],
      en: ['planet', 'sign', 'function', 'manner'],
    },
    copy: {
      ru: {
        title: 'Как читать планету в знаке',
        summary: 'Планета отвечает за функцию, а знак описывает способ её действия.',
        sections: [
          { title: 'Два разных вопроса', paragraphs: ['Например, Меркурий связан с мышлением и речью, а его знак уточняет привычный способ собирать сведения и формулировать мысль.'] },
          { title: 'Не отдельный ярлык', paragraphs: ['Положение планеты читают вместе с домом и аспектами. Одинаковый знак может звучать по-разному в разных картах.'] },
        ],
        shortAnswer: 'Сначала определите функцию планеты, затем добавьте способ действия её знака.',
      },
      en: {
        title: 'How to read a planet in a sign',
        summary: 'A planet names a function, while its sign describes the manner in which it operates.',
        sections: [
          { title: 'Two different questions', paragraphs: ['For example, Mercury is associated with thought and speech, while its sign refines the familiar way of gathering information and wording an idea.'] },
          { title: 'Not a standalone label', paragraphs: ['A planetary placement is read with its house and aspects. The same sign can work differently in different charts.'] },
        ],
        shortAnswer: 'First identify the planet’s function, then add the manner of its sign.',
      },
    },
    relatedTopicIds: ['signs-overview', 'sign-elements', 'how-to-read-natal-chart'],
  },
  {
    id: 'zodiac-signs-vs-constellations',
    category: 'signs',
    aliases: {
      ru: ['знак и созвездие', 'зодиакальные созвездия'],
      en: ['sign versus constellation', 'zodiac constellations'],
    },
    keywords: {
      ru: ['зодиакальный круг', 'созвездия', 'тропический зодиак'],
      en: ['zodiac circle', 'constellations', 'tropical zodiac'],
    },
    copy: {
      ru: {
        title: 'Знак и созвездие — не одно и то же',
        summary: 'Знак — участок зодиакального круга, а созвездие — область звёздного неба.',
        sections: [
          { title: 'Знаки', paragraphs: ['В тропической астрологии круг делят на двенадцать равных знаков, начиная от точки весеннего равноденствия.'] },
          { title: 'Созвездия', paragraphs: ['Астрономические созвездия имеют разный размер и собственные границы. Их названия связаны со знаками исторически, но это разные системы координат.'] },
        ],
        shortAnswer: 'Знаки — равные участки зодиака, созвездия — реальные области звёздного неба.',
      },
      en: {
        title: 'A sign and a constellation are not the same',
        summary: 'A sign is a section of the zodiac, while a constellation is an area of the starry sky.',
        sections: [
          { title: 'Signs', paragraphs: ['In tropical astrology, the zodiac is divided into twelve equal signs beginning at the March equinox.'] },
          { title: 'Constellations', paragraphs: ['Astronomical constellations vary in size and have their own boundaries. Their names are historically connected with the signs, but they are different coordinate systems.'] },
        ],
        shortAnswer: 'Signs are equal sections of the zodiac; constellations are actual regions of the starry sky.',
      },
    },
    relatedTopicIds: ['signs-overview', 'sign-elements', 'what-chart-calculates'],
  },
] satisfies readonly KnowledgeTopicSource[];
