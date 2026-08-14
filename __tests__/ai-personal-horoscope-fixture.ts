import { APP_VOICE_VERSION } from '../lib/appVoice';
import {
  AI_PERSONAL_HOROSCOPE_CONTENT_MODE,
  AI_PERSONAL_HOROSCOPE_EVIDENCE_ID,
} from '../lib/aiPersonalHoroscope';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  type ForecastContentBlockRole,
  type ForecastSection,
  type PersonalForecastPackage,
} from '../lib/personalForecastContract';

const evidenceId = AI_PERSONAL_HOROSCOPE_EVIDENCE_ID;

function section(input: {
  id: string;
  kind: 'overview' | 'dynamic';
  role: ForecastContentBlockRole;
  text: string;
  importance: number;
}): ForecastSection {
  const anchorId = `anchor:${input.id}`;
  const teaser = 'Продолжение личного гороскопа доступно в Premium.';
  return {
    id: input.id,
    kind: input.kind,
    status: 'ready',
    diagnosticCode: null,
    sourceTopicKey: input.kind === 'overview' ? 'overview' : undefined,
    text: input.text,
    contentBlocks: [{
      id: `${input.id}:${input.role}:1`,
      role: input.role,
      text: input.text,
      semanticFactId: evidenceId,
      atomId: `${input.id}:atom`,
      explanationAnchorId: anchorId,
    }],
    semanticFactIds: [evidenceId],
    semanticFingerprint: `ai:${input.id}`,
    importance: input.importance,
    visualTag: `ai-${input.id}`,
    visualCue: null,
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(input.text, teaser),
    explanationAnchors: [{
      id: anchorId,
      conclusion: input.text,
      explanation: 'AI-only personal horoscope context.',
      evidenceIds: [evidenceId],
    }],
    inlineAstroAccent: null,
  };
}

export function aiPersonalHoroscopeFixture(): PersonalForecastPackage {
  const overview = section({
    id: 'overview',
    kind: 'overview',
    role: 'lead',
    text: 'Михаил, сегодня всё будет изображать срочность. Не ведись.',
    importance: 100,
  });
  const forecast = section({
    id: 'semantic:forecast',
    kind: 'dynamic',
    role: 'detail',
    text: 'С утра дела полезут без очереди. Выбери одно главное и закончи его. Люди добавят шума, но не каждый вопрос твой. Не переделывай то, что уже работает. К вечеру станет ясно, что половина суеты была декорацией. Сложные решения оставь на свежую голову.',
    importance: 100,
  });
  const adviceOne = section({
    id: 'semantic:advice-1',
    kind: 'dynamic',
    role: 'action',
    text: 'Не добавляй новые дела до обеда.',
    importance: 72,
  });
  const adviceTwo = section({
    id: 'semantic:advice-2',
    kind: 'dynamic',
    role: 'action',
    text: 'Не объясняй очевидное дважды.',
    importance: 71,
  });
  return {
    period: 'day',
    periodKey: '2026-07-26',
    periodStart: '2026-07-26',
    periodEnd: '2026-07-26',
    dateLabel: 'ВОСКРЕСЕНЬЕ\n26 ИЮЛЯ',
    timezone: 'Europe/Moscow',
    overview,
    sections: [forecast, adviceOne, adviceTwo],
    suggestedCrossPeriodLinks: [],
    evidence: {
      [evidenceId]: {
        id: evidenceId,
        factor: 'AI horoscope profile and continuity context',
        orb: null,
        status: 'active',
        period: '2026-07-26',
        meaning: 'AI-only personal horoscope context.',
      },
    },
    visual: { sectionAssetIds: {} },
    meta: {
      model: 'gpt-5.6-luna',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      generationAttempts: 1,
      validationStatus: 'valid',
      generatedAt: '2026-07-26T10:00:00.000Z',
      status: 'ready',
      diagnosticCode: null,
      freeSelection: {
        strongestSectionId: 'semantic:forecast',
        rotatedSectionId: 'semantic:advice-1',
        sectionIds: ['semantic:forecast', 'semantic:advice-1'],
      },
      contentMode: AI_PERSONAL_HOROSCOPE_CONTENT_MODE,
    } as PersonalForecastPackage['meta'] & { contentMode: string },
  };
}

export function weeklyAiPersonalHoroscopeFixture(): PersonalForecastPackage {
  const daily = aiPersonalHoroscopeFixture();
  const opening = 'Михаил, неделя уже разложила дела по столу. Не хватай всё сразу.';
  const forecast = 'Первые дни потребуют точного порядка. Люди будут приносить свои вопросы, но часть спокойно подождёт. Середина недели подкинет желание резко поменять план. Не ломай то, что уже движется. Ближе к выходным появится больше свободного места. Закрой старое прежде, чем начинать новое. Итог недели зависит не от скорости, а от последовательности.';
  const advice = ['Оставь три главных дела.', 'Не меняй план из-за чужой суеты.'];
  const overview = section({
    id: 'overview',
    kind: 'overview',
    role: 'lead',
    text: opening,
    importance: 100,
  });
  overview.contentBlocks = [
    { ...overview.contentBlocks[0], text: opening, role: 'lead', atomId: 'ai_opening' },
    {
      id: 'overview:detail:2', role: 'detail', text: forecast,
      semanticFactId: evidenceId, atomId: 'ai_forecast', explanationAnchorId: null,
    },
    ...advice.map((item, index) => ({
      id: `overview:action:${index + 3}`,
      role: 'action' as const,
      text: item,
      semanticFactId: evidenceId,
      atomId: `ai_advice_${index + 1}`,
      explanationAnchorId: null,
    })),
  ];
  overview.text = overview.contentBlocks.map((block) => block.text).join('\n\n');
  overview.lockedPreview = buildForecastLockedPreview(overview.text, overview.premiumTeaser);
  overview.semanticFingerprint = 'ai:week:overview';
  return {
    ...daily,
    period: 'week',
    periodKey: '2026-W30',
    periodStart: '2026-07-20',
    periodEnd: '2026-07-26',
    overview,
    sections: [],
    meta: {
      ...daily.meta,
      freeSelection: {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      },
    },
  };
}
