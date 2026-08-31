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
    title: 'Ну всё, дождались',
    forecast: 'Сегодня может прийти ответ, которого ты уже почти перестал ждать. Там будет короткое «да» без новых условий и длинных объяснений. Ждать больше не придётся, а день пойдёт по нормальному плану.',
    closing: 'Ответь сразу и занимайся своими делами.',
  }),
  example('day-bez-cirka', 'day', 'steady', {
    title: 'Намёки, до свидания',
    forecast: 'Сегодня кто-то может снова ходить вокруг да около вместо нормального ответа. Один прямой вопрос быстро покажет, чего человек хочет и почему тянет. Договориться получится сразу — или станет ясно, что ответа тут нет.',
    closing: 'Спроси прямо и слушай ответ.',
  }),
  example('day-meloch-s-zubami', 'day', 'challenging', {
    title: 'Мелочь достала',
    forecast: 'Сегодня дома может снова заесть дверца шкафа. Бесить она будет сильнее, чем заслуживает, но починить её окажется проще, чем кажется. Эта ерунда перестанет мешать, а дома станет удобнее.',
    closing: 'Почини одну штуку — остальное подождёт.',
  }),
  example('week-horoshie-otvety', 'week', 'bright', {
    title: 'Вот это уже весело',
    forecast: 'На этой неделе может прийти приглашение на встречу в новом месте. Там окажутся знакомые люди, а разговоры не застрянут на дежурном «ну как дела». Кто-то подкинет идею, которую можно попробовать без больших затрат. Обычный выход из дома принесёт и пользу, и хорошую историю.',
    closing: 'Иди, если время тебе подходит.',
  }),
  example('week-plany-smenyat-stul', 'week', 'steady', {
    title: 'Опять эти подписки',
    forecast: 'На этой неделе могут всплыть мелкие списания, которые ты давно не замечаешь. По отдельности ерунда, вместе — уже сумма, на которую можно купить что-то полезнее. Одну подписку получится отменить, а ненужную покупку — вернуть. Денег больше не станет, зато до следующего платежа их хватит.',
    closing: 'Проверь подписки и последние покупки.',
  }),
  example('week-chuzhoi-avral', 'week', 'challenging', {
    title: 'Срочно, но не твоё',
    forecast: 'На этой неделе кто-то может скинуть на тебя работу, которую сам тянул до последнего. Сначала просьба покажется пустяком, но следом полезут звонки, правки и новые просьбы. Если согласишься сразу, своё придётся отложить и потом догонять. Короткое «нет» оставит чужой бардак его хозяину, а тебе — твой вечер.',
    closing: 'Сначала спроси, почему это вообще твоё.',
  }),
  example('month-otdacha-prishla', 'month', 'bright', {
    title: 'Вот это уже по карману',
    forecast: 'В этом месяце может найтись покупка, которую ты давно откладывал из-за цены. Подходящий вариант будет без лишних доплат и навязанных услуг. Сначала захочется взять сразу, но простая проверка покажет цену ниже. Через пару дней предложение всё ещё будет на месте, зато появится время сравнить. Покупка обойдётся дешевле, и часть денег всё-таки останется у тебя.',
    closing: 'Сравни две цены и проверь гарантию.',
  }),
  example('month-uborka-v-delah', 'month', 'steady', {
    title: 'Намёки идут лесом',
    forecast: 'В этом месяце может наконец случиться разговор, который все давно откладывали. Сначала снова пойдут намёки, но кто-то первым скажет всё своими словами. Ответ окажется спокойнее, чем ожидалось, и половина догадок сразу отпадёт. После этого люди начнут говорить друг с другом, а не через знакомых. Спор закончится, потому что старые пересказы больше не будут казаться правдой.',
    closing: 'Говори с человеком, а не с чужим пересказом.',
  }),
  example('month-lishnee-otvalitsya', 'month', 'challenging', {
    title: 'Красивые слова кончились',
    forecast: 'В этом месяце один общий план может развалиться, когда придётся отвечать за обещанное. Кто-то снова не сделает свою часть и попросит ещё немного подождать. Разговор получится резким, зато быстро покажет, на кого можно рассчитывать. После него пару общих планов придётся выкинуть, но путаницы станет меньше. Останутся только те обещания, которые люди действительно собираются выполнять сами.',
    closing: 'Не доделывай за того, кто снова подвёл.',
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
