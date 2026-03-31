import type { AdminNotificationTargetSegment } from '../types';
import { isValidGeneratedPreset } from './notificationCardPresets';

const SLOTS = new Set(['morning', 'day', 'evening', 'custom']);
const REPEAT = new Set(['daily']);
const VISUAL_MODES = new Set(['none', 'uploaded', 'generated']);
const ZODIAC_MODES = new Set(['none', 'sun_sign', 'custom']);
const TARGET_SEGMENTS = new Set([
  'all',
  'premium',
  'free',
  'lumi',
  'active_7d',
  'inactive_3d',
  'inactive_7d',
  'inactive_30d',
  'need_attention',
]);

const MAX_TEXT = 4000;
const MAX_NAME = 200;
const MAX_BUTTON = 64;
const MAX_DEEP = 2000;
const MAX_NOTES = 2000;
const MAX_GROUP = 120;
const MAX_GEN_TITLE = 120;
const MAX_GEN_SUB = 200;
const MAX_GEN_ACCENT = 100;
const MAX_GEN_ZODIAC_CUSTOM = 80;

export function parseHHMM(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  const min = m[2];
  return `${h}:${min}`;
}

export function validateDeepLink(url: string): { ok: true } | { ok: false; error: string } {
  const u = url.trim();
  if (!u) return { ok: true };
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'DEEP_LINK_PROTOCOL' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'DEEP_LINK_INVALID' };
  }
}

export type TemplatePayload = {
  name: string;
  slot: string;
  targetSegment: AdminNotificationTargetSegment | null;
  messageType: 'text' | 'photo';
  text: string;
  buttonText: string;
  deepLink: string;
  assetId: number | null;
  isActive: boolean;
  sortOrder: number;
  rotationGroup: string | null;
  notes: string | null;
  visualMode: 'none' | 'uploaded' | 'generated';
  generatedPreset: string | null;
  generatedTitle: string | null;
  generatedSubtitle: string | null;
  generatedAccent: string | null;
  generatedShowDate: boolean;
  generatedShowSlotLabel: boolean;
  generatedZodiacMode: string | null;
  generatedCustomZodiac: string | null;
};

export function parseTemplatePayload(body: any): { ok: true; data: TemplatePayload } | { ok: false; error: string; message: string } {
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  if (!name) {
    return { ok: false, error: 'NAME_REQUIRED', message: 'Template name is required' };
  }
  const slot = typeof body?.slot === 'string' ? body.slot.trim() : '';
  if (!SLOTS.has(slot)) {
    return { ok: false, error: 'INVALID_SLOT', message: 'Invalid slot' };
  }
  const targetSegmentRaw = typeof body?.targetSegment === 'string' ? body.targetSegment.trim() : '';
  const targetSegment = targetSegmentRaw && TARGET_SEGMENTS.has(targetSegmentRaw)
    ? (targetSegmentRaw as AdminNotificationTargetSegment)
    : null;

  const visualRaw = typeof body?.visualMode === 'string' ? body.visualMode.trim().toLowerCase() : 'none';
  const visualMode = VISUAL_MODES.has(visualRaw) ? (visualRaw as 'none' | 'uploaded' | 'generated') : 'none';

  let generatedPreset: string | null = null;
  if (body?.generatedPreset != null && String(body.generatedPreset).trim()) {
    const p = String(body.generatedPreset).trim();
    if (!isValidGeneratedPreset(p)) {
      return { ok: false, error: 'INVALID_PRESET', message: 'Invalid generated preset' };
    }
    generatedPreset = p;
  }

  const generatedTitle =
    body?.generatedTitle != null && String(body.generatedTitle).trim()
      ? String(body.generatedTitle).trim().slice(0, MAX_GEN_TITLE)
      : null;
  const generatedSubtitle =
    body?.generatedSubtitle != null && String(body.generatedSubtitle).trim()
      ? String(body.generatedSubtitle).trim().slice(0, MAX_GEN_SUB)
      : null;
  const generatedAccent =
    body?.generatedAccent != null && String(body.generatedAccent).trim()
      ? String(body.generatedAccent).trim().slice(0, MAX_GEN_ACCENT)
      : null;
  const generatedShowDate = body?.generatedShowDate === true;
  const generatedShowSlotLabel = body?.generatedShowSlotLabel === true;

  let generatedZodiacMode: string | null = null;
  if (body?.generatedZodiacMode != null && String(body.generatedZodiacMode).trim()) {
    const z = String(body.generatedZodiacMode).trim().toLowerCase();
    if (!ZODIAC_MODES.has(z)) {
      return { ok: false, error: 'INVALID_ZODIAC_MODE', message: 'Invalid zodiac mode' };
    }
    generatedZodiacMode = z;
  }

  const generatedCustomZodiac =
    body?.generatedCustomZodiac != null && String(body.generatedCustomZodiac).trim()
      ? String(body.generatedCustomZodiac).trim().slice(0, MAX_GEN_ZODIAC_CUSTOM)
      : null;

  if (visualMode === 'generated' && !generatedPreset) {
    return { ok: false, error: 'PRESET_REQUIRED', message: 'Preset is required for generated visual mode' };
  }

  let assetId: number | null = null;
  if (body?.assetId != null && body.assetId !== '') {
    const n = Number(body.assetId);
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, error: 'INVALID_ASSET', message: 'Invalid asset id' };
    }
    assetId = Math.floor(n);
  }

  if (visualMode === 'uploaded' && !assetId) {
    return { ok: false, error: 'UPLOAD_REQUIRES_ASSET', message: 'Uploaded mode requires an image' };
  }

  if (visualMode === 'generated' && generatedZodiacMode === 'custom' && !generatedCustomZodiac) {
    return { ok: false, error: 'CUSTOM_ZODIAC_REQUIRED', message: 'Custom zodiac text is required when zodiac mode is custom' };
  }

  const messageType: 'text' | 'photo' = visualMode === 'none' ? 'text' : 'photo';

  const text = typeof body?.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
  const buttonText = typeof body?.buttonText === 'string' ? body.buttonText.trim().slice(0, MAX_BUTTON) : '';
  const deepLink = typeof body?.deepLink === 'string' ? body.deepLink.trim().slice(0, MAX_DEEP) : '';
  const dl = validateDeepLink(deepLink);
  if (!dl.ok) {
    return { ok: false, error: dl.error, message: 'Invalid deep link URL' };
  }

  const isActive = body?.isActive !== false;
  const sortOrder = Math.max(0, Math.min(9999, Number(body?.sortOrder) || 0));
  let rotationGroup: string | null = null;
  if (body?.rotationGroup != null && String(body.rotationGroup).trim()) {
    rotationGroup = String(body.rotationGroup).trim().slice(0, MAX_GROUP);
  }
  let notes: string | null = null;
  if (body?.notes != null && String(body.notes).trim()) {
    notes = String(body.notes).trim().slice(0, MAX_NOTES);
  }

  if (visualMode === 'none' && !text.trim()) {
    return { ok: false, error: 'TEXT_REQUIRED', message: 'Text is required when visual mode is none' };
  }

  return {
    ok: true,
    data: {
      name,
      slot,
      targetSegment,
      messageType,
      text,
      buttonText,
      deepLink,
      assetId,
      isActive,
      sortOrder,
      rotationGroup,
      notes,
      visualMode,
      generatedPreset,
      generatedTitle,
      generatedSubtitle,
      generatedAccent,
      generatedShowDate,
      generatedShowSlotLabel,
      generatedZodiacMode,
      generatedCustomZodiac,
    },
  };
}

