import type { KnowledgeTopicSource } from './types';

export const FORECAST_TOPICS = [
  {
    id: 'natal-vs-current-period',
    category: 'forecasts',
    aliases: {
      ru: ['натальная карта и прогноз', 'карта рождения и текущий период', 'чем прогноз отличается от натала'],
      en: ['natal chart and forecast', 'birth chart and current period', 'natal reading versus forecast'],
    },
    keywords: {
      ru: ['натальная карта', 'текущий период', 'дата рождения', 'временный контекст'],
      en: ['natal chart', 'current period', 'birth date', 'temporary context'],
    },
    copy: {
      ru: {
        title: 'Натальная карта и текущий период',
        summary: 'Натальная карта фиксирует расчёт на момент рождения, а прогноз относится к ограниченному текущему периоду.',
        sections: [
          {
            title: 'Что остаётся постоянным',
            paragraphs: [
              'Положения планет в натальной карте рассчитываются по дате, времени и месту рождения. Этот расчёт не меняется каждый день. Натальная карта остаётся исходной картой рождения, а прогноз относится к конкретному текущему периоду.',
            ],
          },
          {
            title: 'Что меняется со временем',
            paragraphs: [
              'Текущий период имеет свои даты и длительность. Его описание отвечает на более узкий вопрос: на что обратить внимание сейчас. Нельзя выдавать постоянную черту карты за событие конкретного дня или месяца.',
            ],
          },
        ],
        shortAnswer: 'Натальная карта описывает исходные данные рождения, прогноз ограничен выбранным текущим периодом.',
      },
      en: {
        title: 'Natal chart and current period',
        summary: 'A natal chart fixes the calculation for the moment of birth, while a forecast concerns a limited current period.',
        sections: [
          {
            title: 'What remains constant',
            paragraphs: [
              'Planetary positions in a natal chart are calculated from the birth date, time, and place. This calculation does not change each day. It can supply personal context for discussing familiar responses and ways of choosing.',
            ],
          },
          {
            title: 'What changes over time',
            paragraphs: [
              'A current period has its own dates and duration. Its description answers a narrower question: what deserves attention now. A lasting natal trait should not be presented as an event assigned to one day or month.',
            ],
          },
        ],
        shortAnswer: 'The natal chart describes birth data, while a forecast is limited to the selected current period.',
      },
    },
    relatedTopicIds: ['transits-current-sky', 'forecast-day-week-month', 'forecast-not-guarantee'],
  },
  {
    id: 'transits-current-sky',
    category: 'forecasts',
    aliases: {
      ru: ['транзиты', 'текущее небо', 'планеты сейчас'],
      en: ['transits', 'current sky', 'planets now'],
    },
    keywords: {
      ru: ['текущие положения планет', 'аспект к натальной карте', 'период действия'],
      en: ['current planetary positions', 'aspect to natal chart', 'active period'],
    },
    copy: {
      ru: {
        title: 'Транзиты и текущее небо',
        summary: 'Транзит сравнивает положение планеты сейчас с натальной картой или описывает её текущее движение по зодиаку.',
        sections: [
          {
            title: 'Два вида контекста',
            paragraphs: [
              'Можно говорить об общем текущем небе, одинаковом для всех в один момент, или о связи текущей планеты с конкретной натальной картой. Второй вариант требует точного расчёта обеих позиций и не должен подменяться общими словами.',
            ],
          },
          {
            title: 'Период, а не команда',
            paragraphs: [
              'Транзит имеет начало, наиболее точную точку и завершение. Он может описывать тему времени, но не заставляет человека совершать определённый поступок. Решения остаются связанными с фактами, условиями и выбором.',
            ],
          },
        ],
        shortAnswer: 'Транзит связывает текущее положение планеты с моментом или натальной картой, но не диктует событие.',
      },
      en: {
        title: 'Transits and the current sky',
        summary: 'A transit compares a planet’s present position with a natal chart or describes its current movement through the zodiac.',
        sections: [
          {
            title: 'Two kinds of context',
            paragraphs: [
              'A reading may discuss the general current sky, which is shared by everyone at one moment, or a current planet’s relationship to a specific natal chart. The second requires an exact calculation of both positions and should not be replaced by generic wording.',
            ],
          },
          {
            title: 'A period, not a command',
            paragraphs: [
              'A transit has an opening phase, a closest point, and an ending phase. It may describe a theme in time, but it does not force a person to take a particular action. Decisions still depend on facts, circumstances, and choice.',
            ],
          },
        ],
        shortAnswer: 'A transit links a planet’s current position with a moment or natal chart; it does not dictate an event.',
      },
    },
    relatedTopicIds: ['natal-vs-current-period', 'forecast-day-week-month', 'forecast-not-guarantee'],
  },
  {
    id: 'forecast-day-week-month',
    category: 'forecasts',
    aliases: {
      ru: ['прогноз на день неделю месяц', 'периоды прогноза', 'сегодня неделя месяц'],
      en: ['day week month forecast', 'forecast periods', 'today week month'],
    },
    keywords: {
      ru: ['день', 'неделя', 'месяц', 'масштаб времени'],
      en: ['day', 'week', 'month', 'time scale'],
    },
    copy: {
      ru: {
        title: 'День, неделя и месяц',
        summary: 'Разные периоды меняют масштаб чтения: день требует конкретного фокуса, неделя общей линии, месяц более широкого направления.',
        sections: [
          {
            title: 'Один прогноз, три масштаба',
            paragraphs: [
              'Дневной текст относится к ближайшим решениям и наблюдениям. Недельный соединяет несколько дней в одну цельную картину. Месячный оставляет больше места для длительных задач и перемен темпа.',
            ],
          },
          {
            title: 'Без искусственного деления по дням',
            paragraphs: [
              'Неделю и месяц не обязательно делить на одинаковые этапы или рубрики. Если точных расчётных дат нет, текст не должен назначать событие на конкретный день. Период задаёт границы рассказа, а не расписание будущего.',
            ],
          },
        ],
        shortAnswer: 'День, неделя и месяц отличаются шириной обзора, а не степенью уверенности в будущем.',
      },
      en: {
        title: 'Day, week, and month',
        summary: 'Different periods change the scale of a reading: a day needs a close focus, a week one continuous line, and a month a broader direction.',
        sections: [
          {
            title: 'One forecast, three scales',
            paragraphs: [
              'A daily text concerns near-term choices and observations. A weekly text connects several days into one coherent view. A monthly text leaves more room for longer tasks and changes of pace.',
            ],
          },
          {
            title: 'Not a forced calendar',
            paragraphs: [
              'A week or month does not need to be divided into identical stages or categories. Without calculated event dates, the text should not assign an outcome to a specific day. The period sets the bounds of the reading, not a timetable for the future.',
            ],
          },
        ],
        shortAnswer: 'Day, week, and month differ in breadth of view, not in certainty about the future.',
      },
    },
    relatedTopicIds: ['natal-vs-current-period', 'transits-current-sky', 'forecast-not-guarantee'],
  },
  {
    id: 'forecast-not-guarantee',
    category: 'forecasts',
    aliases: {
      ru: ['прогноз не гарантия', 'предсказывает ли астрология события', 'можно ли верить прогнозу'],
      en: ['forecast is not a guarantee', 'does astrology predict events', 'can a forecast guarantee an outcome'],
    },
    keywords: {
      ru: ['не предсказание', 'неизбежность', 'выбор', 'вероятность'],
      en: ['not a prediction', 'inevitability', 'choice', 'probability'],
    },
    copy: {
      ru: {
        title: 'Прогноз не гарантирует событие',
        summary: 'Астрологический прогноз не сообщает точное будущее и не отменяет решения человека.',
        sections: [
          {
            title: 'Граница честного вывода',
            paragraphs: [
              'Даже точный расчёт положения планет не сообщает, что человек обязательно встретит кого-то, получит деньги или столкнётся с конфликтом. Для таких утверждений в карте недостаточно данных о реальных обстоятельствах.',
            ],
          },
          {
            title: 'Как использовать текст',
            paragraphs: [
              'Прогноз не заменяет проверку фактов, разговоров и текущих задач. В медицинских, юридических и финансовых вопросах нужны факты и профильная помощь, а не астрологическое обещание.',
            ],
          },
        ],
        shortAnswer: 'Прогноз предлагает направление для наблюдения, но не обещает конкретное событие.',
      },
      en: {
        title: 'A forecast does not guarantee an event',
        summary: 'An astrological forecast may offer a theme to observe, but it does not know the exact future or remove human choice.',
        sections: [
          {
            title: 'The boundary of an honest conclusion',
            paragraphs: [
              'Even an exact calculation of planetary positions cannot establish that someone will meet a person, receive money, or face a conflict. A chart does not contain enough information about real circumstances for such claims.',
            ],
          },
          {
            title: 'How to use the text',
            paragraphs: [
              'It is more useful to treat a forecast as a reason to examine current choices, conversations, and tasks with care. Medical, legal, and financial decisions require facts and qualified help, not an astrological promise.',
            ],
          },
        ],
        shortAnswer: 'A forecast offers a direction for observation; it does not promise a specific event.',
      },
    },
    relatedTopicIds: ['natal-vs-current-period', 'transits-current-sky', 'forecast-day-week-month'],
  },
] satisfies readonly KnowledgeTopicSource[];
