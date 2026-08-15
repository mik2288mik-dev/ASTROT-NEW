import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  AI_PERSONAL_HOROSCOPE_VERSION,
  buildAiPersonalHoroscopeContinuity,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
} from '../lib/aiPersonalHoroscope';

const profile = {
  id: '42',
  name: 'Михаил',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Москва',
  language: 'ru' as const,
};

function periodWindow(period: AiPersonalHoroscopePeriod) {
  if (period === 'day') {
    return {
      periodKey: '2026-07-26',
      periodStart: '2026-07-26',
      periodEnd: '2026-07-26',
      dateLabel: 'ВОСКРЕСЕНЬЕ\n26 ИЮЛЯ',
    };
  }
  if (period === 'week') {
    return {
      periodKey: '2026-W30',
      periodStart: '2026-07-20',
      periodEnd: '2026-07-26',
      dateLabel: '20 ИЮЛЯ — 26 ИЮЛЯ',
    };
  }
  return {
    periodKey: '2026-07',
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
        opening: 'Михаил, сегодня всё будет изображать срочность. Не ведись.',
        forecast: 'Дела полезут без очереди, но это не повод хвататься за всё сразу. Один вопрос действительно потребует внимания, остальные просто громко лежат рядом. Люди могут отвлекать, и тут важно не превращать чужой темп в свой. Оставь рабочее рабочим и не переделывай то, что уже нормально держится. День станет проще, как только перестанешь добавлять ему лишние этажи.',
        advice: [
          'Выбери одно дело и доведи его до конца.',
          'Не объясняй очевидное третий раз.',
          'Новое начинай только после закрытого старого.',
        ],
      }
    : period === 'week'
      ? {
          opening: 'Михаил, неделя попробует продать тебе спешку как преимущество. Не покупай.',
          forecast: 'В ближайшие дни появится несколько поводов резко менять планы, хотя реальной необходимости в этом не будет. Самый громкий запрос окажется не самым важным. Один разговор поможет отделить нормальную просьбу от попытки повесить на тебя чужую суету. Дальше станет легче: останутся только вопросы, которые действительно твои. Неделя пройдёт нормально, если ты не будешь каждый новый шум считать командой к старту.',
          advice: [
            'Отвечай только после понятного запроса.',
            'Не меняй план из-за чужой спешки.',
            'Оставь свободным хотя бы один вечер.',
          ],
        }
      : {
          opening: 'Михаил, месяц предложит много красивых отвлечений. Красивые — не значит нужные.',
          forecast: 'Основная история месяца будет крутиться вокруг выбора, на что действительно стоит тратить внимание. Несколько идей покажутся срочными только потому, что выглядят новыми. Одна из них быстро сдуется, когда дойдёт до конкретных действий. Зато старый вопрос наконец станет проще и потребует обычного решения, без спектакля. К концу месяца выиграет не самый эффектный вариант, а тот, который можно спокойно продолжать дальше.',
          advice: [
            'Проверяй новую идею первым реальным действием.',
            'Не плати вниманием за красивую упаковку.',
            'Закрой один старый вопрос без нового сезона.',
          ],
        };

  return {
    version: AI_PERSONAL_HOROSCOPE_VERSION,
    period,
    ...window,
    timezone: 'Europe/Moscow',
    reading,
    continuity: buildAiPersonalHoroscopeContinuity(reading, profile),
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
