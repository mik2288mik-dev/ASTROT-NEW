import type { KnowledgeTopicSource } from './types';

export const MOON_CYCLE_TOPICS = [
  {
    id: 'natal-moon',
    category: 'moon-cycles',
    aliases: {
      ru: ['луна в натальной карте', 'натальная луна', 'мой знак луны'],
      en: ['moon in the natal chart', 'natal moon', 'my moon sign'],
    },
    keywords: {
      ru: ['эмоциональная реакция', 'привычки', 'знак луны', 'дом луны'],
      en: ['emotional response', 'habits', 'moon sign', 'moon house'],
    },
    copy: {
      ru: {
        title: 'Луна в натальной карте',
        summary: 'Натальная Луна — положение Луны в момент рождения. В астрологии его связывают с привычными эмоциональными реакциями и способами заботы.',
        sections: [
          {
            title: 'Положение на момент рождения',
            paragraphs: [
              'В астрологии знак Луны связывают с привычным эмоциональным ответом. Дом относят к жизненным вопросам, где этот ответ заметнее, если время рождения известно точно. Аспекты связывают Луну с другими планетами и точками карты.',
            ],
          },
          {
            title: 'Не настроение на сегодня',
            paragraphs: [
              'Натальная Луна остаётся частью карты рождения и не меняет знак каждый день. Текущее настроение зависит от сна, здоровья, событий и отношений, поэтому его нельзя выводить только из натального положения.',
            ],
          },
        ],
        shortAnswer: 'Натальная Луна — положение Луны при рождении; его относят к привычным реакциям, а не к настроению конкретного дня.',
      },
      en: {
        title: 'The Moon in a natal chart',
        summary: 'The natal Moon describes familiar emotional responses, ways of caring, and conditions that make it easier to settle.',
        sections: [
          {
            title: 'A placement fixed at birth',
            paragraphs: [
              'The Moon’s sign describes the familiar tone of emotional response. Its house adds the area of life where that response is especially noticeable when the birth time is accurate enough. Aspects connect the Moon with other chart functions.',
            ],
          },
          {
            title: 'Not today’s mood',
            paragraphs: [
              'The natal Moon remains part of the birth chart and does not change signs each day. Current mood also depends on sleep, health, events, and relationships, so it cannot be inferred from the natal placement alone.',
            ],
          },
        ],
        shortAnswer: 'The natal Moon concerns familiar emotional responses, not the mood of a particular day.',
      },
    },
    relatedTopicIds: ['current-moon', 'moon-phase', 'moon-in-relationships'],
  },
  {
    id: 'current-moon',
    category: 'moon-cycles',
    aliases: {
      ru: ['луна сегодня', 'текущая луна', 'где сейчас луна'],
      en: ['moon today', 'current moon', 'where the moon is now'],
    },
    keywords: {
      ru: ['текущее положение луны', 'знак луны сейчас', 'фаза сегодня'],
      en: ['current moon position', 'moon sign now', 'phase today'],
    },
    copy: {
      ru: {
        title: 'Текущая Луна',
        summary: 'Текущая Луна — положение Луны на небе в выбранный момент. Оно постоянно меняется и не заменяет натальную Луну.',
        sections: [
          {
            title: 'Чем она отличается от натальной',
            paragraphs: [
              'Натальная Луна фиксирует положение при рождении. Текущая Луна продолжает движение и примерно за месяц проходит весь зодиак. Её знак сейчас зависит от даты и времени, а не от личной натальной карты.',
            ],
          },
          {
            title: 'Что можно описать',
            paragraphs: [
              'По текущему положению можно объяснить знак, фазу и астрономическую связь Луны с Солнцем. Нельзя по одному этому положению утверждать, какое настроение будет у конкретного человека или что с ним случится.',
            ],
          },
        ],
        shortAnswer: 'Текущая Луна относится к общему положению неба сейчас, а натальная Луна фиксирует личный момент рождения.',
      },
      en: {
        title: 'The current Moon',
        summary: 'The current Moon moves quickly through the zodiac and belongs to the shared sky context of a particular moment.',
        sections: [
          {
            title: 'How it differs from the natal Moon',
            paragraphs: [
              'The natal Moon is fixed for the moment of birth. The current Moon keeps moving and crosses the whole zodiac in roughly a month. Its sign is shared by everyone looking at the same moment, subject to precise timing.',
            ],
          },
          {
            title: 'What can be described',
            paragraphs: [
              'The current position can explain the Moon’s sign, phase, and astronomical relationship with the Sun. That position alone cannot establish a particular person’s mood or predict what will happen to them.',
            ],
          },
        ],
        shortAnswer: 'The current Moon describes a shared moment in the sky, while the natal Moon is personal birth-chart data.',
      },
    },
    relatedTopicIds: ['natal-moon', 'moon-phase', 'lunar-cycle-calendar'],
  },
  {
    id: 'moon-phase',
    category: 'moon-cycles',
    aliases: {
      ru: ['фаза луны', 'лунные фазы', 'какая сейчас фаза луны'],
      en: ['moon phase', 'lunar phases', 'current lunar phase'],
    },
    keywords: {
      ru: ['солнце и луна', 'освещённая часть', 'новолуние', 'полнолуние'],
      en: ['sun and moon', 'illuminated portion', 'new moon', 'full moon'],
    },
    copy: {
      ru: {
        title: 'Что такое фаза Луны',
        summary: 'Фаза Луны — это доля освещённой Солнцем стороны Луны, которую видно с Земли.',
        sections: [
          {
            title: 'Астрономическая основа',
            paragraphs: [
              'Луна не светится сама, а отражает солнечный свет. По мере её движения вокруг Земли меняется угол между Солнцем, Землёй и Луной. Поэтому видимая освещённая часть растёт, становится полной и затем уменьшается.',
            ],
          },
          {
            title: 'Названия фаз',
            paragraphs: [
              'Главные точки цикла называются новолунием, первой четвертью, полнолунием и последней четвертью. Между ними Луну называют растущей или убывающей. Границы в календаре зависят от точного момента расчёта.',
            ],
          },
        ],
        shortAnswer: 'Фаза Луны — видимая с Земли доля её освещённой стороны; она зависит от положения Луны относительно Земли и Солнца.',
      },
      en: {
        title: 'What a Moon phase is',
        summary: 'A phase shows how much of the Moon’s sunlit side is visible from Earth.',
        sections: [
          {
            title: 'The astronomical basis',
            paragraphs: [
              'The Moon does not make its own light; it reflects sunlight. As it travels around Earth, the angle between the Sun, Earth, and Moon changes. The visible illuminated portion therefore grows, becomes full, and then decreases.',
            ],
          },
          {
            title: 'Phase names',
            paragraphs: [
              'The cycle’s main points are called new moon, first quarter, full moon, and last quarter. Between them, the Moon is described as waxing or waning. Calendar boundaries depend on the exact calculated moment.',
            ],
          },
        ],
        shortAnswer: 'The Moon’s phase is determined by its position relative to Earth and the Sun.',
      },
    },
    relatedTopicIds: ['new-moon', 'full-moon', 'waxing-moon', 'waning-moon'],
  },
  {
    id: 'new-moon',
    category: 'moon-cycles',
    aliases: {
      ru: ['новолуние', 'новая луна', 'начало лунного цикла'],
      en: ['new moon', 'dark moon', 'start of lunar cycle'],
    },
    keywords: {
      ru: ['соединение солнца и луны', 'невидимая луна', 'лунный цикл'],
      en: ['sun moon conjunction', 'invisible moon', 'lunar cycle'],
    },
    copy: {
      ru: {
        title: 'Новолуние',
        summary: 'Новолуние — момент, когда Солнце и Луна находятся почти в одном направлении от Земли.',
        sections: [
          {
            title: 'Что видно с Земли',
            paragraphs: [
              'Освещённая сторона Луны в этот момент в основном обращена от наблюдателя, поэтому диск почти не виден. Точный момент новолуния рассчитывается для всей Земли, хотя календарная дата может различаться по часовым поясам.',
            ],
          },
          {
            title: 'Смысл в календаре',
            paragraphs: [
              'Новолуние принимают за начало нового лунного цикла. В астрологической традиции его связывают с новым началом, но это символическое значение, а не гарантия события или результата.',
            ],
          },
        ],
        shortAnswer: 'Новолуние — момент начала лунного цикла, когда с Земли видно минимум освещённой части Луны.',
      },
      en: {
        title: 'New moon',
        summary: 'A new moon occurs when the Sun and Moon lie in nearly the same direction as seen from Earth.',
        sections: [
          {
            title: 'What is visible from Earth',
            paragraphs: [
              'The Moon’s illuminated side is then mostly turned away from the observer, so its disk is nearly invisible. The exact new-moon moment is calculated globally, although the calendar date can differ by time zone.',
            ],
          },
          {
            title: 'Its place in the calendar',
            paragraphs: [
              'The new moon marks the start of a lunar cycle. Astrological tradition often associates it with setting an intention, but that is symbolic language rather than a guarantee of a beginning or outcome.',
            ],
          },
        ],
        shortAnswer: 'The new moon begins the astronomical lunar cycle, when the visible illuminated disk is minimal.',
      },
    },
    relatedTopicIds: ['moon-phase', 'waxing-moon', 'lunar-cycle-calendar'],
  },
  {
    id: 'full-moon',
    category: 'moon-cycles',
    aliases: {
      ru: ['полнолуние', 'полная луна', 'середина лунного цикла'],
      en: ['full moon', 'fully illuminated moon', 'middle of lunar cycle'],
    },
    keywords: {
      ru: ['оппозиция солнца и луны', 'освещённый диск', 'лунный цикл'],
      en: ['sun moon opposition', 'illuminated disk', 'lunar cycle'],
    },
    copy: {
      ru: {
        title: 'Полнолуние',
        summary: 'Полнолуние — момент, когда Солнце и Луна видны с Земли на противоположных сторонах неба.',
        sections: [
          {
            title: 'Почему диск полный',
            paragraphs: [
              'С Земли видна почти вся освещённая сторона Луны. Точная фаза длится один момент, хотя визуально диск выглядит полным до и после него. Часовой пояс влияет на календарную дату наблюдения.',
            ],
          },
          {
            title: 'Без обязательных последствий',
            paragraphs: [
              'В астрологической традиции полнолуние связывают с завершением или ясным итогом. Это не означает, что у каждого человека обязательно произойдёт важное событие, конфликт или резкая перемена настроения.',
            ],
          },
        ],
        shortAnswer: 'Полнолуние — момент лунного цикла, когда с Земли видна почти вся освещённая сторона Луны.',
      },
      en: {
        title: 'Full moon',
        summary: 'A full moon occurs when Earth lies roughly between the directions of the Sun and Moon.',
        sections: [
          {
            title: 'Why the disk looks full',
            paragraphs: [
              'Almost the entire illuminated side of the Moon is visible from Earth. The exact phase lasts for one moment, although the disk looks full before and after it. Time zone affects the local calendar date.',
            ],
          },
          {
            title: 'No required consequences',
            paragraphs: [
              'Astrological tradition associates the full moon with culmination or a clearer result. This does not mean that every person must experience an important event, a conflict, or a sudden mood change.',
            ],
          },
        ],
        shortAnswer: 'The full moon is the point in the cycle when almost the entire illuminated side is visible from Earth.',
      },
    },
    relatedTopicIds: ['moon-phase', 'waning-moon', 'lunar-cycle-calendar'],
  },
  {
    id: 'waxing-moon',
    category: 'moon-cycles',
    aliases: {
      ru: ['растущая луна', 'луна растёт', 'путь от новолуния к полнолунию'],
      en: ['waxing moon', 'moon growing', 'new moon to full moon'],
    },
    keywords: {
      ru: ['серп', 'первая четверть', 'увеличение освещённой части'],
      en: ['crescent', 'first quarter', 'increasing illuminated portion'],
    },
    copy: {
      ru: {
        title: 'Растущая Луна',
        summary: 'Растущей называют Луну в части цикла от новолуния к полнолунию, когда видимая освещённая доля увеличивается.',
        sections: [
          {
            title: 'Этапы роста',
            paragraphs: [
              'После тонкого серпа Луна проходит первую четверть, когда видна половина диска, а затем становится выпуклой. Название описывает видимое освещение, а не изменение физического размера Луны.',
            ],
          },
          {
            title: 'Традиционное чтение',
            paragraphs: [
              'В астрологических календарях эту часть цикла связывают с продолжением начатого. Это символическое значение, оно не сообщает, будет ли дело успешным.',
            ],
          },
        ],
        shortAnswer: 'Растущая Луна означает, что видимая освещённая часть диска увеличивается до полнолуния.',
      },
      en: {
        title: 'Waxing Moon',
        summary: 'The Moon is called waxing during the part of the cycle from new moon to full moon, when the visible illuminated portion increases.',
        sections: [
          {
            title: 'Stages of waxing',
            paragraphs: [
              'After a thin crescent, the Moon reaches first quarter, when half of the disk is visible, and then becomes gibbous. The name describes changing illumination, not a change in the Moon’s physical size.',
            ],
          },
          {
            title: 'Traditional interpretation',
            paragraphs: [
              'Astrological calendars often associate this part of the cycle with developing what has begun. That interpretation can serve as a planning metaphor, but it cannot establish whether an undertaking will succeed.',
            ],
          },
        ],
        shortAnswer: 'A waxing Moon means that the visible illuminated portion grows until the full moon.',
      },
    },
    relatedTopicIds: ['new-moon', 'full-moon', 'moon-phase'],
  },
  {
    id: 'waning-moon',
    category: 'moon-cycles',
    aliases: {
      ru: ['убывающая луна', 'луна убывает', 'путь от полнолуния к новолунию'],
      en: ['waning moon', 'moon decreasing', 'full moon to new moon'],
    },
    keywords: {
      ru: ['последняя четверть', 'уменьшение освещённой части', 'лунный серп'],
      en: ['last quarter', 'decreasing illuminated portion', 'lunar crescent'],
    },
    copy: {
      ru: {
        title: 'Убывающая Луна',
        summary: 'Убывающей называют Луну в части цикла от полнолуния к новолунию, когда видимая освещённая доля уменьшается.',
        sections: [
          {
            title: 'Как меняется вид',
            paragraphs: [
              'После полнолуния видимая освещённая доля уменьшается. Луна проходит последнюю четверть, затем остаётся тонкий серп. Это регулярная часть движения Луны вокруг Земли.',
            ],
          },
          {
            title: 'Традиционное чтение',
            paragraphs: [
              'В астрологических календарях убывающую часть цикла связывают с завершением и пересмотром. Это символическое значение, а не прогноз потери, спада или неудачи.',
            ],
          },
        ],
        shortAnswer: 'Убывающая Луна означает, что видимая освещённая часть уменьшается до новолуния.',
      },
      en: {
        title: 'Waning Moon',
        summary: 'The Moon is called waning during the part of the cycle from full moon to the next new moon.',
        sections: [
          {
            title: 'How its appearance changes',
            paragraphs: [
              'After the full moon, the visible illuminated portion decreases. The Moon passes last quarter and then becomes a thin crescent. This is a regular part of the Moon’s orbit around Earth.',
            ],
          },
          {
            title: 'Traditional interpretation',
            paragraphs: [
              'Astrological calendars often associate the waning part of the cycle with completion and review. This image does not require postponing new work and does not predict loss or decline.',
            ],
          },
        ],
        shortAnswer: 'A waning Moon means that the visible illuminated portion decreases until the new moon.',
      },
    },
    relatedTopicIds: ['full-moon', 'new-moon', 'moon-phase'],
  },
  {
    id: 'lunar-cycle-calendar',
    category: 'moon-cycles',
    aliases: {
      ru: ['лунный цикл', 'лунный календарь', 'лунный месяц'],
      en: ['lunar cycle', 'lunar calendar', 'lunar month'],
    },
    keywords: {
      ru: ['29,5 дня', 'фазы луны', 'часовой пояс', 'календарная дата'],
      en: ['29.5 days', 'moon phases', 'time zone', 'calendar date'],
    },
    copy: {
      ru: {
        title: 'Лунный цикл и календарь',
        summary: 'Лунный цикл — промежуток от одного новолуния до следующего. Он длится около месяца и включает повторяющуюся последовательность фаз.',
        sections: [
          {
            title: 'Как устроен цикл',
            paragraphs: [
              'После новолуния освещённая часть растёт до полнолуния, затем убывает до следующего новолуния. Фазы следуют непрерывно, а названия четвертей отмечают удобные точки в этом движении.',
            ],
          },
          {
            title: 'Почему даты отличаются',
            paragraphs: [
              'Астрономическое событие имеет один точный момент, но местная дата зависит от часового пояса. Разные календари также могут по-разному округлять границы фаз. Лунный календарь описывает цикл и сам по себе не является персональным прогнозом.',
            ],
          },
        ],
        shortAnswer: 'Лунный календарь отмечает датами лунный цикл продолжительностью около месяца и его основные фазы; это не персональный прогноз.',
      },
      en: {
        title: 'Lunar cycle and calendar',
        summary: 'A complete cycle from one new moon to the next lasts about 29.5 days and passes through the same sequence of phases.',
        sections: [
          {
            title: 'How the cycle works',
            paragraphs: [
              'After the new moon, the illuminated portion grows until the full moon and then decreases until the next new moon. The phases form a continuous sequence, while the quarter names mark convenient points in that movement.',
            ],
          },
          {
            title: 'Why dates differ',
            paragraphs: [
              'An astronomical event has one exact moment, but its local date depends on time zone. Calendars can also round phase boundaries differently. A lunar calendar describes the cycle and is not a personal forecast by itself.',
            ],
          },
        ],
        shortAnswer: 'A lunar calendar maps the continuous cycle of roughly 29.5 days into dates and named phases.',
      },
    },
    relatedTopicIds: ['moon-phase', 'new-moon', 'full-moon'],
  },
] satisfies readonly KnowledgeTopicSource[];
