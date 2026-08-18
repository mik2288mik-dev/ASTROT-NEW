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

const RU_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      input: fewShotInput({
        language: 'ru',
        period: 'day',
        currentDate: '2026-09-03',
        periodStart: '2026-09-03',
        periodEnd: '2026-09-03',
        periodLabel: 'ЧЕТВЕРГ\n3 СЕНТЯБРЯ',
        user: {
          name: 'Артём',
          birthDate: '1992-04-11',
          birthTime: '08:40',
          birthPlace: 'Казань',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Артём, сегодня тебе идёт быть заметным. Пользуйся, пока скромность не вмешалась.',
        forecast: 'Люди реагируют на тебя теплее обычного, разговоры легче цепляются один за другой, а симпатия считывается почти без расшифровки. Хорошо может зайти встреча, знакомство, прогулка или просто вечер не дома.',
        advice: [
          'Отличный день для людей и удовольствия.',
          'Выбирай то, куда действительно хочется идти, а не то, куда «надо».',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'day',
        currentDate: '2026-09-07',
        periodStart: '2026-09-07',
        periodEnd: '2026-09-07',
        periodLabel: 'ПОНЕДЕЛЬНИК\n7 СЕНТЯБРЯ',
        user: {
          name: 'Марина',
          birthDate: '1990-11-28',
          birthTime: '17:25',
          birthPlace: 'Самара',
          gender: 'female',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Вот редкий случай: можно ничего не усложнять.',
        forecast: 'Многое сегодня складывается довольно естественно. Нужные слова находятся вовремя, настроение быстро восстанавливается после мелочей, а какая-нибудь совершенно обычная вещь может неожиданно порадовать сильнее крупного события.',
        advice: [
          'День хороший именно своей нормальностью.',
          'Оставь вечером время на что-нибудь приятное. Без великой цели.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'day',
        currentDate: '2026-09-12',
        periodStart: '2026-09-12',
        periodEnd: '2026-09-12',
        periodLabel: 'СУББОТА\n12 СЕНТЯБРЯ',
        user: {
          name: 'Елена',
          birthDate: '1996-02-15',
          birthTime: '21:10',
          birthPlace: 'Пермь',
          gender: 'female',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Кажется, кто-то сегодня будет смотреть на тебя чуть дольше положенного.',
        forecast: 'В общении больше интереса, лёгкости и игры. Если между тобой и кем-то уже есть симпатия, она может стать заметнее; если нет — всё равно легко оказаться в приятной компании и поймать хороший контакт.',
        advice: [
          'Романтика сегодня вполне уместна.',
          'Ответная улыбка ещё никого не разорила.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'day',
        currentDate: '2026-09-18',
        periodStart: '2026-09-18',
        periodEnd: '2026-09-18',
        periodLabel: 'ПЯТНИЦА\n18 СЕНТЯБРЯ',
        user: {
          name: 'Михаил',
          birthDate: '1989-03-06',
          birthTime: '23:15',
          birthPlace: 'Сергиев Посад',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Михаил, хорошие новости: сегодня мир не требует от тебя подвига.',
        forecast: 'День подходит для спокойного удовольствия от привычных вещей. Поесть вкусно, куда-нибудь выбраться, увидеться с приятным человеком, купить мелочь, которая давно нравилась, — всё это сегодня заходит особенно хорошо.',
        advice: [
          'Никакой драмы. Просто хороший человеческий день.',
          'Потрать его хотя бы частично на себя, а не только на полезное.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'day',
        currentDate: '2026-09-23',
        periodStart: '2026-09-23',
        periodEnd: '2026-09-23',
        periodLabel: 'СРЕДА\n23 СЕНТЯБРЯ',
        user: {
          name: 'Роман',
          birthDate: '1993-07-19',
          birthTime: '06:55',
          birthPlace: 'Тула',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Скучно сегодня будет только тому, кто очень постарается.',
        forecast: 'Вокруг больше движения, разговоров и случайных вариантов. Может захотеться резко поменять маршрут, зайти куда-нибудь по дороге, согласиться на неожиданное предложение или продолжить вечер дольше, чем собирался.',
        advice: [
          'Импровизация сегодня сильнее расписания.',
          'Если вариант звучит интересно — хотя бы не отказывайся автоматически.',
        ],
      },
    },
  ],
  week: [
    {
      input: fewShotInput({
        language: 'ru',
        period: 'week',
        currentDate: '2026-10-05',
        periodStart: '2026-10-05',
        periodEnd: '2026-10-11',
        periodLabel: '5 ОКТЯБРЯ — 11 ОКТЯБРЯ',
        user: {
          name: 'Артём',
          birthDate: '1992-04-11',
          birthTime: '08:40',
          birthPlace: 'Казань',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Похоже, у тебя намечается неделя с хорошим вкусом. В прямом и переносном смысле.',
        forecast: 'Станет больше приятных поводов выйти из привычного режима: встречи, места, люди, покупки, новые впечатления. В общении заметно больше взаимности, а один человек может раскрыться с неожиданно хорошей стороны. Где-то захочется потратить чуть больше обычного — скорее на удовольствие, чем по необходимости. И это не выглядит плохой идеей. К выходным настроение становится легче и веселее.',
        advice: [
          'Неделя больше про удовольствие от жизни, чем про преодоление.',
          'Выбери хотя бы один вечер, который заранее никому не отдашь.',
          'И если захочется потратить его совершенно несерьёзно — тем лучше.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'week',
        currentDate: '2026-10-12',
        periodStart: '2026-10-12',
        periodEnd: '2026-10-18',
        periodLabel: '12 ОКТЯБРЯ — 18 ОКТЯБРЯ',
        user: {
          name: 'Алиса',
          birthDate: '1995-05-02',
          birthTime: '13:05',
          birthPlace: 'Уфа',
          gender: 'female',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Есть подозрение, что кто-то скоро сильно поднимет тебе настроение.',
        forecast: 'Общение выходит на первый план, но без обязательных «серьёзных разговоров». Больше шуток, новых тем, симпатии, желания куда-то выбраться вместе. Для отношений это хороший момент добавить что-нибудь живое вместо привычного сценария. Для свободных — просто удачная неделя чаще бывать среди людей. Плюс может неожиданно вернуться интерес к человеку или занятию, которое уже почти забылось.',
        advice: [
          'Скучать в одиночку на этой неделе будет немного обидно.',
          'Принимай приглашения от тех, рядом с кем действительно хорошо.',
          'Остальным совершенно необязательно объяснять, почему тебя нет.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'week',
        currentDate: '2026-10-19',
        periodStart: '2026-10-19',
        periodEnd: '2026-10-25',
        periodLabel: '19 ОКТЯБРЯ — 25 ОКТЯБРЯ',
        user: {
          name: 'Артём',
          birthDate: '1988-12-09',
          birthTime: '10:30',
          birthPlace: 'Омск',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Артём, деньги на этой неделе могут вести себя прилично. Не спугни их аплодисментами.',
        forecast: 'Финансовая тема выглядит спокойнее и приятнее обычного. Может подвернуться выгодная покупка, дополнительный вариант заработать или просто хороший момент решить вопрос, который раньше казался дороже и сложнее. При этом жизнь не крутится только вокруг цифр: ближе к выходным сильнее тянет к отдыху, поездке, компании и нормальному развлечению.',
        advice: [
          'Есть шанс и получить пользу, и не забыть потратить что-нибудь на удовольствие.',
          'Хорошие предложения рассматривай без подозрения по умолчанию.',
          'А часть удачи вполне можно отметить.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'week',
        currentDate: '2026-10-26',
        periodStart: '2026-10-26',
        periodEnd: '2026-11-01',
        periodLabel: '26 ОКТЯБРЯ — 1 НОЯБРЯ',
        user: {
          name: 'Марина',
          birthDate: '1991-08-24',
          birthTime: '19:45',
          birthPlace: 'Ярославль',
          gender: 'female',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Иногда всё действительно начинает складываться. Да, даже без подвоха.',
        forecast: 'Один за другим могут появляться маленькие удачные совпадения: нужный человек оказывается на связи, хорошее место — свободно, решение приходит быстрее ожидаемого, настроение держится лучше. Ничего грандиозного, зато неделя даёт приятное чувство, что мир не сопротивляется каждому твоему движению. В личной жизни особенно хороша середина периода — там больше тепла и инициативы.',
        advice: [
          'Из мелких удач получится очень даже приличная неделя.',
          'Замечай хорошее сразу, а не спустя три дня.',
          'Оно имеет привычку проходить незамеченным, пока человек занят поиском проблемы.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'week',
        currentDate: '2026-11-02',
        periodStart: '2026-11-02',
        periodEnd: '2026-11-08',
        periodLabel: '2 НОЯБРЯ — 8 НОЯБРЯ',
        user: {
          name: 'Кирилл',
          birthDate: '1994-01-30',
          birthTime: '07:20',
          birthPlace: 'Рязань',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Неожиданный поворот: привычное вдруг начинает нравиться снова.',
        forecast: 'Может вернуться интерес к своему городу, знакомому человеку, старому увлечению или месту, которое давно стало фоном. В этом есть что-то приятное: не обязательно постоянно искать новое, чтобы снова почувствовать вкус к жизни. При этом пара свежих знакомств или идей тоже вполне возможны. Неделя хорошо сочетает знакомое и новое без ощущения, что надо выбирать что-то одно.',
        advice: [
          'Удовольствие может оказаться гораздо ближе, чем казалось.',
          'Сходи туда, где тебе раньше действительно нравилось.',
          'Иногда второй заход оказывается лучше первого.',
        ],
      },
    },
  ],
  month: [
    {
      input: fewShotInput({
        language: 'ru',
        period: 'month',
        currentDate: '2026-11-08',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        periodLabel: 'НОЯБРЬ 2026 Г.',
        user: {
          name: 'Михаил',
          birthDate: '1989-03-06',
          birthTime: '23:15',
          birthPlace: 'Сергиев Посад',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Михаил, похоже, впереди период, после которого фотографий в телефоне станет больше. И это хороший знак.',
        forecast: 'Появится больше причин куда-нибудь выйти, съездить, встретиться, попробовать новое или просто чаще менять привычную картинку перед глазами. Новые люди входят в жизнь легче, старые знакомые могут приятно напомнить о себе, а общение становится разнообразнее. В отношениях больше тепла и естественного интереса без необходимости что-то специально изображать. Деньги периодически будут уходить на удовольствие, но месяц выглядит достаточно ровно, чтобы это не превращалось в повод портить себе настроение. Ближе к концу может появиться занятие, место или человек, к которому захочется возвращаться.',
        advice: [
          'Месяц про впечатления, людей и ощущение, что вокруг снова много интересного.',
          'Оставляй деньги и время не только на обязательное, но и на красивое, вкусное и весёлое.',
          'Воспоминания редко начинаются словами «хорошо, что я тогда остался дома».',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'month',
        currentDate: '2026-12-06',
        periodStart: '2026-12-01',
        periodEnd: '2026-12-31',
        periodLabel: 'ДЕКАБРЬ 2026 Г.',
        user: {
          name: 'Ольга',
          birthDate: '1990-06-17',
          birthTime: '15:35',
          birthPlace: 'Воронеж',
          gender: 'female',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Кажется, твоя личная жизнь собралась напомнить о своём существовании.',
        forecast: 'В отношениях становится больше движения. Где-то возвращается интерес, где-то появляется новое знакомство, а некоторые разговоры вдруг начинают звучать совсем иначе, чем раньше. Симпатия может развиваться постепенно — без киношных признаний, зато с нормальным человеческим желанием чаще видеть друг друга. Для пары месяц хорош тем, что снова появляется ощущение «нам вместе прикольно», а не только совместный быт. Вторая половина периода особенно располагает к встречам, поездкам и небольшим совместным приключениям.',
        advice: [
          'Любовь в этом месяце выглядит не драмой, а приятной частью жизни. И слава богу.',
          'Если человек тебе нравится — показывай это нормальным человеческим способом.',
          'Не каждую симпатию нужно анализировать до состояния протокола допроса.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'month',
        currentDate: '2027-01-10',
        periodStart: '2027-01-01',
        periodEnd: '2027-01-31',
        periodLabel: 'ЯНВАРЬ 2027 Г.',
        user: {
          name: 'Артём',
          birthDate: '1993-09-03',
          birthTime: '11:50',
          birthPlace: 'Новосибирск',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Вот сейчас может стать действительно интересно.',
        forecast: 'Привычный круг жизни начинает немного расширяться. Появляются новые места, люди, предложения, темы для разговоров и идеи, на которые раньше не хватало интереса. При этом старое никуда насильно не исчезает — просто становится понятнее, что ещё радует, а что уже давно превратилось в фон. Финансово месяц способен дать приятную свободу: больше выбора, возможность купить желаемое или нормально провести время без постоянного внутреннего калькулятора. Ближе к финалу периода особенно хорошо чувствуется, что жизнь стала насыщеннее.',
        advice: [
          'Главное приобретение месяца — не вещь и не результат, а больше вариантов вокруг.',
          'Пробуй новое там, где оно действительно любопытно, а не потому что «надо развиваться».',
          'Любопытство здесь работает лучше дисциплины.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'month',
        currentDate: '2027-02-09',
        periodStart: '2027-02-01',
        periodEnd: '2027-02-28',
        periodLabel: 'ФЕВРАЛЬ 2027 Г.',
        user: {
          name: 'Ирина',
          birthDate: '1987-10-22',
          birthTime: '18:05',
          birthPlace: 'Краснодар',
          gender: 'female',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Хорошая компания, вкусная еда и немного денег на глупости — иногда это вполне серьёзный жизненный план.',
        forecast: 'Месяц располагает к удовольствиям без особого чувства вины. Хочется больше видеть людей, красиво выглядеть, покупать приятные вещи, менять обстановку, хорошо есть и чаще делать что-то просто потому, что нравится. При этом совсем без пользы тоже не останешься: могут появиться удачные знакомства, выгодный вариант или идея, которая неожиданно окажется перспективной. Отношения становятся легче именно там, где меньше напряжения и больше нормального совместного времени. В целом месяц ощущается живым, тёплым и довольно щедрым.',
        advice: [
          'Хороший период не обязательно надо превращать в проект. Его можно просто хорошо прожить.',
          'Не экономь каждую хорошую эмоцию «на потом».',
          'Удовольствие тоже считается результатом.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'ru',
        period: 'month',
        currentDate: '2027-03-07',
        periodStart: '2027-03-01',
        periodEnd: '2027-03-31',
        periodLabel: 'МАРТ 2027 Г.',
        user: {
          name: 'Павел',
          birthDate: '1991-12-14',
          birthTime: '05:45',
          birthPlace: 'Ижевск',
          gender: 'male',
          language: 'ru',
        },
      }),
      output: {
        opening: 'Не всё будет идеально. Зато многое окажется гораздо лучше, чем выглядело в начале.',
        forecast: 'Первые недели могут дать пару странных поворотов: человек отвечает не так, ожидалось одно — получается другое, привычный вариант внезапно перестаёт нравиться. Но дальше картина становится значительно интереснее. Появляются новые люди, больше свободы в выборе, приятные поводы куда-то выбраться и ощущение, что перемены скорее освежили жизнь, чем испортили её. Особенно хорошо выглядит последняя часть месяца: там больше лёгкости, общения и вещей, которых действительно хочется ждать. Даже неудачный эпизод способен довольно быстро превратиться в забавную историю.',
        advice: [
          'Месяц начнёт немного криво, а закончить может очень красиво.',
          'Первые впечатления в этот раз не самые надёжные.',
          'Некоторым историям просто нужен второй акт. Первый у них так себе.',
        ],
      },
    },
  ],
};

const EN_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      input: fewShotInput({
        language: 'en',
        period: 'day',
        currentDate: '2026-09-03',
        periodStart: '2026-09-03',
        periodEnd: '2026-09-03',
        periodLabel: 'THURSDAY\nSEPTEMBER 3',
        user: {
          name: 'Alex',
          birthDate: '1992-04-11',
          birthTime: '08:40',
          birthPlace: 'Boston',
          gender: 'male',
          language: 'en',
        },
      }),
      output: {
        opening: 'You look unusually easy to notice today. Use it before modesty gets involved.',
        forecast: 'People respond more warmly, conversations find their rhythm quickly, and attraction is easier to read without a full investigation. A meeting, a walk, or an unplanned evening out can land especially well.',
        advice: [
          'Good day for people and simple pleasure.',
          'Pick what you actually want to do, not what looks productive.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'en',
        period: 'day',
        currentDate: '2026-09-07',
        periodStart: '2026-09-07',
        periodEnd: '2026-09-07',
        periodLabel: 'MONDAY\nSEPTEMBER 7',
        user: {
          name: 'Maya',
          birthDate: '1990-11-28',
          birthTime: '17:25',
          birthPlace: 'Chicago',
          gender: 'female',
          language: 'en',
        },
      }),
      output: {
        opening: 'Rare case: you do not need to make this complicated.',
        forecast: 'A lot of things click into place without much effort. The right words arrive on time, small annoyances fade quickly, and something ordinary can end up being the best part of the day.',
        advice: [
          'The day is good because it feels normal.',
          'Keep some time tonight for something you simply enjoy.',
        ],
      },
    },
  ],
  week: [
    {
      input: fewShotInput({
        language: 'en',
        period: 'week',
        currentDate: '2026-10-05',
        periodStart: '2026-10-05',
        periodEnd: '2026-10-11',
        periodLabel: 'OCTOBER 5 — OCTOBER 11',
        user: {
          name: 'Alex',
          birthDate: '1992-04-11',
          birthTime: '08:40',
          birthPlace: 'Boston',
          gender: 'male',
          language: 'en',
        },
      }),
      output: {
        opening: 'This week seems to have decent taste. Finally.',
        forecast: 'There are more reasons to get out, see people, try places, spend a little, and break the usual routine. Communication feels more mutual, and someone may turn out to be more interesting than you gave them credit for. By the weekend, the whole thing feels lighter and more fun.',
        advice: [
          'This one is more about enjoying life than fixing it.',
          'Keep one evening free for something you actually want.',
          'If the plan is delightfully unserious, even better.',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'en',
        period: 'week',
        currentDate: '2026-10-12',
        periodStart: '2026-10-12',
        periodEnd: '2026-10-18',
        periodLabel: 'OCTOBER 12 — OCTOBER 18',
        user: {
          name: 'Maya',
          birthDate: '1995-05-02',
          birthTime: '13:05',
          birthPlace: 'Seattle',
          gender: 'female',
          language: 'en',
        },
      }),
      output: {
        opening: 'Someone may be about to improve your mood quite a lot.',
        forecast: 'People matter more this week, but not because anyone needs a serious talk. There is more humor, attraction, easy company, and a stronger urge to go somewhere together. An old interest can also become unexpectedly fun again.',
        advice: [
          'Being bored alone would be a waste this week.',
          'Say yes to people you genuinely like being around.',
          'Everyone else can survive without a detailed explanation.',
        ],
      },
    },
  ],
  month: [
    {
      input: fewShotInput({
        language: 'en',
        period: 'month',
        currentDate: '2026-11-08',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        periodLabel: 'NOVEMBER 2026',
        user: {
          name: 'Michael',
          birthDate: '1989-03-06',
          birthTime: '23:15',
          birthPlace: 'Cambridge',
          gender: 'male',
          language: 'en',
        },
      }),
      output: {
        opening: 'Your camera roll may be a lot fuller by the end of this. Good sign.',
        forecast: 'There are more reasons to go out, travel, meet people, and change the scenery. New connections arrive more easily, old friends can reappear in a genuinely pleasant way, and relationships feel warmer without needing a dramatic conversation. Money may occasionally disappear into fun, but the month looks steady enough that this does not need to become a moral issue. Toward the end, a person, place, or activity may become something you want more of.',
        advice: [
          'This month is about people, impressions, and having more to look forward to.',
          'Save time and money for things that are beautiful, delicious, or fun too.',
          'Very few good memories begin with “glad I stayed home again.”',
        ],
      },
    },
    {
      input: fewShotInput({
        language: 'en',
        period: 'month',
        currentDate: '2026-12-06',
        periodStart: '2026-12-01',
        periodEnd: '2026-12-31',
        periodLabel: 'DECEMBER 2026',
        user: {
          name: 'Olivia',
          birthDate: '1990-06-17',
          birthTime: '15:35',
          birthPlace: 'Austin',
          gender: 'female',
          language: 'en',
        },
      }),
      output: {
        opening: 'Your love life appears to remember that it exists.',
        forecast: 'Relationships get more movement and more actual interest. A connection may warm up, a new person may become worth noticing, or familiar conversations can suddenly feel different in a good way. Attraction develops best without grand declarations: wanting to see each other more often is enough evidence for now. For couples, ordinary life gets more fun again. The second half of the month is especially good for dates, trips, and small shared adventures.',
        advice: [
          'Love looks more like a pleasant part of life than a crisis this month. Excellent.',
          'If you like someone, make it reasonably obvious.',
          'Not every spark needs a full forensic analysis.',
        ],
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
    ? 'FEW-SHOT EXAMPLES. These are real-shaped INPUT → OUTPUT demonstrations. Learn the voice, variety, rhythm, and transformation. Never copy their facts, jokes, situations, openings, or wording, and never force the current forecast to resemble an example.'
    : 'FEW-SHOT ПРИМЕРЫ. Это реальные по форме пары INPUT → OUTPUT. Учись на них способу превращать входные данные в живой текст: голосу, диапазону настроений, разной конструкции захода, длине и ритму. Никогда не копируй факты, шутки, ситуации, заходы или формулировки и не подгоняй текущий прогноз под конкретный пример.';

  return `${heading}\n${examples.map((example, index) => [
    `EXAMPLE ${index + 1}`,
    'INPUT',
    JSON.stringify(example.input, null, 2),
    'OUTPUT',
    JSON.stringify(example.output, null, 2),
  ].join('\n')).join('\n---\n')}`;
}
