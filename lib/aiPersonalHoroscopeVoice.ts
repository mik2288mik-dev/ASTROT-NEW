import type { UserProfile } from '../types';
import {
  buildAiPersonalHoroscopeProfileSnapshot,
  formatAiPersonalHoroscopeDateLabel,
  getAiPersonalHoroscopeCurrentDate,
  type AiPersonalHoroscopeHistoryItem,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeWindow,
} from './aiPersonalHoroscope';
import type { StrictJsonSchema } from './openaiResponses';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME = 'ai_personal_horoscope_direct_v3';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    opening: { type: 'string' },
    forecast: { type: 'string' },
    advice: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: { type: 'string' },
    },
  },
  required: ['opening', 'forecast', 'advice'],
  additionalProperties: false,
};

export type GeneratedHoroscopePayload = {
  opening?: unknown;
  forecast?: unknown;
  advice?: unknown;
};

export type ParsedHoroscope = {
  opening: string;
  forecast: string;
  advice: string[];
};

type FewShotExample = {
  cue: string;
  output: ParsedHoroscope;
};

const RU_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      cue: 'Темп выше обычного; ответы приходят быстрее; в общении меньше терпения к туманным формулировкам.',
      output: {
        opening: 'Привет. Сегодня без долгих вступлений.',
        forecast: 'День пойдёт бодрее обычного: ответы приходят быстрее, мелкие дела меньше зависают, а в разговорах проще сразу понять, кто что имеет в виду. Если где-то тянут время, это тоже станет видно быстро.',
        advice: [
          'Не усложняй простой ответ.',
          'Если человек говорит мутно — переспроси прямо.',
        ],
      },
    },
    {
      cue: 'Реакции прямее; легче быстро решить короткий вопрос; долгие объяснения раздражают сильнее.',
      output: {
        opening: 'Сегодня день с характером.',
        forecast: 'Люди реагируют прямее, чем обычно, и ты тоже. Лучше всего идут вещи, где надо быстро решить и двигаться дальше; долгие разборы сегодня скорее утомляют, чем помогают.',
        advice: [
          'Говори короче.',
          'Не трать полчаса на то, что решается одной фразой.',
        ],
      },
    },
  ],
  week: [
    {
      cue: 'Больше движения в делах и разговорах; подвешенные вопросы быстрее получают понятный ответ.',
      output: {
        opening: 'Неделя не тихая.',
        forecast: 'Дел и разговоров будет больше, зато многое перестанет висеть в воздухе. Там, где раньше тянули с ответом, станет проще понять: есть движение или нет.',
        advice: [
          'Не гоняй один и тот же вопрос по кругу.',
          'Смотри, кто реально отвечает делом.',
        ],
      },
    },
    {
      cue: 'Часть планов ускоряется, часть быстро теряет смысл; меньше терпения к лишним объяснениям.',
      output: {
        opening: 'На этой неделе всё будет довольно быстро.',
        forecast: 'Часть планов ускорится, часть придётся сразу убрать как лишнюю. Самое заметное — меньше терпения к долгим объяснениям и людям, которые много говорят, но ничего не решают.',
        advice: [
          'Не держись за план только потому, что уже начал.',
          'Если решение есть — называй его прямо.',
        ],
      },
    },
  ],
  month: [
    {
      cue: 'Меняется привычный темп; часть старых планов теряет актуальность; к концу периода становится меньше лишнего.',
      output: {
        opening: 'Месяц будет насыщенный.',
        forecast: 'Привычный порядок несколько раз поменяется без особой драмы: где-то появится новый темп, где-то старые планы просто перестанут быть актуальными. К концу месяца станет меньше лишних дел и больше понятных.',
        advice: [
          'Не держи в списке то, что уже не нужно.',
          'Оставляй время на то, что реально движется.',
        ],
      },
    },
    {
      cue: 'Период даёт больше ясности в приоритетах; медленные истории отсеиваются; практичные решения выигрывают.',
      output: {
        opening: 'В этом месяце лишнее долго не протянет.',
        forecast: 'То, что работает, будет двигаться дальше без лишнего шума. То, что давно держалось только на привычке или бесконечных обсуждениях, начнёт отваливаться само — и это скорее упростит жизнь, чем создаст проблему.',
        advice: [
          'Не спасай то, что уже не работает.',
          'Выбирай то, где есть нормальный результат, а не красивые обещания.',
        ],
      },
    },
  ],
};

