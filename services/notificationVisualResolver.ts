import { renderNotificationCardToPng, type CardRenderInput } from './notificationCardRenderer';
import {
  buildGeneratedCardCacheKey,
  contentHashForGeneratedCard,
  readCachedGeneratedPngIfExists,
  writeGeneratedPngCache,
} from './notificationGeneratedCache';
import { db } from '../lib/db';

export type ResolvedVisual =
  | { kind: 'none' }
  | { kind: 'uploaded'; photoUrl: string }
  | { kind: 'generated'; pngBuffer: Buffer; cacheHit: boolean; publicUrl?: string };

const SLOT_LABEL_RU: Record<string, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  daily_lumi: 'Возврат',
  upsell: 'Premium',
  promo: 'Промо',
  custom: 'Твой Гороскоп',
};

const SLOT_LABEL_EN: Record<string, string> = {
  morning: 'Morning',
  day: 'Day',
  evening: 'Evening',
  daily_lumi: 'Возврат',
  upsell: 'Premium',
  promo: 'Promo',
  custom: 'Твой Гороскоп',
};

function slotLabel(slot: string, lang: string): string {
  if (lang === 'en') return SLOT_LABEL_EN[slot] || SLOT_LABEL_EN.custom;
  return SLOT_LABEL_RU[slot] || SLOT_LABEL_RU.custom;
}

function formatDateLabel(lang: string, tz?: string): string {
  try {
    const opts: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
      ...opts,
      timeZone: tz && tz.length ? tz : 'Europe/Moscow',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function zodiacLineForUser(
  template: Record<string, any>,
  user: { sun_sign?: string | null; language?: string | null }
): string {
  const mode = String(template.generated_zodiac_mode || 'none').toLowerCase();
  if (mode === 'none' || !mode) return '';
  if (mode === 'custom') {
    return String(template.generated_custom_zodiac || '').trim();
  }
  if (mode === 'sun_sign') {
    const sign = (user.sun_sign || '').trim();
    if (!sign) return '';
    return user.language === 'en' ? `Sun · ${sign}` : `☉ ${sign}`;
  }
  return '';
}

export function getVisualMode(template: Record<string, any>): 'none' | 'uploaded' | 'generated' {
  const v = String(template.visual_mode || '').toLowerCase();
  if (v === 'uploaded' || v === 'generated') return v;
  return 'none';
}

/**
 * Resolve PNG or URL for sending. For generated: cache by template+date+content hash.
 */
export async function resolveNotificationVisual(input: {
  template: Record<string, any>;
  recipientUserId: string;
  recipientLanguage: string;
  scheduleTimezone?: string | null;
  dateKey?: string;
  /** Admin preview: override sun sign without DB */
  previewSunSign?: string | null;
}): Promise<ResolvedVisual> {
  const { template } = input;
  const mode = getVisualMode(template);

  if (mode === 'none') {
    return { kind: 'none' };
  }

  if (mode === 'uploaded') {
    const url = template.asset_public_url ? String(template.asset_public_url).trim() : '';
    if (!url) {
      throw new Error('MISSING_UPLOADED_ASSET');
    }
    return { kind: 'uploaded', photoUrl: url };
  }

  const user = await db.users.get(input.recipientUserId);
  const primaryChart = await db.natal_charts.getPrimary(input.recipientUserId);
  const lang = input.recipientLanguage === 'en' ? 'en' : 'ru';
  const sunFromPreview = input.previewSunSign != null ? String(input.previewSunSign).trim() : '';
  const slot = String(template.slot || 'custom');
  const title =
    String(template.generated_title || '').trim() ||
    (lang === 'en' ? 'Your moment' : 'Твой момент');
  const subtitle = String(template.generated_subtitle || '').trim();
  const accent = String(template.generated_accent || '').trim();
  const body = String(template.text || '').trim();
  const showDate = !!template.generated_show_date;
  const showSlot = !!template.generated_show_slot_label;
  const dateLabel = showDate ? formatDateLabel(lang, input.scheduleTimezone || undefined) : '';
  const slotLabelText = showSlot ? slotLabel(slot, lang) : '';
  const zodiacLine = zodiacLineForUser(template, {
    sun_sign: sunFromPreview || primaryChart?.sun_sign || user?.sun_sign,
    language: user?.language || input.recipientLanguage,
  });

  const bodyLinesJoined = body.replace(/\n+/g, ' ').trim();
  const hash = contentHashForGeneratedCard({
    title,
    subtitle,
    accent,
    bodyLines: bodyLinesJoined,
    showDate,
    showSlotLabel: showSlot,
    slotLabel: slotLabelText,
    dateLabel,
    zodiacLine,
  });

  const dateKey = input.dateKey || new Date().toISOString().slice(0, 10);
  const fileName = buildGeneratedCardCacheKey({
    templateId: Number(template.id),
    dateKey,
    slot,
    preset: String(template.generated_preset || ''),
    contentHash: hash,
  });

  const cachedFile = await readCachedGeneratedPngIfExists(fileName);
  if (!cachedFile) {
    const cardInput: CardRenderInput = {
      presetId: template.generated_preset,
      title,
      subtitle,
      accent,
      body,
      showDate,
      showSlotLabel: showSlot,
      dateLabel,
      slotLabel: slotLabelText,
      zodiacLine,
    };
    const rendered = await renderNotificationCardToPng(cardInput);
    const saved = await writeGeneratedPngCache(fileName, rendered);
    return { kind: 'generated', pngBuffer: rendered, cacheHit: false, publicUrl: saved.publicUrl };
  }

  return { kind: 'generated', pngBuffer: cachedFile, cacheHit: true };
}
