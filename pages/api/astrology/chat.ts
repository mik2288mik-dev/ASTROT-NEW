import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getOpenAIInterpretationModel } from '../../../lib/appSettings';
import { SYSTEM_INSTRUCTION_ASTRA } from '../../../constants';
import { db } from '../../../lib/db';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../lib/rateLimit';
import { buildPersonalizationContext, describePersonalizationContext } from '../../../lib/personalizationContext';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 10;
const DEFAULT_HISTORY_LIMIT = 12;
const MAX_HISTORY_LIMIT = 20;
const DUPLICATE_WINDOW_SECONDS = 20;

const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/chat] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/chat] ERROR: ${message}`, error || '');
  },
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type HistoryMessage = {
  role: 'user' | 'model';
  text: string;
};

function normalizeQuestion(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function mapErrorMessage(code: string, lang: 'ru' | 'en') {
  const messages = {
    PREMIUM_REQUIRED: {
      ru: 'Оракул доступен только в Lumia Premium.',
      en: 'Oracle is available only in Lumia Premium.',
    },
    QUESTION_REQUIRED: {
      ru: 'Введите вопрос для Lumia.',
      en: 'Enter a question for Lumia.',
    },
    QUESTION_TOO_SHORT: {
      ru: 'Вопрос слишком короткий. Сформулируйте его чуть подробнее.',
      en: 'Your question is too short. Add a little more detail.',
    },
    QUESTION_TOO_LONG: {
      ru: 'Вопрос слишком длинный. Сократите его и попробуйте снова.',
      en: 'Your question is too long. Shorten it and try again.',
    },
    USER_NOT_FOUND: {
      ru: 'Профиль не найден. Откройте Lumia заново.',
      en: 'Profile not found. Reopen Lumia and try again.',
    },
    OPENAI_NOT_CONFIGURED: {
      ru: 'Oracle временно недоступен. Попробуйте позже.',
      en: 'Oracle is temporarily unavailable. Please try again later.',
    },
    ORACLE_UPSTREAM_ERROR: {
      ru: 'Lumia не смогла подготовить ответ. Попробуйте ещё раз.',
      en: 'Lumia could not prepare an answer. Please try again.',
    },
  } as const;

  return messages[code as keyof typeof messages]?.[lang] || messages.ORACLE_UPSTREAM_ERROR[lang];
}

function buildChartContext(user: any, primaryChart: any) {
  const chartData = primaryChart?.chart_data;
  const lines = [
    `Name: ${user?.name || 'Unknown'}`,
    user?.birth_date ? `Birth date: ${user.birth_date}` : '',
    user?.birth_time ? `Birth time: ${user.birth_time}` : '',
    user?.birth_place ? `Birth place: ${user.birth_place}` : '',
    chartData?.sun?.sign ? `Sun: ${chartData.sun.sign}` : '',
    chartData?.moon?.sign ? `Moon: ${chartData.moon.sign}` : '',
    chartData?.rising?.sign ? `Ascendant: ${chartData.rising.sign}` : '',
    chartData?.element ? `Element: ${chartData.element}` : '',
    chartData?.rulingPlanet ? `Ruling planet: ${chartData.rulingPlanet}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function sanitizeHistory(history: any): HistoryMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter((message) => message && (message.role === 'user' || message.role === 'model') && typeof message.text === 'string')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, 1200),
    }))
    .filter((message) => message.text.length > 0);
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const method = req.method;

    if (method !== 'GET' && method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = method === 'GET' ? String(req.query.userId || '') : String(req.body?.userId || '');

    if (!userId.trim()) {
      return res.status(400).json({
        error: 'Bad request',
        code: 'USER_NOT_FOUND',
        message: 'userId is required',
      });
    }

    const user = await db.users.get(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        message: 'Profile not found',
      });
    }

    const lang: 'ru' | 'en' = user.language === 'en' ? 'en' : 'ru';

    if (!user.is_premium) {
      return res.status(403).json({
        error: 'Premium required',
        code: 'PREMIUM_REQUIRED',
        message: mapErrorMessage('PREMIUM_REQUIRED', lang),
      });
    }

    if (method === 'GET') {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || DEFAULT_HISTORY_LIMIT), 10) || DEFAULT_HISTORY_LIMIT, 1), MAX_HISTORY_LIMIT);
      const items = await db.astro_questions.getByUser(userId, limit);
      return res.status(200).json({
        items: items.map((item: any) => ({
          question: item.question,
          answer: item.answer,
          createdAt: new Date(item.created_at).toISOString(),
        })),
      });
    }

    const normalizedQuestion = normalizeQuestion(String(req.body?.message || ''));
    if (!normalizedQuestion) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'QUESTION_REQUIRED',
        message: mapErrorMessage('QUESTION_REQUIRED', lang),
      });
    }

    if (normalizedQuestion.length < MIN_QUESTION_LENGTH) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'QUESTION_TOO_SHORT',
        message: mapErrorMessage('QUESTION_TOO_SHORT', lang),
      });
    }

    if (normalizedQuestion.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'QUESTION_TOO_LONG',
        message: mapErrorMessage('QUESTION_TOO_LONG', lang),
      });
    }

    log.info('Oracle question received', {
      userId,
      questionLength: normalizedQuestion.length,
    });

    const duplicate = await db.astro_questions.findRecentDuplicate(userId, normalizedQuestion, DUPLICATE_WINDOW_SECONDS);
    if (duplicate) {
      log.info('Returning recent duplicate Oracle answer', { userId });
      return res.status(200).json({
        answer: duplicate.answer,
        createdAt: new Date(duplicate.created_at).toISOString(),
        reusedRecent: true,
      });
    }

    if (!openai) {
      return res.status(503).json({
        error: 'Oracle unavailable',
        code: 'OPENAI_NOT_CONFIGURED',
        message: mapErrorMessage('OPENAI_NOT_CONFIGURED', lang),
      });
    }

    const history = sanitizeHistory(req.body?.history);
    const personalizationContext = await buildPersonalizationContext({
      userId,
      surface: 'ask_lumia',
      includeTodayPulse: true,
      includeRecentCheckIns: true,
      includeRecentQuestions: true,
      includeRelationshipContext: true,
    });
    const chartContext = personalizationContext
      ? describePersonalizationContext(personalizationContext, lang)
      : buildChartContext(user, await db.natal_charts.getPrimary(userId));

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${SYSTEM_INSTRUCTION_ASTRA}

