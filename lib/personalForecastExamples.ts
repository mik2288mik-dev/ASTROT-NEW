import type { PersonalForecastPeriod } from './personalForecastContract';

type Tone = 'bright' | 'steady' | 'challenging';
type Output = {
  headline: string;
  forecast: string;
  takeaway: string;
  do: string;
  dont: string;
  closing: string;
};

export type PersonalForecastReferenceExample = {
  id: string;
  period: PersonalForecastPeriod;
  tone: Tone;
  input: {
    reader: { name: string; language: 'ru' };
    selected_period: {
      period: PersonalForecastPeriod; period_key: string; current_date: string;
      period_start: string; period_end: string; timezone: string;
    };
    astrologer_brief: {
      tone: 'favorable' | 'mixed' | 'demanding';
      core_forecast: string; secondary_forecast: string | null;
      distinctive_detail: string; opportunity: string | null;
      friction: string | null; likely_result: string;
    };
    anti_repeat_context: { recent_forecasts: [] };
  };
  output: Output;
};

type Profile = { name: string };

function window(period: PersonalForecastPeriod) {
  const dates = period === 'day'
    ? ['2026-08-20', '2026-08-20', '2026-08-20']
    : period === 'week'
      ? ['2026-W34', '2026-08-17', '2026-08-23']
      : ['2026-08', '2026-08-01', '2026-08-31'];
  return { period, period_key: dates[0], current_date: '2026-08-20', period_start: dates[1], period_end: dates[2], timezone: 'Europe/Moscow' };
}

function example(id: string, period: PersonalForecastPeriod, tone: Tone, profile: Profile, output: Output): PersonalForecastReferenceExample {
  const sentences = output.forecast.split(/(?<=[.!?])\s+/u).filter(Boolean);
  const compact = (value: string) => value.trim().split(/\s+/u).slice(0, 14).join(' ');
  const briefTone = tone === 'bright' ? 'favorable' : tone === 'challenging' ? 'demanding' : 'mixed';
  return {
    id, period, tone, output,
    input: {
      reader: { name: profile.name, language: 'ru' },
      selected_period: window(period),
      astrologer_brief: {
        tone: briefTone,
        core_forecast: compact(sentences[0] || output.forecast),
        secondary_forecast: sentences[1] ? compact(sentences[1]) : null,
        distinctive_detail: compact(sentences[2] || output.closing),
        opportunity: briefTone === 'favorable' ? compact(output.takeaway) : null,
        friction: briefTone === 'demanding' ? compact(output.dont) : null,
        likely_result: compact(output.closing),
      },
      anti_repeat_context: { recent_forecasts: [] },
    },
  };
}

