import type { KnowledgeTopicSource } from './types';

type HouseDefinition = {
  id: string;
  house: number;
  aliases: Readonly<Record<'ru' | 'en', readonly string[]>>;
  keywords: Readonly<Record<'ru' | 'en', readonly string[]>>;
  copy: KnowledgeTopicSource['copy'];
};

const HOUSE_DEFINITIONS = [
  {
    id: 'house-1',
    house: 1,
    aliases: { ru: ['первый дом', '1 дом'], en: ['first house', '1st house', 'house 1'] },
    keywords: { ru: ['асцендент', 'первое впечатление', 'начало', 'манера'], en: ['ascendant', 'first impression', 'beginning', 'manner'] },
    copy: {
      ru: {
        title: 'Первый дом',
        summary: 'Первый дом — одна из двенадцати частей круга натальной карты. По нему рассматривают начало действий, внешнюю манеру и первое впечатление.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К первому дому относят поведение в новой обстановке, способ показать себя и первую заметную реакцию на происходящее. Он не описывает весь характер или внешность человека.'] },
          { title: 'Что уточняет положение', paragraphs: ['Первый дом начинается с Асцендента, точки круга карты на восточном горизонте в момент рождения. При чтении учитывают знак зодиака, в котором находится Асцендент, планеты внутри дома и их аспекты с другими планетами и точками карты.'] },
        ],
        shortAnswer: 'Первый дом используют для чтения первого впечатления, начала действий и поведения в новой обстановке; весь характер человека он не описывает.',
      },
      en: {
        title: 'First house',
        summary: 'The first house is associated with beginnings, outward manner, and first impressions.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It describes how a person enters a new situation, makes their presence known, and responds to the immediate environment.'] },
          { title: 'How to read it', paragraphs: ['The first house begins at the Ascendant. Its sign, planets in the house, and aspects to the Ascendant are read together.'] },
        ],
        shortAnswer: 'The first house is about how a person begins, presents themselves, and meets the outside world.',
      },
    },
  },
  {
    id: 'house-2',
    house: 2,
    aliases: { ru: ['второй дом', '2 дом'], en: ['second house', '2nd house', 'house 2'] },
    keywords: { ru: ['деньги', 'имущество', 'навыки', 'личное'], en: ['money', 'possessions', 'skills', 'personal'] },
    copy: {
      ru: {
        title: 'Второй дом',
        summary: 'Второй дом — одна из двенадцати частей круга натальной карты. По нему рассматривают личные деньги, имущество и практические навыки.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['Ко второму дому относят обращение с собственными деньгами и вещами, способы поддерживать материальную устойчивость и навыки, которые можно применять на практике. Дом не показывает точную сумму дохода.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается второй дом, описывает подход к этим вопросам. Планеты внутри дома добавляют свои значения, а аспекты связывают их с другими планетами карты.'] },
        ],
        shortAnswer: 'Второй дом используют для чтения вопросов о личных деньгах, имуществе и навыках с практической ценностью; точный доход он не предсказывает.',
      },
      en: {
        title: 'Second house',
        summary: 'The second house is associated with personal means, possessions, and what a person can maintain.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes attitudes toward money and belongings, ways of maintaining material stability, and skills with practical value.'] },
          { title: 'How to read it', paragraphs: ['The second house does not promise a specific income. It describes a familiar approach to personal means together with its sign, planets, and aspects.'] },
        ],
        shortAnswer: 'The second house is about personal means, possessions, and practical skills.',
      },
    },
  },
  {
    id: 'house-3',
    house: 3,
    aliases: { ru: ['третий дом', '3 дом'], en: ['third house', '3rd house', 'house 3'] },
    keywords: { ru: ['общение', 'обучение', 'соседи', 'братья и сёстры'], en: ['communication', 'learning', 'neighbors', 'siblings'] },
    copy: {
      ru: {
        title: 'Третий дом',
        summary: 'Третий дом — одна из двенадцати частей круга натальной карты. По нему рассматривают повседневное общение, начальное обучение и ближайшее окружение.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К третьему дому относят речь и обмен сведениями, школьное обучение, короткие поездки, соседей, братьев и сестёр. Это круг регулярных контактов и знакомых маршрутов, а не дальних путешествий.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается третий дом, описывает способ задавать вопросы и передавать сведения. Планеты внутри дома и их аспекты с другими планетами добавляют детали.'] },
        ],
        shortAnswer: 'Третий дом используют для чтения повседневного общения, начального обучения, коротких поездок и связей с ближайшим окружением.',
      },
      en: {
        title: 'Third house',
        summary: 'The third house is associated with everyday communication, learning, and the nearby environment.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes speech and information exchange, short journeys, basic learning, neighbors, and siblings.'] },
          { title: 'How to read it', paragraphs: ['The sign and planets in the third house refine how a person asks questions, shares information, and moves through familiar surroundings.'] },
        ],
        shortAnswer: 'The third house is about everyday information, learning, and the nearby environment.',
      },
    },
  },
  {
    id: 'house-4',
    house: 4,
    aliases: { ru: ['четвёртый дом', 'четвертый дом', '4 дом'], en: ['fourth house', '4th house', 'house 4'] },
    keywords: { ru: ['дом', 'семья', 'происхождение', 'частная жизнь'], en: ['home', 'family', 'origins', 'private life'] },
    copy: {
      ru: {
        title: 'Четвёртый дом',
        summary: 'Четвёртый дом — одна из двенадцати частей круга натальной карты. По нему рассматривают дом, семейную среду, происхождение и частную жизнь.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К четвёртому дому относят домашнюю обстановку, семейные связи, место происхождения и ту часть жизни, которая не предназначена для публики. Он не восстанавливает подробную историю семьи по одной позиции.'] },
          { title: 'Что уточняет положение', paragraphs: ['Четвёртый дом начинается с Основания неба, или IC, нижней точки карты, расположенной напротив Середины неба. Знак зодиака на этой границе, планеты внутри дома и их аспекты с другими планетами уточняют чтение домашних и семейных вопросов.'] },
        ],
        shortAnswer: 'Четвёртый дом используют для чтения вопросов о доме, семейной среде, происхождении и частной жизни.',
      },
      en: {
        title: 'Fourth house',
        summary: 'The fourth house is associated with home, family, origins, and private life.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes the home environment, family history, connection with one’s place of origin, and what a person keeps outside public view.'] },
          { title: 'How to read it', paragraphs: ['The fourth house begins at the IC. Its sign and planets refine the picture of private space and family ties.'] },
        ],
        shortAnswer: 'The fourth house is about home, origins, family, and private life.',
      },
    },
  },
  {
    id: 'house-5',
    house: 5,
    aliases: { ru: ['пятый дом', '5 дом'], en: ['fifth house', '5th house', 'house 5'] },
    keywords: { ru: ['творчество', 'игра', 'романтика', 'дети'], en: ['creativity', 'play', 'romance', 'children'] },
    copy: {
      ru: {
        title: 'Пятый дом',
        summary: 'Пятый дом — одна из двенадцати частей круга натальной карты. По нему рассматривают творчество, игру, романтический интерес и тему детей.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К пятому дому относят занятия, в которых человек создаёт что-то своё, играет, выступает перед другими или показывает романтическую симпатию. Тема детей здесь касается отношения к родительству и взаимодействия с детьми, а не предсказания их количества.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается пятый дом, описывает, как человек выражает интерес и творческую инициативу. Планеты внутри дома и аспекты, то есть их связи с другими точками карты, добавляют к этим вопросам свои значения.'] },
        ],
        shortAnswer: 'Пятый дом используют для чтения вопросов о творчестве, игре, романтическом интересе и отношении к теме детей.',
      },
      en: {
        title: 'Fifth house',
        summary: 'The fifth house is associated with creativity, play, romance, and children.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It describes activities in which a person creates something of their own, enjoys the process, and allows freer expression.'] },
          { title: 'How to read it', paragraphs: ['Planets and the sign of the fifth house refine the form of creativity and the approach to play, attention, romance, and children.'] },
        ],
        shortAnswer: 'The fifth house is about creativity, play, romance, and personal authorship.',
      },
    },
  },
  {
    id: 'house-6',
    house: 6,
    aliases: { ru: ['шестой дом', '6 дом'], en: ['sixth house', '6th house', 'house 6'] },
    keywords: { ru: ['распорядок', 'работа', 'обязанности', 'здоровье'], en: ['routine', 'work', 'duties', 'health'] },
    copy: {
      ru: {
        title: 'Шестой дом',
        summary: 'Шестой дом — одна из двенадцати частей круга натальной карты. По нему рассматривают распорядок, повседневную работу, обязанности и привычки ухода за телом.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К шестому дому относят повторяющиеся дела, рабочие навыки, распределение обязанностей, режим и повседневный уход за собой. Он описывает организацию быта и труда, но не ставит диагноз и не заменяет медицинскую оценку.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается шестой дом, описывает подход к регулярным задачам. Планеты внутри дома и их аспекты с другими планетами уточняют, какие вопросы чаще входят в распорядок и рабочие обязанности.'] },
        ],
        shortAnswer: 'Шестой дом используют для чтения распорядка, повседневной работы, обязанностей и привычек ухода за собой; медицинских выводов он не даёт.',
      },
      en: {
        title: 'Sixth house',
        summary: 'The sixth house is associated with routine, daily work, duties, and care for the body.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes recurring tasks, working skills, the distribution of duties, and habits connected with physical well-being.'] },
          { title: 'How to read it', paragraphs: ['This house does not replace medical assessment. In a chart, it describes the organization of daily tasks and self-care.'] },
        ],
        shortAnswer: 'The sixth house is about routines, work, duties, and everyday care for the body.',
      },
    },
  },
  {
    id: 'house-7',
    house: 7,
    aliases: { ru: ['седьмой дом', '7 дом'], en: ['seventh house', '7th house', 'house 7'] },
    keywords: { ru: ['партнёрство', 'любовь', 'брак', 'договор', 'другой человек'], en: ['partnership', 'love', 'marriage', 'contract', 'other person'] },
    copy: {
      ru: {
        title: 'Седьмой дом',
        summary: 'Седьмой дом — одна из двенадцати частей круга натальной карты. По нему рассматривают партнёрство, договоры и отношения между двумя равными сторонами.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К седьмому дому относят близкие и деловые союзы, брак, договоры и открытое взаимодействие с другим человеком. Речь идёт о связи один на один, где у каждой стороны есть свои интересы и обязательства.'] },
          { title: 'Что уточняет положение', paragraphs: ['Начало седьмого дома называют точкой «Десцендент». Она находится на западном горизонте карты напротив Асцендента. Знак зодиака на этой границе, планеты внутри дома и их аспекты с другими планетами уточняют чтение партнёрства, но не гарантируют исход отношений.'] },
        ],
        shortAnswer: 'Седьмой дом используют для чтения партнёрства, договоров и прямого взаимодействия с другим человеком; исход отношений он не предсказывает.',
      },
      en: {
        title: 'Seventh house',
        summary: 'The seventh house is associated with partnership, contracts, and one-to-one relationships.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes close and business partnerships, marriage, contractual relationships, and situations that require an equal counterpart.'] },
          { title: 'How to read it', paragraphs: ['The seventh house begins at the Descendant. Its sign, planets, and aspects describe relationship demands but do not guarantee an outcome.'] },
        ],
        shortAnswer: 'The seventh house is about partnership, contracts, and direct interaction with another person.',
      },
    },
  },
  {
    id: 'house-8',
    house: 8,
    aliases: { ru: ['восьмой дом', '8 дом'], en: ['eighth house', '8th house', 'house 8'] },
    keywords: { ru: ['общие деньги', 'долги', 'наследство', 'близость'], en: ['shared money', 'debts', 'inheritance', 'intimacy'] },
    copy: {
      ru: {
        title: 'Восьмой дом',
        summary: 'Восьмой дом — одна из двенадцати частей круга натальной карты. По нему рассматривают общие деньги, финансовые обязательства, наследство, близость и потери.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К восьмому дому относят совместные деньги, долги, налоги, наследство и доверие в близких отношениях. Общая тема этих вопросов состоит в том, что человек зависит от чужих решений, общих условий или передачи имущества.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается восьмой дом, планеты внутри него и их аспекты с другими планетами уточняют отношение к общим обязательствам и переменам условий. Этот дом не предсказывает смерть, катастрофу или обязательную беду.'] },
        ],
        shortAnswer: 'Восьмой дом используют для чтения общих денег, долгов, наследства, доверия и других вопросов, где решения зависят не от одного человека.',
      },
      en: {
        title: 'Eighth house',
        summary: 'The eighth house is associated with shared means, obligations, intimacy, and major change.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes shared money, debt, taxes, inheritance, trust in close relationships, and situations that cannot be handled entirely alone.'] },
          { title: 'How to read it', paragraphs: ['The eighth house does not predict death or disaster. It describes dealings with shared obligations, loss, and changing conditions.'] },
        ],
        shortAnswer: 'The eighth house is about shared means, trust, obligations, and major change.',
      },
    },
  },
  {
    id: 'house-9',
    house: 9,
    aliases: { ru: ['девятый дом', '9 дом'], en: ['ninth house', '9th house', 'house 9'] },
    keywords: { ru: ['высшее образование', 'путешествия', 'мировоззрение', 'публикации'], en: ['higher education', 'travel', 'worldview', 'publishing'] },
    copy: {
      ru: {
        title: 'Девятый дом',
        summary: 'Девятый дом — одна из двенадцати частей круга натальной карты. По нему рассматривают мировоззрение, высшее образование, дальние поездки и распространение знаний.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К девятому дому относят университетское образование, знакомство с другими странами и культурами, право, религию, издательское дело и поиск общей системы взглядов. Это не только путешествия, а вопросы, которые расширяют картину мира.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается девятый дом, описывает способ искать объяснения и проверять убеждения. Планеты внутри дома и их аспекты с другими планетами добавляют детали к вопросам обучения, поездок и публикаций.'] },
        ],
        shortAnswer: 'Девятый дом используют для чтения мировоззрения, высшего образования, дальних поездок и способов передавать знания широкой аудитории.',
      },
      en: {
        title: 'Ninth house',
        summary: 'The ninth house is associated with worldview, higher education, long journeys, and publishing.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes learning that changes the larger view, encounters with other cultures, law, religion, and the distribution of ideas.'] },
          { title: 'How to read it', paragraphs: ['The sign and planets in the ninth house refine how a person looks for explanations, examines beliefs, and shares knowledge with a wider audience.'] },
        ],
        shortAnswer: 'The ninth house is about worldview, distant horizons, and structured learning.',
      },
    },
  },
  {
    id: 'house-10',
    house: 10,
    aliases: { ru: ['десятый дом', '10 дом'], en: ['tenth house', '10th house', 'house 10'] },
    keywords: { ru: ['карьера', 'общественная роль', 'репутация', 'ответственность'], en: ['career', 'public role', 'reputation', 'responsibility'] },
    copy: {
      ru: {
        title: 'Десятый дом',
        summary: 'Десятый дом — одна из двенадцати частей круга натальной карты. По нему рассматривают общественную роль, карьерное направление, репутацию и видимую ответственность.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К десятому дому относят долгие профессиональные цели, отношения с руководством и общественными правилами, репутацию и результаты, которые видят другие люди. Он говорит о направлении публичной деятельности, а не назначает конкретную должность.'] },
          { title: 'Что уточняет положение', paragraphs: ['Десятый дом начинается с Середины неба, или MC, верхней точки карты. Знак зодиака на этой границе, планеты внутри дома и их аспекты с другими планетами уточняют чтение карьеры и общественной роли, но не определяют единственную профессию.'] },
        ],
        shortAnswer: 'Десятый дом используют для чтения общественной роли, карьерного направления, репутации и ответственности; конкретную профессию он не назначает.',
      },
      en: {
        title: 'Tenth house',
        summary: 'The tenth house is associated with public role, career direction, and visible responsibility.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes long-term professional aims, relationships with rules and authority, reputation, and results visible to other people.'] },
          { title: 'How to read it', paragraphs: ['The tenth house begins at the MC. Its sign and planets refine an approach to public life but do not assign a single profession.'] },
        ],
        shortAnswer: 'The tenth house is about public role, career, reputation, and responsibility.',
      },
    },
  },
  {
    id: 'house-11',
    house: 11,
    aliases: { ru: ['одиннадцатый дом', '11 дом'], en: ['eleventh house', '11th house', 'house 11'] },
    keywords: { ru: ['друзья', 'группы', 'сообщество', 'общие планы'], en: ['friends', 'groups', 'community', 'shared plans'] },
    copy: {
      ru: {
        title: 'Одиннадцатый дом',
        summary: 'Одиннадцатый дом — одна из двенадцати частей круга натальной карты. По нему рассматривают друзей, группы, сообщества и цели, которые требуют совместной работы.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К одиннадцатому дому относят дружеские связи, участие в коллективах, профессиональные сообщества и общие планы. Речь идёт не о любых знакомых, а о людях, с которыми объединяют интересы или долгие цели.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается одиннадцатый дом, описывает способ входить в группу и выбирать круг общения. Планеты внутри дома и их аспекты с другими планетами добавляют детали к вопросам дружбы и совместной работы.'] },
        ],
        shortAnswer: 'Одиннадцатый дом используют для чтения дружеских связей, участия в сообществах и целей, которые люди создают вместе.',
      },
      en: {
        title: 'Eleventh house',
        summary: 'The eleventh house is associated with friends, groups, communities, and shared plans.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It describes participation in a collective, friendships, professional networks, and goals that require cooperation among many people.'] },
          { title: 'How to read it', paragraphs: ['The sign and planets in the eleventh house refine how a person chooses a social circle and takes part in shared work.'] },
        ],
        shortAnswer: 'The eleventh house is about friends, communities, and goals built together.',
      },
    },
  },
  {
    id: 'house-12',
    house: 12,
    aliases: { ru: ['двенадцатый дом', '12 дом'], en: ['twelfth house', '12th house', 'house 12'] },
    keywords: { ru: ['уединение', 'закрытые места', 'завершение', 'дела за кулисами'], en: ['solitude', 'closed institutions', 'closure', 'behind the scenes'] },
    copy: {
      ru: {
        title: 'Двенадцатый дом',
        summary: 'Двенадцатый дом — одна из двенадцати частей круга натальной карты. По нему рассматривают уединение, завершение дел, закрытые учреждения и работу вне публичного внимания.',
        sections: [
          { title: 'Какие вопросы к нему относят', paragraphs: ['К двенадцатому дому относят добровольное уединение, вынужденную изоляцию, больницы и другие закрытые учреждения, непубличную работу и завершение затянувшихся дел. Эти темы рассматривают отдельно и не сводят к одному значению.'] },
          { title: 'Что уточняет положение', paragraphs: ['Знак зодиака, в котором начинается двенадцатый дом, планеты внутри него и их аспекты с другими планетами уточняют отношение к тишине, ограничениям и делам без публичного признания. Этот дом не означает неизбежные тайны, одиночество или несчастье.'] },
        ],
        shortAnswer: 'Двенадцатый дом используют для чтения уединения, завершения дел, закрытых учреждений и работы вне публичного внимания; несчастье он не предсказывает.',
      },
      en: {
        title: 'Twelfth house',
        summary: 'The twelfth house is associated with solitude, closure, institutions, and work outside public attention.',
        sections: [
          { title: 'What this house covers', paragraphs: ['It includes the need to step away from outside noise, work behind the scenes, periods of isolation, and what ends before a new cycle.'] },
          { title: 'How to read it', paragraphs: ['This house does not mean inevitable secrets or misfortune. Its sign and planets refine an approach to quiet, limits, and non-public work.'] },
        ],
        shortAnswer: 'The twelfth house is about solitude, closure, and what happens outside public attention.',
      },
    },
  },
] as const satisfies readonly HouseDefinition[];

