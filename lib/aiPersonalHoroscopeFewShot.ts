import type { AiPersonalHoroscopePeriod } from './aiPersonalHoroscope';

type FewShotInput = {
  language: 'ru' | 'en';
  period: AiPersonalHoroscopePeriod;
  currentDate: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  user: {
    name: string;
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    gender: 'male' | 'female';
    language: 'ru' | 'en';
  };
  recentOpenings: string[];
  recentClosings: string[];
};

type FewShotOutput = {
  opening: string;
  forecast: string;
  advice: string[];
};

type FewShotExample = {
  input: FewShotInput;
  output: FewShotOutput;
};

function input(
  value: Omit<FewShotInput, 'recentOpenings' | 'recentClosings'>,
): FewShotInput {
  return { ...value, recentOpenings: [], recentClosings: [] };
}

const RU_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      input: input({
        language: 'ru', period: 'day', currentDate: '2026-09-03', periodStart: '2026-09-03', periodEnd: '2026-09-03', periodLabel: '3 СЕНТЯБРЯ',
        user: { name: 'Артём', birthDate: '1992-04-11', birthTime: '08:40', birthPlace: 'Казань', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Скромность сегодня можно оставить дома.',
        forecast: 'Ты заметнее обычного, и люди это считывают быстро. Хорошо может зайти разговор, встреча или случайное знакомство, от которого настроение станет ощутимо лучше.',
        advice: ['День любит живой контакт.', 'Если зовут куда-то интересное — идея вполне годная.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'day', currentDate: '2026-09-07', periodStart: '2026-09-07', periodEnd: '2026-09-07', periodLabel: '7 СЕНТЯБРЯ',
        user: { name: 'Марина', birthDate: '1990-11-28', birthTime: '17:25', birthPlace: 'Самара', gender: 'female', language: 'ru' },
      }),
      output: {
        opening: 'Планы подождут. Тут намечается кое-что приятнее.',
        forecast: 'Обычный день легко может свернуть в более интересную сторону: сообщение, приглашение или спонтанная идея быстро меняют настроение. Особенно хорошо заходят вещи, которые не требовали долгой подготовки.',
        advice: ['Сюрпризы сегодня скорее хорошие.', 'Оставь немного места для импровизации.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'day', currentDate: '2026-09-12', periodStart: '2026-09-12', periodEnd: '2026-09-12', periodLabel: '12 СЕНТЯБРЯ',
        user: { name: 'Елена', birthDate: '1996-02-15', birthTime: '21:10', birthPlace: 'Пермь', gender: 'female', language: 'ru' },
      }),
      output: {
        opening: 'Кажется, кто-то заметит тебя первым.',
        forecast: 'В общении больше лёгкости, интереса и той самой приятной искры, которую не надо объяснять. Если симпатия уже есть, сегодня она может стать заметнее.',
        advice: ['Романтика вполне в игре.', 'Ответная улыбка ещё никого не разорила.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'day', currentDate: '2026-09-18', periodStart: '2026-09-18', periodEnd: '2026-09-18', periodLabel: '18 СЕНТЯБРЯ',
        user: { name: 'Михаил', birthDate: '1989-03-06', birthTime: '23:15', birthPlace: 'Сергиев Посад', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Михаил, без подвигов. Просто хороший день.',
        forecast: 'Многое идёт спокойнее обычного, и именно это приятно. Хорошо заходят вкусная еда, короткая поездка, любимое место или встреча с человеком, рядом с которым не надо изображать занятость века.',
        advice: ['Никакой драмы — и отлично.', 'Возьми от дня что-нибудь приятное для себя.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'day', currentDate: '2026-09-23', periodStart: '2026-09-23', periodEnd: '2026-09-23', periodLabel: '23 СЕНТЯБРЯ',
        user: { name: 'Роман', birthDate: '1993-07-19', birthTime: '06:55', birthPlace: 'Тула', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Скука сегодня явно не в списке гостей.',
        forecast: 'Вокруг больше движения, разговоров и неожиданных вариантов. Что-то спонтанное может оказаться заметно удачнее того, что было задумано заранее.',
        advice: ['День любит живую реакцию.', 'Интересная идея появилась — не хорони её в календаре.'],
      },
    },
  ],
  week: [
    {
      input: input({
        language: 'ru', period: 'week', currentDate: '2026-10-05', periodStart: '2026-10-05', periodEnd: '2026-10-11', periodLabel: '5–11 ОКТЯБРЯ',
        user: { name: 'Артём', birthDate: '1992-04-11', birthTime: '08:40', birthPlace: 'Казань', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Похоже, скучать придётся в другой раз.',
        forecast: 'Станет больше поводов выйти из привычного маршрута: встречи, места, новые разговоры, короткие поездки. Один человек может приятно удивить, а случайная идея — получить неожиданно хорошее продолжение. Ближе к выходным хочется больше свободы и меньше расписания. И это выглядит очень вовремя.',
        advice: ['Неделя больше про впечатления, чем про великие решения.', 'Интересное приглашение лучше хотя бы рассмотреть.', 'Слишком серьёзное лицо можно оставить дома.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'week', currentDate: '2026-10-12', periodStart: '2026-10-12', periodEnd: '2026-10-18', periodLabel: '12–18 ОКТЯБРЯ',
        user: { name: 'Алиса', birthDate: '1995-05-02', birthTime: '13:05', birthPlace: 'Уфа', gender: 'female', language: 'ru' },
      }),
      output: {
        opening: 'Кто-то явно собирается стать приятной неожиданностью.',
        forecast: 'Общения становится больше, но без тяжёлых разговоров и длинных объяснений. Симпатия, юмор и желание чаще видеть кого-то рядом звучат заметнее. Старый знакомый тоже может внезапно напомнить о себе с хорошей стороны. К концу недели людей вокруг как будто становится чуть больше — и это радует.',
        advice: ['Хорошая компания сейчас особенно ценна.', 'С теми, с кем легко, не надо ничего усложнять.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'week', currentDate: '2026-10-19', periodStart: '2026-10-19', periodEnd: '2026-10-25', periodLabel: '19–25 ОКТЯБРЯ',
        user: { name: 'Илья', birthDate: '1988-12-09', birthTime: '10:30', birthPlace: 'Омск', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Деньги ведут себя прилично — подозрительно, но приятно.',
        forecast: 'Финансовая тема выглядит спокойнее и понятнее обычного. Может подвернуться удачная покупка, нормальная скидка, дополнительный доход или просто более выгодный вариант привычной вещи. При этом неделя не превращается в бухгалтерию: ближе к выходным сильнее тянет к отдыху, компании и хорошему развлечению.',
        advice: ['Есть шанс и сэкономить, и порадовать себя.', 'Хороший вариант не обязан выглядеть сложным.', 'Часть удачи можно отметить без финансового совета директоров.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'week', currentDate: '2026-10-26', periodStart: '2026-10-26', periodEnd: '2026-11-01', periodLabel: '26 ОКТЯБРЯ – 1 НОЯБРЯ',
        user: { name: 'Марина', birthDate: '1991-08-24', birthTime: '19:45', birthPlace: 'Ярославль', gender: 'female', language: 'ru' },
      }),
      output: {
        opening: 'Мир наконец перестал спорить с каждым твоим шагом.',
        forecast: 'Несколько вещей складываются легче, чем ожидалось: нужный ответ приходит вовремя, люди быстрее понимают друг друга, маленькие удачи появляются одна за другой. Ничего грандиозного, зато приятного достаточно. В личной жизни особенно хорошо выглядит живое общение без догадок и длинных пауз.',
        advice: ['Из мелких удач получится вполне приличная неделя.', 'Хорошее можно замечать сразу, не через три дня.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'week', currentDate: '2026-11-02', periodStart: '2026-11-02', periodEnd: '2026-11-08', periodLabel: '2–8 НОЯБРЯ',
        user: { name: 'Кирилл', birthDate: '1994-01-30', birthTime: '07:20', birthPlace: 'Рязань', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Старое внезапно снова выглядит неплохо.',
        forecast: 'Может вернуться интерес к знакомому месту, человеку, музыке или занятию, которое давно стало фоном. И неожиданно окажется, что оно всё ещё умеет радовать. При этом новое тоже не проходит мимо: пара свежих идей или знакомств легко вписываются рядом. Получается хорошая смесь привычного и нового.',
        advice: ['Не всё интересное обязано быть новым.', 'Второй заход иногда оказывается лучше первого.'],
      },
    },
  ],
  month: [
    {
      input: input({
        language: 'ru', period: 'month', currentDate: '2026-11-08', periodStart: '2026-11-01', periodEnd: '2026-11-30', periodLabel: 'НОЯБРЬ 2026',
        user: { name: 'Михаил', birthDate: '1989-03-06', birthTime: '23:15', birthPlace: 'Сергиев Посад', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Фотографий в телефоне станет больше — хороший знак.',
        forecast: 'Появится больше причин куда-нибудь выйти, съездить, встретиться или попробовать новое. Новые люди входят в жизнь легче, старые знакомые могут приятно напомнить о себе, а общение становится разнообразнее. В отношениях больше тепла и естественного интереса. Деньги временами уходят на удовольствие, но без ощущения, что каждая покупка требует семейного совета. Ближе к концу месяца может появиться место, занятие или человек, к которому захочется возвращаться.',
        advice: ['Месяц про людей, впечатления и больше интересного вокруг.', 'Оставь время и деньги не только на обязательное.', 'Хорошие воспоминания редко начинаются с решения остаться дома.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'month', currentDate: '2026-12-06', periodStart: '2026-12-01', periodEnd: '2026-12-31', periodLabel: 'ДЕКАБРЬ 2026',
        user: { name: 'Ольга', birthDate: '1990-06-17', birthTime: '15:35', birthPlace: 'Воронеж', gender: 'female', language: 'ru' },
      }),
      output: {
        opening: 'Личная жизнь вспомнила, что она существует.',
        forecast: 'В отношениях становится больше движения и реального интереса. Где-то возвращается симпатия, где-то появляется новое знакомство, а привычные разговоры внезапно звучат теплее. Для пары особенно хорошо работают обычные совместные вещи: куда-то выбраться, посмеяться, сделать что-то не по расписанию. Свободным легче замечать взаимный интерес без долгой расшифровки каждого сообщения. Вторая половина месяца выглядит живее первой.',
        advice: ['Любовь здесь больше похожа на радость, чем на драму.', 'Если человек нравится, это можно показать нормально и просто.', 'Не каждую искру надо разбирать как место преступления.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'month', currentDate: '2027-01-10', periodStart: '2027-01-01', periodEnd: '2027-01-31', periodLabel: 'ЯНВАРЬ 2027',
        user: { name: 'Артём', birthDate: '1993-09-03', birthTime: '11:50', birthPlace: 'Новосибирск', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Вот теперь становится интереснее.',
        forecast: 'Привычный круг жизни начинает расширяться: новые места, люди, темы, предложения, поездки. Старое никуда не исчезает, просто рядом появляется больше вариантов. Финансово месяц способен дать немного больше свободы — купить желаемое, выбрать вариант получше или спокойно потратиться на удовольствие. В общении легче находить тех, с кем разговор не надо вытягивать клещами. К финалу месяца жизнь ощущается заметно насыщеннее.',
        advice: ['Главный плюс месяца — вариантов вокруг становится больше.', 'Новое стоит пробовать там, где оно правда любопытно.', 'Любопытство сейчас полезнее пафосного «начать новую жизнь».'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'month', currentDate: '2027-02-09', periodStart: '2027-02-01', periodEnd: '2027-02-28', periodLabel: 'ФЕВРАЛЬ 2027',
        user: { name: 'Ирина', birthDate: '1987-10-22', birthTime: '18:05', birthPlace: 'Краснодар', gender: 'female', language: 'ru' },
      }),
      output: {
        opening: 'Хорошая компания — тоже серьёзный план.',
        forecast: 'Хочется больше видеть людей, красиво выглядеть, хорошо есть, менять обстановку и чаще делать что-то просто потому, что нравится. Это не отменяет обычную жизнь, но заметно делает её приятнее. Может появиться удачное знакомство, выгодная покупка или место, которое быстро станет любимым. В отношениях легче возвращается юмор и нормальная человеческая лёгкость. Месяц получается тёплым, живым и довольно щедрым на хорошие мелочи.',
        advice: ['Не всё ценное обязано быть великим достижением.', 'На удовольствие тоже можно оставлять место.', 'Иногда отличный вечер — уже отличный результат.'],
      },
    },
    {
      input: input({
        language: 'ru', period: 'month', currentDate: '2027-03-08', periodStart: '2027-03-01', periodEnd: '2027-03-31', periodLabel: 'МАРТ 2027',
        user: { name: 'Роман', birthDate: '1991-01-14', birthTime: '22:15', birthPlace: 'Москва', gender: 'male', language: 'ru' },
      }),
      output: {
        opening: 'Старт может быть кривым, а финал — совсем нет.',
        forecast: 'Первые дни способны дать пару странных поворотов: ожидалось одно, получается другое, кто-то отвечает не так быстро, как хотелось. Дальше картина заметно веселее. Появляются новые люди, больше свободы в выборе и приятные поводы куда-то выбраться. Один неудачный эпизод легко превращается в смешную историю уже через неделю. Последняя часть месяца выглядит особенно живо: больше общения, движения и вещей, которых действительно хочется ждать.',
        advice: ['Первое впечатление здесь не главное.', 'Не списывай месяц со счёта по его старту.', 'У некоторых историй просто слабая первая серия.'],
      },
    },
  ],
};

const EN_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      input: input({
        language: 'en', period: 'day', currentDate: '2026-09-03', periodStart: '2026-09-03', periodEnd: '2026-09-03', periodLabel: 'SEPTEMBER 3',
        user: { name: 'Alex', birthDate: '1992-04-11', birthTime: '08:40', birthPlace: 'Boston', gender: 'male', language: 'en' },
      }),
      output: {
        opening: 'Leave modesty at home today.',
        forecast: 'You are easier to notice, and people pick up on it quickly. A conversation, meeting, or random introduction can turn out much better than expected.',
        advice: ['This is a people day.', 'If something sounds fun, give it a fair chance.'],
      },
    },
  ],
  week: [
    {
      input: input({
        language: 'en', period: 'week', currentDate: '2026-10-05', periodStart: '2026-10-05', periodEnd: '2026-10-11', periodLabel: 'OCTOBER 5–11',
        user: { name: 'Alex', birthDate: '1992-04-11', birthTime: '08:40', birthPlace: 'Boston', gender: 'male', language: 'en' },
      }),
      output: {
        opening: 'Boredom can try again next week.',
        forecast: 'There are more reasons to get out, see people, try places, and break the usual route. Someone may surprise you in a good way, while a random idea gets more traction than expected. By the weekend, the whole thing feels lighter and more fun.',
        advice: ['This one is more about impressions than big decisions.', 'Give interesting invitations a real look.'],
      },
    },
  ],
  month: [
    {
      input: input({
        language: 'en', period: 'month', currentDate: '2026-11-08', periodStart: '2026-11-01', periodEnd: '2026-11-30', periodLabel: 'NOVEMBER 2026',
        user: { name: 'Michael', birthDate: '1989-03-06', birthTime: '23:15', birthPlace: 'Cambridge', gender: 'male', language: 'en' },
      }),
      output: {
        opening: 'Your camera roll may get crowded.',
        forecast: 'There are more reasons to go out, travel, meet people, and change the scenery. New connections arrive more easily, old friends can reappear in a genuinely pleasant way, and relationships feel warmer. Money may occasionally disappear into fun, but not every purchase needs a board meeting. Toward the end, a person, place, or activity may become something you want more of.',
        advice: ['This month is about people and more to look forward to.', 'Keep some time and money for fun too.', 'Very few good memories start with staying home again.'],
      },
    },
  ],
};

export function buildAiPersonalHoroscopeFewShotBlock(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  const examples = language === 'en'
    ? EN_FEW_SHOT_EXAMPLES[period]
    : RU_FEW_SHOT_EXAMPLES[period];
  const heading = language === 'en'
    ? 'REFERENCE EXAMPLES. Match their voice, density, directness, and human rhythm. Use the new input facts; never copy wording or situations.'
    : 'ЭТАЛОННЫЕ ПРИМЕРЫ. Повторяй их уровень живости, плотность, прямоту и человеческий ритм. Для нового ответа используй новый вход; не копируй формулировки и ситуации.';

  return `${heading}\n${examples.map((example, index) => [
    `EXAMPLE ${index + 1}`,
    'INPUT',
    JSON.stringify(example.input, null, 2),
    'OUTPUT',
    JSON.stringify(example.output, null, 2),
  ].join('\n')).join('\n---\n')}`;
}