export function existingRowToTemplatePayload(row: any, patch: { isActive: boolean }): TemplatePayload {
  const vm = String(row.visual_mode || 'none').toLowerCase();
  const visualMode = VISUAL_MODES.has(vm) ? (vm as 'none' | 'uploaded' | 'generated') : 'none';
  return {
    name: row.name || '',
    slot: row.slot || 'custom',
    targetSegment: row.target_segment ?? null,
    messageType: row.message_type === 'photo' ? 'photo' : 'text',
    text: row.text || '',
    buttonText: row.button_text || '',
    deepLink: row.deep_link || '',
    assetId: row.asset_id != null ? Number(row.asset_id) : null,
    isActive: patch.isActive,
    sortOrder: Number(row.sort_order ?? 0),
    rotationGroup: row.rotation_group ?? null,
    notes: row.notes ?? null,
    visualMode,
    generatedPreset: row.generated_preset ?? null,
    generatedTitle: row.generated_title ?? null,
    generatedSubtitle: row.generated_subtitle ?? null,
    generatedAccent: row.generated_accent ?? null,
    generatedShowDate: !!row.generated_show_date,
    generatedShowSlotLabel: !!row.generated_show_slot_label,
    generatedZodiacMode: row.generated_zodiac_mode ?? null,
    generatedCustomZodiac: row.generated_custom_zodiac ?? null,
  };
}

export function parseSchedulePayload(body: any, requireTemplateId: boolean): { ok: true; data: any } | { ok: false; error: string; message: string } {
  let templateId: number | undefined;
  if (requireTemplateId) {
    const tid = Number(body?.templateId);
    if (!Number.isFinite(tid) || tid < 1) {
      return { ok: false, error: 'TEMPLATE_ID_REQUIRED', message: 'templateId is required' };
    }
    templateId = Math.floor(tid);
  }
  const sendTime = parseHHMM(body?.sendTime);
  if (!sendTime) {
    return { ok: false, error: 'INVALID_SEND_TIME', message: 'sendTime must be HH:mm' };
  }
  const timezone = typeof body?.timezone === 'string' && body.timezone.trim() ? body.timezone.trim().slice(0, 64) : 'Europe/Moscow';
  const repeatMode = typeof body?.repeatMode === 'string' && REPEAT.has(body.repeatMode) ? body.repeatMode : 'daily';
  const isActive = body?.isActive !== false;
  return {
    ok: true,
    data: { templateId, sendTime, timezone, repeatMode, isActive },
  };
}
