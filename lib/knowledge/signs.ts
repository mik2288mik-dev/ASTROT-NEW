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
        summary: 'Овен — один из двенадцати знаков зодиака. В астрологии его связывают с быстрым началом, прямым действием и самостоятельностью.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Когда планета находится в Овне, её значение связывают с готовностью быстро включиться в дело и проверить решение действием. Конкретный смысл зависит от планеты: например, для Меркурия речь идёт о способе думать и говорить, а для Марса — о способе добиваться своего.'] },
          { title: 'Не только напор', paragraphs: ['Овен не делает человека обязательно резким или конфликтным. Этот знак также связывают с ясной инициативой, самостоятельностью и готовностью первым начать действие.'] },
        ],
        shortAnswer: 'Овен — знак зодиака, который в астрологии описывает прямой способ начинать дела, действовать самостоятельно и делать первый шаг.',
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
        summary: 'Телец — знак зодиака, который в астрологии связывают с устойчивым темпом, сохранением достигнутого и практическим результатом.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Тельце обычно описывает неторопливый способ действовать, опору на привычный порядок и желание получить результат, который можно сохранить или использовать на практике.'] },
          { title: 'Не только медлительность', paragraphs: ['Телец не означает пассивность. Когда цель понятна, устойчивый темп помогает действовать терпеливо, последовательно и долго продолжать начатое.'] },
        ],
        shortAnswer: 'Телец — знак зодиака, который описывает устойчивый темп, внимание к практической стороне дела и стремление сохранить достигнутое.',
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
        summary: 'Близнецы — знак зодиака, который в астрологии связывают с вопросами, обменом сведениями и сравнением разных точек зрения.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Близнецах обычно описывает подвижный способ работать с информацией: замечать несколько вариантов, связывать факты и уточнять мысль в разговоре.'] },
          { title: 'Не только переменчивость', paragraphs: ['Близнецы не означают, что человек всегда непостоянен. Смена мнения может быть реакцией на новые сведения, а интерес к разным версиям помогает точнее понять вопрос.'] },
        ],
        shortAnswer: 'Близнецы — знак зодиака, который описывает подвижное мышление, обмен информацией и привычку сравнивать несколько вариантов.',
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
        summary: 'Рак — знак зодиака, который в астрологии связывают с близостью, заботой, памятью и защитой того, что человек считает своим.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Раке обычно описывает внимание к доверию, знакомой обстановке и чувствам близких людей. Перед открытым действием здесь часто важно понять, можно ли чувствовать себя спокойно и безопасно.'] },
          { title: 'Не только мягкость', paragraphs: ['Рак не означает слабость или постоянную уступчивость. Когда нужно защитить близкого человека, дом или личные границы, с этим знаком связывают твёрдые и решительные действия.'] },
        ],
        shortAnswer: 'Рак — знак зодиака, который описывает заботу о близких, потребность в доверии и защиту привычного личного пространства.',
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
        summary: 'Лев — знак зодиака, который в астрологии связывают с заметным самовыражением, личной позицией и гордостью за созданное.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты во Льве обычно описывает желание выразить личное отношение, сделать результат узнаваемым и не прятать собственный вклад.'] },
          { title: 'Не только внимание', paragraphs: ['Лев не означает постоянное стремление быть в центре. Этот знак также связывают с готовностью отвечать за сделанное, поддерживать других и открыто обозначать свою позицию.'] },
        ],
        shortAnswer: 'Лев — знак зодиака, который описывает заметное самовыражение, личное отношение к делу и готовность отвечать за свой результат.',
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
        summary: 'Дева — знак зодиака, который в астрологии связывают с точностью, вниманием к деталям и практической полезностью.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Деве обычно описывает привычку разбирать задачу на части, проверять детали и исправлять то, что мешает работе или точному результату.'] },
          { title: 'Не только критика', paragraphs: ['Дева не означает постоянную придирчивость. Внимание к мелочам может помогать отличить существенную ошибку от неважной и сделать работу понятнее.'] },
        ],
        shortAnswer: 'Дева — знак зодиака, который описывает точный подход к задаче, проверку деталей и стремление сделать результат полезным на практике.',
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
        summary: 'Весы — знак зодиака, который в астрологии связывают со сравнением позиций, взаимностью и поиском понятной договорённости.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Весах обычно описывает привычку учитывать другую сторону, сравнивать варианты и искать решение, правила которого понятны всем участникам.'] },
          { title: 'Не только сомнения', paragraphs: ['Весы не означают неспособность принять решение. Дополнительное сравнение может быть способом увидеть последствия для обеих сторон и выбрать более справедливую меру.'] },
        ],
        shortAnswer: 'Весы — знак зодиака, который описывает сравнение разных позиций, внимание к взаимности и стремление договориться на понятных условиях.',
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
        summary: 'Скорпион — знак зодиака, который в астрологии связывают с доверием, личными тайнами и вниманием к сложным переменам.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Скорпионе обычно описывает стремление дойти до причины, осторожно выбирать степень близости и не раскрывать важную информацию без доверия.'] },
          { title: 'Не только драма', paragraphs: ['Скорпион не означает постоянный кризис, ревность или манипуляцию. Этот знак также связывают с выдержкой и способностью долго разбираться в трудной теме.'] },
        ],
        shortAnswer: 'Скорпион — знак зодиака, который описывает осторожное доверие, внимание к скрытым причинам и выдержку перед сложными переменами.',
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
        summary: 'Стрелец — знак зодиака, который в астрологии связывают с поиском смысла, обучением и стремлением увидеть общую картину.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Стрельце обычно описывает стремление связать отдельные факты с более широкой идеей, учиться через опыт и выходить за пределы уже знакомого.'] },
          { title: 'Не только широкие идеи', paragraphs: ['Стрелец не гарантирует правильный ответ и не заменяет проверку фактов. Общая идея становится убедительнее, когда учитывает конкретные обстоятельства и возможные исключения.'] },
        ],
        shortAnswer: 'Стрелец — знак зодиака, который описывает поиск смысла, интерес к обучению и стремление связать факты в общую картину.',
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
        summary: 'Козерог — знак зодиака, который в астрологии связывают с порядком действий, ответственностью и результатом, требующим времени.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Козероге обычно описывает стремление понять требования задачи, выстроить последовательность шагов и учитывать последствия в долгой перспективе.'] },
          { title: 'Не только строгость', paragraphs: ['Козерог не означает холодность или отсутствие юмора. Основная тема этого знака связана с готовностью принять ограничения и отвечать за выбранное решение.'] },
        ],
        shortAnswer: 'Козерог — знак зодиака, который описывает последовательный подход, ответственность за решение и работу ради результата, требующего времени.',
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
        summary: 'Водолей — знак зодиака, который в астрологии связывают с независимым взглядом, общими правилами и устройством групп.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Водолее обычно описывает привычку смотреть на правила со стороны, замечать, как устроена система, и сохранять собственное мнение внутри группы.'] },
          { title: 'Не только отстранённость', paragraphs: ['Водолей не означает безразличие к людям. Независимая позиция может сочетаться с интересом к справедливым общим правилам и равным возможностям для участников группы.'] },
        ],
        shortAnswer: 'Водолей — знак зодиака, который описывает независимый взгляд на правила, внимание к устройству системы и отношениям человека с группой.',
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
        summary: 'Рыбы — знак зодиака, который в астрологии связывают с восприимчивостью к настроению, воображением и образным мышлением.',
        sections: [
          { title: 'Как читают этот знак', paragraphs: ['Положение планеты в Рыбах обычно описывает способность замечать общий тон происходящего, связывать разрозненные впечатления и выражать мысль через образы.'] },
          { title: 'Не только чувствительность', paragraphs: ['Рыбы не означают беспомощность или отсутствие границ. Этот знак говорит о восприимчивости, а способность отличать собственные чувства от чужих зависит не от одного положения карты.'] },
        ],
        shortAnswer: 'Рыбы — знак зодиака, который описывает восприимчивость к настроению, воображение и способность связывать разные впечатления в один образ.',
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
        summary: 'Знак зодиака — это один из двенадцати равных участков круга, в котором при расчёте карты находится планета или важная точка.',
        sections: [
          { title: 'Что значит «планета в знаке»', paragraphs: ['Расчёт показывает, в каком участке зодиакального круга находилась каждая планета. В астрологии планета задаёт тему, а знак описывает привычный способ её выражать. Поэтому Овен у Меркурия относится к мышлению и речи, а Овен у Марса — к способу действовать и добиваться своего.'] },
          { title: 'Почему знак не равен человеку', paragraphs: ['В одной натальной карте планеты обычно находятся в разных знаках. К их значениям добавляют дома и аспекты, то есть области карты и углы между планетами. Поэтому ни солнечный знак, ни любой другой знак не описывает личность целиком.'] },
        ],
        shortAnswer: 'Знак зодиака показывает, в каком из двенадцати участков зодиакального круга находится планета; в астрологии по знаку описывают, как выражается её значение.',
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
        summary: 'Стихии знаков — это четыре астрологические группы: Огонь, Земля, Воздух и Вода. Они не обозначают физические вещества, а объединяют знаки с похожим способом действовать и воспринимать происходящее.',
        sections: [
          {
            title: 'Огонь и Земля',
            paragraphs: [
              'К Огню относят Овен, Лев и Стрелец; эту группу связывают с инициативой и прямым выражением. К Земле относят Телец, Деву и Козерог; её связывают с практическими задачами, устойчивостью и результатом, который можно проверить.',
            ],
          },
          {
            title: 'Воздух и Вода',
            paragraphs: [
              'К Воздуху относят Близнецы, Весы и Водолей; эту группу связывают с мыслями, словами и обменом между людьми. К Воде относят Рак, Скорпион и Рыбы; её связывают с чувствами, близостью и восприимчивостью к настроению.',
            ],
          },
        ],
        shortAnswer: 'Стихия — это группа знаков с общей темой: Огонь связывают с инициативой, Землю с практикой, Воздух с обменом мыслями, а Воду с чувствами и близостью.',
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
        summary: 'Модальность — это деление знаков по тому, как они ведут дело во времени: начинают его, удерживают выбранное направление или приспосабливаются к переменам.',
        sections: [
          {
            title: 'Кардинальные и фиксированные',
            paragraphs: [
              'Кардинальными называют Овен, Рак, Весы и Козерог: в астрологии их связывают с началом и заданием нового направления. Фиксированными называют Телец, Лев, Скорпион и Водолей: их связывают с продолжением дела и сохранением выбранного курса.',
            ],
          },
          {
            title: 'Мутабельные',
            paragraphs: [
              'Мутабельными называют Близнецы, Деву, Стрелец и Рыбы. Их связывают со сменой подхода, приспособлением к новым условиям и переходом от одного этапа к следующему.',
            ],
          },
        ],
        shortAnswer: 'Модальность делит знаки на три группы: кардинальные начинают новое, фиксированные удерживают направление, а мутабельные меняют подход под новые условия.',
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
      ru: ['планета', 'знак', 'значение', 'способ действия'],
      en: ['planet', 'sign', 'function', 'manner'],
    },
    copy: {
      ru: {
        title: 'Как читать планету в знаке',
        summary: 'Планета в знаке — это положение, которое показывает, в каком из двенадцати участков зодиакального круга находилась планета в момент рождения.',
        sections: [
          { title: 'Что добавляет знак', paragraphs: ['В астрологии у каждой планеты есть своя тема, а знак уточняет способ её выражения. Например, Меркурий связывают с мышлением и речью, поэтому знак Меркурия описывает привычный способ собирать сведения и формулировать мысль.'] },
          { title: 'Что ещё влияет на значение', paragraphs: ['Положение планеты читают вместе с домом, то есть областью карты, и аспектами, то есть углами к другим планетам. Поэтому одна и та же планета в одном знаке может получать разный дополнительный смысл в разных картах.'] },
        ],
        shortAnswer: 'Планета в знаке показывает, какая астрологическая тема рассматривается и каким способом она выражается; полный вывод также учитывает дом и углы к другим планетам.',
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
        title: 'Чем знак отличается от созвездия',
        summary: 'Знак зодиака — это равный участок расчётного круга, а созвездие — область звёздного неба с границами, принятыми в астрономии.',
        sections: [
          { title: 'Как устроены знаки', paragraphs: ['В тропической астрологии годовой путь Солнца по небу делят на двенадцать равных участков. Первый знак начинается в точке мартовского равноденствия, когда день и ночь имеют примерно равную продолжительность.'] },
          { title: 'Как устроены созвездия', paragraphs: ['Созвездия занимают на небе области разного размера и имеют собственные астрономические границы. Знаки получили похожие названия по исторической связи с созвездиями, но сегодня это две разные системы.'] },
        ],
        shortAnswer: 'Знаки зодиака — двенадцать равных участков расчётного круга, а созвездия — области звёздного неба разного размера; их названия связаны исторически, но это не одно и то же.',
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
