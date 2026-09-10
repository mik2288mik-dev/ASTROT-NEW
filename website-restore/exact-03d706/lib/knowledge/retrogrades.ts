import type { KnowledgeTopicSource } from './types';

export const RETROGRADE_TOPICS = [
  {
    id: 'retrograde-motion',
    category: 'retrogrades',
    aliases: {
      ru: ['ретроградное движение', 'ретроградность', 'ретроград', 'почему планета движется назад', 'retrograde motion'],
      en: ['retrograde motion', 'why a planet moves backward'],
    },
    keywords: {
      ru: ['ретроградность', 'видимое движение', 'орбиты', 'астрономия'],
      en: ['retrograde', 'apparent motion', 'orbits', 'astronomy'],
    },
    copy: {
      ru: {
        title: 'Что такое ретроградное движение',
        summary: 'Ретроградное движение — видимое смещение планеты назад на фоне звёзд при наблюдении с Земли. Планета не разворачивается на своей орбите: эффект возникает из-за меняющейся геометрии движения Земли и планеты вокруг Солнца.',
        sections: [
          {
            title: 'Что происходит на самом деле',
            kind: 'fact',
            paragraphs: [
              'Все планеты продолжают двигаться по орбитам в прежнем направлении. Но мы наблюдаем их с Земли, которая тоже движется. Когда взаимное положение и направление луча зрения меняются, проекция планеты на звёздный фон на время смещается в обратную сторону.',
            ],
          },
          {
            title: 'Простой пример с обгоном',
            kind: 'mechanism',
            paragraphs: [
              'Из окна быстрого поезда медленный поезд может на несколько секунд казаться движущимся назад, хотя оба едут вперёд. Для внешних планет похожий эффект возникает, когда Земля обгоняет их. У Меркурия и Венеры геометрия другая, потому что они движутся внутри земной орбиты, но результат на карте тот же — временное обратное смещение.',
            ],
          },
          {
            title: 'Что такое станции',
            kind: 'calculation',
            paragraphs: [
              'Перед сменой видимого направления скорость по эклиптической долготе уменьшается почти до нуля. Такой момент называют станцией. После одной станции начинается ретроградная фаза, после другой — директная. Планета не останавливается в пространстве: почти нулевой становится только выбранная видимая координата.',
            ],
          },
          {
            title: 'Что отмечает карта',
            kind: 'calculation',
            paragraphs: [
              'Буква R означает, что долгота объекта в выбранный момент уменьшалась. Буква D или отсутствие пометки обычно означает директное движение. Эти данные получают из эфемерид; символическая трактовка добавляется уже в астрологии.',
            ],
          },
          {
            title: 'В астрологии',
            kind: 'astrology',
            paragraphs: [
              'Ретроградную планету часто связывают с пересмотром, возвратом к теме или менее прямым проявлением её символики. Это традиционная интерпретация видимого движения, а не доказанный физический эффект на решения и события.',
            ],
          },
          {
            title: 'Часто путают',
            kind: 'confusion',
            paragraphs: [
              'Ретроградность не означает, что планета стала опасной, слабой или физически полетела назад. Она также не объясняет автоматически любую задержку: для практического решения важны реальные причины ситуации.',
            ],
          },
        ],
        shortAnswer: 'Ретроградная планета физически не идёт назад: так выглядит её движение с Земли из-за разницы орбитальных скоростей.',
      },
      en: {
        title: 'What retrograde motion means',
        summary: 'Retrograde motion is a planet’s apparent backward movement against the stars, caused by the relative positions and speeds of Earth and that planet.',
        sections: [
          {
            title: 'The planet does not reverse',
            paragraphs: [
              'The celestial body continues along its orbit in the usual direction. The effect resembles a train that briefly seems to move backward when viewed from a faster train.',
            ],
          },
          {
            title: 'What the chart records',
            paragraphs: [
              'An R beside a planet means its apparent longitude was decreasing at the calculated moment. Astrology adds an interpretation, but the marker itself comes from calculated motion.',
            ],
          },
        ],
        shortAnswer: 'A retrograde planet does not physically travel backward; it appears to do so from Earth because orbital speeds differ.',
      },
    },
    relatedTopicIds: ['direct-motion', 'retrograde-station-direct', 'retrograde-mercury', 'transits-current-sky', 'ephemerides'],
    diagram: 'retrograde-motion',
    sourceIds: ['nasa-retrograde'],
  },
  {
    id: 'retrograde-natal',
    category: 'retrogrades',
    aliases: {
      ru: ['ретроградная планета в натальной карте', 'натальная ретроградность'],
      en: ['retrograde planet in natal chart', 'natal retrograde'],
    },
    keywords: {
      ru: ['натальная карта', 'ретроградная планета', 'буква R', 'рождение'],
      en: ['natal chart', 'retrograde planet', 'R marker', 'birth'],
    },
    copy: {
      ru: {
        title: 'Ретроградная планета в натальной карте',
        summary: 'Натальная ретроградность означает, что в момент рождения планета казалась движущейся назад с точки зрения Земли. В карте её отмечают буквой R.',
        sections: [
          {
            title: 'Как это читают',
            paragraphs: [
              'Отметку R читают как дополнительную деталь: к вопросам этой планеты человек может чаще возвращаться и пересматривать их. Конкретный смысл зависит от самой планеты, её знака, дома и аспектов.',
            ],
          },
          {
            title: 'Не дефект карты',
            paragraphs: [
              'Отметка R не означает, что планета «работает неправильно». Это одна деталь карты, а не оценка способностей и не обещание обязательных трудностей.',
            ],
          },
        ],
        shortAnswer: 'Ретроградная планета в натальной карте означает кажущееся обратное движение в момент рождения, а не поломку или обязательную трудность.',
      },
      en: {
        title: 'A retrograde planet in the natal chart',
        summary: 'Natal retrograde status records a planet’s apparent-motion phase at birth and adds detail to its interpretation.',
        sections: [
          {
            title: 'How it is read',
            paragraphs: [
              'Astrology often associates a retrograde planet with a more private, revisited, or less immediately visible way of handling its subjects. Meaning depends on the planet itself, its sign, house, and aspects.',
            ],
          },
          {
            title: 'Not a chart defect',
            paragraphs: [
              'An R marker does not mean that a planet’s function is broken or unavailable. It is one interpretation detail, not a judgment of ability or a prediction of required difficulty.',
            ],
          },
        ],
        shortAnswer: 'Natal retrograde status is an additional planet detail, not a sign of damage or bad fate.',
      },
    },
    relatedTopicIds: ['retrograde-motion', 'retrograde-transit', 'planet-mercury'],
  },
  {
    id: 'retrograde-transit',
    category: 'retrogrades',
    aliases: {
      ru: ['ретроградная планета сейчас', 'ретроградный транзит'],
      en: ['planet retrograde now', 'retrograde transit'],
    },
    keywords: {
      ru: ['транзит', 'текущая ретроградность', 'период', 'эфемериды'],
      en: ['transit', 'current retrograde', 'period', 'ephemeris'],
    },
    copy: {
      ru: {
        title: 'Ретроградность в транзитах',
        summary: 'Транзитная ретроградность — текущий период, когда планета кажется движущейся назад с точки зрения Земли. Она не меняет её положение в натальной карте.',
        sections: [
          {
            title: 'Натальное и текущее',
            paragraphs: [
              'Натальная карта фиксирует положение планеты в момент рождения. Транзит показывает её положение на другую дату, поэтому планета может быть директной в натальной карте и ретроградной сейчас — или наоборот.',
            ],
          },
          {
            title: 'Без автоматических событий',
            paragraphs: [
              'В астрологии такой период связывают с пересмотром тем планеты и её текущих аспектов. Само кажущееся обратное движение не доказывает, что задержка, ссора или поломка обязательно произойдут.',
            ],
          },
        ],
        shortAnswer: 'Транзитная ретроградность описывает кажущееся обратное движение планеты сейчас, а натальная — в момент рождения.',
      },
      en: {
        title: 'Retrograde motion in transits',
        summary: 'Transit retrograde status belongs to a planet’s current position and does not change its retrograde marker in the natal chart.',
        sections: [
          {
            title: 'Natal and current positions',
            paragraphs: [
              'A natal chart records one birth moment. A transit describes a celestial body on another date, so the same planet can be direct in the natal chart and retrograde now—or the reverse.',
            ],
          },
          {
            title: 'No automatic events',
            paragraphs: [
              'Astrologers use such a period to look more carefully at the planet’s subjects and current aspects. Retrograde status alone does not prove that a delay, argument, or breakdown must occur.',
            ],
          },
        ],
        shortAnswer: 'Transit retrograde describes a current period; natal retrograde describes the planet at birth.',
      },
    },
    relatedTopicIds: ['retrograde-motion', 'retrograde-natal', 'retrograde-station-direct'],
  },
  {
    id: 'retrograde-station-direct',
    category: 'retrogrades',
    aliases: {
      ru: ['станция планеты', 'планета стала директной', 'разворот планеты'],
      en: ['planetary station', 'planet turns direct', 'planetary turnaround'],
    },
    keywords: {
      ru: ['станция', 'директное движение', 'разворот', 'скорость планеты'],
      en: ['station', 'direct motion', 'turnaround', 'planet speed'],
    },
    copy: {
      ru: {
        title: 'Станция и директное движение',
        summary: 'Станция — момент, когда видимая скорость планеты почти равна нулю перед сменой направления. Директным называют её обычное видимое движение вперёд.',
        sections: [
          {
            title: 'Смена направления',
            paragraphs: [
              'Перед ретроградным движением планета видимо замедляется, проходит станцию и начинает смещаться назад. Перед директным движением она снова проходит станцию и возвращается к видимому движению вперёд.',
            ],
          },
          {
            title: 'Точность даты',
            paragraphs: [
              'Точный момент станции берут из эфемерид — таблиц рассчитанных положений планет. Часовой пояс меняет местное время и иногда календарную дату этого момента.',
            ],
          },
        ],
        shortAnswer: 'Станция — почти неподвижный видимый момент перед сменой направления; директное движение — видимое движение планеты вперёд.',
      },
      en: {
        title: 'Stations and direct motion',
        summary: 'Before changing apparent direction, a planet briefly seems almost still; this period is called a station.',
        sections: [
          {
            title: 'Changing direction',
            paragraphs: [
              'A station before retrograde motion marks the change from direct to apparent backward motion. A station before direct motion marks the return to increasing longitude.',
            ],
          },
          {
            title: 'Timing precision',
            paragraphs: [
              'A turnaround does not occur at the same local clock time everywhere on a calendar date; the exact moment comes from an ephemeris. Near a boundary, calculation time and astronomical data therefore matter.',
            ],
          },
        ],
        shortAnswer: 'A station is a moment of near-zero apparent speed before a planet shifts to retrograde or direct motion.',
      },
    },
    relatedTopicIds: ['retrograde-motion', 'retrograde-transit', 'retrograde-mercury'],
  },
  {
    id: 'retrograde-mercury',
    category: 'retrogrades',
    aliases: {
      ru: ['ретроградный меркурий', 'меркурий ретроградный', 'ретро меркурий', 'меркурий ретро', 'ретроград', 'mercury retrograde'],
      en: ['mercury retrograde', 'retrograde mercury'],
    },
    keywords: {
      ru: ['меркурий', 'ретроградность', 'общение', 'документы', 'проверка'],
      en: ['mercury', 'retrograde', 'communication', 'documents', 'review'],
    },
    copy: {
      ru: {
        title: 'Ретроградный Меркурий',
        summary: 'Ретроградный Меркурий — период, когда видимое положение Меркурия с Земли смещается назад по зодиаку. Сам Меркурий не разворачивается и продолжает двигаться вокруг Солнца.',
        sections: [
          {
            title: 'Почему возникает обратное движение',
            kind: 'mechanism',
            paragraphs: [
              'Меркурий обращается вокруг Солнца быстрее Земли и находится ближе к Солнцу. По мере того как меняется взаимное положение двух орбит, направление на Меркурий относительно далёких звёзд сначала замедляется, затем временно разворачивается, а потом снова становится прямым.',
            ],
          },
          {
            title: 'Что означает слово «ретроградный»',
            kind: 'definition',
            paragraphs: [
              'Латинская основа слова означает «идущий назад». В астрономическом и астрологическом календаре речь идёт о видимом движении в геоцентрической системе координат — то есть так, как положение меняется для наблюдателя с Земли.',
            ],
          },
          {
            title: 'Почему существуют станции',
            kind: 'calculation',
            paragraphs: [
              'На границах периода видимая скорость Меркурия по зодиакальной долготе проходит через ноль. Эти моменты называют станциями ретроградности и директности. Планета при этом не зависает в космосе — меняется только скорость её проекции на выбранную координату.',
            ],
          },
          {
            title: 'Почему о нём говорят чаще',
            paragraphs: [
              'Меркурий становится ретроградным несколько раз в год, поэтому периоды регулярно попадают в массовые календари. Кроме того, его астрологическая символика связана с общением, документами, поездками и техникой — повседневными темами, в которых легко заметить любую ошибку.',
            ],
          },
          {
            title: 'В современной астрологии',
            kind: 'astrology',
            paragraphs: [
              'Период связывают с пересмотром сообщений, договорённостей, маршрутов, документов и способов обмена информацией. Некоторые астрологи учитывают также знак, фазы петли и точные транзитные аспекты, а не только общую пометку R.',
            ],
          },
          {
            title: 'Что является преувеличением',
            kind: 'confusion',
            paragraphs: [
              'Ретроградный Меркурий не гарантирует поломку телефона, отмену рейса, возвращение бывшего партнёра или провал договора. Такие утверждения невозможно вывести из одной отметки движения. Проверять факты и документы разумно в любой период.',
            ],
          },
          {
            title: 'Часто путают',
            kind: 'confusion',
            depth: 'deep',
            paragraphs: [
              'Натальный ретроградный Меркурий — положение в карте рождения. Транзитный ретроградный Меркурий — текущий период на небе. Это разные контексты и их не следует смешивать.',
            ],
          },
        ],
        shortAnswer: 'Меркурий не летит назад. Это регулярно повторяющаяся видимая петля; астрология трактует её символически, но она не требует отменять жизнь.',
      },
      en: {
        title: 'Mercury retrograde without fear',
        summary: 'Mercury retrograde is a normal recurring phase of apparent motion, not a ban on communication, purchases, or important decisions.',
        sections: [
          {
            title: 'What you can take into account',
            paragraphs: [
              'Astrological tradition links this period with reviewing messages, agreements, routes, and documents. The practical conclusion is simple: checking details can help, but life does not need to stop until Mercury turns direct.',
            ],
          },
          {
            title: 'What it does not prove',
            paragraphs: [
              'Retrograde status alone does not explain every communication error or guarantee broken technology. Astrological analysis considers exact dates, aspects, and the natal chart; real decisions still depend on facts and circumstances.',
            ],
          },
        ],
        shortAnswer: 'Mercury retrograde does not require canceling plans; it is a reason to check messages, timing, and documents calmly.',
      },
    },
    relatedTopicIds: ['planet-mercury', 'retrograde-motion', 'direct-motion', 'retrograde-station-direct', 'transits-current-sky'],
    diagram: 'retrograde-motion',
    sourceIds: ['nasa-retrograde'],
  },
] satisfies readonly KnowledgeTopicSource[];
