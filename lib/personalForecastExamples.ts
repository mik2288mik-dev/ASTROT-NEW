import type { PersonalForecastPeriod } from './personalForecastContract';

type Tone = 'bright' | 'steady' | 'challenging';
type Output = {
  headline: string;
  forecast: string;
  closing: string;
};

export type PersonalForecastReferenceExample = {
  id: string;
  period: PersonalForecastPeriod;
  tone: Tone;
  input: {
    reader: { name: string; language: 'ru' };
    selected_period: {
      period: PersonalForecastPeriod;
      period_key: string;
      current_date: string;
      period_start: string;
      period_end: string;
      timezone: string;
    };
    astrologer_brief: {
      tone: 'favorable' | 'mixed' | 'demanding';
      core_forecast: string;
      secondary_forecast: string | null;
      distinctive_detail: string;
      opportunity: string | null;
      friction: string | null;
      likely_result: string;
    };
    anti_repeat_context: { recent_forecasts: [] };
  };
  output: Output;
};

function window(period: PersonalForecastPeriod) {
  const dates = period === 'day'
    ? ['2026-08-20', '2026-08-20', '2026-08-20']
    : period === 'week'
      ? ['2026-W34', '2026-08-17', '2026-08-23']
      : ['2026-08', '2026-08-01', '2026-08-31'];
  return {
    period,
    period_key: dates[0],
    current_date: '2026-08-20',
    period_start: dates[1],
    period_end: dates[2],
    timezone: 'Europe/Moscow',
  };
}

function compact(value: string): string {
  return value.trim().split(/\s+/u).slice(0, 14).join(' ');
}

function example(
  id: string,
  period: PersonalForecastPeriod,
  tone: Tone,
  name: string,
  output: Output,
): PersonalForecastReferenceExample {
  const sentences = output.forecast.split(/(?<=[.!?])\s+/u).filter(Boolean);
  const briefTone = tone === 'bright' ? 'favorable' : tone === 'challenging' ? 'demanding' : 'mixed';
  return {
    id,
    period,
    tone,
    output,
    input: {
      reader: { name, language: 'ru' },
      selected_period: window(period),
      astrologer_brief: {
        tone: briefTone,
        core_forecast: compact(sentences[0] || output.forecast),
        secondary_forecast: sentences[1] ? compact(sentences[1]) : null,
        distinctive_detail: compact(sentences[2] || output.closing),
        opportunity: briefTone === 'favorable' ? compact(sentences[1] || output.closing) : null,
        friction: briefTone === 'demanding' ? compact(sentences[0] || output.forecast) : null,
        likely_result: compact(output.closing),
      },
      anti_repeat_context: { recent_forecasts: [] },
    },
  };
}