Use the user's natal chart context when it is relevant to the question, but stay direct and practical.

User context:
${chartContext || 'Chart context is temporarily unavailable. Answer carefully and be honest about uncertainty.'}`,
      },
      ...history.map((message) => ({
        role: (message.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: message.text,
      })),
      {
        role: 'user',
        content: normalizedQuestion,
      },
    ];

    try {
      const modelId = await getOpenAIInterpretationModel();
      const completion = await openai.chat.completions.create({
        model: modelId,
        messages,
        temperature: 0.7,
        max_tokens: 900,
      });

      const answer = completion.choices[0]?.message?.content?.trim();
      if (!answer) {
        throw new Error('Empty Oracle response');
      }

      await db.astro_questions.add(userId, normalizedQuestion, answer);

      return res.status(200).json({
        answer,
        createdAt: new Date().toISOString(),
        reusedRecent: false,
      });
    } catch (error: any) {
      log.error('Oracle completion failed', {
        userId,
        error: error.message,
        code: error.code,
        type: error.type,
      });

      return res.status(502).json({
        error: 'Oracle upstream error',
        code: 'ORACLE_UPSTREAM_ERROR',
        message: mapErrorMessage('ORACLE_UPSTREAM_ERROR', lang),
      });
    }
  } catch (error: any) {
    log.error('Oracle handler failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'ORACLE_INTERNAL_ERROR',
      message: 'Failed to process Oracle request',
    });
  }
}

export default withRateLimit(handler, (req) => (
  req.method === 'GET' ? RATE_LIMIT_CONFIGS.PREMIUM : RATE_LIMIT_CONFIGS.AI_PREMIUM
));
