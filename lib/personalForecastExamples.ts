import type { PersonalForecastPeriod } from './personalForecastContract';

type ClosingKind = 'advice' | 'action' | 'avoidance' | 'wish' | 'motivation';
type Tone = 'bright' | 'steady' | 'challenging';

export type PersonalForecastReferenceExample = {
  id: string;
  period: PersonalForecastPeriod;
  tone: Tone;
  input: { period: PersonalForecastPeriod; name: string; birth_date: string; birth_time: string | null; birth_place: string | null };
  output: {
    headline: { text: string; evidence_ids: ['profile:personal'] };
    fragments: Array<{
      text: string;
      presentation_style?: 'prose' | 'pull_quote' | 'paper_note';
      main_idea_key: string;
      life_plot_key: string;
      advice_key: string;
      comparison_key: string;
      evidence_ids: ['profile:personal'];
    }>;
    closing: { text: string; kind: ClosingKind; advice_key: string; evidence_ids: ['profile:personal'] };
  };
};

const evidenceIds = (): ['profile:personal'] => ['profile:personal'];

function reference(
  id: string,
  period: PersonalForecastPeriod,
  tone: Tone,
  name: string,
  fragments: string[],
  headline: string,
  closing: string,
  kind: ClosingKind,
): PersonalForecastReferenceExample {
  return {
    id,
    period,
    tone,
    input: { period, name, birth_date: '1990-01-01', birth_time: null, birth_place: 'Москва' },
    output: {
      headline: { text: headline, evidence_ids: evidenceIds() },
      fragments: fragments.map((text, index) => ({
        text,
        presentation_style: 'prose',
        main_idea_key: `reference-${id}-${index + 1}`,
        life_plot_key: `reference-${id}-plot-${index + 1}`,
        advice_key: `reference-${id}-guidance-${index + 1}`,
        comparison_key: '',
        evidence_ids: evidenceIds(),
      })),
      closing: { text: closing, kind, advice_key: `reference-${id}-closing`, evidence_ids: evidenceIds() },
    },
  };
}

/**
 * Approved editorial corpus. These are complete input/output few-shots, not
 * reusable templates. Keep the visible text word-for-word unless the product
 * owner explicitly approves a replacement.
 */
