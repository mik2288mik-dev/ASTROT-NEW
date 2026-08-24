import type { KnowledgeTopicSource } from './types';

export const RETROGRADE_TOPICS = [
  {
    id: 'retrograde-motion',
    category: 'retrogrades',
    aliases: {
      ru: ['ретроградное движение', 'почему планета движется назад'],
      en: ['retrograde motion', 'why a planet moves backward'],
    },
    keywords: {
      ru: ['ретроградность', 'видимое движение', 'орбиты', 'астрономия'],
      en: ['retrograde', 'apparent motion', 'orbits', 'astronomy'],
    },
    copy: {
      ru: {
        title: 'Что такое ретроградное движение',
        summary: 'Ретроградность — это кажущееся, а не реальное движение планеты назад на фоне звёзд. Оно возникает из-за взаимного движения Земли и этой планеты.',
        sections: [
          {
            title: 'Планета не разворачивается',
            paragraphs: [
              'Небесное тело продолжает двигаться по своей орбите в обычном направлении. Эффект похож на поезд, который из более быстрого поезда на время кажется движущимся назад.',
            ],
          },
          {
            title: 'Что отмечает карта',
            paragraphs: [
              'Буква R рядом с планетой означает, что в выбранный момент с Земли она казалась движущейся назад. Эту отметку рассчитывают по астрономическим данным; астрологическое значение добавляют отдельно.',
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
    relatedTopicIds: ['retrograde-natal', 'retrograde-transit', 'retrograde-station-direct'],
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
      ru: ['ретроградный меркурий', 'меркурий ретроградный'],
      en: ['mercury retrograde', 'retrograde mercury'],
    },
    keywords: {
      ru: ['меркурий', 'ретроградность', 'общение', 'документы', 'проверка'],
      en: ['mercury', 'retrograde', 'communication', 'documents', 'review'],
    },
    copy: {
      ru: {
        title: 'Ретроградный Меркурий',
        summary: 'Ретроградный Меркурий — период, когда с Земли кажется, что Меркурий движется назад по зодиаку. Это обычная повторяющаяся фаза видимого движения.',
        sections: [
          {
            title: 'Астрологическое значение',
            paragraphs: [
              'В астрологии этот период связывают с пересмотром сообщений, договорённостей, маршрутов и документов. Такое значение не означает запрет на общение, покупки или важные решения.',
            ],
          },
          {
            title: 'Чего он не доказывает',
            paragraphs: [
              'Ретроградность Меркурия сама по себе не объясняет каждую ошибку связи и не гарантирует поломку техники. Астрологический разбор учитывает точные даты, аспекты и личную карту, а реальное решение опирается на факты и условия ситуации.',
            ],
          },
        ],
        shortAnswer: 'Во время ретроградного Меркурия планета лишь кажется движущейся назад; этот период не гарантирует сбоев и не требует отменять планы.',
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
    relatedTopicIds: ['planet-mercury', 'retrograde-motion', 'retrograde-station-direct'],
  },
] satisfies readonly KnowledgeTopicSource[];
