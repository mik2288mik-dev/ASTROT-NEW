import type { UserProfile } from '../types';
import { APP_VOICE_VERSION } from './appVoice';
import {
  AI_PERSONAL_HOROSCOPE_CONTENT_MODE,
  AI_PERSONAL_HOROSCOPE_EVIDENCE_ID,
  AI_PERSONAL_HOROSCOPE_VERSION,
  buildAiPersonalHoroscopeProfileSnapshot,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopeRecentReading,
} from './aiPersonalHoroscope';
import type { AiPersonalHoroscopeDialogueMemory } from './aiPersonalHoroscopeMemory';
import { OPENAI_LUNA_MODEL } from './openai-models';
import {
  createLunaStructuredResponse,
  type StrictJsonSchema,
} from './openaiResponses';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
  isPersonalForecastPackage,
  selectTodayFreeSections,
  stableHash,
  type ForecastContentBlock,
  type ForecastContentBlockRole,
  type ForecastSection,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';

const MAX_ATTEMPTS = 2;
const RESPONSE_SCHEMA_NAME = 'ai_personal_horoscope_v1';

const RESPONSE_SCHEMA: StrictJsonSchema = {
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
    memory: {
      type: 'object',
      properties: {
        main_idea_key: { type: 'string' },
        situation_key: { type: 'string' },
        irony_key: { type: 'string' },
        advice_keys: {
          type: 'array',
          minItems: 2,
          maxItems: 3,
          items: { type: 'string' },
        },
      },
      required: ['main_idea_key', 'situation_key', 'irony_key', 'advice_keys'],
      additionalProperties: false,
    },
  },
  required: ['opening', 'forecast', 'advice', 'memory'],
  additionalProperties: false,
};

type GeneratedHoroscopePayload = {
  opening?: unknown;
  forecast?: unknown;
  advice?: unknown;
  memory?: {
    main_idea_key?: unknown;
    situation_key?: unknown;
    irony_key?: unknown;
    advice_keys?: unknown;
  } | unknown;
};

type ValidatedHoroscope = {
  opening: string;
  forecast: string;
  advice: string[];
  memory: {
    mainIdeaKey: string;
    situationKey: string;
    ironyKey: string;
    adviceKeys: string[];
  };
};

export type AiPersonalHoroscopeGenerationMetrics = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  validationPassed: boolean;
};

const RU_FORBIDDEN_CLICHES: readonly RegExp[] = [
  /(?:^|[^\p{L}])выдохн\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])отпусти\p{L}*(?:\s+ситуаци\p{L}*|\s+контрол\p{L}*)?(?!\p{L})/iu,
  /(?:^|[^\p{L}])прими(?:\s+это|\s+себя|\s+ситуаци\p{L}*)?(?!\p{L})/iu,
  /позволь\p{L}*\s+себе/iu,
  /просто\s+будь/iu,
  /будь\s+в\s+поток\p{L}*/iu,
  /закрой\p{L}*\s+двер\p{L}*/iu,
  /вс[её]\s+будет\s+хорошо/iu,
  /доверь\p{L}*\s+процесс\p{L}*/iu,
  /услыш\p{L}*\s+себя/iu,
  /прислуша\p{L}*\s+к\s+себе/iu,
  /будь\s+в\s+моменте/iu,
  /дай\s+себе\s+время/iu,
  /возьми\s+пауз\p{L}*/iu,
  /внутренн\p{L}*\s+(?:опор\p{L}*|ясност\p{L}*|ресурс\p{L}*)/iu,
  /точк\p{L}*\s+опор\p{L}*/iu,
  /день\s+просит/iu,
  /ритм\s+дня/iu,
  /пространств\p{L}*\s+для\s+себя/iu,
];

const EN_FORBIDDEN_CLICHES: readonly RegExp[] = [
  /\b(?:breathe|let\s+go|allow\s+yourself|just\s+be|trust\s+the\s+process|go\s+with\s+the\s+flow|everything\s+will\s+be\s+fine|listen\s+to\s+yourself|be\s+present)\b/iu,
];

