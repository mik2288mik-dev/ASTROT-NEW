const SLOTS = new Set(['morning', 'day', 'evening', 'custom']);
const MSG_TYPES = new Set(['text', 'photo']);
const REPEAT = new Set(['daily']);

const MAX_TEXT = 4000;
const MAX_NAME = 200;
const MAX_BUTTON = 64;
const MAX_DEEP = 2000;
const MAX_NOTES = 2000;
const MAX_GROUP = 120;

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
  messageType: 'text' | 'photo';
  text: string;
  buttonText: string;
  deepLink: string;
  assetId: number | null;
  isActive: boolean;
  sortOrder: number;
  rotationGroup: string | null;
  notes: string | null;
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
  const messageType = body?.messageType === 'photo' ? 'photo' : 'text';
  if (!MSG_TYPES.has(messageType)) {
    return { ok: false, error: 'INVALID_MESSAGE_TYPE', message: 'Invalid message type' };
  }
  const text = typeof body?.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
  const buttonText = typeof body?.buttonText === 'string' ? body.buttonText.trim().slice(0, MAX_BUTTON) : '';
  const deepLink = typeof body?.deepLink === 'string' ? body.deepLink.trim().slice(0, MAX_DEEP) : '';
  const dl = validateDeepLink(deepLink);
  if (!dl.ok) {
    return { ok: false, error: dl.error, message: 'Invalid deep link URL' };
  }
  let assetId: number | null = null;
  if (body?.assetId != null && body.assetId !== '') {
    const n = Number(body.assetId);
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, error: 'INVALID_ASSET', message: 'Invalid asset id' };
    }
    assetId = Math.floor(n);
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

  if (messageType === 'photo' && !assetId) {
    return { ok: false, error: 'PHOTO_REQUIRES_ASSET', message: 'Photo templates require an uploaded image' };
  }
  if (messageType === 'text' && !text.trim()) {
    return { ok: false, error: 'TEXT_REQUIRED', message: 'Text message cannot be empty' };
  }

  return {
    ok: true,
    data: {
      name,
      slot,
      messageType,
      text,
      buttonText,
      deepLink,
      assetId,
      isActive,
      sortOrder,
      rotationGroup,
      notes,
    },
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
