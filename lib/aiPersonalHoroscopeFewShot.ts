import type {
  AiPersonalHoroscopeHistoryItem,
  AiPersonalHoroscopePeriod,
} from './aiPersonalHoroscope';

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
  previousForecasts: AiPersonalHoroscopeHistoryItem[];
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

function fewShotInput(
  input: Omit<FewShotInput, 'previousForecasts'>,
): FewShotInput {
  return { ...input, previousForecasts: [] };
}

function ruUser(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string,
  gender: 'male' | 'female',
) {
  return { name, birthDate, birthTime, birthPlace, gender, language: 'ru' as const };
}

function enUser(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string,
  gender: 'male' | 'female',
) {
  return { name, birthDate, birthTime, birthPlace, gender, language: 'en' as const };
}

const RU_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      input: fewShotInput({
        language: 'ru', period: 'day', currentDate: '2026-09-03',
        periodStart: '2026-09-03', periodEnd: '2026-09-03', periodLabel: 'ЧЕТВЕРГ\n3 СЕНТЯБРЯ',
        user: ruUser('Артём', '1992-04-11', '08:40', 'Казань', 'male'),
      }),
      output: {
        opening: 'Скука сегодня идёт мимо.',
        forecast: 'Разговоры цепляются легко, люди отвечают живее, а случайная встреча или переписка может неожиданно стать лучшей частью дня. Всё идёт бодрее обычного, поэтому даже простой выход из дома способен принести больше впечатлений, чем планировалось.',
        advice: ['Хороший день для людей и движения.', 'Если зовут — хотя бы дослушай предложение.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'day', currentDate: '2026-09-08',
        periodStart: '2026-09-08', periodEnd: '2026-09-08', periodLabel: 'ВТОРНИК\n8 СЕНТЯБРЯ',
        user: ruUser('Михаил', '1989-03-06', '23:15', 'Сергиев Посад', 'male'),
      }),
      output: {
        opening: 'Михаил, харизму не прячь.',
        forecast: 'Внимания вокруг тебя сегодня больше, и оно скорее приятное: люди охотнее поддерживают разговор, а симпатия считывается без долгих расшифровок. Хорошо заходят встречи, лёгкий флирт и всё, где можно быть собой без серьёзного лица.',
        advice: ['Тебя сегодня замечают.', 'Улыбнуться в ответ — вполне рабочая стратегия.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'day', currentDate: '2026-09-12',
        periodStart: '2026-09-12', periodEnd: '2026-09-12', periodLabel: 'СУББОТА\n12 СЕНТЯБРЯ',
        user: ruUser('Марина', '1990-11-28', '17:25', 'Самара', 'female'),
      }),
      output: {
        opening: 'Случайности решили немного обнаглеть.',
        forecast: 'Что-то незапланированное может оказаться удачнее первоначального варианта: новое место, сообщение, знакомство или внезапная идея быстро меняют настроение к лучшему. День особенно хорош там, где остаётся немного свободы для импровизации.',
        advice: ['Лучшее сегодня может быть случайным.', 'Не всё интересное обязано стоять в календаре.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'day', currentDate: '2026-09-16',
        periodStart: '2026-09-16', periodEnd: '2026-09-16', periodLabel: 'СРЕДА\n16 СЕНТЯБРЯ',
        user: ruUser('Елена', '1996-02-15', '21:10', 'Пермь', 'female'),
      }),
      output: {
        opening: 'Спешить сегодня вообще некуда.',
        forecast: 'День получается ровным и приятным: привычные вещи не раздражают, люди не требуют лишнего, а свободное время действительно ощущается свободным. Особенно хорошо заходят дом, вкусная еда, прогулка и разговор с тем, рядом с кем не приходится изображать занятость.',
        advice: ['Тихий день тоже умеет радовать.', 'Не превращай отдых в ещё одну задачу.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'day', currentDate: '2026-09-20',
        periodStart: '2026-09-20', periodEnd: '2026-09-20', periodLabel: 'ВОСКРЕСЕНЬЕ\n20 СЕНТЯБРЯ',
        user: ruUser('Ирина', '1987-10-22', '18:05', 'Краснодар', 'female'),
      }),
      output: {
        opening: 'Кто-то явно тебя заметил.',
        forecast: 'В общении появляется больше интереса, а обычный разговор легко приобретает приятный второй слой — чуть больше внимания, тепла или флирта. Если симпатия уже есть, сегодня она выглядит заметнее и проще, без ненужной драмы.',
        advice: ['Романтика сегодня вполне уместна.', 'Не надо делать вид, что ничего не заметила.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'day', currentDate: '2026-09-24',
        periodStart: '2026-09-24', periodEnd: '2026-09-24', periodLabel: 'ЧЕТВЕРГ\n24 СЕНТЯБРЯ',
        user: ruUser('Кирилл', '1994-01-30', '07:20', 'Рязань', 'male'),
      }),
      output: {
        opening: 'День без лишнего цирка.',
        forecast: 'Многое решается с первого нормального разговора, покупки оказываются удачными, а бытовые мелочи не пытаются украсть всё внимание. Вечер выглядит особенно приятно, если провести его там, где можно просто расслабиться и не обсуждать великие планы человечества.',
        advice: ['Нормально — уже очень хорошо.', 'Оставь героизм кому-нибудь другому.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'day', currentDate: '2026-09-29',
        periodStart: '2026-09-29', periodEnd: '2026-09-29', periodLabel: 'ВТОРНИК\n29 СЕНТЯБРЯ',
        user: ruUser('Алиса', '1995-05-02', '13:05', 'Уфа', 'female'),
      }),
      output: {
        opening: 'Не всё обязано быть серьёзным.',
        forecast: 'Сегодня легче смеяться, знакомиться, менять маршрут и соглашаться на маленькие авантюры, которые обычно откладываются на потом. Пара дел может идти неидеально, но настроение от этого не разваливается — слишком много вокруг вещей поинтереснее.',
        advice: ['День лучше прожить, чем анализировать.', 'Иногда смешная идея действительно хорошая.'],
      },
    },
  ],
  week: [
    {
      input: fewShotInput({
        language: 'ru', period: 'week', currentDate: '2026-10-05',
        periodStart: '2026-10-05', periodEnd: '2026-10-11', periodLabel: '5 ОКТЯБРЯ — 11 ОКТЯБРЯ',
        user: ruUser('Артём', '1992-04-11', '08:40', 'Казань', 'male'),
      }),
      output: {
        opening: 'Скучно не будет, это точно.',
        forecast: 'Вокруг становится больше движения: люди чаще зовут, разговоры дают новые идеи, а привычный маршрут легко меняется на что-то интереснее. Одна спонтанная история может вытянуть за собой ещё несколько приятных событий, особенно если не пытаться заранее расписать каждую мелочь. Ближе к выходным особенно хорошо заходят компания, новые места и всё, после чего хочется сказать: «Вот это было не зря».',
        advice: ['Неделя явно за впечатления.', 'Оставь немного места для внезапных планов.', 'Самое интересное может прийти без приглашения.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'week', currentDate: '2026-10-12',
        periodStart: '2026-10-12', periodEnd: '2026-10-18', periodLabel: '12 ОКТЯБРЯ — 18 ОКТЯБРЯ',
        user: ruUser('Алиса', '1995-05-02', '13:05', 'Уфа', 'female'),
      }),
      output: {
        opening: 'Людей станет больше — и кстати.',
        forecast: 'Общение выходит на первый план, но без тяжёлых разговоров и бесконечных выяснений: больше шуток, встреч и лёгкой взаимности. Кто-то старый может неожиданно напомнить о себе с хорошей стороны, а новый человек быстро перестанет казаться чужим. В отношениях особенно ценятся простые вещи — желание увидеться, продолжить разговор и остаться рядом подольше.',
        advice: ['Компания сейчас действительно имеет значение.', 'Иди туда, где тебе рады.', 'Остальное подождёт без драматической музыки.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'week', currentDate: '2026-10-19',
        periodStart: '2026-10-19', periodEnd: '2026-10-25', periodLabel: '19 ОКТЯБРЯ — 25 ОКТЯБРЯ',
        user: ruUser('Роман', '1993-07-19', '06:55', 'Тула', 'male'),
      }),
      output: {
        opening: 'Деньги решили не вредничать.',
        forecast: 'Финансовые вопросы идут спокойнее: может подвернуться нормальная цена, приятная покупка или возможность получить больше за те же усилия без цирка с бубном. При этом неделя не превращается в бухгалтерию — остаётся место для встреч, еды вне дома и чего-нибудь давно желанного. К выходным особенно приятно тратить не на обязательное, а на то, что реально радует.',
        advice: ['С деньгами всё выглядит прилично.', 'Хороший вариант можно просто взять и использовать.', 'Небольшая приятная покупка тоже считается победой.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'week', currentDate: '2026-10-26',
        periodStart: '2026-10-26', periodEnd: '2026-11-01', periodLabel: '26 ОКТЯБРЯ — 1 НОЯБРЯ',
        user: ruUser('Марина', '1991-08-24', '19:45', 'Ярославль', 'female'),
      }),
      output: {
        opening: 'Привычное снова становится интересным.',
        forecast: 'То, что давно стало фоном, неожиданно возвращает вкус: знакомое место, старое увлечение или человек, с которым давно не было нормального разговора. Пара свежих идей тоже появится, но они не вытесняют всё старое — скорее дают на него посмотреть по-новому. Неделя получается тёплой и немного ностальгической, но без желания жить прошлым.',
        advice: ['Хорошее иногда уже рядом.', 'Вернуться куда-то из любопытства — нормальная идея.', 'Второй заход бывает удачнее первого.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'week', currentDate: '2026-11-02',
        periodStart: '2026-11-02', periodEnd: '2026-11-08', periodLabel: '2 НОЯБРЯ — 8 НОЯБРЯ',
        user: ruUser('Елена', '1996-02-15', '21:10', 'Пермь', 'female'),
      }),
      output: {
        opening: 'Пара сюрпризов уже в пути.',
        forecast: 'Планы несколько раз могут повернуть не туда, куда ожидалось, но итог часто окажется интереснее исходного варианта. Один разговор даст больше ясности, другая случайность добавит хорошего настроения, а ближе к выходным появится повод выбраться из дома или собрать людей рядом. Неровность здесь не портит картину — наоборот, делает её живой.',
        advice: ['Предсказуемость сейчас переоценена.', 'Не цепляйся за первый вариант.', 'У этой недели хороший вкус к поворотам.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'week', currentDate: '2026-11-09',
        periodStart: '2026-11-09', periodEnd: '2026-11-15', periodLabel: '9 НОЯБРЯ — 15 НОЯБРЯ',
        user: ruUser('Ирина', '1987-10-22', '18:05', 'Краснодар', 'female'),
      }),
      output: {
        opening: 'Романтика явно не спит.',
        forecast: 'Симпатия ощущается заметнее, переписка становится живее, а встречи дают больше тепла, чем обычно. Если отношения уже есть, в них легче вернуть лёгкость и вспомнить, что вы вообще-то не только обсуждаете бытовые вопросы. Если никого нет, вокруг всё равно появляется больше людей, с которыми хочется продолжить знакомство.',
        advice: ['Личная жизнь выглядит бодро.', 'Интерес лучше показывать, а не шифровать.', 'Телепатия всё ещё работает так себе.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'week', currentDate: '2026-11-16',
        periodStart: '2026-11-16', periodEnd: '2026-11-22', periodLabel: '16 НОЯБРЯ — 22 НОЯБРЯ',
        user: ruUser('Кирилл', '1994-01-30', '07:20', 'Рязань', 'male'),
      }),
      output: {
        opening: 'Темп бодрый, настроение ещё лучше.',
        forecast: 'Дела, встречи и личные планы складываются плотнее обычного, но без ощущения, что жизнь превратилась в очередь из обязательств. Особенно хорошо идут короткие поездки, новые места и разговоры, после которых сразу хочется что-то попробовать или куда-то сходить. К выходным накопится приятное чувство, что произошло больше, чем ожидалось, и почти ничего из этого не было зря.',
        advice: ['Хорошая насыщенность без перегруза.', 'Бери от недели то, что действительно интересно.', 'Остальное не обязано попадать в кадр.'],
      },
    },
  ],
  month: [
    {
      input: fewShotInput({
        language: 'ru', period: 'month', currentDate: '2026-11-08',
        periodStart: '2026-11-01', periodEnd: '2026-11-30', periodLabel: 'НОЯБРЬ 2026 Г.',
        user: ruUser('Михаил', '1989-03-06', '23:15', 'Сергиев Посад', 'male'),
      }),
      output: {
        opening: 'Фотографий станет заметно больше.',
        forecast: 'Поводов выйти из дома, куда-то съездить и увидеть людей становится больше, причём многие планы появляются буквально на ходу. Новые знакомства входят легко, старые друзья чаще напоминают о себе, а привычные места внезапно снова выглядят интересными. Деньги временами уходят на еду, поездки и удовольствия, но без ощущения, что каждая трата была ошибкой века. К финалу месяца особенно заметно, что жизнь стала насыщеннее и в ней появилось больше вещей, которых приятно ждать.',
        advice: ['Месяц явно собирает впечатления.', 'Оставь место для красивого и вкусного.', 'Хорошие воспоминания редко бывают слишком практичными.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'month', currentDate: '2026-12-06',
        periodStart: '2026-12-01', periodEnd: '2026-12-31', periodLabel: 'ДЕКАБРЬ 2026 Г.',
        user: ruUser('Ольга', '1990-06-17', '15:35', 'Воронеж', 'female'),
      }),
      output: {
        opening: 'Личная жизнь наконец проснулась.',
        forecast: 'В отношениях становится больше движения: разговоры теплеют, встречи случаются чаще, а симпатия меньше прячется за нейтральными фразами. Для пары это хороший месяц, чтобы снова чаще смеяться вместе и куда-нибудь выбираться, а не только обсуждать бытовую логистику. Для свободного человека вполне может появиться знакомство, которое захочется продолжить без срочных выводов и великих обещаний. К концу месяца особенно хорошо чувствуется простая вещь: рядом стало больше людей, с которыми действительно приятно.',
        advice: ['Романтика выглядит вполне живой.', 'Если нравится — покажи это нормально.', 'Допрос с пристрастием можно не устраивать.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'month', currentDate: '2027-01-10',
        periodStart: '2027-01-01', periodEnd: '2027-01-31', periodLabel: 'ЯНВАРЬ 2027 Г.',
        user: ruUser('Артём', '1993-09-03', '11:50', 'Новосибирск', 'male'),
      }),
      output: {
        opening: 'Скучно не будет — уже плюс.',
        forecast: 'Привычный круг постепенно расширяется: новые места, люди и занятия появляются чаще, чем в последние недели. Некоторые идеи неожиданно получают продолжение, а пара совершенно случайных разговоров может открыть интересные варианты для отдыха, поездки или нового увлечения. Денежная тема остаётся ровной, поэтому удовольствие не приходится каждый раз согласовывать с внутренним бухгалтером. Финал месяца выглядит особенно живо — больше движения, больше встреч и меньше ощущения, что все дни похожи друг на друга.',
        advice: ['Месяц заметно оживляет картинку.', 'Новое бери там, где реально любопытно.', 'Любопытство сейчас полезнее пафоса.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'month', currentDate: '2027-02-09',
        periodStart: '2027-02-01', periodEnd: '2027-02-28', periodLabel: 'ФЕВРАЛЬ 2027 Г.',
        user: ruUser('Ирина', '1987-10-22', '18:05', 'Краснодар', 'female'),
      }),
      output: {
        opening: 'Красивое снова имеет смысл.',
        forecast: 'Сильнее тянет менять обстановку, хорошо выглядеть, бывать в приятных местах и чаще выбирать вещи не только по принципу «зато практично». Покупки, еда, маленькие поездки и встречи способны приносить заметно больше удовольствия, чем обычно. В отношениях тоже становится легче — меньше тяжёлых тем, больше нормального совместного времени и поводов посмеяться. Месяц получается тёплым, социальным и немного расточительным, но именно это делает его живым.',
        advice: ['Удовольствие здесь не лишнее.', 'Иногда красивое можно выбрать просто потому, что нравится.', 'Практичность переживёт один выходной без тебя.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'month', currentDate: '2027-03-07',
        periodStart: '2027-03-01', periodEnd: '2027-03-31', periodLabel: 'МАРТ 2027 Г.',
        user: ruUser('Марина', '1991-08-24', '19:45', 'Ярославль', 'female'),
      }),
      output: {
        opening: 'Первое впечатление немного соврёт.',
        forecast: 'Начало месяца может показаться более скучным или запутанным, чем оно окажется на самом деле. Через несколько дней часть вопросов решается проще, люди становятся понятнее, а планы получают нормальную форму без лишнего давления. Во второй половине становится больше встреч, движения и приятных причин менять привычный маршрут. Финал выглядит заметно лучше старта и оставляет ощущение, что месяц просто долго разгонялся.',
        advice: ['Старт здесь ничего не решает.', 'Не спеши выносить месяцу приговор.', 'Он ещё успеет исправить впечатление.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'month', currentDate: '2027-04-05',
        periodStart: '2027-04-01', periodEnd: '2027-04-30', periodLabel: 'АПРЕЛЬ 2027 Г.',
        user: ruUser('Елена', '1996-02-15', '21:10', 'Пермь', 'female'),
      }),
      output: {
        opening: 'Мир вокруг станет чуть шире.',
        forecast: 'Появляется больше вариантов, куда идти, с кем общаться и чем вообще заполнять свободное время. Новое знакомство, поездка или увлечение может быстро стать регулярной частью жизни, потому что оно просто хорошо в неё вписывается. Старые привычки при этом не рушатся — часть из них даже начинает нравиться сильнее после небольшого перерыва. К концу месяца особенно заметно, что выборов стало больше, а скуки — меньше.',
        advice: ['Вокруг действительно больше вариантов.', 'Пробуй то, что вызывает нормальный интерес.', 'Не всё новое обязано быть судьбоносным.'],
      },
    },
    {
      input: fewShotInput({
        language: 'ru', period: 'month', currentDate: '2027-05-10',
        periodStart: '2027-05-01', periodEnd: '2027-05-31', periodLabel: 'МАЙ 2027 Г.',
        user: ruUser('Роман', '1993-07-19', '06:55', 'Тула', 'male'),
      }),
      output: {
        opening: 'Деньги любят спокойствие, ты тоже.',
        forecast: 'Финансовая часть месяца выглядит ровнее: меньше неприятных сюрпризов, больше понятных покупок и нормальных решений без желания срочно что-то отыграть. Может появиться возможность позволить себе вещь, поездку или развлечение, которое раньше откладывалось просто из осторожности. При этом месяц не про экономию ради экономии — удовольствие остаётся важной частью картинки, особенно ближе к выходным и праздникам. К финалу легче понять, на что тебе действительно не жалко денег, а что давно покупалось по привычке.',
        advice: ['С деньгами сейчас без лишнего шума.', 'Хорошая покупка не обязана быть подвигом.', 'Кошелёк тоже ценит нормальное обращение.'],
      },
    },
  ],
};

