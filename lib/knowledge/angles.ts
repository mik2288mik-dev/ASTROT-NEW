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
        summary: 'ASC, DSC, MC и IC задают четыре главные точки карты и зависят от точного времени и места рождения.',
        sections: [
          {
            title: 'Что называют углами',
            paragraphs: [
              'Углы отмечают восток, запад, верх и низ натальной карты. ASC и DSC образуют одну ось, MC и IC — другую. Эти точки используют при чтении первого впечатления, отношений один на один, публичной роли, дома и частной жизни.',
            ],
          },
          {
            title: 'Почему важна точность',
            paragraphs: [
              'Земля вращается, поэтому углы быстро меняют градус и иногда знак. Без точного времени рождения их нельзя определять уверенно. При неизвестном времени честнее не показывать углы, чем выдавать условный расчёт за точный.',
            ],
          },
        ],
        shortAnswer: 'Углы описывают четыре ключевых направления карты, но надёжно рассчитываются только по точному времени рождения.',
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
        summary: 'Асцендент описывает привычную манеру входить в новую ситуацию и то, что окружающие замечают сначала.',
        sections: [
          {
            title: 'Как его читать',
            paragraphs: [
              'Асцендент — точка зодиака, которая восходила над восточным горизонтом в момент рождения. Его знак связывают с первой реакцией, внешней подачей и поведением в новой обстановке. Это не маска и не описание всей личности.',
            ],
          },
          {
            title: 'Зависимость от времени',
            paragraphs: [
              'Асцендент заметно меняется в течение суток. Для его знака и градуса нужно точное время рождения. При приблизительном времени вывод допустим только тогда, когда расчёт показывает, что знак остаётся тем же во всём указанном промежутке.',
            ],
          },
        ],
        shortAnswer: 'ASC говорит о первой реакции и внешней подаче, но не описывает человека целиком.',
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
    personalizationKind: { type: 'angle', key: 'ascendant' },
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
        summary: 'Десцендент относится к близкому взаимодействию, партнёрству и качествам, которые особенно заметны в другом человеке.',
        sections: [
          {
            title: 'Ось отношений',
            paragraphs: [
              'DSC находится напротив Асцендента, у западного горизонта карты. Его знак связывают с тем, как человек строит отношения один на один и чего ждёт от партнёра. Он не описывает готовый тип идеального партнёра.',
            ],
          },
          {
            title: 'Что требуется для расчёта',
            paragraphs: [
              'Положение DSC напрямую связано с Асцендентом и так же чувствительно ко времени рождения. Без точного времени нельзя уверенно назвать его знак, градус и связанные с ним аспекты.',
            ],
          },
        ],
        shortAnswer: 'DSC помогает читать стиль близкого взаимодействия, но не предписывает, с кем строить отношения.',
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
    personalizationKind: { type: 'angle', key: 'descendant' },
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
        summary: 'MC описывает публичное направление, заметную роль и то, за что человека могут знать вне близкого круга.',
        sections: [
          {
            title: 'Не только карьера',
            paragraphs: [
              'MC часто связывают с работой, но его смысл шире. Это верхняя точка карты, связанная с публичной позицией, репутацией и направлением, в котором человек хочет быть заметен. Конкретную профессию по одному MC не выбирают.',
            ],
          },
          {
            title: 'Почему нужен точный час',
            paragraphs: [
              'Градус и знак MC зависят от времени и места рождения. Ошибка во времени может изменить положение точки и её аспекты. При неизвестном времени выводы о MC следует исключить.',
            ],
          },
        ],
        shortAnswer: 'MC относится к публичной роли и направлению, но не называет единственно верную профессию.',
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
    personalizationKind: { type: 'angle', key: 'mc' },
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
        summary: 'IC связывают с домом, семьёй и частной стороной жизни.',
        sections: [
          {
            title: 'Нижняя точка карты',
            paragraphs: [
              'IC находится напротив MC. Его знак помогает говорить о личном пространстве, отношении к дому и семейной среде. Это не подробная биография семьи и не утверждение о конкретных событиях детства.',
            ],
          },
          {
            title: 'Чувствительность к времени',
            paragraphs: [
              'Положение IC меняется вместе с MC и требует точного времени рождения. Если время неизвестно, знак и аспекты IC нельзя считать надёжными данными карты.',
            ],
          },
        ],
        shortAnswer: 'IC помогает читать отношение к дому и частной жизни, но не восстанавливает семейную историю.',
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
    personalizationKind: { type: 'angle', key: 'ic' },
  },
] satisfies readonly KnowledgeTopicSource[];