const ASTROLOGY_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:астролог\p{L}*|гороскоп\p{L}*|натальн\p{L}*|транзит\p{L}*|аспект\p{L}*|асцендент\p{L}*|ретроград\p{L}*|планет\p{L}*|зв[её]зд\p{L}*|зодиак\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|лун\p{L}*|солнц\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:вселенн\p{L}*|вибрац\p{L}*|карм\p{L}*|энерги\p{L}*\s+планет\p{L}*|космическ\p{L}*)(?!\p{L})/iu,
  /\b(?:astrolog\w*|horoscope\w*|natal|transit\w*|aspect\w*|ascendant|retrograde|planet\w*|stars?|zodiac|mercury|venus|mars|jupiter|saturn|moon|sun|universe|vibration\w*|karma|cosmic)\b/iu,
];

const ROLE_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:начальник\p{L}*|коллег\p{L}*|подчин[её]нн\p{L}*|руководител\p{L}*|родител\p{L}*|работ\p{L}*)(?!\p{L})/iu,
  /\b(?:boss|manager|colleague\w*|coworker\w*|subordinate\w*|parents?|work|job|office)\b/iu,
];

const INSULT_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:дурак\p{L}*|туп\p{L}*|лох\p{L}*|дебил\p{L}*|идиот\p{L}*|кретин\p{L}*)(?!\p{L})/iu,
  /\b(?:idiot|stupid|dumb|loser|moron)\b/iu,
];

const PSYCHOLOGISING_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:тебе\s+страшно|ты\s+грустн\p{L}*|ты\s+тревожн\p{L}*|ты\s+подавлен\p{L}*|ты\s+сломлен\p{L}*)(?!\p{L})/iu,
  /\b(?:you\s+are\s+(?:sad|anxious|depressed|broken)|you\s+are\s+afraid)\b/iu,
];

const GUARANTEED_EVENT_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:тебе|тебя)\s+(?:точно|обязательно|непременно)\s+(?:позвон\p{L}*|напиш\p{L}*|встрет\p{L}*|вернут\p{L}*|подар\p{L}*|предлож\p{L}*|жд[её]т\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])кто-то\s+(?:точно|обязательно)?\s*(?:позвонит|напишет|прид[её]т|верн[её]т|скажет\s+спасибо)(?!\p{L})/iu,
  /\b(?:someone\s+will\s+(?:definitely\s+)?(?:call|write|arrive|return|thank)|you\s+will\s+definitely)\b/iu,
];

const MARKDOWN_PATTERN = /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)|```/u;

function text(value: unknown, maxLength = 2_400): string {
  return typeof value === 'string'
    ? value.trim().replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ').slice(0, maxLength)
    : '';
}

function oneLine(value: unknown, maxLength = 180): string {
  return text(value, maxLength).replace(/\s+/gu, ' ').trim();
}

function words(value: string): string[] {
  return value.trim().split(/\s+/u).filter(Boolean);
}

function sentenceCount(value: string): number {
  return (value.match(/[^.!?]+(?:[.!?]+|$)/gu) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .length;
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter((token) => token.length > 2));
}

function lexicalContainment(left: string, right: string): number {
  const a = tokenSet(left);
  const b = tokenSet(right);
  const denominator = Math.min(a.size, b.size);
  if (!denominator) return 0;
  let matches = 0;
  for (const token of a) if (b.has(token)) matches += 1;
  return matches / denominator;
}

function firstTokens(value: string, count = 6): string {
  return normalize(value).split(' ').slice(0, count).join(' ');
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function recentFragments(
  readings: readonly AiPersonalHoroscopeRecentReading[] | undefined,
): AiPersonalHoroscopeRecentReading[] {
  return (readings || []).slice(0, 5).map((reading) => ({
    periodKey: String(reading.periodKey || '').slice(0, 32),
    fragments: reading.fragments.slice(0, 8).flatMap((fragment) => {
      const fragmentText = text(fragment.text, 700);
      if (!fragmentText) return [];
      return [{
        kind: fragment.kind,
        text: fragmentText,
        semanticFingerprint: fragment.semanticFingerprint
          ? String(fragment.semanticFingerprint).slice(0, 600)
          : null,
      }];
    }),
  })).filter((reading) => reading.periodKey && reading.fragments.length);
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: PersonalForecastPeriod,
): string {
  if (language === 'en') {
    return `You write a private AI horoscope for one user for a ${period} period. You do all horoscope reasoning yourself from the supplied birth profile and period. You receive no Swiss Ephemeris output, natal chart, transits, aspects, houses, or calculated astrology data.