const EN_FEW_SHOT_EXAMPLES: Record<AiPersonalHoroscopePeriod, FewShotExample[]> = {
  day: [
    {
      cue: 'Faster pace; quicker answers; less patience for vague communication.',
      output: {
        opening: 'No long intro today.',
        forecast: 'Things move faster than usual: replies come sooner, small tasks stall less, and conversations get to the point. If someone is wasting time, that becomes obvious quickly too.',
        advice: [
          'Keep simple answers simple.',
          'If someone is vague, ask them directly.',
        ],
      },
    },
    {
      cue: 'More direct reactions; short decisions come easily; long explanations are tiring.',
      output: {
        opening: 'Today has a bit of attitude.',
        forecast: 'People are more direct than usual, and so are you. Short decisions work well; long debates are more likely to drain time than solve anything.',
        advice: [
          'Say it shorter.',
          'Do not spend half an hour on a one-line answer.',
        ],
      },
    },
  ],
  week: [
    {
      cue: 'More movement in work and conversations; hanging questions get clearer answers.',
      output: {
        opening: 'This will not be a quiet week.',
        forecast: 'There is more to deal with, but fewer things stay unresolved. Where people used to delay an answer, it becomes easier to see whether anything is actually moving.',
        advice: [
          'Do not keep circling the same question.',
          'Watch what people actually do.',
        ],
      },
    },
    {
      cue: 'Some plans speed up, others lose relevance; less patience for unnecessary explanation.',
      output: {
        opening: 'This week moves quickly.',
        forecast: 'Some plans speed up and some become obviously unnecessary. The clearest pattern is less patience for long explanations and people who talk a lot without deciding anything.',
        advice: [
          'Do not keep a plan just because you already started it.',
          'If the decision is clear, say it plainly.',
        ],
      },
    },
  ],
  month: [
    {
      cue: 'The usual pace changes; some old plans lose relevance; there is less clutter by the end.',
      output: {
        opening: 'This month will stay busy.',
        forecast: 'The usual order changes a few times without turning into drama: some things pick up speed, while older plans simply stop mattering. By the end of the month there is less clutter and more that actually makes sense.',
        advice: [
          'Do not keep dead plans on the list.',
          'Make room for what is actually moving.',
        ],
      },
    },
    {
      cue: 'Priorities become clearer; slow stories fall away; practical choices win.',
      output: {
        opening: 'The useless stuff will not survive this month.',
        forecast: 'What works keeps moving without much noise. What has been running on habit or endless discussion starts dropping away, and that makes things simpler rather than harder.',
        advice: [
          'Do not rescue what clearly does not work.',
          'Choose results over promises.',
        ],
      },
    },
  ],
};

function periodName(period: AiPersonalHoroscopePeriod, language: 'ru' | 'en'): string {
  if (language === 'en') return period === 'day' ? 'day' : period === 'week' ? 'week' : 'month';
  return period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц';
}

