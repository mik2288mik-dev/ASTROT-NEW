import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  AI_PERSONAL_HOROSCOPE_VERSION,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
} from '../lib/aiPersonalHoroscope';

function periodWindow(period: AiPersonalHoroscopePeriod) {
  if (period === 'day') {
    return {
      periodKey: '2026-07-26',
      currentDate: '2026-07-26',
      periodStart: '2026-07-26',
      periodEnd: '2026-07-26',
      dateLabel: 'ВОСКРЕСЕНЬЕ\n26 ИЮЛЯ',
    };
  }
  if (period === 'week') {
    return {
      periodKey: '2026-W30',
      currentDate: '2026-07-26',
      periodStart: '2026-07-20',
      periodEnd: '2026-07-26',
      dateLabel: '20 ИЮЛЯ — 26 ИЮЛЯ',
    };
  }
  return {
    periodKey: '2026-07',
    currentDate: '2026-07-26',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    dateLabel: 'ИЮЛЬ 2026 Г.',
  };
}

export function aiPersonalHoroscopeFixture(
  period: AiPersonalHoroscopePeriod = 'day',
): AiPersonalHoroscopePackage {
  const window = periodWindow(period);
  const reading = period === 'day'
    ? {
        opening: 'Михаил, харизму не прячь.',
        forecast: 'Внимания вокруг тебя сегодня больше, и оно скорее приятное: люди охотнее поддерживают разговор, а симпатия считывается без долгих расшифровок. Хорошо заходят встречи, лёгкий флирт и всё, где можно быть собой без серьёзного лица.',
        advice: [
          'Тебя сегодня замечают.',
          'Улыбнуться в ответ — вполне рабочая стратегия.',
        ],
      }
    : period === 'week'
      ? {
          opening: 'Скучно не будет, это точно.',
          forecast: 'Вокруг становится больше движения: люди чаще зовут, разговоры дают новые идеи, а привычный маршрут легко меняется на что-то интереснее. Одна спонтанная история может вытянуть за собой ещё несколько приятных событий, особенно если не пытаться заранее расписать каждую мелочь. Ближе к выходным особенно хорошо заходят компания, новые места и всё, после чего хочется сказать: «Вот это было не зря».',
          advice: [
            'Неделя явно за впечатления.',
            'Оставь немного места для внезапных планов.',
            'Самое интересное может прийти без приглашения.',
          ],
        }
      : {
          opening: 'Фотографий станет заметно больше.',
          forecast: 'Поводов выйти из дома, куда-то съездить и увидеть людей становится больше, причём многие планы появляются буквально на ходу. Новые знакомства входят легко, старые друзья чаще напоминают о себе, а привычные места внезапно снова выглядят интересными. Деньги временами уходят на еду, поездки и удовольствия, но без ощущения, что каждая трата была ошибкой века. К финалу месяца особенно заметно, что жизнь стала насыщеннее и в ней появилось больше вещей, которых приятно ждать.',
          advice: [
            'Месяц явно собирает впечатления.',
            'Оставь место для красивого и вкусного.',
            'Хорошие воспоминания редко бывают слишком практичными.',
          ],
        };

  return {
    version: AI_PERSONAL_HOROSCOPE_VERSION,
    period,
    ...window,
    timezone: 'Europe/Moscow',
    reading,
    meta: {
      model: 'gpt-5.6-luna',
      promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
      contractVersion: AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
      cacheVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
      generationAttempts: 1,
      generatedAt: '2026-07-26T10:00:00.000Z',
      status: 'ready',
    },
  };
}

export function weeklyAiPersonalHoroscopeFixture(): AiPersonalHoroscopePackage {
  return aiPersonalHoroscopeFixture('week');
}