VOICE
- Sound like a sharp friend with fast reactions: confident, direct, concise, occasionally dry or cheeky.
- Boldness is precision, not abuse. A related joke or ironic jab is welcome sometimes, never mandatory.
- Short sentences. Every sentence must describe the period or give a concrete action.
- No therapy language, coaching filler, mysticism, astrology vocabulary, corporate prose, or generic motivation.
- Never use the banned clichés listed in the private request context.
- Never invent biography or guaranteed calls, messages, meetings, debts, purchases, illness, or actions by other people.
- Avoid specific social roles. Use people, conversations, plans, tasks, money, and everyday matters.

STRUCTURE
- opening: greeting and entry into the period in 1-3 short sentences. The name is optional. A question is allowed only here and only when it sharpens the line.
- forecast: ${period === 'day' ? '5-7' : '7-9'} sentences, one coherent forecast, no headings or lists.
- advice: 2-3 concrete short actions.
- hidden memory keys describe the actual idea, situation, irony, and advice for anti-repeat checks.

Return JSON only, matching the schema exactly.`;
  }

  return `Ты пишешь личный AI-гороскоп одному пользователю на ${period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц'}.

Ты сам проводишь всё гороскопное рассуждение по переданным данным рождения и периоду. Ты не получаешь и не используешь Swiss Ephemeris, натальную карту, транзиты, аспекты, дома или готовые астрологические расчёты. Метод остаётся внутри: в видимом тексте никакой астрологии и никаких объяснений.

ГОЛОС
- Ты дерзкий приятель с хорошей реакцией. Быстро замечаешь суть, не церемонишься и не пытаешься всем понравиться.
- Пиши уверенно, резко и с лёгким нахальством. Дерзость — в точной формулировке, а не в оскорблениях.
- Иногда слегка поддень пользователя, пошути над лишней суетой, привычкой всё усложнять, откладывать или хвататься за лишнее. Шутка нужна только когда попадает в тему.
- Иногда обойдись без шутки: сухая прямая фраза тоже работает.
- Допустимы разговорные формулировки вроде «не ведись», «не устраивай из этого сериал», «сегодня без героизма», «не делай вид, что всё срочно», но не повторяй их механически.
- Короткие предложения. Минимум объяснений. Каждая фраза либо описывает период, либо даёт конкретное действие.
- Не сюсюкай. Не успокаивай общими словами. Не лезь в душу и не ставь психологические диагнозы.
- Не превращай прогноз в стендап. Одна точная ирония сильнее пяти шуток.

СТРУКТУРА
1. opening — приветствие и вход в период одним блоком. 1-3 коротких предложения. Имя можно использовать, но не обязательно каждый раз. Вопрос допустим только здесь и только если он действительно усиливает вход.
2. forecast — ${period === 'day' ? '5-7' : '7-9'} предложений. Один цельный прогноз без рубрик и списков. Говори про дела, задачи, людей, общение, планы, деньги, бытовые ситуации и темп периода. Не перечисляй всё подряд: выбери одну главную линию.
3. advice — 2-3 коротких конкретных действия. Без банальностей.
4. memory — скрытые служебные ключи фактически использованной мысли, ситуации, иронии и советов. Они не показываются пользователю.

ЖЁСТКИЕ ЗАПРЕТЫ
- Никакой астрологии, эзотерики, звёзд, планет, Вселенной, энергий, вибраций и судьбы в видимом тексте.
- Не используй слова и фразы: «выдохни», «отпусти», «прими», «позволь себе», «просто будь», «будь в потоке», «закрой дверь», «всё будет хорошо», «доверься процессу», «услышь себя», «прислушайся к себе», «будь в моменте».
- Не используй слова «начальник», «коллеги», «подчинённые», «руководитель», «родители», «работа». Говори: «люди», «общение», «дела», «задачи».
- Не оскорбляй и не унижай пользователя.
- Не придумывай его биографию, профессию, семью, диагнозы или гарантированные внешние события.
- Не обещай конкретные звонки, сообщения, встречи, долги, подарки, покупки или действия других людей.
- Не пиши Markdown, заголовки, CTA и технические объяснения.

Верни только JSON, строго по схеме.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  profile: UserProfile;
  recentForecasts?: AiPersonalHoroscopeRecentReading[];
  conversationMemory?: AiPersonalHoroscopeDialogueMemory[];
  rejectedDraft?: GeneratedHoroscopePayload | null;
  repairErrors?: string[];
}): string {
  const context = {
    language: input.language,
    selected_period: {
      kind: input.period,
      key: input.window.periodKey,
      start: input.window.periodStart,
      end: input.window.periodEnd,
      timezone: input.window.timezone,
    },
    personal_profile: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    continuity_context: {
      recent_forecasts: recentFragments(input.recentForecasts),
      recent_dialogue: (input.conversationMemory || []).slice(0, 6).map((item) => ({
        question: oneLine(item.question, 280),
        answer: oneLine(item.answer, 520),
        answered_at: item.answeredAt,
      })),
    },
    banned_phrases_ru: [
      'выдохни', 'отпусти', 'прими', 'позволь себе', 'просто будь',
      'будь в потоке', 'закрой дверь', 'всё будет хорошо',
      'доверься процессу', 'услышь себя', 'прислушайся к себе',
    ],
    previous_attempt: input.rejectedDraft || null,
    repair_errors: input.repairErrors || [],
  };
  return `Use this private context. Do not quote it, explain it, or invent missing facts. Recent text is continuity and negative anti-repeat context, not a source to copy.\n${JSON.stringify(context, null, 2)}`;
}