/** Единственный утверждённый runtime-корпус личного Today / Week / Month. */
export const PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU: readonly PersonalForecastReferenceExample[] = [
  example('day-own-it', 'day', 'bright', 'Мира', {
    headline: 'День твой. Забирай.',
    forecast: 'Сегодня многое складывается в твою пользу без уговоров. Люди охотнее идут навстречу, идея быстро находит поддержку, а спонтанное «почему бы и нет» может оказаться самым удачным пунктом дня. Не прячь интерес к хорошему под видом скромности.',
    closing: 'Бери хорошее без сдачи.',
  }),
  example('day-go-higher', 'day', 'bright', 'Ирина', {
    headline: 'Можно выше.',
    forecast: 'Сегодня не нужно уменьшать свои желания, чтобы выглядеть удобным человеком. Там, где обычно хочется промолчать или отступить на полшага, можно спокойно обозначить себя. Ирина, твой интерес сегодня звучит убедительно без длинных речей.',
    closing: 'Скромность сегодня отдыхает.',
  }),
  example('day-luck-is-here', 'day', 'bright', 'Лена', {
    headline: 'Случай на твоей стороне.',
    forecast: 'День умеет приятно подмигнуть: нужная мысль приходит вовремя, привычный маршрут даёт неожиданно хороший поворот, а простая встреча оставляет после себя больше, чем обещала. Не забивай всё до последней минуты — хорошему тоже нужен вход без записи.',
    closing: 'Жизнь сегодня не жадничает.',
  }),
  example('day-no-heroics', 'day', 'challenging', 'Марина', {
    headline: 'Без лишнего героизма.',
    forecast: 'Сегодня не надо быть одновременно спасателем, диспетчером и человеком-оркестром. Оставь себе нормальный темп, закрой то, что действительно висит перед глазами, и не открывай пять новых вкладок ради красивой суеты. День станет легче, если не тащить чужое.',
    closing: 'Мир переживёт твоё «не сейчас».',
  }),
  example('week-with-appetite', 'week', 'bright', 'Саша', {
    headline: 'Неделя с аппетитом.',
    forecast: 'Появится больше поводов выбраться из привычного круга: новое место, хорошая компания, короткая поездка или внезапный план, который окажется лучше старого. В делах тоже будет толк, если не превращать каждую мелочь в государственный проект. Оставь в календаре воздух: у этой недели есть что предложить помимо обязательной программы.',
    closing: 'Удовольствие тоже идёт в зачёт.',
  }),
  example('week-quietly-positive', 'week', 'steady', 'Ирина', {
    headline: 'Тихо, но в плюс.',
    forecast: 'Неделя не обещает цирк с прожекторами — и отлично. В спокойном темпе наладятся мелочи, которые давно раздражали: дома станет удобнее, деньги понятнее, а люди — честнее в своих намерениях. Хорошо покупать то, чем будешь пользоваться, встречаться с теми, после кого не хочется восстанавливаться, и делать жизнь чуть проще.',
    closing: 'Удобно — это не скучно.',
  }),
  example('week-not-your-rush', 'week', 'challenging', 'Денис', {
    headline: 'Чужая спешка мимо.',
    forecast: 'Кто-то попытается вбежать в твою неделю с криком «срочно». Не обязательно пускать его в дом вместе с обувью. Смотри не на громкость, а на смысл. Всё стоящее выдержит нормальный срок и ясный ответ. А у тебя освободится место для вещи, от которой давно хотелось избавиться, и для идеи, которую приятно наконец довести.',
    closing: 'Не плати своим временем за чужой бардак.',
  }),
  example('month-opens-doors', 'month', 'bright', 'Алина', {
    headline: 'Месяц открывает двери.',
    forecast: 'Этот месяц добавит движения: интересное приглашение, новое место, симпатия, которой надоело сидеть в тени, или занятие, от которого неожиданно станет веселее жить. Не всё хорошее приходит с фанфарами; иногда оно просто оказывается рядом, пока ты не занят привычной беготнёй. В покупках тянись к качеству, в людях — к лёгкости, в планах — к тому, что правда хочется попробовать.',
    closing: 'Особый случай уже пришёл.',
  }),
  example('month-calm-and-beautiful', 'month', 'steady', 'Роман', {
    headline: 'Спокойно, зато красиво.',
    forecast: 'Месяц соберёт в одну картину то, что раньше выглядело россыпью мелочей. Что-то завершится без драм, привычное место станет удобнее, а навык, который ты развивал без рекламы, начнёт приносить реальную пользу. Не нужно устраивать рывок века. Достаточно не бросать хорошее на середине и замечать, сколько уже сделано.',
    closing: 'Доводи красивое до конца.',
  }),
  example('month-extra-retreats', 'month', 'challenging', 'Ника', {
    headline: 'Лишнее сдаёт позиции.',
    forecast: 'Месяц быстро покажет цену всему, что забирает много сил и почти ничего не отдаёт взамен. Большая драма не потребуется: пару раз вовремя отказаться — и дышать станет заметно свободнее. Освободившееся место пригодится для нормального отдыха, живых встреч и дел, за которые не хочется извиняться. Скидка, чужая путаница и мутные обещания пусть развлекаются без тебя.',
    closing: 'Оставь себе лучшее.',
  }),
];

const RUNTIME_REFERENCE_IDS: Record<PersonalForecastPeriod, readonly string[]> = {
  day: ['day-own-it', 'day-go-higher', 'day-no-heroics'],
  week: ['week-with-appetite', 'week-quietly-positive', 'week-not-your-rush'],
  month: ['month-opens-doors', 'month-calm-and-beautiful', 'month-extra-retreats'],
};

export function renderPersonalForecastReferenceExamples(
  language: 'ru' | 'en',
  period: PersonalForecastPeriod,
): string {
  if (language !== 'ru') return '';
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((item) => RUNTIME_REFERENCE_IDS[period].includes(item.id))
    .map((item) => `<forecast_example_input>\n${JSON.stringify(item.input, null, 2)}\n</forecast_example_input>\n<forecast_example_output>\n${JSON.stringify(item.output, null, 2)}\n</forecast_example_output>`)
    .join('\n\n');
}

export function getPersonalForecastRuntimeExampleIds(period: PersonalForecastPeriod): string[] {
  return [...RUNTIME_REFERENCE_IDS[period]];
}

export function getDisabledPersonalForecastRuntimeExampleIds(period: PersonalForecastPeriod): string[] {
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((item) => item.period === period && !RUNTIME_REFERENCE_IDS[period].includes(item.id))
    .map((item) => item.id);
}

export function getPersonalForecastReferenceFragments(period: PersonalForecastPeriod) {
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((item) => item.period === period)
    .flatMap((item) => [
      { kind: 'headline' as const, text: item.output.headline },
      ...[item.output.forecast, item.output.closing].map((text) => ({
        kind: 'fragment' as const,
        text,
        mainIdeaKey: '',
        lifePlotKey: '',
        adviceKey: '',
        comparisonKey: '',
      })),
    ]);
}
