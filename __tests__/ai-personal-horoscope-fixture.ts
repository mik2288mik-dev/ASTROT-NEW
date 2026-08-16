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
        opening: 'Михаил, день сегодня с хорошим запасом хода. Используй его, пока настроение на твоей стороне.',
        forecast: 'Люди будут охотнее идти на контакт, и один обычный разговор может приятно сдвинуть дело с места. Хорошо пойдут занятия, где нужен вкус, реакция и немного смелости. В личном общении станет легче говорить без лишних объяснений. День не требует подвига — он даёт шанс быстро увидеть результат там, где ты уже начал. Оставь место для спонтанной идеи: сегодня она способна оказаться полезнее тщательно собранного плана.',
        advice: [
          'Напиши человеку, с которым давно хотел спокойно поговорить.',
          'Используй первую удачную идею, а не откладывай её.',
          'Оставь вечер свободным для приятного продолжения дня.',
        ],
      }
    : period === 'week'
      ? {
          opening: 'Михаил, неделя не собирается скучать. И тебе, похоже, тоже не придётся.',
          forecast: 'В начале появится хороший повод вернуть интерес к тому, что недавно казалось обычным. Общение станет живее, а одна симпатия или дружеская связь может заметно потеплеть. В делах поможет не осторожность, а нормальная решительность без лишней драматургии. Ближе к выходным станет ясно, какая идея действительно стоит продолжения. Деньги лучше идут через конкретное действие, а не долгие расчёты. Эта неделя даёт больше возможностей, чем препятствий, если не прятать инициативу.',
          advice: [
            'Сделай первый шаг там, где уже есть взаимный интерес.',
            'Покажи результат раньше, чем он станет идеальным.',
            'Запланируй одно событие, которого действительно ждёшь.',
          ],
        }
      : {
          opening: 'Михаил, месяц может приятно удивить. Только не делай вид, что ты против.',
          forecast: 'Главная линия месяца — расширение привычных возможностей без резкого переворота. Появится больше общения, новых идей и поводов выйти из обычного режима. В отношениях легче станет говорить прямо и получать такой же честный ответ. Финансовая тема потребует внимания, но не выглядит тяжёлой: разумный шаг способен дать заметный результат. Во второй половине месяца одна старая задумка получит нормальный шанс на продолжение. Самое полезное здесь — не ждать особого момента, а использовать хорошие условия, пока они действительно есть. Месяц обещает быть живым и довольно щедрым на приятные совпадения.',
          advice: [
            'Дай ход идее, которую уже можно показать людям.',
            'Не пропускай приглашение только из-за привычной лени.',
            'Часть результата сразу отложи, а остальным насладись.',
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