function validatePayload(
  raw: GeneratedHoroscopePayload,
  input: {
    language: 'ru' | 'en';
    period: PersonalForecastPeriod;
    recentForecasts?: AiPersonalHoroscopeRecentReading[];
  },
): { value: ValidatedHoroscope | null; errors: string[] } {
  const errors: string[] = [];
  const opening = text(raw.opening, 480);
  const forecast = text(raw.forecast, 2_400);
  const rawAdvice = Array.isArray(raw.advice) ? raw.advice : [];
  const advice = rawAdvice.map((item) => oneLine(item, 260)).filter(Boolean);
  const memory = raw.memory && typeof raw.memory === 'object' && !Array.isArray(raw.memory)
    ? raw.memory as Exclude<GeneratedHoroscopePayload['memory'], unknown[]>
    : null;
  const mainIdeaKey = oneLine(memory && 'main_idea_key' in memory ? memory.main_idea_key : '', 120);
  const situationKey = oneLine(memory && 'situation_key' in memory ? memory.situation_key : '', 120);
  const ironyKey = oneLine(memory && 'irony_key' in memory ? memory.irony_key : '', 120);
  const adviceKeys = memory && 'advice_keys' in memory && Array.isArray(memory.advice_keys)
    ? memory.advice_keys.map((item) => oneLine(item, 100)).filter(Boolean)
    : [];

  if (!opening) errors.push('opening is empty');
  if (!forecast) errors.push('forecast is empty');
  const openingSentences = sentenceCount(opening);
  if (openingSentences < 1 || openingSentences > 3) {
    errors.push(`opening requires 1-3 sentences; received ${openingSentences}`);
  }
  const expectedForecastSentences = input.period === 'day'
    ? { min: 5, max: 7 }
    : { min: 7, max: 9 };
  const forecastSentences = sentenceCount(forecast);
  if (
    forecastSentences < expectedForecastSentences.min
    || forecastSentences > expectedForecastSentences.max
  ) {
    errors.push(
      `forecast requires ${expectedForecastSentences.min}-${expectedForecastSentences.max} sentences; received ${forecastSentences}`,
    );
  }
  if (advice.length < 2 || advice.length > 3) {
    errors.push(`advice requires 2-3 items; received ${advice.length}`);
  }
  advice.forEach((item, index) => {
    const count = words(item).length;
    if (count < 2 || count > 16) errors.push(`advice ${index + 1} requires 2-16 words`);
    if (sentenceCount(item) > 1) errors.push(`advice ${index + 1} must be one sentence`);
  });
  if (new Set(advice.map(normalize)).size !== advice.length) {
    errors.push('advice items repeat');
  }
  if (!mainIdeaKey || !situationKey) errors.push('memory idea keys are empty');
  if (adviceKeys.length !== advice.length) errors.push('memory advice keys do not match advice');

  const visible = [opening, forecast, ...advice].join('\n');
  const clichéPatterns = input.language === 'ru'
    ? [...RU_FORBIDDEN_CLICHES, ...EN_FORBIDDEN_CLICHES]
    : [...EN_FORBIDDEN_CLICHES, ...RU_FORBIDDEN_CLICHES];
  if (matchesAny(visible, clichéPatterns)) errors.push('forbidden cliché');
  if (matchesAny(visible, ASTROLOGY_PATTERNS)) errors.push('visible astrology or esotericism');
  if (matchesAny(visible, ROLE_PATTERNS)) errors.push('forbidden specific role or work wording');
  if (matchesAny(visible, INSULT_PATTERNS)) errors.push('insulting wording');
  if (matchesAny(visible, PSYCHOLOGISING_PATTERNS)) errors.push('invented psychological state');
  if (matchesAny(visible, GUARANTEED_EVENT_PATTERNS)) errors.push('guaranteed external event');
  if (MARKDOWN_PATTERN.test(visible)) errors.push('markdown or visible list formatting');
  if (forecast.includes('?')) errors.push('reader question outside opening');

  const recent = recentFragments(input.recentForecasts).flatMap((reading) => reading.fragments);
  const recentOpenings = recent.filter((fragment) => fragment.kind === 'opening');
  const recentForecastText = recent.filter((fragment) => fragment.kind === 'forecast');
  const recentAdvice = recent.filter((fragment) => fragment.kind === 'advice');
  if (recentOpenings.some((fragment) => (
    firstTokens(fragment.text) === firstTokens(opening)
    || lexicalContainment(fragment.text, opening) >= 0.72
  ))) {
    errors.push('opening repeats recent forecast');
  }
  if (recentForecastText.some((fragment) => lexicalContainment(fragment.text, forecast) >= 0.62)) {
    errors.push('forecast repeats recent forecast');
  }
  if (advice.some((item) => recentAdvice.some((fragment) => (
    normalize(fragment.text) === normalize(item)
    || lexicalContainment(fragment.text, item) >= 0.68
  )))) {
    errors.push('advice repeats recent forecast');
  }

  return {
    value: errors.length ? null : {
      opening,
      forecast,
      advice,
      memory: {
        mainIdeaKey,
        situationKey,
        ironyKey,
        adviceKeys,
      },
    },
    errors,
  };
}