const INDIVIDUAL_HOUSE_TOPICS: readonly KnowledgeTopicSource[] = HOUSE_DEFINITIONS.map((definition) => ({
  id: definition.id,
  category: 'houses',
  aliases: definition.aliases,
  keywords: definition.keywords,
  copy: definition.copy,
  relatedTopicIds: ['houses-overview', 'sign-vs-house', 'birth-time-and-houses'],
}));

export const HOUSE_TOPICS = [
  {
    id: 'houses-overview',
    category: 'houses',
    aliases: {
      ru: ['дома натальной карты', 'астрологические дома', 'что такое дома'],
      en: ['natal houses', 'astrological houses', 'what houses mean'],
    },
    keywords: {
      ru: ['двенадцать домов', 'области жизни', 'куспиды'],
      en: ['twelve houses', 'areas of life', 'cusps'],
    },
    copy: {
      ru: {
        title: 'Что такое дома',
        summary: 'Дома — двенадцать секторов астрологической карты, построенных относительно конкретного места и времени. Они образуют отдельную сетку поверх зодиакального круга и не являются небесными телами.',
        sections: [
          { title: 'Что такое сектор карты', kind: 'definition', paragraphs: ['Представьте круг, разделённый двенадцатью границами. Каждый участок между двумя границами — дом. Начальную границу называют куспидом. Номер дома показывает его место в порядке от первого до двенадцатого.'] },
          { title: 'Почему домов двенадцать', kind: 'history', paragraphs: ['Двенадцать домов — правило сложившейся астрологической традиции. Их не находят телескопом и не выводят из двенадцати знаков простым наложением: это отдельное деление карты с собственной историей и методами расчёта.'] },
          { title: 'Почему нужны время и место', kind: 'mechanism', paragraphs: ['Сетка домов опирается на местный горизонт и суточное вращение Земли. Один и тот же момент выглядит по-разному из Москвы и Владивостока, а через несколько минут границы уже сдвигаются. Поэтому без времени и места дома нельзя вычислить надёжно.'] },
          { title: 'Почему системы домов отличаются', kind: 'calculation', paragraphs: ['Плацидус делит суточное движение точек неба по времени, целые знаки назначают первым домом весь знак Асцендента, равнодомная система строит двенадцать равных секторов. Из-за разных правил куспиды и дома некоторых планет могут не совпасть.'] },
          { title: 'Зачем дома используют в астрологии', kind: 'astrology', paragraphs: ['Планету читают как функцию, знак — как способ её выражения, а дом — как группу вопросов, где эта функция рассматривается. Первый дом связывают с началом действия и самопроявлением, седьмой — с отношениями один на один, десятый — с публичной ролью и направлением деятельности.'] },
          { title: 'Часто путают', kind: 'confusion', paragraphs: ['Первый дом не равен Овну, второй — Тельцу и так далее. Знаки всегда занимают равные участки зодиака, а дома зависят от времени, места и выбранной системы. Куспид — граница дома, а не «смесь» двух соседних домов.'] },
        ],
        shortAnswer: 'Дома — расчётные сектора карты. Они отвечают на вопрос «в какой области» астрологи читают планету, и для них нужны время, место и выбранная система домов.',
      },
      en: {
        title: 'What houses show',
        summary: 'The twelve houses divide a chart into areas of life calculated for a specific time and place.',
        sections: [
          { title: 'A house answers “where”', paragraphs: ['A planet describes a function, a sign its manner, and a house the area of life where that factor is especially relevant in chart reading.'] },
          { title: 'Houses depend on input', paragraphs: ['The house grid is calculated from birth time and place. When time is unknown, it cannot be used as a precise personal part of the chart.'] },
        ],
        shortAnswer: 'Houses describe areas of life and require a reliable birth time.',
      },
    },
    relatedTopicIds: ['house-cusp', 'house-systems', 'birth-time-and-houses', 'ascendant', 'sign-vs-house', 'house-1'],
    diagram: 'houses',
    sourceIds: ['swiss-ephemeris-houses'],
  },
  {
    id: 'sign-vs-house',
    category: 'houses',
    aliases: {
      ru: ['знак или дом', 'разница знака и дома', 'знаки и дома'],
      en: ['sign or house', 'sign versus house', 'signs and houses'],
    },
    keywords: {
      ru: ['как и где', 'планета в знаке', 'планета в доме'],
      en: ['how and where', 'planet in sign', 'planet in house'],
    },
    copy: {
      ru: {
        title: 'Чем знак отличается от дома',
        summary: 'Знак — один из двенадцати участков зодиака, а дом — одна из двенадцати частей круга натальной карты. Знак описывает, как выражается значение планеты, а дом указывает на связанные с ним жизненные вопросы.',
        sections: [
          { title: 'Как это работает на примере', paragraphs: ['Марс в астрологии связывают с действием. Знак Марса описывает манеру действовать, а дом показывает, в каких жизненных вопросах это действие рассматривают. Для вывода нужны оба слоя, но они отвечают на разные вопросы.'] },
          { title: 'Почему их нельзя приравнивать', paragraphs: ['Первый дом не равен Овну, второй дом не равен Тельцу и так далее. Зодиак заранее разделён на двенадцать равных знаков, а дома строятся по местному горизонту для времени и места рождения.'] },
        ],
        shortAnswer: 'Знак зодиака описывает, как выражается значение планеты, а дом указывает, с какими жизненными вопросами его связывают при чтении карты.',
      },
      en: {
        title: 'How a sign differs from a house',
        summary: 'A sign describes a manner of action, while a house describes an area of life.',
        sections: [
          { title: 'Two different layers', paragraphs: ['Mars, for example, is associated with action. Its sign refines the manner of action, while its house identifies the area where that topic matters most.'] },
          { title: 'Do not substitute one for the other', paragraphs: ['The first house is not the same as Aries, the second is not Taurus, and so on. Houses and signs have separate meanings and different calculation bases.'] },
        ],
        shortAnswer: 'A sign answers “how”; a house answers “in which area of life”.',
      },
    },
    relatedTopicIds: ['houses-overview', 'planet-in-sign', 'how-to-read-natal-chart'],
  },
  {
    id: 'birth-time-and-houses',
    category: 'houses',
    aliases: {
      ru: ['время рождения и дома', 'дома без времени', 'точность домов'],
      en: ['birth time and houses', 'houses without birth time', 'house accuracy'],
    },
    keywords: {
      ru: ['точное время', 'место рождения', 'куспиды', 'неизвестное время'],
      en: ['exact time', 'birth place', 'cusps', 'unknown time'],
    },
    copy: {
      ru: {
        title: 'Почему домам нужно точное время',
        summary: 'Сетка домов — деление круга натальной карты на двенадцать частей. Её строят от местного горизонта, поэтому для расчёта нужны время и место рождения.',
        sections: [
          { title: 'Как возникает сетка домов', paragraphs: ['Время и географические координаты задают местный горизонт и углы карты. От них рассчитывают границы домов, а затем определяют, в какой дом попадает каждая планета. Даже небольшая ошибка во времени может сдвинуть эти границы.'] },
          { title: 'Если время неизвестно', paragraphs: ['Случайную или условно выбранную сетку нельзя выдавать за личный расчёт. Без надёжного времени остаются доступными положения планет в знаках и аспекты между планетами, а дома в таком чтении не используют.'] },
        ],
        shortAnswer: 'Дома зависят от местного горизонта, поэтому без надёжного времени и места рождения их нельзя считать точной личной частью карты.',
      },
      en: {
        title: 'Why houses need an accurate time',
        summary: 'Houses are built from the local horizon, so they depend on birth time and place.',
        sections: [
          { title: 'How the grid is built', paragraphs: ['Time and geographic coordinates determine chart angles and house cusps. Those boundaries place planets into the twelve houses.'] },
          { title: 'When time is unknown', paragraphs: ['A random house grid should not be presented as personal. It is better to read reliable planetary positions and aspects without houses.'] },
        ],
        shortAnswer: 'Without an accurate birth time, houses cannot be treated as a reliable personal part of the chart.',
      },
    },
    relatedTopicIds: ['houses-overview', 'birth-time-in-chart', 'unknown-birth-time'],
  },
  ...INDIVIDUAL_HOUSE_TOPICS,
] satisfies readonly KnowledgeTopicSource[];
