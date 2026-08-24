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
        summary: 'Ретроградность — это видимое движение планеты назад на фоне звёзд, возникающее из-за взаимного положения и скорости Земли и другой планеты.',
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
              'Буква R рядом с планетой означает, что в момент расчёта её видимая долгота уменьшалась. Астрология добавляет этому факту трактовку, но сама отметка основана на вычисленном движении.',
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
        summary: 'Натальная ретроградность фиксирует фазу видимого движения планеты в момент рождения и добавляет деталь к её трактовке.',
        sections: [
          {
            title: 'Как это читают',
            paragraphs: [
              'В астрологии ретроградность означает, что обычный способ действия планеты может быть менее заметен со стороны или чаще пересматриваться. Значение зависит от самой планеты, знака, дома и аспектов.',
            ],
          },
          {
            title: 'Не дефект карты',
            paragraphs: [
              'Отметка R не означает, что планета «работает неправильно». Это одна деталь карты, а не оценка способностей и не предсказание обязательных трудностей.',
            ],
          },
        ],
        shortAnswer: 'Натальная ретроградность — дополнительная характеристика планеты, а не признак поломки или плохой судьбы.',
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
        summary: 'Транзитная ретроградность относится к текущему положению планеты и не меняет ретроградную отметку в натальной карте.',
        sections: [
          {
            title: 'Натальное и текущее',
            paragraphs: [
              'Натальная карта фиксирует один момент рождения. Транзит описывает положение небесного тела на другую дату, поэтому одна и та же планета может быть директной в натальной карте и ретроградной сейчас — или наоборот.',
            ],
          },
          {
            title: 'Без автоматических событий',
            paragraphs: [
              'В астрологии такой период используют как повод внимательнее смотреть на темы планеты и её текущие аспекты. Сам факт ретроградности не доказывает, что задержка, ссора или поломка обязательно произойдут.',
            ],
          },
        ],
        shortAnswer: 'Транзитная ретроградность описывает текущий период, а натальная — положение планеты в момент рождения.',
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
        summary: 'Перед сменой видимого направления планета на короткое время кажется почти неподвижной; этот период называют станцией.',
        sections: [
          {
            title: 'Смена направления',
            paragraphs: [
              'Станция перед ретроградным ходом отмечает переход от директного движения к видимому обратному. Станция перед директным ходом отмечает возвращение к увеличению долготы.',
            ],
          },
          {
            title: 'Точность даты',
            paragraphs: [
              'Разворот не происходит одинаково во всех часовых поясах календарного дня: точный момент задаётся эфемеридами. Поэтому для пограничной даты важны время расчёта и используемые астрономические данные.',
            ],
          },
        ],
        shortAnswer: 'Станция — момент почти нулевой видимой скорости перед переходом планеты к ретроградному или директному ходу.',
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
        title: 'Ретроградный Меркурий без страха',
        summary: 'Ретроградный Меркурий — обычная повторяющаяся фаза видимого движения, а не запрет на общение, покупки или важные решения.',
        sections: [
          {
            title: 'Что можно учитывать',
            paragraphs: [
              'В астрологической традиции этот период связывают с пересмотром сообщений, договорённостей, маршрутов и документов. Практичный вывод прост: проверять детали полезно, но откладывать всю жизнь до директного хода не требуется.',
            ],
          },
          {
            title: 'Чего он не доказывает',
            paragraphs: [
              'Одна ретроградность не объясняет каждую ошибку связи и не гарантирует поломку техники. Для астрологического разбора смотрят точные даты, аспекты и личную карту, а для реального решения — факты и условия ситуации.',
            ],
          },
        ],
        shortAnswer: 'Ретроградный Меркурий не требует отменять планы; это повод спокойнее проверять сообщения, сроки и документы.',
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