export const PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU: readonly PersonalForecastReferenceExample[] = [
  reference('day-bright-own-it', 'day', 'bright', 'Мира', [
    'Сегодня многое будет получаться с первого захода.',
    'Разговоры пойдут легко, решения станут яснее, а люди окажутся сговорчивее обычного.',
    'Самое время предлагать своё и занимать место, которое тебе действительно интересно.',
    'Выбери главную цель и иди к ней без лишних церемоний. Можно просить больше, говорить увереннее и соглашаться на интересное.',
  ], 'День твой. Забирай.', 'Хороший день. Пользуйся щедро.', 'action'),
  reference('day-bold', 'day', 'steady', 'Ирина', [
    'В хорошем смысле.',
    'День поддержит тех, кто действует первым: отправляет сообщение, предлагает встречу, называет свои условия, берётся за интересную задачу.',
    'Инициатива сегодня прозвучит убедительнее долгих объяснений.',
    'Направь этот напор в одно точное действие. Ирина, выбери то, что действительно хочется получить, и сделай первый ход.',
  ], 'Сегодня можно наглеть.', 'Скромность сегодня взяла выходной.', 'motivation'),
  reference('day-warm-luck', 'day', 'bright', 'Лена', [
    'Сегодня приятные совпадения будут работать в твою пользу.',
    'Ответ придёт вовремя, удачная мысль появится к месту, а обычное дело даст результат лучше ожидаемого.',
    'День явно решил показать, что умеет быть щедрым.',
    'Оставь в планах немного свободного места.',
    'Самое интересное может появиться без предварительной записи.',
    'Соглашайся на живые идеи и выбирай то, от чего прибавляется сил.',
  ], 'Удача вышла на смену.', 'Похоже, сегодня жизнь за тебя.', 'wish'),
  reference('day-no-heroics', 'day', 'challenging', 'Марина', [
    'День может попытаться выдать чужую спешку за твою обязанность.',
    'Не покупайся.',
    'Сначала закончи то, что действительно важно тебе, а уже потом отвечай на всё остальное.',
    'При этом день вполне нормальный: он лучше работает с коротким списком и ясными решениями.',
    'Хорошо пойдут дела, где можно поставить точку, а не открыть ещё пять вкладок.',
    'Оставь часть дня себе, нормальной еде и чему-нибудь, что не требует отчёта.',
  ], 'Сегодня без геройства.', 'Не спасай весь мир. Сегодня он справится сам.', 'avoidance'),
  reference('week-tasty', 'week', 'bright', 'Саша', [
    'Появится больше поводов выйти из дома не потому, что надо, а потому что интересно. Хорошо зайдут новые места, короткие поездки, вкусная еда и компания, в которой не приходится смотреть на часы. Симпатия может стать заметнее, а скучный план — внезапно уступить место чему-то лучше. Не забивай календарь до упора: этой неделе нужен воздух для случайной радости. В делах тоже будет толк, если не превращать каждую задачу в государственный проект. Сделал, отметил, пошёл жить дальше.',
  ], 'Неделя будет вкусной.', 'Оставь место для удовольствия. Оно тоже умеет быть полезным.', 'advice'),
  reference('week-no-circus', 'week', 'steady', 'Ирина', [
    'Неделя даст спокойный темп, в котором многое получится без гонки. Деньги потребуют обычной аккуратности, дом — пары удобных решений, а люди — ясных слов без длинных предисловий. Хорошее время для разумных покупок, завершения накопившегося и встреч, которые действительно радуют. Выбирай простые варианты без подозрений: удобное может оказаться лучшим, а пустое место в календаре — вполне серьёзным планом. Чем меньше лишнего шума ты сам добавишь, тем больше успеешь и тем приятнее окажется результат.',
  ], 'Неделя без цирка.', 'Сделай жизнь немного удобнее. Не всё полезное обязано быть подвигом.', 'action'),
  reference('week-precision', 'week', 'challenging', 'Денис', [
    'Несколько дел могут одновременно объявить себя главными, а пара людей — решить, что твоё время лежит в общем доступе. Не спорь с громкостью; смотри на последствия. То, что действительно важно, выдержит уточняющий вопрос и нормальный срок. Остальное быстро сдуется. Тебе пригодится прямота без грубости: назвать цену, отказаться от неудобного, перенести то, что не помещается, и не обещать лишнего ради красивой картинки. И у этой недели есть хороший бонус: один сложный вопрос можно закрыть окончательно, а освободившееся место быстро займёт что-то гораздо приятнее.',
  ], 'Неделя любит точность.', 'Не покупай чужую срочность своим временем.', 'avoidance'),
  reference('month-generous', 'month', 'bright', 'Алина', [
    'У тебя станет больше поводов выйти из привычного маршрута: новое место, интересное предложение, человек с хорошей идеей или занятие, которое неожиданно затянет. Не всё потребует великого решения — и слава богу. Месяц хорош именно тем, что приятные возможности не требуют торжественной музыки. В делах выбирай то, где есть движение и понятная отдача. В отношениях говори прямо, не превращая симпатию в многоходовку. В покупках лучше одна качественная вещь, чем три случайных. Оставляй место для спонтанности: некоторые хорошие решения приходят без презентации и дресс-кода.',
  ], 'Месяц будет щедрым.', 'Не откладывай хорошее до особого случая. Особый случай уже пришёл.', 'motivation'),
  reference('month-results', 'month', 'steady', 'Роман', [
    'То, что долго двигалось мелкими шагами, наконец станет видно целиком: затянувшийся проект приблизится к финалу, привычное место станет удобнее, а навык, который ты осваивал без фанфар, начнёт реально помогать. Не придётся бежать быстрее — полезнее довести начатое и заметить, что часть результата уже у тебя в руках. В общении станет проще отличать пустое обещание от нормального участия. В покупках выиграет качество, в отдыхе — то, что действительно радует, а не просто убивает время. Месяц может получиться спокойным, но совсем не пустым: хорошие вещи часто приходят без салюта, зато остаются надолго.',
  ], 'Месяц собирает результат.', 'Закрой начатое красиво. Новое само найдёт свободное место.', 'action'),
  reference('month-refusals', 'month', 'challenging', 'Ника', [
    'Некоторые планы, покупки и договорённости быстро покажут свою настоящую цену. Всё, что требует слишком много внимания и даёт слишком мало пользы, станет особенно заметным. Большая драма тут не нужна: достаточно перестать продлевать то, что давно держится на привычке. Хорошая сторона месяца в том, что после пары точных отказов станет легче двигать нужное. Появится место для нормального отдыха, живых встреч и работы, за которую не стыдно брать деньги. Не тащи чужую неорганизованность, не соглашайся на мутные условия и не покупай вещь только потому, что скидка смотрит жалобно.',
  ], 'Лишнее сдаёт позиции.', 'Оставь себе лучшее. Остальное переживёт отказ.', 'avoidance'),
];

export function renderPersonalForecastReferenceExamples(language: 'ru' | 'en', period: PersonalForecastPeriod): string {
  if (language !== 'ru') return '';
  const examples = PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((example) => example.period === period)
    .map((example) => ({
      input: {
        personal_profile: {
          name: example.input.name, birth_date: example.input.birth_date, birth_time: example.input.birth_time,
          birth_time_mode: example.input.birth_time ? 'exact' : 'unknown', birth_time_uncertainty_minutes: null,
          birth_place: example.input.birth_place, birth_timezone: 'Europe/Moscow', gender: 'unspecified', language,
        },
        selected_period: { period: example.period, period_key: `${example.period}-reference-${example.id}`, current_date: '2026-08-20', period_start: '2026-08-20', period_end: example.period === 'day' ? '2026-08-20' : '2026-08-26', timezone: 'Europe/Moscow' },
        anti_repeat_context: { recent_forecasts: [] },
      },
      output: example.output,
    }));
  return examples.map((example) => `<forecast_example_input>\n${JSON.stringify(example.input, null, 2)}\n</forecast_example_input>\n<forecast_example_output>\n${JSON.stringify(example.output, null, 2)}\n</forecast_example_output>`).join('\n\n');
}

export function getPersonalForecastReferenceFragments(period: PersonalForecastPeriod) {
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.filter((example) => example.period === period).flatMap((example) => [
    { kind: 'headline' as const, text: example.output.headline.text },
    ...example.output.fragments.map((fragment, index, fragments) => ({
      kind: 'fragment' as const,
      text: index === fragments.length - 1 ? `${fragment.text.trim()} ${example.output.closing.text.trim()}`.trim() : fragment.text,
      mainIdeaKey: fragment.main_idea_key,
      lifePlotKey: fragment.life_plot_key,
      adviceKey: index === fragments.length - 1 ? [fragment.advice_key, example.output.closing.advice_key].filter(Boolean).join('; ') : fragment.advice_key,
      comparisonKey: fragment.comparison_key,
    })),
  ]);
}
