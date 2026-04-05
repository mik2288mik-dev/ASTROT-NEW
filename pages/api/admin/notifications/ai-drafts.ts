import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import type { AdminNotificationTargetSegment } from '../../../../types';

type DraftScenario =
  | 'morning'
  | 'day'
  | 'evening'
  | 'daily_lumi'
  | 'upsell'
  | 'promo'
  | 'reactivation'
  | 'custom';

type DraftVariant = {
  label: string;
  title: string;
  bodyRu: string;
  bodyEn: string;
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SCENARIOS = new Set<DraftScenario>([
  'morning',
  'day',
  'evening',
  'daily_lumi',
  'upsell',
  'promo',
  'reactivation',
  'custom',
]);

function isValidScenario(value: unknown): value is DraftScenario {
  return typeof value === 'string' && SCENARIOS.has(value as DraftScenario);
}

function isValidSegment(value: unknown): value is AdminNotificationTargetSegment {
  return value === 'all'
    || value === 'premium'
    || value === 'free'
    || value === 'lumi'
    || value === 'active_7d'
    || value === 'inactive_3d'
    || value === 'inactive_7d'
    || value === 'inactive_30d'
    || value === 'need_attention';
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function scenarioDescription(scenario: DraftScenario) {
  switch (scenario) {
    case 'morning':
      return 'Morning reminder to open Lumia, check the horoscope, and see the daily natal layer.';
    case 'day':
      return 'Midday reminder to reopen Lumia and get a sharper read on the current day.';
    case 'evening':
      return 'Evening reminder to reflect on the day and look at the closing insight.';
    case 'daily_lumi':
      return 'Reminder to collect daily Lumi in the app.';
    case 'upsell':
      return 'Upsell for the full and more precise day layer. Mention both Premium and one-off Lumi unlock softly.';
    case 'promo':
      return 'Promo offer for premium content such as compatibility, deep dives, or other paid layers.';
    case 'reactivation':
      return 'Reactivation message for users who have gone quiet and should return to the app.';
    case 'custom':
    default:
      return 'Custom scenario based on the admin brief.';
  }
}

function appendBrief(base: string, brief: string, language: 'ru' | 'en') {
  const normalizedBrief = normalizeText(brief, 80);
  if (!normalizedBrief) return base;
  return language === 'ru'
    ? `${base} Акцент: ${normalizedBrief}.`
    : `${base} Focus: ${normalizedBrief}.`;
}

function buildFallbackDrafts(scenario: DraftScenario, brief: string): DraftVariant[] {
  switch (scenario) {
    case 'morning':
      return [
        {
          label: 'Sharp start',
          title: 'Открой свой день',
          bodyRu: appendBrief('Зайди в Lumia и посмотри, где сегодня твой главный фокус. Утренний прогноз уже ждёт.', brief, 'ru'),
          bodyEn: appendBrief('Open Lumia and see where your main focus is today. Your morning reading is already waiting.', brief, 'en'),
        },
        {
          label: 'Morning focus',
          title: 'Поймай ритм утра',
          bodyRu: appendBrief('Утро уже задало ритм дня. Проверь гороскоп и дневную карту, чтобы войти в него точнее.', brief, 'ru'),
          bodyEn: appendBrief('The morning has already set the rhythm of the day. Check your horoscope and daily chart to step into it with more precision.', brief, 'en'),
        },
        {
          label: 'Fast check-in',
          title: 'Твой утренний ориентир',
          bodyRu: appendBrief('Одной минуты в Lumia хватит, чтобы понять, на что сегодня лучше опереться с самого утра.', brief, 'ru'),
          bodyEn: appendBrief('A minute in Lumia is enough to see what is worth leaning on from the very start of the day.', brief, 'en'),
        },
      ];
    case 'day':
      return [
        {
          label: 'Midday reset',
          title: 'Сверься с днём',
          bodyRu: appendBrief('Середина дня многое проясняет. Загляни в Lumia и проверь, где сейчас твоя лучшая точка опоры.', brief, 'ru'),
          bodyEn: appendBrief('Midday often makes things clearer. Open Lumia and check where your best point of support is right now.', brief, 'en'),
        },
        {
          label: 'Refocus',
          title: 'Верни себе фокус',
          bodyRu: appendBrief('День уже в движении. Посмотри, какие моменты сегодня важно не пропустить и где лучше не распыляться.', brief, 'ru'),
          bodyEn: appendBrief('The day is already moving. See which moments matter most and where it is better not to scatter your energy.', brief, 'en'),
        },
        {
          label: 'Practical cue',
          title: 'Что важно сейчас',
          bodyRu: appendBrief('Открой Lumia и быстро проверь, что сегодня работает в твою пользу прямо сейчас.', brief, 'ru'),
          bodyEn: appendBrief('Open Lumia and quickly check what is working in your favor right now.', brief, 'en'),
        },
      ];
    case 'evening':
      return [
        {
          label: 'Soft close',
          title: 'Закрой день точнее',
          bodyRu: appendBrief('Вечер даёт шанс увидеть день без лишнего шума. Загляни в Lumia за спокойной финальной подсказкой.', brief, 'ru'),
          bodyEn: appendBrief('Evening gives you a chance to see the day without extra noise. Open Lumia for a calm closing insight.', brief, 'en'),
        },
        {
          label: 'Evening insight',
          title: 'Твой вечерний итог',
          bodyRu: appendBrief('Посмотри, что сегодня действительно стоит унести с собой в вечер, а что лучше отпустить.', brief, 'ru'),
          bodyEn: appendBrief('See what is truly worth carrying into the evening and what is better to let go of.', brief, 'en'),
        },
        {
          label: 'Night rhythm',
          title: 'Вечерний ритм',
          bodyRu: appendBrief('Открой Lumia и проверь, как мягко завершить этот день и на чём держать внутренний баланс.', brief, 'ru'),
          bodyEn: appendBrief('Open Lumia and see how to close this day gently while keeping your inner balance.', brief, 'en'),
        },
      ];
    case 'daily_lumi':
      return [
        {
          label: 'Collect',
          title: 'Забери Lumi',
          bodyRu: appendBrief('Твои ежедневные Lumi уже ждут. Зайди в приложение и забери их, пока день идёт в твою пользу.', brief, 'ru'),
          bodyEn: appendBrief('Your daily Lumi are already waiting. Open the app and collect them while the day is still on your side.', brief, 'en'),
        },
        {
          label: 'Reward loop',
          title: 'Твой бонус внутри',
          bodyRu: appendBrief('Не пропускай свой ежедневный Lumi-сбор. Открой Lumia и возьми то, что уже доступно сегодня.', brief, 'ru'),
          bodyEn: appendBrief('Do not miss your daily Lumi reward. Open Lumia and claim what is already available today.', brief, 'en'),
        },
        {
          label: 'Quick reward',
          title: 'Собери награду',
          bodyRu: appendBrief('Одна быстрая проверка в Lumia и твои ежедневные Lumi у тебя. Зайди и забери.', brief, 'ru'),
          bodyEn: appendBrief('One quick check in Lumia and your daily Lumi are yours. Open the app and collect them.', brief, 'en'),
        },
      ];
    case 'upsell':
      return [
        {
          label: 'Full day',
          title: 'Открой полный день',
          bodyRu: appendBrief('Сегодняшний день можно прочитать глубже. В Lumia открыт путь через Premium или разовый unlock за Lumi.', brief, 'ru'),
          bodyEn: appendBrief('Today can be read more deeply. Lumia opens that full layer through Premium or a one-off Lumi unlock.', brief, 'en'),
        },
        {
          label: 'More precise',
          title: 'Больше, чем free',
          bodyRu: appendBrief('Бесплатный слой уже открыт, но полный день даёт более точный разбор моментов и триггеров. Открой его удобным способом.', brief, 'ru'),
          bodyEn: appendBrief('The free layer is already open, but the full day gives a more precise read on today’s moments and triggers. Open it in the way that fits you.', brief, 'en'),
        },
        {
          label: 'Upgrade path',
          title: 'Полная точность дня',
          bodyRu: appendBrief('Если нужен не общий фон, а полный и точный слой дня, зайди в Lumia и выбери Premium или unlock за Lumi.', brief, 'ru'),
          bodyEn: appendBrief('If you need more than the general mood and want the full, precise day layer, open Lumia and choose Premium or a Lumi unlock.', brief, 'en'),
        },
      ];
    case 'promo':
      return [
        {
          label: 'Offer',
          title: 'Разборы ждут',
          bodyRu: appendBrief('В Lumia уже доступны более глубокие разборы, совместимость и точные личные слои. Зайди и выбери, что открыть следующим.', brief, 'ru'),
          bodyEn: appendBrief('Deeper readings, compatibility, and precise personal layers are already waiting in Lumia. Open the app and choose what to unlock next.', brief, 'en'),
        },
        {
          label: 'Paid depth',
          title: 'Открой глубже',
          bodyRu: appendBrief('Если хочется не поверхностного ответа, а полноценного разбора, в Lumia уже есть следующий уровень.', brief, 'ru'),
          bodyEn: appendBrief('If you want more than a surface answer, Lumia already has the next layer ready for you.', brief, 'en'),
        },
        {
          label: 'Compatibility hook',
          title: 'Новый разбор внутри',
          bodyRu: appendBrief('Совместимость, вопросы и полные интерпретации уже внутри Lumia. Проверь, какой разбор тебе сейчас нужнее всего.', brief, 'ru'),
          bodyEn: appendBrief('Compatibility, questions, and full interpretations are already inside Lumia. See which reading you need most right now.', brief, 'en'),
        },
      ];
    case 'reactivation':
      return [
        {
          label: 'Come back',
          title: 'Lumia ждёт тебя',
          bodyRu: appendBrief('Сейчас хороший момент вернуться в Lumia и быстро свериться с тем, что для тебя важно именно сегодня.', brief, 'ru'),
          bodyEn: appendBrief('This is a good moment to come back to Lumia and quickly check what matters most for you today.', brief, 'en'),
        },
        {
          label: 'Fresh reason',
          title: 'Вернись на минуту',
          bodyRu: appendBrief('Зайди в Lumia ненадолго: внутри уже есть свежий ежедневный слой, который поможет быстрее собраться.', brief, 'ru'),
          bodyEn: appendBrief('Come back to Lumia for a minute: a fresh daily layer is already inside and can help you pull things together faster.', brief, 'en'),
        },
        {
          label: 'Reopen',
          title: 'Твой день уже внутри',
          bodyRu: appendBrief('Открой Lumia и посмотри, что день показывает тебе сейчас. Иногда одной точной подсказки уже достаточно.', brief, 'ru'),
          bodyEn: appendBrief('Open Lumia and see what the day is showing you right now. Sometimes one precise cue is already enough.', brief, 'en'),
        },
      ];
    case 'custom':
    default:
      return [
        {
          label: 'Clean draft',
          title: 'Новый сценарий',
          bodyRu: appendBrief('Собрала для тебя чистый черновик уведомления под нужный сценарий.', brief, 'ru'),
          bodyEn: appendBrief('A clean draft notification was prepared for your custom scenario.', brief, 'en'),
        },
        {
          label: 'Sharper draft',
          title: 'Точный акцент',
          bodyRu: appendBrief('Этот вариант звучит собраннее и чуть сильнее, чтобы быстрее привести пользователя в Lumia.', brief, 'ru'),
          bodyEn: appendBrief('This version sounds tighter and a bit stronger to bring the user back into Lumia faster.', brief, 'en'),
        },
        {
          label: 'Softer draft',
          title: 'Мягкий заход',
          bodyRu: appendBrief('Более мягкий черновик для того же сценария, если нужен премиальный и спокойный тон.', brief, 'ru'),
          bodyEn: appendBrief('A softer draft for the same scenario if you want a calmer premium tone.', brief, 'en'),
        },
      ];
  }
}

function extractJsonObject(raw: string) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function normalizeVariant(raw: unknown, fallback: DraftVariant): DraftVariant {
  const candidate = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    label: normalizeText(candidate.label, 40) || fallback.label,
    title: normalizeText(candidate.title, 80) || fallback.title,
    bodyRu: normalizeText(candidate.bodyRu, 280) || fallback.bodyRu,
    bodyEn: normalizeText(candidate.bodyEn, 280) || fallback.bodyEn,
  };
}

async function generateWithOpenAI(options: {
  mode: 'personal' | 'broadcast';
  targetSegment: AdminNotificationTargetSegment | null;
  scenario: DraftScenario;
  brief: string;
}) {
  if (!openai) {
    return {
      variants: buildFallbackDrafts(options.scenario, options.brief),
      source: 'fallback' as const,
      model: null,
    };
  }

  const fallbackVariants = buildFallbackDrafts(options.scenario, options.brief);
  const { model } = await getOpenAIModelForContent({
    accessTier: 'premium',
    contentSurface: 'question',
    contentVariant: 'full',
  });

  const prompt = `You are writing Telegram push notifications for Lumia admin.

Brand rules:
- tone: modern, warm, precise, premium
- direct and engaging, but never scary, manipulative, or cheesy
- low mysticism, more clarity and practical value
- no emojis
- no all caps
- no fake urgency
- do not mention exact Lumi prices unless the admin brief explicitly asks for a price

Task:
- generate exactly 3 distinct notification variants
- each variant must include: label, title, bodyRu, bodyEn
- label: 1-3 words describing the angle
- title: short, premium, punchy, ideally 2-5 words
- bodyRu/bodyEn: concise push copy, ideally 1-2 short sentences, not long paragraphs
- make the three variants meaningfully different in angle
- if scenario is upsell, softly mention both Premium and one-off Lumi unlock
- if scenario is daily_lumi, keep the reward feeling but do not sound childish

Context:
- mode: ${options.mode}
- target segment: ${options.targetSegment || 'n/a'}
- scenario: ${options.scenario}
- scenario intent: ${scenarioDescription(options.scenario)}
- admin brief: ${options.brief || 'none'}

Return JSON only in this shape:
{
  "variants": [
    { "label": "...", "title": "...", "bodyRu": "...", "bodyEn": "..." },
    { "label": "...", "title": "...", "bodyRu": "...", "bodyEn": "..." },
    { "label": "...", "title": "...", "bodyRu": "...", "bodyEn": "..." }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a senior CRM copywriter for a premium astrology app.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content || '';
    const jsonContent = extractJsonObject(rawContent);
    if (!jsonContent) {
      return {
        variants: fallbackVariants,
        source: 'fallback' as const,
        model,
      };
    }

    const parsed = JSON.parse(jsonContent) as { variants?: unknown[] };
    const variants = Array.isArray(parsed.variants) ? parsed.variants : [];

    return {
      variants: fallbackVariants.map((fallback, index) => normalizeVariant(variants[index], fallback)),
      source: 'openai' as const,
      model,
    };
  } catch {
    return {
      variants: fallbackVariants,
      source: 'fallback' as const,
      model,
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);

    const mode = req.body?.mode;
    const targetSegment = req.body?.targetSegment;
    const scenario = req.body?.scenario;
    const brief = normalizeText(req.body?.brief, 240);

    if (mode !== 'personal' && mode !== 'broadcast') {
      return res.status(400).json({ error: 'INVALID_MODE', message: 'Notification mode is invalid' });
    }
    if (!isValidScenario(scenario)) {
      return res.status(400).json({ error: 'INVALID_SCENARIO', message: 'Notification scenario is invalid' });
    }
    if (mode === 'broadcast' && targetSegment != null && !isValidSegment(targetSegment)) {
      return res.status(400).json({ error: 'INVALID_SEGMENT', message: 'Notification segment is invalid' });
    }
    if (scenario === 'custom' && !brief) {
      return res.status(400).json({
        error: 'BRIEF_REQUIRED',
        message: 'A short brief is required for the custom scenario',
      });
    }

    const result = await generateWithOpenAI({
      mode,
      targetSegment: mode === 'broadcast' && isValidSegment(targetSegment) ? targetSegment : null,
      scenario,
      brief,
    });

    return res.status(200).json(result);
  } catch (error) {
    return handleAdminError(res, error);
  }
}