const EN_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      input: fewShotInput({
        language: 'en', period: 'day', currentDate: '2026-09-03',
        periodStart: '2026-09-03', periodEnd: '2026-09-03', periodLabel: 'THURSDAY\nSEPTEMBER 3',
        user: enUser('Michael', '1989-03-06', '23:15', 'Cambridge', 'male'),
      }),
      output: {
        opening: 'Boredom is not invited today.',
        forecast: 'People respond more easily, conversations move faster, and an ordinary message or meeting can become the best part of the day. Anything spontaneous has a decent chance of being more fun than the original plan.',
        advice: ['Good day for people and movement.', 'At least hear the invitation out.'],
      },
    },
    {
      input: fewShotInput({
        language: 'en', period: 'day', currentDate: '2026-09-12',
        periodStart: '2026-09-12', periodEnd: '2026-09-12', periodLabel: 'SATURDAY\nSEPTEMBER 12',
        user: enUser('Maya', '1995-05-02', '13:05', 'Seattle', 'female'),
      }),
      output: {
        opening: 'Someone has noticed you.',
        forecast: 'There is more warmth and interest in conversation, and attraction is easier to read without turning it into a detective case. A date, a casual drink, or a simple chat can land surprisingly well.',
        advice: ['Romance is perfectly welcome today.', 'A smile back is enough.'],
      },
    },
    {
      input: fewShotInput({
        language: 'en', period: 'day', currentDate: '2026-09-20',
        periodStart: '2026-09-20', periodEnd: '2026-09-20', periodLabel: 'SUNDAY\nSEPTEMBER 20',
        user: enUser('Olivia', '1990-06-17', '15:35', 'Austin', 'female'),
      }),
      output: {
        opening: 'No heroics required.',
        forecast: 'The day works best in a simple register: good food, familiar people, a walk, and enough time to enjoy whatever you are doing. Nothing needs to become a major event to feel genuinely good.',
        advice: ['Quiet can still be excellent.', 'Rest does not need a business case.'],
      },
    },
  ],
  week: [
    {
      input: fewShotInput({
        language: 'en', period: 'week', currentDate: '2026-10-05',
        periodStart: '2026-10-05', periodEnd: '2026-10-11', periodLabel: 'OCTOBER 5 — OCTOBER 11',
        user: enUser('Michael', '1989-03-06', '23:15', 'Cambridge', 'male'),
      }),
      output: {
        opening: 'Boring is not on the menu.',
        forecast: 'There is more movement around you: invitations, new places, and conversations that turn into actual plans. One spontaneous choice can lead to several good moments without needing a grand strategy. The weekend looks especially social and pleasantly unserious.',
        advice: ['This week wants impressions.', 'Keep some room for last-minute plans.', 'The good stuff may arrive unannounced.'],
      },
    },
    {
      input: fewShotInput({
        language: 'en', period: 'week', currentDate: '2026-10-12',
        periodStart: '2026-10-12', periodEnd: '2026-10-18', periodLabel: 'OCTOBER 12 — OCTOBER 18',
        user: enUser('Maya', '1995-05-02', '13:05', 'Seattle', 'female'),
      }),
      output: {
        opening: 'Romance is clearly awake.',
        forecast: 'Attraction is easier to notice, messages get warmer, and time together feels lighter. Couples get more fun back into ordinary life, while single people have more reasons to stay around someone interesting a little longer. Nothing needs a dramatic speech to be obvious.',
        advice: ['Love looks lively.', 'Make interest reasonably visible.', 'Telepathy is still unreliable.'],
      },
    },
    {
      input: fewShotInput({
        language: 'en', period: 'week', currentDate: '2026-10-19',
        periodStart: '2026-10-19', periodEnd: '2026-10-25', periodLabel: 'OCTOBER 19 — OCTOBER 25',
        user: enUser('Alex', '1993-07-19', '06:55', 'Denver', 'male'),
      }),
      output: {
        opening: 'Money is behaving for once.',
        forecast: 'Financial choices feel cleaner, and a purchase or price can work out better than expected without becoming a miracle story. The week still leaves plenty of room for food, friends, and something you simply want. By the weekend, spending on pleasure feels easier to justify because the basics are under control.',
        advice: ['The numbers look civilised.', 'Use a genuinely good deal.', 'A small treat still counts.'],
      },
    },
  ],
  month: [
    {
      input: fewShotInput({
        language: 'en', period: 'month', currentDate: '2026-11-08',
        periodStart: '2026-11-01', periodEnd: '2026-11-30', periodLabel: 'NOVEMBER 2026',
        user: enUser('Michael', '1989-03-06', '23:15', 'Cambridge', 'male'),
      }),
      output: {
        opening: 'Your camera roll gets busier.',
        forecast: 'There are more reasons to go out, travel, see people, and change the scenery. New connections arrive easily, while old friends can reappear in a genuinely good way. Money occasionally disappears into food, trips, and fun, but not with the feeling that every purchase was a mistake. By the end of the month, life simply feels fuller and there is more to look forward to.',
        advice: ['This month collects impressions.', 'Keep room for beautiful and delicious things.', 'Good memories are rarely too practical.'],
      },
    },
    {
      input: fewShotInput({
        language: 'en', period: 'month', currentDate: '2026-12-06',
        periodStart: '2026-12-01', periodEnd: '2026-12-31', periodLabel: 'DECEMBER 2026',
        user: enUser('Olivia', '1990-06-17', '15:35', 'Austin', 'female'),
      }),
      output: {
        opening: 'Your love life woke up.',
        forecast: 'Relationships get more movement, with warmer conversations and more obvious interest. Couples find it easier to have fun together instead of only managing practical life. If you are single, a new connection can become worth continuing without a giant declaration attached. By the end of the month, there are simply more people around you who feel good to be with.',
        advice: ['Romance looks very alive.', 'If you like someone, show it normally.', 'No forensic analysis required.'],
      },
    },
    {
      input: fewShotInput({
        language: 'en', period: 'month', currentDate: '2027-01-10',
        periodStart: '2027-01-01', periodEnd: '2027-01-31', periodLabel: 'JANUARY 2027',
        user: enUser('Alex', '1993-09-03', '11:50', 'Chicago', 'male'),
      }),
      output: {
        opening: 'Life gets a little wider.',
        forecast: 'More places, people, and interests start competing for your free time. A random conversation or short trip can turn into something you want to repeat. Money stays steady enough that pleasure does not need a committee meeting every time. The end of the month feels especially lively, with more movement and fewer identical days.',
        advice: ['There are more options around you.', 'Try what is genuinely interesting.', 'Not everything new needs to be profound.'],
      },
    },
  ],
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectExamples(
  examples: FewShotExample[],
  count: number,
  selectionKey: string,
): FewShotExample[] {
  if (examples.length <= count) return examples;
  const start = stableHash(selectionKey || 'default') % examples.length;
  const result: FewShotExample[] = [];
  for (let offset = 0; result.length < count && offset < examples.length * 2; offset += 1) {
    const index = (start + offset * 2) % examples.length;
    const candidate = examples[index];
    if (!result.includes(candidate)) result.push(candidate);
  }
  return result;
}

export function buildAiPersonalHoroscopeFewShotBlock(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
  selectionKey = '',
): string {
  const pool = language === 'en'
    ? EN_FEW_SHOT_EXAMPLES[period]
    : RU_FEW_SHOT_EXAMPLES[period];
  const examples = selectExamples(pool, language === 'ru' ? 4 : 3, selectionKey);
  const heading = language === 'en'
    ? 'GOLD EXAMPLES. Match their directness, rhythm, density, variety, and INPUT→OUTPUT transformation. Write a new forecast rather than paraphrasing an example.'
    : 'ЭТАЛОННЫЕ ПРИМЕРЫ. Повтори их уровень прямоты, живости, ритма, плотности, разнообразия и способ преобразования INPUT→OUTPUT. Новый прогноз должен быть новым текстом, а не пересказом примера.';

  return `${heading}\n${examples.map((example, index) => [
    `EXAMPLE ${index + 1}`,
    'INPUT',
    JSON.stringify(example.input, null, 2),
    'OUTPUT',
    JSON.stringify(example.output, null, 2),
  ].join('\n')).join('\n---\n')}`;
}