/** Runtime corpus: complete strict-output few-shots, not text templates. */
export const PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU: readonly PersonalForecastReferenceExample[] = [
  example('day-bright-own-it', 'day', 'bright', { name: 'Мира' }, {
    headline: 'День твой. Забирай.',
    forecast: 'Сегодня многое складывается в твою пользу без уговоров. Люди охотнее идут навстречу, интересная идея быстро находит поддержку, а спонтанное «почему бы и нет» может оказаться лучшей частью дня.',
    takeaway: 'День любит тех, кто не уменьшает себя заранее.',
    do: 'Предлагай своё смелее.', dont: 'Не тяни паузу.', closing: 'Удача сегодня не жадничает.',
  }),
  example('day-bold', 'day', 'steady', { name: 'Ирина' }, {
    headline: 'Сегодня можно наглеть.',
    forecast: 'День поддержит инициативу. Предложения будут звучать убедительнее, люди быстрее поймут, чего ты хочешь, а удачные варианты появятся без долгих поисков. Сегодня полезнее самому открыть дверь, чем стоять рядом и ждать приглашения.',
    takeaway: 'Первый ход сегодня за тобой.', do: 'Называй свои условия.', dont: 'Не уменьшай запрос.', closing: 'Скромность сегодня взяла выходной.',
  }),
  example('day-warm-luck', 'day', 'bright', { name: 'Лена' }, {
    headline: 'Удача вышла на смену.',
    forecast: 'Сегодня приятные совпадения будут работать в твою пользу. Нужная мысль придёт к месту, обычное дело даст больше, чем ожидалось, а встреча может оказаться теплее обычного. Оставь немного воздуха: интересное способно появиться без записи.',
    takeaway: 'Жизнь сегодня явно не жадничает.', do: 'Оставь место случаю.', dont: 'Не забивай всё планами.', closing: 'Похоже, сегодня жизнь за тебя.',
  }),
  example('day-steady', 'day', 'challenging', { name: 'Марина' }, {
    headline: 'Без лишней суеты.',
    forecast: 'День не требует от тебя невозможного. Обычные вещи дадут хороший результат, если не раздувать их до марафона. Там, где хочется добавить ещё десять пунктов, лучше оставить нормальный объём и закончить без цирка.',
    takeaway: 'Нормальный темп часто выигрывает у суеты.', do: 'Делай без марафона.', dont: 'Не усложняй простое.', closing: 'Спокойный день тоже может быть твоим.',
  }),
  example('week-tasty', 'week', 'bright', { name: 'Саша' }, {
    headline: 'Неделя с аппетитом.',
    forecast: 'Появится больше поводов выйти из дома не потому, что надо, а потому что интересно. Новые места, короткие поездки, вкусная еда и хорошая компания зайдут лучше привычной гонки. Симпатия может стать заметнее, а скучный план уступит место чему-то гораздо веселее. В обычных делах тоже будет толк, если не превращать каждую мелочь в государственный проект.',
    takeaway: 'Тебе полезно не только успевать, но и жить с удовольствием.', do: 'Выходи в новые места.', dont: 'Не забивай календарь.', closing: 'Хорошее не нужно заслуживать.',
  }),
  example('week-easier', 'week', 'steady', { name: 'Ирина' }, {
    headline: 'Неделя по-человечески.',
    forecast: 'Неделя не обещает фейерверк — и отлично. Наладятся мелочи, которые давно раздражали: дома станет удобнее, деньги понятнее, а рядом останутся люди, с которыми можно не играть роль. Хорошо покупать то, чем будешь пользоваться, и оставлять себе свободное время без чувства вины. Простые варианты окажутся полезнее красивых усложнений, и это редкий подарок для уставшей головы, между прочим.',
    takeaway: 'Удобно — это не скучно, а умно.', do: 'Выбирай удобное для себя.', dont: 'Не усложняй простое.', closing: 'Нормальная жизнь тоже считается.',
  }),
  example('week-lively', 'week', 'challenging', { name: 'Денис' }, {
    headline: 'Неделя без серости.',
    forecast: 'Случайных планов станет меньше, а того, после чего остаётся приятное чувство «не зря», больше. Хорошо пойдут обновления дома, небольшие поездки, покупки для удовольствия и люди, с которыми не надо изображать бодрость. Одна живая идея быстро вытеснит несколько скучных пунктов — и правильно сделает. Свободный вечер даст больше сил, чем ещё один пункт в списке.',
    takeaway: 'Хорошее настроение не отвлекает от жизни.', do: 'Оставь место хорошему.', dont: 'Не соглашайся на скуку.', closing: 'Жизнь не обязана быть полезной каждую минуту.',
  }),
  example('month-generous', 'month', 'bright', { name: 'Алина' }, {
    headline: 'Месяц открывает двери.',
    forecast: 'Появится движение: интересное приглашение, новое место, симпатия или занятие, от которого жить станет веселее. Не всё хорошее приходит с фанфарами; иногда оно просто оказывается рядом. Скучный маршрут можно менять без комиссии и согласования — наконец-то нормальные новости. Хорошо зайдут обновления дома, внешнего вида и привычного круга. В людях выбирай лёгкость, в покупках — качество. Остальное подождёт, и это не мелочь. И это приятно.',
    takeaway: 'Жизнь интереснее, когда ты берёшь не только безопасное.', do: 'Меняй привычный маршрут.', dont: 'Не выбирай только безопасное.', closing: 'Особый случай уже пришёл.',
  }),
  example('month-results', 'month', 'steady', { name: 'Роман' }, {
    headline: 'Спокойно, зато красиво.',
    forecast: 'То, что раньше выглядело россыпью мелочей, начнёт собираться в понятную картину. Что-то завершится без драм, привычное место станет удобнее, а навык, который ты развивал без рекламы, начнёт реально помогать. Хорошее не требует рывка века — оно любит, когда его просто не бросают. Люди рядом покажут себя без лишних слов, а пару старых мелочей наконец удастся закрыть без лишней беготни и надрыва.',
    takeaway: 'Спокойный ход тоже приносит заметный результат.', do: 'Доводи хорошее до конца.', dont: 'Не бросай на середине.', closing: 'Ты не стоишь на месте. Просто без флага.',
  }),
  example('month-less-is-better', 'month', 'challenging', { name: 'Ника' }, {
    headline: 'Лишнее сдаёт позиции.',
    forecast: 'Станет заметнее цена привычек, которые забирают много сил и мало дают взамен. Ненужные покупки, мутные обещания и вечное «потом» быстро теряют власть, если перестать кормить их вниманием. Скидка не делает вещь нужной — она просто делает ценник красным. Свободного места станет больше — для отдыха, нормальных встреч и вещей, которые правда радуют. Большую драму устраивать не придётся, и это отличная новость, правда.',
    takeaway: 'Рядом должно оставаться то, от чего тебе хорошо.', do: 'Оставляй полезное рядом.', dont: 'Не корми лишнее вниманием.', closing: 'Остальное как-нибудь переживёт твой отказ.',
  }),
];

const RUNTIME_REFERENCE_IDS: Record<PersonalForecastPeriod, readonly string[]> = {
  day: ['day-bright-own-it', 'day-bold', 'day-steady'],
  week: ['week-tasty', 'week-easier', 'week-lively'],
  month: ['month-generous', 'month-results', 'month-less-is-better'],
};

export function renderPersonalForecastReferenceExamples(language: 'ru' | 'en', period: PersonalForecastPeriod): string {
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
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.filter((item) => item.period === period && !RUNTIME_REFERENCE_IDS[period].includes(item.id)).map((item) => item.id);
}

export function getPersonalForecastReferenceFragments(period: PersonalForecastPeriod) {
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.filter((item) => item.period === period).flatMap((item) => [
    { kind: 'headline' as const, text: item.output.headline },
    ...[item.output.forecast, item.output.takeaway, item.output.do, item.output.dont, item.output.closing].map((text) => ({
      kind: 'fragment' as const, text, mainIdeaKey: '', lifePlotKey: '', adviceKey: '', comparisonKey: '',
    })),
  ]);
}