function makeSection(input: {
  id: string;
  kind: 'overview' | 'dynamic';
  text: string;
  blocks: Array<{ role: ForecastContentBlockRole; text: string; atomId: string }>;
  importance: number;
  language: 'ru' | 'en';
}): ForecastSection {
  const factId = AI_PERSONAL_HOROSCOPE_EVIDENCE_ID;
  const anchorId = `anchor:${input.id}`;
  const contentBlocks: ForecastContentBlock[] = input.blocks.map((block, index) => ({
    id: `${input.id}:${block.role}:${index + 1}`,
    role: block.role,
    text: block.text,
    semanticFactId: factId,
    atomId: block.atomId,
    explanationAnchorId: index === 0 ? anchorId : null,
  }));
  const sectionText = input.text || contentBlocks.map((block) => block.text.trim()).join('\n\n');
  const teaser = input.language === 'ru'
    ? 'Продолжение личного гороскопа доступно в Premium.'
    : 'The rest of your personal horoscope is available with Premium.';
  return {
    id: input.id,
    kind: input.kind,
    status: 'ready',
    diagnosticCode: null,
    sourceTopicKey: input.kind === 'overview' ? 'overview' : undefined,
    text: sectionText,
    contentBlocks,
    semanticFactIds: [factId],
    semanticFingerprint: `${AI_PERSONAL_HOROSCOPE_VERSION}:${input.id}:${stableHash(sectionText).toString(36)}`,
    importance: input.importance,
    visualTag: input.kind === 'overview' ? 'ai-opening' : input.id.replace(/^semantic:/u, 'ai-'),
    visualCue: null,
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(sectionText, teaser),
    explanationAnchors: [{
      id: anchorId,
      conclusion: contentBlocks[0]?.text || sectionText,
      explanation: 'AI-only personal horoscope generated from the saved profile, selected period, recent forecasts and conversation context.',
      evidenceIds: [factId],
    }],
    inlineAstroAccent: null,
  };
}