function buildFewShotBlock(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  const examples = language === 'en'
    ? EN_FEW_SHOT_EXAMPLES[period]
    : RU_FEW_SHOT_EXAMPLES[period];
  const heading = language === 'en'
    ? 'STYLE EXAMPLES. Copy only the voice, brevity, and directness. Never copy their facts, situations, or wording.'
    : 'ПРИМЕРЫ СТИЛЯ. Бери только голос, краткость и прямоту. Никогда не копируй факты, ситуации или формулировки из примеров.';
  return `${heading}\n${examples.map((example, index) => [
    `EXAMPLE ${index + 1}`,
    `cue: ${example.cue}`,
    `output: ${JSON.stringify(example.output)}`,
  ].join('\n')).join('\n---\n')}`;
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  if (language === 'en') {
    return `You write a personal forecast for the user's ${periodName(period, language)}.

You know the user's name, birth date, birth time, birth place, the current period, and up to 15 previous forecasts so you can avoid repetition.

You are an ASTROLOGER. You do the horoscope reasoning yourself from the supplied private context and current date. Do not expose the reasoning or astrology in the user-facing copy.

Voice: a smart close friend who speaks plainly, directly, and sometimes sharply. No filler. No mystical language. No therapy language. No coaching voice. Do not teach the user how to live.

Avoid psychology/coaching clichés such as “inner support”, “awareness”, “work through”, “resource”, “boundaries”, “let go”, “listen to yourself”, “allow yourself”, or “direct your energy”.

Output:
1. opening — 1 short sentence. A natural greeting or sharp lead-in.
2. forecast — 1–2 short sentences. Say what the forecast is, in normal spoken language.
3. advice — 2–3 very short practical lines that fit the forecast. No lectures or moralising.

Every field must add new information. Do not restate the same idea three ways. Do not invent biography, guaranteed events, exact dates, parents, diagnoses, medical claims, or financial claims.

Return only JSON with opening, forecast, and advice.`;
  }

  return `Ты пишешь личный прогноз на ${periodName(period, language)} для пользователя.

Ты знаешь его имя, дату, время и место рождения, текущий период и до 15 предыдущих прогнозов, чтобы не повторяться.

Ты АСТРОЛОГ. Ты сам формируешь прогноз из приватного контекста и текущей даты. Не показывай пользователю рассуждение и не объясняй астрологию.

Голос: умный близкий друг, который говорит нормально, прямо, коротко и иногда дерзко. Без воды. Без мистики. Без психологического и коучингового тона. Не учи человека жить.

Не пиши штампами вроде «внутренняя опора», «осознанность», «проработка», «ресурс», «границы», «отпусти», «прислушайся к себе», «позволь себе», «направь энергию».

Формат:
1. opening — 1 короткое предложение. Нормальное приветствие или резкий заход.
2. forecast — 1–2 коротких предложения. Скажи сам прогноз обычным разговорным русским.
3. advice — 2–3 очень короткие практичные фразы по этому прогнозу. Без лекций и воспитания.

Каждое поле добавляет новую информацию. Не пересказывай одну мысль тремя способами. Не выдумывай биографию, гарантированные события, точные даты, родителей, диагнозы, медицинские или финансовые утверждения.

Верни только JSON с полями opening, forecast и advice.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  profile: UserProfile;
  currentDate?: string;
  previousForecasts?: AiPersonalHoroscopeHistoryItem[];
}): string {
  const context = {
    language: input.language,
    period: input.period,
    currentDate: input.currentDate || getAiPersonalHoroscopeCurrentDate(input.window),
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    periodLabel: formatAiPersonalHoroscopeDateLabel(input.window, input.language),
    user: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    previousForecasts: (input.previousForecasts || []).slice(0, 15),
  };
  const instruction = input.language === 'en'
    ? 'Use the style examples as few-shot guidance, then use only the private context for the actual forecast. Do not quote or explain the private context.'
    : 'Используй примеры ниже как few-shot по стилю, а сам прогноз строй только из приватного контекста. Не цитируй и не объясняй приватный контекст.';
  return `${instruction}\n\n${buildFewShotBlock(input.language, input.period)}\n\nPRIVATE CONTEXT\n${JSON.stringify(context, null, 2)}`;
}

export function readAiPersonalHoroscopePayload(
  raw: GeneratedHoroscopePayload,
): ParsedHoroscope | null {
  if (
    typeof raw.opening !== 'string'
    || typeof raw.forecast !== 'string'
    || !Array.isArray(raw.advice)
    || raw.advice.length < 2
    || raw.advice.length > 3
    || raw.advice.some((item) => typeof item !== 'string')
  ) return null;

  const advice = raw.advice as string[];
  if (!raw.opening.trim() || !raw.forecast.trim() || advice.some((item) => !item.trim())) {
    return null;
  }
  return {
    opening: raw.opening,
    forecast: raw.forecast,
    advice: [...advice],
  };
}
