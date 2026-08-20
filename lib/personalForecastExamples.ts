import type { PersonalForecastPeriod } from './personalForecastContract';

type PersonalForecastReferenceTone = 'bright' | 'steady' | 'challenging';

type PersonalForecastReferenceFragment = {
  text: string;
  presentation_style?: 'prose' | 'pull_quote' | 'paper_note';
  main_idea_key: string;
  life_plot_key: string;
  advice_key: string;
  comparison_key: string;
  evidence_ids: ['profile:personal'];
};

export type PersonalForecastReferenceExample = {
  id: string;
  period: PersonalForecastPeriod;
  tone: PersonalForecastReferenceTone;
  input: {
    period: PersonalForecastPeriod;
    name: string;
    birth_date: string;
    birth_time: string | null;
    birth_place: string | null;
  };
  output: {
    headline: {
      text: string;
      evidence_ids: ['profile:personal'];
    };
    fragments: PersonalForecastReferenceFragment[];
    closing: {
      text: string;
      kind: 'advice' | 'action' | 'avoidance' | 'wish' | 'motivation';
      advice_key: string;
      evidence_ids: ['profile:personal'];
    };
  };
};

const evidenceIds = (): ['profile:personal'] => ['profile:personal'];

/**
 * Editorial references, not reusable forecast templates. They deliberately
 * cover different period moods while keeping one recognisable Luna voice.
 */
