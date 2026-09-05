import type { PersonalForecastPeriod } from './personalForecastContract';

type Tone = 'bright' | 'steady' | 'challenging';
type Output = {
  title: string;
  forecast: string;
  closing: string;
};

export type PersonalForecastReferenceExample = {
  id: string;
  period: PersonalForecastPeriod;
  tone: Tone;
  input: {
    reference_scope: 'voice_and_structure_only';
    reader: { language: 'ru'; grammatical_gender: 'male' };
    selected_period: { period: PersonalForecastPeriod };
  };
  output: Output;
};

function example(
  id: string,
  period: PersonalForecastPeriod,
  tone: Tone,
  output: Output,
): PersonalForecastReferenceExample {
  return {
    id,
    period,
    tone,
    output,
    input: {
      reference_scope: 'voice_and_structure_only',
      reader: { language: 'ru', grammatical_gender: 'male' },
      selected_period: { period },
    },
  };
}

/** Единственный утверждённый runtime-корпус личного Today / Week / Month. */
export const PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU: readonly PersonalForecastReferenceExample[] = [
  example('day-nu-vot-poehali', 'day', 'bright', {
    title: "Ну, поехали",
    forecast: "Сегодня кто-то может предложить подвезти тебя до нужного места. Если дорога одна, разговор легко пойдёт дальше дежурного «как дела». В итоге случайная помощь может обернуться новым знакомством.",
    closing: "Сначала уточни, куда человек едет.",
  }),
  example('day-bez-cirka', 'day', 'steady', {
    title: "Так во сколько?",
    forecast: "Сегодня тебе могут предложить встречу без ясного времени и места. После пары прямых вопросов станет понятнее, готов ли человек договориться. Если конкретного ответа нет, ожидание вряд ли принесёт что-то кроме новых сообщений.",
    closing: "Пока нет времени — встреча не назначена.",
  }),
  example('day-meloch-s-zubami', 'day', 'challenging', {
    title: "Доставка тоже платная?",
    forecast: "Сегодня заманчивое предложение может оказаться дороже, чем звучит сначала. Доставка или мелкая доплата способны заметно изменить цену. Если сумма вырастет, от привлекательной цены мало что останется.",
    closing: "Сначала узнай, сколько платить целиком.",
  }),
  example('week-horoshie-otvety', 'week', 'bright', {
    title: "А почему бы нет?",
    forecast: "На этой неделе тебя могут позвать куда-нибудь без долгих сборов и сложного повода. Если компания тебе подойдёт, разговору вряд ли понадобятся заготовленные темы. Если с кем-то легко смеяться над одними шутками, есть повод встретиться ещё раз. Из обычного приглашения вполне может получиться хороший повод чаще выходить из дома.",
    closing: "Иди, если тебе хочется этой встречи.",
  }),
  example('week-plany-smenyat-stul', 'week', 'steady', {
    title: "Ненадолго — это сколько?",
    forecast: "На этой неделе тебе могут предложить подработку с приятной на слух оплатой. Но за словами «ненадолго» иногда прячется половина дня. Если часов много, деньги способны выглядеть уже не так заманчиво. После разговора о времени можно будет решить, стоит ли соглашаться на такую работу.",
    closing: "Узнай часы, а потом обсуждай деньги.",
  }),
  example('week-chuzhoi-avral', 'week', 'challenging', {
    title: "Это ещё не ссора",
    forecast: "На этой неделе резкое сообщение может испортить разговор сильнее, чем заслуживает сам повод. По короткой переписке легко принять спешку за грубость. Если человек объяснит свои слова, спор вполне способен закончиться до настоящей ссоры. После этого может оказаться, что ругаться вообще не о чем.",
    closing: "Спроси, что человек имел в виду.",
  }),
  example('month-otdacha-prishla', 'month', 'bright', {
    title: "А вдруг понравится?",
    forecast: "В этом месяце тебе могут предложить попробовать незнакомое занятие без долгой подготовки. На первой встрече может стать ясно, нравится ли тебе само занятие, а не его реклама. Если понравится, появится повод вернуться и познакомиться с людьми поближе. Если нет, одного раза вполне хватит, чтобы больше на это не тратить время. В итоге у тебя останется собственное впечатление, а не чужое обещание лёгкого удовольствия.",
    closing: "Сначала попробуй один раз.",
  }),
  example('month-uborka-v-delah', 'month', 'steady', {
    title: "Вместе дешевле. Или нет?",
    forecast: "В этом месяце кто-то может предложить разделить с тобой расходы на поездку. Общая сумма способна выглядеть приятно, пока разговор не дойдёт до жилья и дороги. Тут может выясниться, что удобство каждый понимает по-своему. Если желания сильно разойдутся, экономия вряд ли перекроет споры из-за каждой мелочи. Зато при похожих вкусах получится и потратить меньше, и провести время вместе.",
    closing: "Спроси, что входит в общую сумму.",
  }),
  example('month-lishnee-otvalitsya', 'month', 'challenging', {
    title: "Последний шанс подождёт",
    forecast: "В этом месяце продавец может настойчиво торопить тебя с покупкой. Слова «только сейчас» способны сделать обычную цену похожей на удачу. У другого продавца может найтись та же вещь без громкой скидки. Если цены близкие, срочность окажется частью продажи, а не причиной соглашаться. Без быстрой покупки деньги пока останутся у тебя, а сравнить предложения можно и позже.",
    closing: "Сравни цену хотя бы в двух местах.",
  }),
];

export function renderPersonalForecastReferenceExamples(
  language: 'ru' | 'en',
  period: PersonalForecastPeriod,
): string {
  if (language !== 'ru') return '';
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((item) => item.period === period)
    .map((item) => `<forecast_example_input>\n${JSON.stringify(item.input, null, 2)}\n</forecast_example_input>\n<forecast_example_output>\n${JSON.stringify(item.output, null, 2)}\n</forecast_example_output>`)
    .join('\n\n');
}

export function getPersonalForecastRuntimeExampleIds(period: PersonalForecastPeriod): string[] {
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((item) => item.period === period)
    .map((item) => item.id);
}

export function getDisabledPersonalForecastRuntimeExampleIds(_period: PersonalForecastPeriod): string[] {
  return [];
}

export function getPersonalForecastReferenceFragments(period: PersonalForecastPeriod) {
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((item) => item.period === period)
    .flatMap((item) => ([
      { kind: 'title' as const, text: item.output.title },
      { kind: 'forecast' as const, text: item.output.forecast },
      { kind: 'closing' as const, text: item.output.closing },
    ]));
}
