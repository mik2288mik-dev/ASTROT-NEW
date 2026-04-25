import { llmJson, llmTagged } from '../anthropic';
import type { NatalChartData, UserProfile } from '../../types';
import { serializeChartForPrompt } from './chartSerializer';
import {
  NATAL_READING_SYSTEM,
  buildAspectsPrompt,
  buildDeepDivePrompt,
  buildPortraitPrompt,
  buildTodayPrompt,
  buildWeekPrompt,
  parsePortraitTags,
  DEEP_DIVE_TOPICS,
  type DeepDiveTopic,
} from './prompts';
import type {
  NatalReadingAspects,
  NatalReadingDeepDive,
  NatalReadingDeepDiveKey,
  NatalReadingPortrait,
  NatalReadingToday,
  NatalReadingWeek,
} from './types';

function clamp(text: string | undefined, max: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trim() + '…';
}

export async function generatePortrait(
  profile: UserProfile,
  chart: NatalChartData
): Promise<NatalReadingPortrait> {
  const serialized = serializeChartForPrompt(profile, chart);
  const raw = await llmTagged({
    system: NATAL_READING_SYSTEM,
    user: buildPortraitPrompt(serialized),
    model: {
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
    },
    maxTokens: 1800,
    temperature: 0.75,
  });
  const parsed = parsePortraitTags(raw);
  if (!parsed.archetypes.length || !parsed.portrait) {
    throw new Error('Portrait response could not be parsed');
  }
  return {
    archetypes: parsed.archetypes.slice(0, 5).map((a) => ({
      title: clamp(a.title, 60),
      subtitle: clamp(a.subtitle, 120),
    })),
    portrait: parsed.portrait,
    insight: parsed.insight,
    energyA: parsed.energyA,
    energyB: parsed.energyB,
    synthesis: parsed.synthesis,
  };
}

export async function generateAspects(
  profile: UserProfile,
  chart: NatalChartData
): Promise<NatalReadingAspects> {
  const serialized = serializeChartForPrompt(profile, chart);
  const result = await llmJson<NatalReadingAspects>({
    system: NATAL_READING_SYSTEM,
    user: buildAspectsPrompt(serialized),
    model: {
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
    },
    maxTokens: 1800,
    temperature: 0.6,
  });
  if (!Array.isArray(result.aspects) || result.aspects.length === 0) {
    throw new Error('Aspects response missing aspects[]');
  }
  return {
    aspects: result.aspects.slice(0, 5).map((a) => ({
      pl: String(a.pl || '').trim(),
      badge: String(a.badge || '').trim() || 'Соединение',
      color: String(a.color || '#9a9a9a').trim(),
      text: String(a.text || '').trim(),
    })),
    resume: String(result.resume || '').trim(),
  };
}

export async function generateWeek(
  profile: UserProfile,
  chart: NatalChartData
): Promise<NatalReadingWeek> {
  const serialized = serializeChartForPrompt(profile, chart);
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const result = await llmJson<NatalReadingWeek>({
    system: NATAL_READING_SYSTEM,
    user: buildWeekPrompt(serialized, { from: fmt(monday), to: fmt(sunday) }),
    model: {
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'weekly',
    },
    maxTokens: 800,
    temperature: 0.75,
  });
  return {
    title: String(result.title || '').trim(),
    body: String(result.body || '').trim(),
  };
}

export async function generateToday(
  profile: UserProfile,
  chart: NatalChartData
): Promise<NatalReadingToday> {
  const serialized = serializeChartForPrompt(profile, chart);
  const now = new Date();
  const dateLabel = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });
  const result = await llmJson<NatalReadingToday>({
    system: NATAL_READING_SYSTEM,
    user: buildTodayPrompt(serialized, dateLabel),
    model: {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'living',
    },
    maxTokens: 1200,
    temperature: 0.75,
  });
  return {
    title: String(result.title || '').trim(),
    main: String(result.main || '').trim(),
    love: String(result.love || '').trim(),
    work: String(result.work || '').trim(),
    energy: String(result.energy || '').trim(),
  };
}

export async function generateDeepDive(
  profile: UserProfile,
  chart: NatalChartData,
  key: NatalReadingDeepDiveKey
): Promise<NatalReadingDeepDive> {
  const topic: DeepDiveTopic = DEEP_DIVE_TOPICS[key];
  const serialized = serializeChartForPrompt(profile, chart);
  const result = await llmJson<NatalReadingDeepDive>({
    system: NATAL_READING_SYSTEM,
    user: buildDeepDivePrompt(serialized, topic),
    model: {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'full',
    },
    maxTokens: 1800,
    temperature: 0.7,
  });
  return {
    title: String(result.title || topic.title).trim(),
    body: String(result.body || '').trim(),
    highlights: Array.isArray(result.highlights)
      ? result.highlights.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 6)
      : [],
  };
}
