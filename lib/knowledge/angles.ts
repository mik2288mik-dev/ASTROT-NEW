import type { KnowledgeTopicSource } from './types';

export const ANGLE_TOPICS = [
  {
    id: 'angles-overview',
    category: 'angles',
    aliases: {
      ru: ['углы карты', 'оси натальной карты', 'главные точки карты'],
      en: ['chart angles', 'natal chart axes', 'cardinal points'],
    },
    keywords: {
      ru: ['асцендент', 'десцендент', 'середина неба', 'основание неба', 'время рождения'],
      en: ['ascendant', 'descendant', 'midheaven', 'imum coeli', 'birth time'],
    },
    copy: {
      ru: {
        title: 'Углы натальной карты',
        summary: 'Углы натальной карты — четыре точки круга карты, положение которых задают местный горизонт и меридиан, воображаемая линия через небо с севера на юг. Их обозначают ASC, DSC, MC и IC и рассчитывают по времени и месту рождения.',
        sections: [
          {
            title: 'Как возникают четыре точки',
            paragraphs: [
              'ASC и DSC образуются там, где круг карты пересекает восточную и западную стороны местного горизонта. MC и IC образуются на верхнем и нижнем пересечениях круга карты с местным меридианом. В астрологии эти пары называют осями и связывают с первым впечатлением, отношениями один на один, публичной ролью и частной жизнью.',
            ],
          },
          {
            title: 'Почему нужно точное время',
            paragraphs: [
              'Из-за вращения Земли положение горизонта относительно круга карты постоянно меняется. Вместе с ним меняются точное место точки на круге, её знак зодиака и аспекты с другими точками. Без точного времени рождения эти данные нельзя определить надёжно.',
            ],
          },
        ],
        shortAnswer: 'Углы карты — это Асцендент, Десцендент, Середина неба и Основание неба; их рассчитывают из положения местного горизонта и меридиана по точным времени и месту рождения.',
      },
      en: {
        title: 'Natal chart angles',
        summary: 'ASC, DSC, MC, and IC mark the chart’s four cardinal points and depend on an exact birth time and place.',
        sections: [
          {
            title: 'What chart angles are',
            paragraphs: [
              'The angles mark the eastern, western, upper, and lower points of a natal chart. ASC and DSC form one axis, while MC and IC form another. They help describe first impressions, one-to-one relationships, public direction, and private foundations.',
            ],
          },
          {
            title: 'Why precision matters',
            paragraphs: [
              'Earth’s rotation moves the angles quickly through degrees and sometimes into another sign. Without an exact birth time, they cannot be identified with confidence. It is more accurate to omit them than to present an estimated angle as certain.',
            ],
          },
        ],
        shortAnswer: 'The angles describe four key directions in a chart, but they are reliable only when the birth time is exact.',
      },
    },
    relatedTopicIds: ['ascendant', 'descendant', 'midheaven', 'imum-coeli'],
  },
  {
    id: 'ascendant',
    category: 'angles',
    aliases: {
      ru: ['асцендент', 'asc', 'восходящий знак'],
      en: ['ascendant', 'asc', 'rising sign'],
    },
    keywords: {
      ru: ['первое впечатление', 'манера входить в ситуацию', 'внешняя подача', 'точное время'],
      en: ['first impression', 'approach', 'presentation', 'exact birth time'],
    },
    copy: {
      ru: {
        title: 'Асцендент (ASC)',
        summary: 'Асцендент (ASC) — точка круга натальной карты, которая поднималась над восточным горизонтом в момент рождения. В астрологии её связывают с первой заметной реакцией и поведением в новой обстановке.',
        sections: [
          {
            title: 'Что читают по Асценденту',
            paragraphs: [
              'Асцендент служит началом первого дома, одной из двенадцати частей круга карты. Знак Асцендента, то есть участок зодиака, в котором находится точка, используют, чтобы обсуждать, как человек входит в незнакомую ситуацию, показывает себя и производит первое впечатление. Это не портрет всей личности.',
            ],
          },
          {
            title: 'Почему нужно точное время',
            paragraphs: [
              'Из-за вращения Земли точка восточного горизонта быстро перемещается по кругу карты. Поэтому её точное место, знак и аспекты с другими точками зависят от времени и места рождения. Для расчёта нужно точное время рождения. При приблизительном времени знак можно считать надёжным только после проверки всего указанного промежутка.',
            ],
          },
        ],
        shortAnswer: 'Асцендент — точка восточного горизонта в момент рождения; в астрологии её связывают с первой реакцией и поведением в новой обстановке.',
      },
      en: {
        title: 'Ascendant (ASC)',
        summary: 'The Ascendant describes a familiar way of entering a new situation and what other people tend to notice first.',
        sections: [
          {
            title: 'How to read it',
            paragraphs: [
              'ASC is the eastern horizon of the chart. Its sign helps describe the pace of an initial response, outward presentation, and how someone approaches unfamiliar surroundings. It is neither a mask nor a replacement for the whole personality.',
            ],
          },
          {
            title: 'Dependence on birth time',
            paragraphs: [
              'The Ascendant changes noticeably during the day. Its sign and degree require an exact birth time. With an approximate time, a sign is dependable only when the calculation shows that it stays unchanged across the full stated interval.',
            ],
          },
        ],
        shortAnswer: 'ASC describes first responses and outward presentation, not the whole person.',
      },
    },
    relatedTopicIds: ['angles-overview', 'descendant', 'same-sign-different-people'],
  },
  {
    id: 'descendant',
    category: 'angles',
    aliases: {
      ru: ['десцендент', 'dsc', 'заходящий знак'],
      en: ['descendant', 'dsc', 'setting sign'],
    },
    keywords: {
      ru: ['отношения один на один', 'партнёрство', 'договорённости', 'точное время'],
      en: ['one-to-one relationships', 'partnership', 'agreements', 'exact birth time'],
    },
    copy: {
      ru: {
        title: 'Десцендент (DSC)',
        summary: 'Десцендент (DSC) — точка круга натальной карты, которая заходила за западный горизонт в момент рождения. В астрологии её связывают с партнёрством и отношениями один на один.',
        sections: [
          {
            title: 'Что читают по Десценденту',
            paragraphs: [
              'Десцендент находится точно напротив Асцендента и служит началом седьмого дома, одной из двенадцати частей круга карты. Знак Десцендента, то есть участок зодиака, в котором находится точка, используют, чтобы обсуждать прямое взаимодействие с другим человеком и ожидания от равного партнёрства. Он не задаёт готовый тип идеального партнёра.',
            ],
          },
          {
            title: 'Почему нужно точное время',
            paragraphs: [
              'Положение западного горизонта меняется из-за вращения Земли. Поэтому точное место, знак и аспекты Десцендента с другими точками зависят от времени и места рождения. Без точного времени их нельзя назвать надёжно.',
            ],
          },
        ],
        shortAnswer: 'Десцендент — точка западного горизонта в момент рождения; в астрологии её связывают с партнёрством и прямым взаимодействием с другим человеком.',
      },
      en: {
        title: 'Descendant (DSC)',
        summary: 'The Descendant concerns close interaction, partnership, and qualities that become especially noticeable in another person.',
        sections: [
          {
            title: 'The relationship axis',
            paragraphs: [
              'DSC sits opposite the Ascendant on the western horizon of the chart. Its sign helps describe how someone enters agreements and what they notice in one-to-one interaction. It does not define a fixed ideal-partner type.',
            ],
          },
          {
            title: 'What the calculation requires',
            paragraphs: [
              'DSC is directly linked to the Ascendant and is equally sensitive to birth time. Without an exact time, its sign, degree, and related aspects cannot be stated with confidence.',
            ],
          },
        ],
        shortAnswer: 'DSC helps describe close interaction, but it does not prescribe whom someone should choose.',
      },
    },
    relatedTopicIds: ['angles-overview', 'ascendant', 'compatibility-not-fate'],
  },
  {
    id: 'midheaven',
    category: 'angles',
    aliases: {
      ru: ['середина неба', 'mc', 'медиум цели'],
      en: ['midheaven', 'mc', 'medium coeli'],
    },
    keywords: {
      ru: ['публичная роль', 'направление карьеры', 'репутация', 'точное время'],
      en: ['public role', 'career direction', 'reputation', 'exact birth time'],
    },
    copy: {
      ru: {
        title: 'Середина неба (MC)',
        summary: 'Середина неба (MC) — верхняя точка круга натальной карты на местном меридиане, воображаемой линии через небо с севера на юг. В астрологии её связывают с общественной ролью, карьерным направлением и репутацией.',
        sections: [
          {
            title: 'Что читают по MC',
            paragraphs: [
              'Верхнее пересечение местного меридиана с кругом карты образует MC. Эту точку используют, чтобы обсуждать публичную позицию, долгие профессиональные цели и то, за что человека знают вне близкого круга. Одно положение MC не определяет профессию.',
            ],
          },
          {
            title: 'Почему нужно точное время',
            paragraphs: [
              'Положение местного меридиана относительно круга карты зависит от времени и места наблюдения. Ошибка во времени может изменить точное место, знак и аспекты MC с другими точками. Если время рождения неизвестно, эту точку не используют как надёжную личную часть карты.',
            ],
          },
        ],
        shortAnswer: 'Середина неба, или MC, — верхняя точка карты, которую связывают с общественной ролью, карьерным направлением и репутацией; профессию она не назначает.',
      },
      en: {
        title: 'Midheaven (MC)',
        summary: 'MC describes public direction, a visible role, and what someone may become known for beyond their close circle.',
        sections: [
          {
            title: 'More than a career label',
            paragraphs: [
              'MC is often linked with work, but its meaning is broader. As the upper point of the chart, it concerns public position, reputation, and the direction in which someone wants to be recognized. One MC placement cannot select a specific profession.',
            ],
          },
          {
            title: 'Why the exact hour matters',
            paragraphs: [
              'The sign and degree of MC depend on birth time and place. A time error can change the point and its aspects. When birth time is unknown, MC-based conclusions should be omitted.',
            ],
          },
        ],
        shortAnswer: 'MC concerns public role and direction, but it does not name one correct profession.',
      },
    },
    relatedTopicIds: ['angles-overview', 'imum-coeli', 'no-single-indicator'],
  },
  {
    id: 'imum-coeli',
    category: 'angles',
    aliases: {
      ru: ['основание неба', 'ic', 'имум цели'],
      en: ['imum coeli', 'ic', 'nadir'],
    },
    keywords: {
      ru: ['дом', 'частная жизнь', 'семейная среда', 'точное время'],
      en: ['home', 'private life', 'family background', 'exact birth time'],
    },
    copy: {
      ru: {
        title: 'Основание неба (IC)',
        summary: 'Основание неба (IC) — нижняя точка круга натальной карты на местном меридиане, воображаемой линии через небо с севера на юг. В астрологии её связывают с домом, семейной средой и частной жизнью.',
        sections: [
          {
            title: 'Что читают по IC',
            paragraphs: [
              'IC находится точно напротив Середины неба и служит началом четвёртого дома, одной из двенадцати частей круга карты. Знак IC, то есть участок зодиака, в котором находится точка, используют, чтобы обсуждать личное пространство, отношение к дому и семейной среде. Эта точка не восстанавливает биографию семьи.',
            ],
          },
          {
            title: 'Почему нужно точное время',
            paragraphs: [
              'Положение нижнего пересечения местного меридиана с кругом карты зависит от времени и места рождения. Вместе с MC меняются точное место, знак и аспекты IC с другими точками. Если время неизвестно, эти данные нельзя считать надёжной личной частью карты.',
            ],
          },
        ],
        shortAnswer: 'Основание неба, или IC, — нижняя точка карты, которую связывают с домом, семейной средой и частной жизнью; семейную историю она не восстанавливает.',
      },
      en: {
        title: 'Imum Coeli (IC)',
        summary: 'IC concerns private life, home, and what someone regards as a personal foundation.',
        sections: [
          {
            title: 'The lower point of the chart',
            paragraphs: [
              'IC sits opposite MC. Its sign helps describe personal space, attitudes toward home, and family background. It is not a detailed family biography or a claim about specific childhood events.',
            ],
          },
          {
            title: 'Sensitivity to birth time',
            paragraphs: [
              'IC moves together with MC and requires an exact birth time. If the time is unknown, its sign and aspects cannot be treated as reliable chart data.',
            ],
          },
        ],
        shortAnswer: 'IC helps describe home and private life, but it cannot reconstruct a family history.',
      },
    },
    relatedTopicIds: ['angles-overview', 'midheaven', 'planet-in-house'],
  },
] satisfies readonly KnowledgeTopicSource[];
