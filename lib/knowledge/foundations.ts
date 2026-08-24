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
        summary: 'Натальная карта — это схема положений Солнца, Луны и планет на момент рождения.',
        sections: [
          {
            title: 'Из чего состоит карта',
            paragraphs: [
              'Зодиакальный круг делят на двенадцать знаков и отмечают, в каком из них находились Солнце, Луна и планеты. Если известны точные время и место рождения, круг также делят на двенадцать домов, которые в астрологии связывают с разными областями жизни.',
            ],
          },
          {
            title: 'Как соединяют значения',
            paragraphs: [
              'Сначала смотрят, какая планета находится в каком знаке и доме. Затем учитывают аспекты: углы между планетами, по которым в астрологии описывают их связь. Общий вывод делают по нескольким частям карты, а не по одному положению.',
            ],
          },
        ],
        shortAnswer: 'Натальная карта показывает положение небесных тел в момент рождения; в астрологии её читают по знакам, домам и углам между планетами.',
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
        summary: 'Расчёт натальной карты определяет положения небесных тел, углы между ними и, при точном времени рождения, дома и основные точки карты.',
        sections: [
          {
            title: 'Положения планет',
            paragraphs: [
              'Для выбранного момента программа получает астрономические координаты Солнца, Луны и планет. Так определяется знак и место внутри знака для каждого небесного тела, а также аспекты, то есть углы между ними.',
            ],
          },
          {
            title: 'Что требует точного времени',
            paragraphs: [
              'Асцендент показывает точку зодиака, которая восходила над восточным горизонтом, а MC — верхнюю точку карты. Эти точки и границы домов зависят от времени и места рождения, поэтому без точных исходных данных их нельзя считать надёжными.',
            ],
          },
        ],
        shortAnswer: 'Расчёт натальной карты показывает, где находились планеты и какие углы они образовывали; точные время и место также позволяют определить дома, Асцендент и другие точки карты.',
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
        summary: 'Дата рождения указывает, на какой день нужно рассчитать положения Солнца, Луны и планет.',
        sections: [
          {
            title: 'Что определяет дата',
            paragraphs: [
              'Небесные тела постоянно движутся по зодиакальному кругу. Дата задаёт нужный день, а время рождения уточняет их положение внутри этого дня, особенно положение Луны и точное место каждой планеты в знаке.',
            ],
          },
          {
            title: 'Почему одного дня мало',
            paragraphs: [
              'Земля вращается, поэтому вид неба относительно горизонта меняется в течение суток. Для расчёта Асцендента, домов и других точек, связанных с горизонтом, кроме даты нужны время и место рождения.',
            ],
          },
        ],
        shortAnswer: 'Дата рождения нужна, чтобы выбрать день расчёта и определить положения Солнца, Луны и планет на этот день.',
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
        summary: 'Место рождения указывает точку на Земле, относительно которой рассчитывают горизонт, Асцендент и дома натальной карты.',
        sections: [
          {
            title: 'Зачем нужны координаты',
            paragraphs: [
              'Широта и долгота города показывают, как небо было расположено относительно местного горизонта. По ним рассчитывают Асцендент, то есть восходившую точку зодиака, другие основные точки и границы домов.',
            ],
          },
          {
            title: 'Что остаётся прежним',
            paragraphs: [
              'В один и тот же момент положения планет по зодиакальному кругу почти не зависят от города. Меняется местный вид неба, поэтому разные места рождения прежде всего дают разные дома и точки, связанные с горизонтом.',
            ],
          },
        ],
        shortAnswer: 'Место рождения нужно, чтобы связать момент рождения с местным горизонтом и рассчитать Асцендент, другие основные точки и дома карты.',
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
        summary: 'Время рождения нужно, чтобы рассчитать положение зодиакального круга относительно горизонта и определить Асцендент и дома.',
        sections: [
          {
            title: 'Что зависит от времени',
            paragraphs: [
              'Асцендент — это точка зодиака, которая восходила над восточным горизонтом, а MC — верхняя точка карты. Вместе с другими основными точками и границами домов они меняются в течение суток из-за вращения Земли.',
            ],
          },
          {
            title: 'Почему важна точность',
            paragraphs: [
              'Даже небольшая ошибка во времени сдвигает основные точки карты и границы домов. Иногда из-за этого планета попадает в соседний дом, поэтому приблизительное время нельзя выдавать за точное.',
            ],
          },
        ],
        shortAnswer: 'Точное время рождения нужно прежде всего для расчёта Асцендента, других основных точек и домов натальной карты.',
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
        summary: 'Если время рождения неизвестно, по дате всё ещё можно рассчитать многие положения планет, но Асцендент и дома определить точно нельзя.',
        sections: [
          {
            title: 'Что остаётся доступно',
            paragraphs: [
              'Обычно можно определить знаки Солнца и большинства планет, а также многие аспекты, то есть углы между планетами. С Луной нужна проверка: она движется быстро и в день рождения могла перейти из одного знака в другой.',
            ],
          },
          {
            title: 'Что нельзя считать точным',
            paragraphs: [
              'Асцендент, верхняя точка карты MC и дома зависят от времени рождения. Если время неизвестно, эти части лучше не включать в личный разбор, чем показывать случайный результат как точный.',
            ],
          },
        ],
        shortAnswer: 'Без времени рождения можно использовать те положения планет, которые не менялись в течение дня, но нельзя точно определить Асцендент, дома и другие точки, связанные с горизонтом.',
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
        summary: 'Чтобы прочитать натальную карту, сначала рассматривают планеты и знаки, затем дома и аспекты, а в конце сопоставляют все значения.',
        sections: [
          {
            title: 'Сначала основные положения',
            paragraphs: [
              'Сначала смотрят знак Солнца, Луны, Меркурия, Венеры и Марса. В астрологии Солнце связывают с выбором направления, Луну с привычными чувствами и реакциями, Меркурий с мышлением и речью, Венеру со вкусом и сближением, а Марс со способом действовать.',
            ],
          },
          {
            title: 'Затем контекст и связи',
            paragraphs: [
              'При точном времени добавляют дома, то есть части карты, связанные с разными жизненными вопросами. Затем смотрят аспекты: связи между планетами, которые описывают, легко ли их значения сочетаются. Общий вывод проверяют по нескольким положениям.',
            ],
          },
        ],
        shortAnswer: 'Чтобы прочитать натальную карту, сначала определяют значения планет и их знаков, затем добавляют дома и аспекты и только после этого делают общий вывод.',
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
        summary: '«Своим знаком» обычно называют знак, в котором находилось Солнце при рождении, но это только одно положение в натальной карте.',
        sections: [
          {
            title: 'Что показывает солнечный знак',
            paragraphs: [
              'Солнечный знак — это один из двенадцати участков зодиакального круга, где находилось Солнце. В астрологии его связывают со способом принимать важные решения и выбирать направление, но не со всеми чувствами, привычками и поступками человека.',
            ],
          },
          {
            title: 'Почему люди одного знака разные',
            paragraphs: [
              'Луна, Меркурий, Венера и Марс у людей одного солнечного знака могут находиться в разных знаках. Также различаются углы между планетами, а при точном времени рождения ещё Асцендент и дома. Поэтому один солнечный знак не описывает человека целиком.',
            ],
          },
        ],
        shortAnswer: 'Солнечный знак показывает только положение Солнца; для чтения всей натальной карты нужны положения других планет, углы между ними и, при точном времени рождения, дома.',
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