export const PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU: readonly PersonalForecastReferenceExample[] = [
  {
    id: 'day-bright-own-it',
    period: 'day',
    tone: 'bright',
    input: {
      period: 'day',
      name: 'Мира',
      birth_date: '1990-01-01',
      birth_time: '12:00',
      birth_place: 'Москва',
    },
    output: {
      headline: { text: 'День твой. Забирай.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'Сегодня у тебя редкое сочетание скорости и точности: решения складываются без лишней возни, а нужные слова приходят вовремя и звучат уверенно.',
          presentation_style: 'prose',
          main_idea_key: 'решения даются легко',
          life_plot_key: 'быстрый точный выбор',
          advice_key: '',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Если разговор начнёт буксовать, говори сразу по делу без длинного вступления. Шанс договориться сейчас выше, особенно когда ты не прячешь главное за вежливыми кругами.',
          presentation_style: 'prose',
          main_idea_key: 'прямота помогает договориться',
          life_plot_key: 'важный разговор',
          advice_key: 'говорить сразу по делу',
          comparison_key: 'вежливые круги',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Рабочая задача или бытовой выбор могут приятно поддаться с первой попытки. Хороший вариант не обязан выглядеть сложно, чтобы оказаться действительно твоим.',
          presentation_style: 'prose',
          main_idea_key: 'простое решение подходит',
          life_plot_key: 'задача или бытовой выбор',
          advice_key: '',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Твои условия звучат убедительно, когда ты называешь их спокойно и не извиняешься за хороший аппетит к жизни.',
          presentation_style: 'prose',
          main_idea_key: 'условия звучат убедительно',
          life_plot_key: 'свои условия',
          advice_key: 'назвать условия без оправданий',
          comparison_key: 'аппетит к жизни',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Пусть день окажется щедрым: бери своё без лишних церемоний.',
        kind: 'wish',
        advice_key: 'принять щедрость дня без церемоний',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'day-steady-bold',
    period: 'day',
    tone: 'steady',
    input: {
      period: 'day',
      name: 'Антон',
      birth_date: '1987-06-14',
      birth_time: null,
      birth_place: 'Казань',
    },
    output: {
      headline: { text: 'Сегодня можно наглеть.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'Твоя уверенность сегодня звучит убедительно, если за ней стоит конкретика. Можно просить больше, предлагать смелее и не уменьшать себя ради чужого удобства.',
          presentation_style: 'prose',
          main_idea_key: 'уверенность подкреплена конкретикой',
          life_plot_key: 'смелая просьба',
          advice_key: 'просить больше и предлагать смелее',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'В сообщении или разговоре лучше сразу назвать желаемый результат. Людям будет проще ответить тебе по существу, а не гадать, чего ты на самом деле хочешь.',
          presentation_style: 'prose',
          main_idea_key: 'назвать желаемый результат',
          life_plot_key: 'сообщение с просьбой',
          advice_key: 'назвать желаемый результат',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'В бытовом выборе не обязательно брать самый скромный вариант. Если вещь экономит время и радует глаз, это уже два нормальных аргумента.',
          presentation_style: 'prose',
          main_idea_key: 'удобство оправдывает смелый выбор',
          life_plot_key: 'бытовая покупка',
          advice_key: 'выбрать удобный приятный вариант',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Сделай одну сильную просьбу и откажись от одного лишнего компромисса.',
          presentation_style: 'prose',
          main_idea_key: 'просить без самоуменьшения',
          life_plot_key: 'отказ от компромисса',
          advice_key: 'сделать просьбу и убрать компромисс',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Желаю получить честный ответ там, где расплывчатость только мешает делу.',
        kind: 'wish',
        advice_key: 'получить честный ответ вместо расплывчатости',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'day-bright-luck',
    period: 'day',
    tone: 'bright',
    input: {
      period: 'day',
      name: 'Лена',
      birth_date: '1994-10-03',
      birth_time: '08:40',
      birth_place: null,
    },
    output: {
      headline: { text: 'Удача вышла на смену.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'Сегодня многое готово складываться в твою пользу без перетягивания каната. Не чудо, просто хороший день наконец работает без выходного и не требует долгих объяснений.',
          presentation_style: 'prose',
          main_idea_key: 'обстоятельства складываются удачно',
          life_plot_key: 'лёгкое продвижение',
          advice_key: '',
          comparison_key: 'работает без выходного',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Ответ, договорённость или небольшая покупка могут оказаться приятнее ожиданий. Замечай простые совпадения интересов: именно через них дело двигается почти само.',
          presentation_style: 'prose',
          main_idea_key: 'совпадение интересов помогает',
          life_plot_key: 'ответ или договорённость',
          advice_key: 'замечать совпадение интересов',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Лена, сегодня тебе идёт решительность без тяжёлого лица. Приятный поворот не требует проверки на серьёзность, чтобы заслужить нормальную улыбку.',
          presentation_style: 'prose',
          main_idea_key: 'радость без проверки',
          life_plot_key: 'приятный результат',
          advice_key: '',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Выбирай то, что даёт больше пользы и удовольствия одновременно.',
          presentation_style: 'prose',
          main_idea_key: 'принять удачный вариант',
          life_plot_key: 'приятный полезный выбор',
          advice_key: 'выбрать полезное и приятное',
          comparison_key: 'запас везения',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Используй этот запас везения смело и красиво: хороший результат сегодня можно принимать сразу, спокойно и с удовольствием.',
        kind: 'advice',
        advice_key: 'смело использовать запас везения',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'day-challenging-precision',
    period: 'day',
    tone: 'challenging',
    input: {
      period: 'day',
      name: 'Марина',
      birth_date: '1983-11-21',
      birth_time: null,
      birth_place: 'Уфа',
    },
    output: {
      headline: { text: 'Сегодня нужна точность.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'День будет быстрым, и мелочи попробуют командовать парадом. Главная задача не успеть всё, а не отдать важное случайной суете.',
          presentation_style: 'prose',
          main_idea_key: 'мелочи создают суету',
          life_plot_key: 'быстрый день',
          advice_key: 'не отдавать важное суете',
          comparison_key: 'командовать парадом',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Зато одна задача может пойти особенно хорошо, если убрать лишние разговоры и заняться ею без зрителей. Спокойная собранность сегодня сильнее показного рывка.',
          presentation_style: 'prose',
          main_idea_key: 'собранность помогает делу',
          life_plot_key: 'задача без лишних разговоров',
          advice_key: 'убрать лишние разговоры и сосредоточиться',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Если тебя торопят, уточни срок, задачу и свою часть. После этого проще согласиться, отказаться или предложить нормальный вариант без лишней драмы.',
          presentation_style: 'prose',
          main_idea_key: 'точные вопросы возвращают выбор',
          life_plot_key: 'чужая спешка',
          advice_key: 'уточнить срок задачу и свою часть',
          comparison_key: '',
          evidence_ids: evidenceIds(),
        },
        {
          text: 'Сделай необходимое, не доказывай очевидное и не бери лишнего из вежливости.',
          presentation_style: 'prose',
          main_idea_key: 'не брать лишнее',
          life_plot_key: 'приятный план без отчётности',
          advice_key: 'сделать необходимое и не брать лишнего',
          comparison_key: 'день как экзамен',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Оставь один приятный план без пользы и отчётности — день не обязан быть экзаменом.',
        kind: 'action',
        advice_key: 'оставить приятный план без отчётности',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'week-bright-acceleration',
    period: 'week',
    tone: 'bright',
    input: {
      period: 'week',
      name: 'Саша',
      birth_date: '1989-02-22',
      birth_time: '19:15',
      birth_place: 'Самара',
    },
    output: {
      headline: { text: 'Неделя даёт разгон.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'На этой неделе твои идеи легче переходят из разговоров в нормальные дела. Там, где задаче нужна ясность, хватит одной точной формулировки и уверенного шага. Хорошо пойдут договорённости, задачи с понятным результатом и просьбы, которые можно сформулировать одним точным предложением. Люди охотнее подхватят твой темп, если увидят, куда именно ты ведёшь. Даже мелкие удачи будут складываться в заметное преимущество, и скромничать здесь совершенно незачем. Выбери одну цель, подними ставку и доведи дело до результата.',
          main_idea_key: 'идеи быстро становятся делами',
          life_plot_key: 'договорённости и понятные задачи',
          advice_key: 'выбрать цель и поднять ставку',
          comparison_key: 'поднять ставку',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Пусть эта неделя приятно удивит собственной щедростью.',
        kind: 'wish',
        advice_key: 'пожелать щедрой недели',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'week-steady-clean-pace',
    period: 'week',
    tone: 'steady',
    input: {
      period: 'week',
      name: 'Ирина',
      birth_date: '1978-09-11',
      birth_time: null,
      birth_place: 'Пермь',
    },
    output: {
      headline: { text: 'Неделя идёт ровно.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'Эта неделя хороша редкой управляемостью. Бытовые мелочи укладываются без суеты, встречи не требуют сложной режиссуры, а свободное окно действительно может остаться свободным. Тебе будет проще выбирать приятные планы без ощущения, что сначала надо заслужить отдых ещё десятью пунктами. Если появится чужая срочность, она не обязана немедленно становиться твоей. Спокойный ход даст больше пользы, чем показательный рывок ради красивого старта. Оставь в расписании только несколько действительно важных дел, а остальному назначь честное «потом».',
          main_idea_key: 'ровный темп сохраняет силы',
          life_plot_key: 'быт встречи и отдых',
          advice_key: 'ограничить список важных дел',
          comparison_key: 'отдых надо заслужить пунктами',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Желаю закончить неделю с простым и редким результатом: нужное сделано, приятное случилось, силы ещё остались.',
        kind: 'wish',
        advice_key: 'закончить неделю с результатом и силами',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'week-challenging-precision',
    period: 'week',
    tone: 'challenging',
    input: {
      period: 'week',
      name: 'Денис',
      birth_date: '1992-12-05',
      birth_time: '06:20',
      birth_place: 'Омск',
    },
    output: {
      headline: { text: 'Неделя требует точности.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'На этой неделе мелкие неточности способны устроить шума больше, чем заслуживают. Особенно это касается обещаний, условий и задач, где каждый уверен, что второй всё понял без слов. Ничего драматичного: просто намёки временно работают хуже прямых формулировок. Твоя сильная позиция — не отвечать на чужую спешку автоматическим согласием и не тащить лишнее из вежливости. Один уточняющий вопрос сбережёт больше сил, чем героическое исправление чужих догадок. Перед согласием назови срок, объём и ожидаемый результат.',
          main_idea_key: 'точность предотвращает лишнюю суету',
          life_plot_key: 'условия обещания и задачи',
          advice_key: 'уточнить срок объём и результат',
          comparison_key: 'точность как фильтр от лишней работы',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Держи свою точность: она здесь не занудство, а хороший фильтр от лишней работы.',
        kind: 'motivation',
        advice_key: 'сохранить точность и отсечь лишнее',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'month-bright-winning-side',
    period: 'month',
    tone: 'bright',
    input: {
      period: 'month',
      name: 'Алина',
      birth_date: '1985-04-27',
      birth_time: '15:30',
      birth_place: 'Тула',
    },
    output: {
      headline: { text: 'Месяц играет за тебя.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'Этот месяц хорошо поддерживает решения, которые делают твою жизнь удобнее, интереснее и заметно шире. Инициатива звучит уместно и уверенно, хорошие идеи получают нормальную почву, а полезные знакомства могут начинаться с совершенно обычного разговора. Тебе легче показывать результат ясно, просить условия, соответствующие твоему вкладу, и замечать варианты с хорошим запасом роста. Приятные возможности можно принимать сразу, а затем превращать их в заметный результат. Чем честнее ты называешь желаемое, тем проще другим ответить по существу. Выбери направление, где тебе действительно хочется большего, и сделай первый заметный шаг.',
          main_idea_key: 'месяц поддерживает рост',
          life_plot_key: 'решения идеи и знакомства',
          advice_key: 'выбрать направление и сделать шаг',
          comparison_key: 'идеи получают нормальную почву',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Пусть этот месяц радует тебя чаще, чем ты успеваешь привыкнуть к хорошему.',
        kind: 'wish',
        advice_key: 'пожелать частых поводов для радости',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'month-steady-order',
    period: 'month',
    tone: 'steady',
    input: {
      period: 'month',
      name: 'Роман',
      birth_date: '1975-07-19',
      birth_time: null,
      birth_place: 'Воронеж',
    },
    output: {
      headline: { text: 'Месяц любит порядок.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'Этот месяц становится заметно приятнее, когда у каждого дела есть понятное место, а у каждого обещания — настоящий срок. Тебе не требуется превращать жизнь в таблицу; достаточно замечать решения, которые требуют внимания и ничего не дают взамен. Если освободится время, ему быстро найдётся достойное применение: встреча, полезная задача, отдых или новая идея на пробу. В разговорах выигрывает конкретика без сухости, в покупках — ясное понимание, зачем вещь тебе нужна. Выбери один вопрос для окончательного решения, откажись от одной пустой обязанности и оставь место для чего-нибудь по-настоящему приятного.',
          main_idea_key: 'порядок освобождает время',
          life_plot_key: 'решения обещания и покупки',
          advice_key: 'закрыть вопрос и убрать обязанность',
          comparison_key: 'порядок как строгий завуч',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Пусть порядок здесь работает на свободу, а не изображает строгого завуча из старой школы.',
        kind: 'wish',
        advice_key: 'использовать порядок ради свободы',
        evidence_ids: evidenceIds(),
      },
    },
  },
  {
    id: 'month-challenging-less-noise',
    period: 'month',
    tone: 'challenging',
    input: {
      period: 'month',
      name: 'Ника',
      birth_date: '1997-03-08',
      birth_time: '23:10',
      birth_place: 'Сочи',
    },
    output: {
      headline: { text: 'Лишнее сдаст позиции.', evidence_ids: evidenceIds() },
      fragments: [
        {
          text: 'Этот месяц быстро покажет, какие дела держатся только на твоём терпении, а какие действительно заслуживают продолжения. Возможны разговоры, где неопределённость потребует прямого ответа, и задачи, которым нужны ясные условия без лишних осложнений. Это не месяц больших драм; скорее генеральная уборка без торжественной музыки. Тебе пригодится умение спокойно отказывать тому, что требует много и возвращает крохи. После нескольких точных решений появится больше места для людей и занятий, которые отвечают взаимностью. Не спасай чужую неорганизованность своим временем, уточняй договорённости и закрывай бесполезные хвосты.',
          main_idea_key: 'лишнее теряет влияние',
          life_plot_key: 'неясные дела и договорённости',
          advice_key: 'не спасать чужую неорганизованность',
          comparison_key: 'генеральная уборка без музыки',
          evidence_ids: evidenceIds(),
        },
      ],
      closing: {
        text: 'Не продлевай в этом месяце договорённости, где взаимность существует только на словах и исчезает при переходе к настоящему делу.',
        kind: 'avoidance',
        advice_key: 'не продлевать односторонние договорённости',
        evidence_ids: evidenceIds(),
      },
    },
  },
];

export function renderPersonalForecastReferenceExamples(
  language: 'ru' | 'en',
  period: PersonalForecastPeriod,
): string {
  if (language !== 'ru') return '';
  const examples = PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((example) => example.period === period)
    .map((example) => ({ input: example.input, output: example.output }));
  return `<forecast_reference_examples>
Эти примеры задают голос, краткость, структуру и практичный финал. Это ориентиры, а не шаблоны. Не копируй и близко не пересказывай их заголовок, ситуацию, сравнение, совет или концовку.
${JSON.stringify(examples, null, 2)}
</forecast_reference_examples>`;
}
export function getPersonalForecastReferenceFragments(
  period: PersonalForecastPeriod,
): Array<{
  kind: 'headline' | 'fragment';
  text: string;
  mainIdeaKey?: string;
  lifePlotKey?: string;
  adviceKey?: string;
  comparisonKey?: string;
}> {
  return PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
    .filter((example) => example.period === period)
    .flatMap((example) => [
      { kind: 'headline' as const, text: example.output.headline.text },
      ...example.output.fragments.map((fragment, index, fragments) => ({
        kind: 'fragment' as const,
        text: index === fragments.length - 1
          ? `${fragment.text.trim()} ${example.output.closing.text.trim()}`.trim()
          : fragment.text,
        mainIdeaKey: fragment.main_idea_key,
        lifePlotKey: fragment.life_plot_key,
        adviceKey: index === fragments.length - 1
          ? [fragment.advice_key, example.output.closing.advice_key].filter(Boolean).join('; ')
          : fragment.advice_key,
        comparisonKey: fragment.comparison_key,
      })),
    ]);
}
