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
        summary: 'Первый дом связан с началом действия, внешней манерой и первым впечатлением.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Он описывает, как человек начинает действовать, представляет себя и реагирует на новую обстановку.'] },
          { title: 'Как читать', paragraphs: ['Начало первого дома — Асцендент. Его знак, планеты в доме и аспекты к Асценденту читают вместе.'] },
        ],
        shortAnswer: 'Первый дом — о способе начинать, заявлять о себе и встречать внешнюю ситуацию.',
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
        summary: 'Второй дом связан с личными средствами, имуществом и тем, что человек умеет сохранять.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Здесь рассматривают отношение к деньгам и вещам, способы поддерживать материальную устойчивость и навыки, которые имеют практическую ценность.'] },
          { title: 'Как читать', paragraphs: ['Второй дом не обещает конкретный доход. Он описывает привычный подход к личным средствам вместе со знаком, планетами и аспектами.'] },
        ],
        shortAnswer: 'Второй дом — о личных средствах, имуществе и практических навыках.',
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
        summary: 'Третий дом связан с повседневным общением, обучением и ближайшим окружением.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Он включает речь и обмен сведениями, короткие поездки, базовое обучение, соседей, братьев и сестёр.'] },
          { title: 'Как читать', paragraphs: ['Знак и планеты в третьем доме уточняют, как человек задаёт вопросы, передаёт сведения и ориентируется в знакомой среде.'] },
        ],
        shortAnswer: 'Третий дом — о повседневной информации, обучении и близком окружении.',
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
        summary: 'Четвёртый дом связан с домом, семьёй, происхождением и частной частью жизни.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Здесь рассматривают домашнюю среду, семейную историю, связь с местом происхождения и то, что человек предпочитает не выносить на публику.'] },
          { title: 'Как читать', paragraphs: ['Начало четвёртого дома связано с IC. Его знак и планеты помогают уточнить устройство личного пространства и семейных связей.'] },
        ],
        shortAnswer: 'Четвёртый дом — о доме, происхождении, семье и частной жизни.',
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
        summary: 'Пятый дом связан с творчеством, игрой, романтическим интересом и детьми.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Он описывает занятия, в которых человек создаёт что-то от себя, получает удовольствие от процесса и допускает свободное выражение.'] },
          { title: 'Как читать', paragraphs: ['Планеты и знак пятого дома уточняют форму творчества и отношение к игре, вниманию, романтике и теме детей.'] },
        ],
        shortAnswer: 'Пятый дом — о творчестве, игре, романтическом интересе и собственных идеях.',
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
        summary: 'Шестой дом связан с распорядком, повседневной работой, обязанностями и заботой о теле.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Здесь рассматривают повторяющиеся дела, рабочие навыки, распределение обязанностей и привычки, связанные с самочувствием.'] },
          { title: 'Как читать', paragraphs: ['Этот дом не заменяет медицинскую оценку. В карте он описывает организацию повседневных задач и ухода за собой.'] },
        ],
        shortAnswer: 'Шестой дом — о распорядке, работе, обязанностях и повседневной заботе о теле.',
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
        summary: 'Седьмой дом связан с партнёрством, договорами и отношениями один на один.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Он включает близкие и деловые союзы, брак, договоры и ситуации, в которых у обеих сторон есть свои интересы.'] },
          { title: 'Как читать', paragraphs: ['Начало седьмого дома — Десцендент. Знак, планеты и аспекты описывают требования к взаимодействию, но не гарантируют исход отношений.'] },
        ],
        shortAnswer: 'Седьмой дом — о партнёрстве, договорах и прямом взаимодействии с другим человеком.',
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
        summary: 'Восьмой дом связан с общими средствами, обязательствами, близостью и серьёзными переменами.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Здесь рассматривают совместные деньги, долги, налоги, наследство, доверие в близких отношениях и ситуации, где нельзя действовать только в одиночку.'] },
          { title: 'Как читать', paragraphs: ['Восьмой дом не предсказывает смерть или беду. Он описывает обращение с общими обязательствами, потерями и изменениями условий.'] },
        ],
        shortAnswer: 'Восьмой дом — об общих средствах, доверии, обязательствах и серьёзных изменениях.',
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
        summary: 'Девятый дом связан с мировоззрением, высшим образованием, дальними поездками и публикациями.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Он включает обучение, которое меняет общую картину мира, знакомство с другими культурами, право, религию и распространение идей.'] },
          { title: 'Как читать', paragraphs: ['Знак и планеты девятого дома уточняют способ искать объяснение, проверять убеждения и передавать знания широкой аудитории.'] },
        ],
        shortAnswer: 'Девятый дом — о мировоззрении, дальнем горизонте и системном обучении.',
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
        summary: 'Десятый дом связан с общественной ролью, карьерным направлением и видимой ответственностью.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Здесь рассматривают долгие профессиональные цели, отношения с правилами и руководством, репутацию и результаты, заметные другим людям.'] },
          { title: 'Как читать', paragraphs: ['Начало десятого дома связано с MC. Его знак и планеты уточняют подход к общественной роли, но не назначают единственную профессию.'] },
        ],
        shortAnswer: 'Десятый дом — об общественной роли, карьере, репутации и ответственности.',
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
        summary: 'Одиннадцатый дом связан с друзьями, группами, сообществами и общими планами.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Он описывает участие в коллективе, дружеские связи, профессиональные сети и цели, которые требуют сотрудничества многих людей.'] },
          { title: 'Как читать', paragraphs: ['Знак и планеты одиннадцатого дома уточняют способ выбирать круг общения и занимать место в общей работе.'] },
        ],
        shortAnswer: 'Одиннадцатый дом — о друзьях, сообществах и целях, которые создаются вместе.',
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
        summary: 'Двенадцатый дом связан с уединением, завершением, закрытыми местами и делами вне публичного внимания.',
        sections: [
          { title: 'О чём этот дом', paragraphs: ['Здесь рассматривают уединение, работу за кулисами, периоды изоляции и завершение дел.'] },
          { title: 'Как читать', paragraphs: ['Этот дом не означает неизбежные тайны или несчастья. Его знак и планеты уточняют отношение к тишине, ограничениям и непубличной работе.'] },
        ],
        shortAnswer: 'Двенадцатый дом — об уединении, завершении и том, что происходит вне публичного внимания.',
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
        title: 'Что показывают дома',
        summary: 'Двенадцать домов делят карту на области жизни, рассчитанные для конкретного времени и места.',
        sections: [
          { title: 'Дом отвечает на вопрос «где»', paragraphs: ['Планета показывает, о чём идёт речь, знак — каким способом, а дом — в какой области жизни это особенно заметно при чтении карты.'] },
          { title: 'Дома зависят от исходных данных', paragraphs: ['Сетка домов строится по времени и месту рождения. При неизвестном времени её нельзя использовать как точную личную часть карты.'] },
        ],
        shortAnswer: 'Дома показывают области жизни и требуют надёжного времени рождения.',
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
    relatedTopicIds: ['sign-vs-house', 'birth-time-and-houses', 'house-1'],
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
        summary: 'Знак описывает способ действия, а дом — область жизни.',
        sections: [
          { title: 'Два разных слоя', paragraphs: ['Марс, например, связан с действием. Его знак уточняет манеру действия, а дом — круг задач, где эта тема чаще становится важной.'] },
          { title: 'Не подменяйте одно другим', paragraphs: ['Первый дом не равен Овну, второй — Тельцу и так далее. У домов и знаков есть отдельные значения и разные основания расчёта.'] },
        ],
        shortAnswer: 'Знак отвечает на вопрос «как», дом — на вопрос «в какой области жизни».',
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
        summary: 'Дома строятся от местного горизонта, поэтому зависят от времени и места рождения.',
        sections: [
          { title: 'Как строится сетка', paragraphs: ['Время и географические координаты определяют углы карты и границы домов. По этим границам планеты распределяются по двенадцати домам.'] },
          { title: 'Если время неизвестно', paragraphs: ['Нельзя выбирать случайную сетку и выдавать её за личную. В таком случае лучше читать надёжные положения планет и аспекты без домов.'] },
        ],
        shortAnswer: 'Без точного времени дома нельзя считать надёжной личной частью карты.',
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
