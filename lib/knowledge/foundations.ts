import type { KnowledgeTopicSource } from './types';

export const FOUNDATION_TOPICS = [
  {
    id: 'natal-chart-basics',
    category: 'start',
    aliases: {
      ru: ['натальная карта', 'карта рождения', 'гороскоп рождения'],
      en: ['natal chart', 'birth chart', 'astrological chart'],
    },
    keywords: {
      ru: ['планеты', 'знаки', 'дома', 'аспекты'],
      en: ['planets', 'signs', 'houses', 'aspects'],
    },
    copy: {
      ru: {
        title: 'Что такое натальная карта',
        summary: 'Схема положений планет и основных точек на момент рождения.',
        sections: [
          {
            title: 'Что входит в карту',
            paragraphs: [
              'Карта показывает положения планет в знаках, связи между ними и, при точном времени рождения, дома и углы карты.',
            ],
          },
          {
            title: 'Как её читать',
            paragraphs: [
              'Каждый показатель отвечает на свой вопрос. Планета описывает функцию, знак — способ её действия, дом — область жизни, а аспект — связь с другой планетой.',
            ],
          },
        ],
        shortAnswer: 'Натальная карта — это схема астрономических положений, которую в астрологии читают как единое целое.',
      },
      en: {
        title: 'What a natal chart is',
        summary: 'A map of planetary positions and key points at the time of birth.',
        sections: [
          {
            title: 'What the chart contains',
            paragraphs: [
              'A chart shows planets in signs, the relationships between them, and, when birth time is accurate, houses and chart angles.',
            ],
          },
          {
            title: 'How it is read',
            paragraphs: [
              'Each part answers a different question. A planet describes a function, a sign its manner, a house an area of life, and an aspect a relationship with another planet.',
            ],
          },
        ],
        shortAnswer: 'A natal chart is a map of astronomical positions that astrology reads as one connected whole.',
      },
    },
    relatedTopicIds: ['what-chart-calculates', 'how-to-read-natal-chart', 'why-one-sign-is-not-enough'],
  },
  {
    id: 'what-chart-calculates',
    category: 'start',
    aliases: {
      ru: ['расчёт карты', 'что считает карта', 'данные натальной карты'],
      en: ['chart calculation', 'what a chart calculates', 'natal chart data'],
    },
    keywords: {
      ru: ['координаты', 'положения', 'аспекты', 'куспиды'],
      en: ['coordinates', 'positions', 'aspects', 'cusps'],
    },
    copy: {
      ru: {
        title: 'Что рассчитывается в карте',
        summary: 'Положения небесных тел, углы между ними и точки, зависящие от времени и места.',
        sections: [
          {
            title: 'Основные данные',
            paragraphs: [
              'Расчёт определяет положение Солнца, Луны и планет по зодиакальному кругу. По этим координатам находятся знаки и аспекты.',
            ],
          },
          {
            title: 'Что требует точного времени',
            paragraphs: [
              'Асцендент, другие углы и границы домов зависят от времени и места рождения. Без этих данных их нельзя считать точными.',
            ],
          },
        ],
        shortAnswer: 'Карта рассчитывает положения планет, аспекты и, при точных исходных данных, дома и углы.',
      },
      en: {
        title: 'What the chart calculates',
        summary: 'Celestial positions, the angles between them, and points that depend on time and place.',
        sections: [
          {
            title: 'Core data',
            paragraphs: [
              'The calculation locates the Sun, Moon, and planets around the zodiac. Their coordinates determine signs and aspects.',
            ],
          },
          {
            title: 'What needs an accurate time',
            paragraphs: [
              'The Ascendant, other angles, and house cusps depend on birth time and place. They cannot be treated as precise without those details.',
            ],
          },
        ],
        shortAnswer: 'A chart calculates planetary positions, aspects, and, with accurate input, houses and angles.',
      },
    },
    relatedTopicIds: ['natal-chart-basics', 'birth-time-in-chart', 'birth-place-in-chart'],
  },
  {
    id: 'birth-date-in-chart',
    category: 'start',
    aliases: {
      ru: ['дата рождения', 'день рождения в карте'],
      en: ['birth date', 'date of birth in a chart'],
    },
    keywords: {
      ru: ['дата', 'день', 'положение планет', 'луна'],
      en: ['date', 'day', 'planetary positions', 'moon'],
    },
    copy: {
      ru: {
        title: 'Зачем нужна дата рождения',
        summary: 'Дата задаёт день, для которого рассчитываются положения Солнца, Луны и планет.',
        sections: [
          {
            title: 'Что определяет дата',
            paragraphs: [
              'По дате выбирается день расчёта. Время рождения уточняет положения небесных тел внутри этого дня.',
            ],
          },
          {
            title: 'Почему одного дня мало',
            paragraphs: [
              'Люди, родившиеся в один день, могут иметь разные дома и углы карты. Для них нужны время и место рождения.',
            ],
          },
        ],
        shortAnswer: 'Дата нужна для расчёта положений небесных тел в день рождения.',
      },
      en: {
        title: 'Why the birth date matters',
        summary: 'The date sets the day for calculating the positions of the Sun, Moon, and planets.',
        sections: [
          {
            title: 'What the date determines',
            paragraphs: [
              'The date selects the relevant moment in the motion of celestial bodies. It is essential for locating the Sun, Moon, and planets in signs.',
            ],
          },
          {
            title: 'Why the day alone is not enough',
            paragraphs: [
              'People born on the same day can have different houses and chart angles. Those require birth time and place.',
            ],
          },
        ],
        shortAnswer: 'The birth date is needed to calculate celestial positions on that day.',
      },
    },
    relatedTopicIds: ['birth-time-in-chart', 'birth-place-in-chart', 'unknown-birth-time'],
  },
  {
    id: 'birth-place-in-chart',
    category: 'start',
    aliases: {
      ru: ['место рождения', 'город рождения', 'география карты'],
      en: ['birth place', 'birth city', 'chart location'],
    },
    keywords: {
      ru: ['координаты', 'горизонт', 'дома', 'асцендент'],
      en: ['coordinates', 'horizon', 'houses', 'ascendant'],
    },
    copy: {
      ru: {
        title: 'Зачем нужно место рождения',
        summary: 'Место связывает момент рождения с конкретной точкой на Земле.',
        sections: [
          {
            title: 'Что меняет география',
            paragraphs: [
              'Координаты места нужны для местного горизонта и сетки домов. Поэтому один и тот же момент в разных городах даёт разные углы карты.',
            ],
          },
          {
            title: 'Что остаётся прежним',
            paragraphs: [
              'Положения планет по зодиакальному кругу относятся к выбранному моменту. Место прежде всего уточняет углы и дома.',
            ],
          },
        ],
        shortAnswer: 'Место рождения нужно для расчёта местного горизонта, углов и домов карты.',
      },
      en: {
        title: 'Why the birth place matters',
        summary: 'The place connects the birth moment to a specific point on Earth.',
        sections: [
          {
            title: 'What location changes',
            paragraphs: [
              'Geographic coordinates are needed for the local horizon and house grid. The same moment in different cities therefore gives different chart angles.',
            ],
          },
          {
            title: 'What stays the same',
            paragraphs: [
              'Planetary positions around the zodiac belong to the selected moment. Place mainly refines the angles and houses.',
            ],
          },
        ],
        shortAnswer: 'Birth place is needed to calculate the local horizon, chart angles, and houses.',
      },
    },
    relatedTopicIds: ['birth-time-in-chart', 'what-chart-calculates', 'unknown-birth-time'],
  },
  {
    id: 'birth-time-in-chart',
    category: 'start',
    aliases: {
      ru: ['время рождения', 'точное время', 'часы рождения'],
      en: ['birth time', 'exact birth time', 'time of birth'],
    },
    keywords: {
      ru: ['асцендент', 'углы', 'дома', 'точность'],
      en: ['ascendant', 'angles', 'houses', 'accuracy'],
    },
    copy: {
      ru: {
        title: 'Зачем нужно время рождения',
        summary: 'Время определяет положение местного горизонта и распределение домов.',
        sections: [
          {
            title: 'Что зависит от времени',
            paragraphs: [
              'По времени рассчитываются Асцендент, MC и остальные углы, а также границы домов. Эти части карты меняются в течение суток.',
            ],
          },
          {
            title: 'Почему важна точность',
            paragraphs: [
              'Неточное время может изменить градусы углов и положение планет по домам. Поэтому приблизительное время следует отмечать как приблизительное.',
            ],
          },
        ],
        shortAnswer: 'Точное время нужно прежде всего для углов и домов натальной карты.',
      },
      en: {
        title: 'Why the birth time matters',
        summary: 'Time determines the local horizon and the arrangement of houses.',
        sections: [
          {
            title: 'What depends on time',
            paragraphs: [
              'The Ascendant, MC, other angles, and house cusps are calculated from birth time. These parts of the chart change through the day.',
            ],
          },
          {
            title: 'Why accuracy matters',
            paragraphs: [
              'An imprecise time can change angle degrees and planetary house positions. An approximate time should therefore be marked as approximate.',
            ],
          },
        ],
        shortAnswer: 'Accurate birth time is needed mainly for chart angles and houses.',
      },
    },
    relatedTopicIds: ['unknown-birth-time', 'birth-place-in-chart', 'what-chart-calculates'],
  },
  {
    id: 'unknown-birth-time',
    category: 'start',
    aliases: {
      ru: ['не знаю время рождения', 'время неизвестно', 'без времени рождения'],
      en: ['unknown birth time', 'no birth time', 'birth time not known'],
    },
    keywords: {
      ru: ['приблизительное время', 'дома недоступны', 'асцендент неизвестен'],
      en: ['approximate time', 'houses unavailable', 'unknown ascendant'],
    },
    copy: {
      ru: {
        title: 'Что делать, если время рождения неизвестно',
        summary: 'Часть карты остаётся доступной, но дома и углы нельзя выдавать за точные.',
        sections: [
          {
            title: 'Что можно читать',
            paragraphs: [
              'Обычно остаются положения Солнца и большинства планет в знаках, а также многие аспекты. Положение Луны требует осторожности, если в этот день она меняла знак.',
            ],
          },
          {
            title: 'Что нужно исключить',
            paragraphs: [
              'Асцендент, MC и дома зависят от времени. При неизвестном времени честнее не использовать их в личном разборе.',
            ],
          },
        ],
        shortAnswer: 'Без времени можно читать надёжные положения планет, но не точные дома и углы.',
      },
      en: {
        title: 'What to do when birth time is unknown',
        summary: 'Part of the chart remains available, but houses and angles cannot be presented as exact.',
        sections: [
          {
            title: 'What can still be read',
            paragraphs: [
              'The Sun and most planetary signs, along with many aspects, usually remain usable. The Moon needs caution if it changed signs on that date.',
            ],
          },
          {
            title: 'What should be left out',
            paragraphs: [
              'The Ascendant, MC, and houses depend on time. When time is unknown, an honest personal reading should not use them.',
            ],
          },
        ],
        shortAnswer: 'Without a birth time, reliable planetary positions can still be read, but exact houses and angles cannot.',
      },
    },
    relatedTopicIds: ['birth-time-in-chart', 'what-chart-calculates', 'how-to-read-natal-chart'],
  },
  {
    id: 'how-to-read-natal-chart',
    category: 'start',
    aliases: {
      ru: ['как читать карту', 'чтение натальной карты', 'разбор карты'],
      en: ['how to read a chart', 'reading a natal chart', 'chart interpretation'],
    },
    keywords: {
      ru: ['планета', 'знак', 'дом', 'аспект'],
      en: ['planet', 'sign', 'house', 'aspect'],
    },
    copy: {
      ru: {
        title: 'Как читать натальную карту',
        summary: 'Начните с основных положений, затем добавляйте дома и аспекты.',
        sections: [
          {
            title: 'Сначала — основа',
            paragraphs: [
              'Посмотрите, в каких знаках находятся Солнце, Луна и личные планеты. Если время точное, добавьте Асцендент и дома.',
            ],
          },
          {
            title: 'Затем — связи',
            paragraphs: [
              'Аспекты показывают, какие части карты действуют согласованно, а где требуется учитывать разные задачи. Итог строится из нескольких показателей, а не из одного слова.',
            ],
          },
        ],
        shortAnswer: 'Читайте карту по слоям: планета, знак, дом, аспекты и только потом общий вывод.',
      },
      en: {
        title: 'How to read a natal chart',
        summary: 'Start with the main placements, then add houses and aspects.',
        sections: [
          {
            title: 'Begin with the foundation',
            paragraphs: [
              'Look at the signs of the Sun, Moon, and personal planets. If birth time is accurate, add the Ascendant and houses.',
            ],
          },
          {
            title: 'Then add connections',
            paragraphs: [
              'Aspects show which chart functions work easily together and where different demands need to be considered. A conclusion comes from several factors, not one label.',
            ],
          },
        ],
        shortAnswer: 'Read the chart in layers: planet, sign, house, aspects, and only then the overall picture.',
      },
    },
    relatedTopicIds: ['natal-chart-basics', 'why-one-sign-is-not-enough', 'what-chart-calculates'],
  },
  {
    id: 'why-one-sign-is-not-enough',
    category: 'start',
    aliases: {
      ru: ['почему одного знака мало', 'я не похож на свой знак', 'солнечный знак'],
      en: ['why one sign is not enough', 'I do not match my sign', 'sun sign'],
    },
    keywords: {
      ru: ['солнце', 'луна', 'асцендент', 'личные планеты'],
      en: ['sun', 'moon', 'ascendant', 'personal planets'],
    },
    copy: {
      ru: {
        title: 'Почему одного знака недостаточно',
        summary: 'Знак Солнца — важная часть карты, но не вся карта.',
        sections: [
          {
            title: 'Что даёт знак Солнца',
            paragraphs: [
              'Солнечный знак описывает один из центральных способов действовать и выбирать направление. Он не обязан объяснять каждую реакцию и привычку.',
            ],
          },
          {
            title: 'Что добавляют другие положения',
            paragraphs: [
              'Луна, Меркурий, Венера, Марс, аспекты и, при точном времени, дома и углы дополняют картину. Поэтому люди одного солнечного знака заметно отличаются.',
            ],
          },
        ],
        shortAnswer: 'Солнечный знак — один показатель среди многих, поэтому по нему нельзя описать всю карту.',
      },
      en: {
        title: 'Why one sign is not enough',
        summary: 'The Sun sign is an important part of a chart, but it is not the whole chart.',
        sections: [
          {
            title: 'What the Sun sign adds',
            paragraphs: [
              'The Sun sign describes one central way of acting and choosing direction. It does not have to explain every reaction or habit.',
            ],
          },
          {
            title: 'What the other placements add',
            paragraphs: [
              'The Moon, Mercury, Venus, Mars, aspects, and, with an accurate time, houses and angles add more detail. People with the same Sun sign can therefore differ greatly.',
            ],
          },
        ],
        shortAnswer: 'The Sun sign is one factor among many, so it cannot describe the entire chart.',
      },
    },
    relatedTopicIds: ['natal-chart-basics', 'how-to-read-natal-chart', 'signs-overview'],
  },
] satisfies readonly KnowledgeTopicSource[];
