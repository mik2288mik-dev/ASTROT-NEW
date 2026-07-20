import { createHash } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { llmJson } from '../../../../lib/anthropic';
import { getDailyCanvasModelResolved } from '../../../../lib/appSettings';
import { getAppSystemVoice } from '../../../../lib/appVoice';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import type {
  PersonalizedDailyQuestion,
  PersonalizedDailyQuestionsPayload,
} from '../../../../lib/dailyQuestionTypes';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import { buildHumanInputHash } from '../../../../lib/natalHumanInterpretation';
import {
  DAILY_CANVAS_TOPIC_KEYS,
  type DailyCanvas,
  type DailyCanvasTopicKey,
} from '../../../../lib/natalHumanShared';

export const config = { maxDuration: 60 };

const PROMPT_VERSION = 'your-horoscope-v2.personal-daily-questions';
const QUESTION_COUNT = 3;
const FORBIDDEN_COPY = /не\s+спеш|не\s+тороп|замедл|возьми\s+пауз|дай\s+себе\s+время|всё\s+станет\s+понятно|все\s+станет\s+понятно|один\s+разговор\s+покажет|энерги[яи]\s+дня|ритм\s+дня|сфер[аы]\s+дня|доверься\s+себе|прислушайся\s+к\s+себе|сыграет\s+тебе\s+на\s+руку|где\s+у\s+тебя\s+больше\s+шансов|что\s+стоит\s+заметить|какой\s+момент\s+дня/i;
const REAL_SCENE = /сообщ|переписк|ответ|звон|встреч|покуп|цен|деньг|сч[её]т|задач|работ|срок|дедлайн|обещ|просьб|отказ|дом|родн|друг|устал|план|приглаш|разговор|человек|партн[её]р|началь|коллег/i;

function readDateKey(req: NextApiRequest): string {
  const raw = String(req.body?.date || req.query.date || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoscowTodayKey();
}

function getMoscowDayWindow(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return {
    validFrom: new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0)),
    validTo: new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0)),
  };
}

function cleanLine(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeDailyPackage(value: unknown): DailyCanvas | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<DailyCanvas>;
  if (!cleanLine(raw.hero_title) || !cleanText(raw.overview)) return null;

  const topic = (key: DailyCanvasTopicKey) => ({
    hook: cleanLine(raw[key]?.hook),
    body: cleanText(raw[key]?.body),
  });

  const sanitized = {
    hero_title: cleanLine(raw.hero_title),
    hero_hook: cleanText(raw.hero_hook),
    overview: cleanText(raw.overview),
    love: topic('love'),
    money: topic('money'),
    work: topic('work'),
    goals: topic('goals'),
    family: topic('family'),
    friendship: topic('friendship'),
    energy: topic('energy'),
    communication: topic('communication'),
    meta: {
      free_section_key: raw.meta?.free_section_key || 'communication',
      locale: raw.meta?.locale,
      voice_version: raw.meta?.voice_version,
      date_key: raw.meta?.date_key,
    },
  } as DailyCanvas;

  const usableTopics = DAILY_CANVAS_TOPIC_KEYS.filter((key) => (
    sanitized[key].hook.length >= 8 && sanitized[key].body.length >= 40
  ));
  return usableTopics.length >= 5 ? sanitized : null;
}

function normalizeQuestions(value: unknown): PersonalizedDailyQuestionsPayload | null {
  const rawQuestions = Array.isArray((value as any)?.questions)
    ? (value as any).questions
    : Array.isArray(value)
      ? value
      : [];

  const normalized = rawQuestions.slice(0, QUESTION_COUNT).map((raw: any, index: number) => {
    const topic = DAILY_CANVAS_TOPIC_KEYS.includes(raw?.topic as DailyCanvasTopicKey)
      ? raw.topic as DailyCanvasTopicKey
      : null;
    return {
      id: `daily-question-${index + 1}`,
      topic,
      question: cleanLine(raw?.question),
      teaser: cleanLine(raw?.teaser),
      answer: cleanText(raw?.answer),
    };
  });

  if (normalized.length !== QUESTION_COUNT) return null;
  const topics = new Set<string>();

  for (const item of normalized) {
    if (!item.topic || topics.has(item.topic)) return null;
    topics.add(item.topic);
    if (item.question.length < 10 || item.question.length > 82 || !item.question.endsWith('?')) return null;
    if (item.teaser.length < 14 || item.teaser.length > 135) return null;
    if (item.answer.length < 100 || item.answer.length > 760) return null;
    const all = `${item.question}\n${item.teaser}\n${item.answer}`;
    if (FORBIDDEN_COPY.test(all) || !REAL_SCENE.test(all)) return null;
  }

  return { questions: normalized as PersonalizedDailyQuestion[] };
}