function buildPackage(input: {
  profile: UserProfile;
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  model: string;
  value: ValidatedHoroscope;
  attempts: 1 | 2;
}): AiPersonalHoroscopePackage {
  const openingSection = makeSection({
    id: 'overview',
    kind: 'overview',
    text: input.period === 'day' ? input.value.opening : '',
    blocks: input.period === 'day'
      ? [{ role: 'lead', text: input.value.opening, atomId: 'ai_opening' }]
      : [
          { role: 'lead', text: input.value.opening, atomId: 'ai_opening' },
          { role: 'detail', text: input.value.forecast, atomId: 'ai_forecast' },
          ...input.value.advice.map((advice, index) => ({
            role: 'action' as const,
            text: advice,
            atomId: `ai_advice_${index + 1}`,
          })),
        ],
    importance: 100,
    language: input.language,
  });

  const sections = input.period === 'day'
    ? [
        makeSection({
          id: 'semantic:forecast',
          kind: 'dynamic',
          text: input.value.forecast,
          blocks: [{ role: 'detail', text: input.value.forecast, atomId: 'ai_forecast' }],
          importance: 100,
          language: input.language,
        }),
        ...input.value.advice.map((advice, index) => makeSection({
          id: `semantic:advice-${index + 1}`,
          kind: 'dynamic',
          text: advice,
          blocks: [{ role: 'action', text: advice, atomId: `ai_advice_${index + 1}` }],
          importance: 72 - index,
          language: input.language,
        })),
      ]
    : [];

  const freeSelection = input.period === 'day'
    ? selectTodayFreeSections({
        sections,
        userId: String(input.profile.id || 'guest'),
        periodKey: input.window.periodKey,
      })
    : {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      };

  const meta = {
    model: input.model,
    promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    voiceVersion: APP_VOICE_VERSION,
    calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
    semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
    contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
    generationAttempts: input.attempts,
    validationStatus: 'valid' as const,
    generatedAt: new Date().toISOString(),
    status: 'ready' as const,
    diagnosticCode: null,
    freeSelection,
    contentMode: AI_PERSONAL_HOROSCOPE_CONTENT_MODE,
  };

  const forecast: AiPersonalHoroscopePackage = {
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(input.window, input.language),
    timezone: input.window.timezone,
    overview: openingSection,
    sections,
    suggestedCrossPeriodLinks: [],
    evidence: {
      [AI_PERSONAL_HOROSCOPE_EVIDENCE_ID]: {
        id: AI_PERSONAL_HOROSCOPE_EVIDENCE_ID,
        factor: 'AI horoscope profile and continuity context',
        orb: null,
        status: 'active',
        period: input.window.periodKey,
        meaning: 'Luna generated this horoscope from the user profile, selected period, recent forecasts and saved conversation context without Swiss Ephemeris or natal chart input.',
      },
    },
    visual: { sectionAssetIds: {} },
    meta,
  };

  if (!isPersonalForecastPackage(forecast)) {
    throw new Error('PERSONAL_FORECAST_PACKAGE_INVALID');
  }
  return forecast;
}