function buildPrompt(canvas: DailyCanvas, locale: 'ru' | 'en', repair = false): string {
  const packageForPrompt = {
    hero_title: canvas.hero_title,
    hero_hook: canvas.hero_hook,
    overview: canvas.overview,
    ...Object.fromEntries(DAILY_CANVAS_TOPIC_KEYS.map((key) => [key, canvas[key]])),
  };

  if (locale === 'en') {
    return `Create exactly three personal, present-day questions from this already generated daily package.

DAILY PACKAGE:
${JSON.stringify(packageForPrompt, null, 2)}

The three questions must cover three different life areas. Do not summarize section titles. Find the concrete tension inside the text: a reply, meeting, purchase, task, deadline, request, promise, refusal, tiredness, or home situation.

Each item:
- topic: one of ${DAILY_CANVAS_TOPIC_KEYS.join(', ')}; topics must not repeat;
- question: 4-10 words, ending with ?, phrased like a real thought in someone's head;
- teaser: 5-16 words, a direct sharp answer or angle, not clickbait;
- answer: 45-85 words, two short paragraphs. Start with the point, then explain what to notice or do.

Do not invent that a specific person, message, offer, purchase, or conflict definitely exists. Use conditional wording where needed. No astrology words, coaching clichés, mystical fluff, fatalism, or generic advice. Never use versions of “slow down”, “take your time”, “trust yourself”, “everything will become clear”, or “one conversation will reveal everything”.

${repair ? 'The previous result failed validation. Make every item concrete, distinct, concise, and fully compliant.' : ''}

Return only JSON:
{"questions":[{"topic":"communication","question":"... ?","teaser":"...","answer":"...\n\n..."}]}`;
  }

  return `Создай ровно три персональных вопроса из уже готового разбора дня.

ГОТОВЫЙ ПАКЕТ ДНЯ:
${JSON.stringify(packageForPrompt, null, 2)}

Это не заголовки гороскопа и не «темы дня». Найди внутри текста три разные реальные ситуации: переписку, встречу, покупку, задачу, дедлайн, просьбу, обещание, отказ, усталость, деньги или домашний вопрос.

Каждый элемент:
- topic: одно из ${DAILY_CANVAS_TOPIC_KEYS.join(', ')}; темы не повторяются;
- question: 4–10 слов, обязательно со знаком ?, звучит как настоящая мысль человека;
- teaser: 5–16 слов, сразу даёт сильный и полезный угол, без пустой интриги;
- answer: 45–85 слов, два коротких абзаца. Первая фраза — суть. Дальше нормальное объяснение: что заметить и как поступить без лекции.

Тон: дерзкий, молодой, живой, добрый и умный друг. Без литературщины и служебных слов.

Запрещено:
- «что сегодня может сыграть на руку», «где больше шансов», «какой разговор важен», «что стоит заметить»;
- «не спеши», «не торопись», «замедлись», «возьми паузу», «дай себе время» и любые версии торможения;
- «всё станет понятно», «один разговор покажет», «энергия дня», «ритм дня», «доверься себе»;
- выдумывать, что конкретный человек, сообщение, предложение, покупка или конфликт точно существует. Если исходные данные только намекают на ситуацию — формулируй условно.
- астрологические термины, фатализм, угрозы и обещания точного будущего.

Не повторяй тексты карточек дословно. Вопрос, тизер и ответ должны быть написаны вместе и отвечать друг другу.

${repair ? 'Прошлый вариант не прошёл проверку. Сделай каждый вопрос конкретным, живым, разным по теме и без единой запрещённой формулы.' : ''}

Верни только JSON:
{"questions":[{"topic":"communication","question":"... ?","teaser":"...","answer":"...\n\n..."}]}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const ready = await ensureValidContext(req, res, { allowGuest: false });
  if (!ready) return;
  const { userId, ctx } = ready;
  const dateKey = readDateKey(req);
  const locale = ctx.profile.language === 'en' ? 'en' : 'ru';
  const canvas = sanitizeDailyPackage(req.body?.dailyPackage);

  if (!canvas) {
    return res.status(400).json({ error: 'BAD_DAILY_PACKAGE' });
  }

  const packageHash = createHash('sha256')
    .update(JSON.stringify(canvas))
    .digest('hex');
  const baseInputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey: 'daily_questions',
    dateKey,
    promptVersion: PROMPT_VERSION,
    locale,
  });
  const inputHash = createHash('sha256')
    .update(`${baseInputHash}:${packageHash}`)
    .digest('hex');
  const window = getMoscowDayWindow(dateKey);
  const cacheKey = `personal_daily.questions.user.${userId}.date.${dateKey}.locale.${locale}.v2`;
  const cacheOpts = {
    accessTier: 'premium' as const,
    contentVariant: 'living' as const,
    cacheKey,
    inputHash,
    promptVersion: PROMPT_VERSION,
    isPersistent: false,
    validFrom: window.validFrom,
    validTo: window.validTo,
  };

  const entitlement = await getPremiumEntitlementState(userId);
  const shapeForAccess = (payload: PersonalizedDailyQuestionsPayload) => ({
    questions: payload.questions.map((item) => ({
      ...item,
      answer: entitlement.isPremium ? item.answer : '',
    })),
  });

  const cached = await getCachedReading<PersonalizedDailyQuestionsPayload>(ctx, cacheOpts);
  if (cached?.content) {
    return res.status(200).json(shapeForAccess(cached.content));
  }

  try {
    const lockResult = await withContentGenerationLock({
      lockKey: buildContentGenerationLockKey({
        userId,
        chartId: ctx.chartId,
        accessTier: 'premium',
        contentSurface: 'natal',
        contentVariant: 'living',
        cacheKey,
        promptVersion: PROMPT_VERSION,
      }),
      operation: 'personal-daily-questions',
      readCached: async () => {
        const again = await getCachedReading<PersonalizedDailyQuestionsPayload>(ctx, cacheOpts);
        return again ? { value: again, source: 'human_v2' as const } : null;
      },
      generate: async () => {
        let payload: PersonalizedDailyQuestionsPayload | null = null;
        for (let attempt = 0; attempt < 2 && !payload; attempt += 1) {
          const raw = await llmJson<PersonalizedDailyQuestionsPayload>({
            system: getAppSystemVoice(locale),
            user: buildPrompt(canvas, locale, attempt > 0),
            model: { accessTier: 'premium', contentSurface: 'natal', contentVariant: 'living' },
            modelOverride: await getDailyCanvasModelResolved(),
            maxTokens: 1050,
            temperature: 0.66,
          });
          payload = normalizeQuestions(raw);
        }
        if (!payload) throw new Error('INVALID_PERSONAL_DAILY_QUESTIONS');
        return saveReading(ctx, cacheOpts, payload);
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    const record = lockResult.value as { content?: PersonalizedDailyQuestionsPayload };
    if (!record?.content) throw new Error('EMPTY_PERSONAL_DAILY_QUESTIONS');
    return res.status(200).json(shapeForAccess(record.content));
  } catch (error) {
    console.error('[natal/daily-questions] generation failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({
      error: 'DAILY_QUESTIONS_UNAVAILABLE',
      message: locale === 'ru' ? 'Вопросы пока не готовы.' : 'Questions are not ready yet.',
    });
  }
}