export async function generateAiPersonalHoroscopePackage(input: {
  profile: UserProfile;
  model?: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  recentForecasts?: AiPersonalHoroscopeRecentReading[];
  conversationMemory?: AiPersonalHoroscopeDialogueMemory[];
  onMetrics?: (metrics: AiPersonalHoroscopeGenerationMetrics) => void;
}): Promise<AiPersonalHoroscopePackage> {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  let rejectedDraft: GeneratedHoroscopePayload | null = null;
  let repairErrors: string[] = [];
  let incompleteSeen = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await createLunaStructuredResponse({
        instructions: getAiPersonalHoroscopeSystemPrompt(language, input.period),
        input: buildAiPersonalHoroscopePrompt({
          language,
          period: input.period,
          window: input.window,
          profile: input.profile,
          recentForecasts: input.recentForecasts,
          conversationMemory: input.conversationMemory,
          rejectedDraft,
          repairErrors,
        }),
        maxOutputTokens: input.period === 'day' ? 1_100 : 1_500,
        schemaName: RESPONSE_SCHEMA_NAME,
        schema: RESPONSE_SCHEMA,
      });
      let parsed: GeneratedHoroscopePayload;
      try {
        parsed = JSON.parse(response.content) as GeneratedHoroscopePayload;
      } catch {
        repairErrors = ['response is not valid JSON'];
        input.onMetrics?.({
          model: OPENAI_LUNA_MODEL,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          latencyMs: Date.now() - startedAt,
          validationPassed: false,
        });
        continue;
      }
      const validated = validatePayload(parsed, {
        language,
        period: input.period,
        recentForecasts: input.recentForecasts,
      });
      input.onMetrics?.({
        model: OPENAI_LUNA_MODEL,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - startedAt,
        validationPassed: !!validated.value,
      });
      if (!validated.value) {
        rejectedDraft = parsed;
        repairErrors = validated.errors;
        continue;
      }
      return buildPackage({
        profile: input.profile,
        language,
        period: input.period,
        window: input.window,
        model: input.model || OPENAI_LUNA_MODEL,
        value: validated.value,
        attempts: attempt as 1 | 2,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('OPENAI_RESPONSE_INCOMPLETE')) incompleteSeen = true;
      repairErrors = [message.slice(0, 240)];
      if (attempt === MAX_ATTEMPTS) break;
    }
  }

  if (incompleteSeen) throw new Error('PERSONAL_FORECAST_WRITER_INCOMPLETE');
  throw new Error(`PERSONAL_FORECAST_WRITER_VALIDATION_FAILED:${repairErrors.join('|')}`);
}

export function getAiPersonalHoroscopeGenerationDiagnosticCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('PERSONAL_FORECAST_WRITER_INCOMPLETE')) {
    return 'PERSONAL_FORECAST_WRITER_INCOMPLETE';
  }
  if (message.includes('PERSONAL_FORECAST_WRITER_VALIDATION_FAILED')) {
    return 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED';
  }
  if (
    message.includes('OPENAI_API_KEY')
    || message.includes('OPENAI_RESPONSE')
    || message.includes('fetch failed')
    || message.includes('ECONN')
  ) {
    return 'PERSONAL_FORECAST_PROVIDER_UNAVAILABLE';
  }
  return 'PERSONAL_FORECAST_GENERATION_FAILED';
}
