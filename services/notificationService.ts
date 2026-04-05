import { db } from '../lib/db';
import {
  sendTelegramTextMessage,
  sendTelegramPhotoMessage,
  sendTelegramPhotoBuffer,
  buildInlineKeyboardUrl,
} from '../lib/telegramBot';
import { resolveNotificationVisual, getVisualMode } from './notificationVisualResolver';
import type { AdminNotificationTargetSegment } from '../types';

const BROADCAST_CHUNK_SIZE = 20;
const BROADCAST_CHUNK_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchesRepeatMode(repeatMode: string | null | undefined, zonedNow: Date): boolean {
  const mode = String(repeatMode || 'daily').toLowerCase();
  const weekday = zonedNow.getDay();

  if (mode === 'weekdays') {
    return weekday >= 1 && weekday <= 5;
  }

  if (mode === 'weekly') {
    return weekday === 1;
  }

  return true;
}

export type ScheduledTemplateRow = Record<string, any>;

export function resolveDefaultMiniAppUrl(): string {
  return (
    process.env.TELEGRAM_MINI_APP_URL ||
    process.env.NEXT_PUBLIC_TELEGRAM_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).trim();
}

export function resolveCaption(template: ScheduledTemplateRow): string {
  return String(template.text || '').trim();
}

export function resolveReplyMarkup(template: ScheduledTemplateRow) {
  const deep = String(template.deep_link || '').trim() || resolveDefaultMiniAppUrl();
  const btn = String(template.button_text || '').trim();
  const keyboard = buildInlineKeyboardUrl(deep, btn);
  return keyboard ? { inline_keyboard: keyboard } : undefined;
}

/**
 * Pick next template in rotation for slot (+ optional rotation_group).
 */
export async function getNextNotificationTemplate(
  slot: string,
  rotationGroup: string | null
): Promise<{ template: ScheduledTemplateRow; index: number; list: ScheduledTemplateRow[] } | null> {
  const list = await db.scheduled_notification_templates.listActiveForSlot(slot, rotationGroup);
  if (!list.length) {
    return null;
  }

  const rg = rotationGroup || '';
  const state = await db.notification_rotation_state.get(slot, rg);

  let nextIndex = 0;
  if (state?.last_template_id != null) {
    const idx = list.findIndex((t) => Number(t.id) === Number(state.last_template_id));
    if (idx >= 0) {
      nextIndex = (idx + 1) % list.length;
    } else {
      const li = Number(state.last_index);
      if (!Number.isNaN(li) && li >= 0) {
        nextIndex = (li + 1) % list.length;
      }
    }
  }

  const template = list[nextIndex];
  return { template, index: nextIndex, list };
}

export async function markRotationAfterSend(
  slot: string,
  rotationGroup: string | null,
  templateId: number,
  index: number
): Promise<void> {
  await db.notification_rotation_state.upsert(slot, rotationGroup || '', templateId, index);
}

async function deliverToRecipient(
  telegramUserId: string,
  template: ScheduledTemplateRow,
  options?: { scheduleTimezone?: string | null; recipientLanguage?: string }
): Promise<{ ok: boolean; error?: string; generatedCacheHit?: boolean }> {
  const caption = resolveCaption(template);
  const replyMarkup = resolveReplyMarkup(template);
  const mode = getVisualMode(template);

  if (mode === 'none') {
    if (!caption) {
      return { ok: false, error: 'EMPTY_TEXT' };
    }
    const r = await sendTelegramTextMessage(telegramUserId, caption, { replyMarkup });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  try {
    const visual = await resolveNotificationVisual({
      template,
      recipientUserId: telegramUserId,
      recipientLanguage: options?.recipientLanguage || 'ru',
      scheduleTimezone: options?.scheduleTimezone ?? null,
    });

    if (visual.kind === 'uploaded') {
      const r = await sendTelegramPhotoMessage(telegramUserId, visual.photoUrl, caption, { replyMarkup });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }

    if (visual.kind === 'generated') {
      const r = await sendTelegramPhotoBuffer(
        telegramUserId,
        visual.pngBuffer,
        `lumia-card-${template.id}.png`,
        caption,
        { replyMarkup }
      );
      return r.ok ? { ok: true, generatedCacheHit: visual.cacheHit } : { ok: false, error: r.error };
    }

    return { ok: false, error: 'UNEXPECTED_VISUAL_KIND' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'VISUAL_RESOLVE_FAILED' };
  }
}

/**
 * Send template to one user (test) or full broadcast to segment.
 */
export async function sendNotificationFromTemplate(
  template: ScheduledTemplateRow,
  input: {
    createdBy: string;
    mode: 'test' | 'broadcast';
    targetUserId?: string | null;
    targetSegment?: AdminNotificationTargetSegment | null;
    scheduleTimezone?: string | null;
  }
): Promise<{
  successCount: number;
  failureCount: number;
  totalRecipients: number;
  errorSummary?: string | null;
}> {
  let recipients: Array<{ id: string; language: string }> = [];

  if (input.mode === 'test') {
    const uid = String(input.targetUserId || '').trim();
    if (!uid) {
      throw new Error('TARGET_USER_REQUIRED');
    }
    const user = await db.users.get(uid);
    recipients = [{ id: uid, language: user?.language || 'ru' }];
  } else {
    const segment = input.targetSegment || 'all';
    const rows = await db.admin.getNotificationRecipients(segment);
    recipients = rows.map((r: any) => ({ id: String(r.id), language: r.language || 'ru' }));
  }

  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];
  let genHits = 0;
  let genMisses = 0;

  for (let i = 0; i < recipients.length; i += BROADCAST_CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + BROADCAST_CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (recipient) => {
        const result = await deliverToRecipient(recipient.id, template, {
          scheduleTimezone: input.scheduleTimezone,
          recipientLanguage: recipient.language,
        });
        if (result.ok) {
          successCount += 1;
          if (getVisualMode(template) === 'generated') {
            if (result.generatedCacheHit === true) genHits += 1;
            else if (result.generatedCacheHit === false) genMisses += 1;
          }
        } else {
          failureCount += 1;
          if (errors.length < 5 && result.error) {
            errors.push(result.error);
          }
        }
      })
    );
    if (i + BROADCAST_CHUNK_SIZE < recipients.length) {
      await sleep(BROADCAST_CHUNK_DELAY_MS);
    }
  }

  const status =
    failureCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial';
  const vm = getVisualMode(template);
  let cacheHitLog: boolean | null = null;
  if (vm === 'generated' && successCount > 0) {
    if (genHits > 0 && genMisses === 0) cacheHitLog = true;
    else if (genMisses > 0 && genHits === 0) cacheHitLog = false;
    else cacheHitLog = null;
  }
  await db.notification_delivery_log.create({
    templateId: Number(template.id),
    sentAt: new Date(),
    recipientCount: recipients.length,
    successCount,
    failureCount,
    status,
    errorSummary: errors.length ? errors.join('; ') : null,
    visualMode: vm,
    generatedPreset: vm === 'generated' ? String(template.generated_preset || '') || null : null,
    assetId: vm === 'uploaded' && template.asset_id != null ? Number(template.asset_id) : null,
    generatedCacheHit: cacheHitLog,
  });

  return {
    successCount,
    failureCount,
    totalRecipients: recipients.length,
    errorSummary: errors.length ? errors.join('; ') : null,
  };
}

/**
 * Run one slot: rotate, send broadcast to all users, update rotation state.
 */
export async function sendNotificationSlot(
  slot: string,
  rotationGroup: string | null,
  createdBy: string
): Promise<{
  template: ScheduledTemplateRow | null;
  result: Awaited<ReturnType<typeof sendNotificationFromTemplate>> | null;
}> {
  const next = await getNextNotificationTemplate(slot, rotationGroup);
  if (!next) {
    await db.notification_delivery_log.create({
      templateId: null,
      sentAt: new Date(),
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      status: 'skipped',
      errorSummary: 'No active templates for slot',
    });
    return { template: null, result: null };
  }

  const { template, index } = next;
  const result = await sendNotificationFromTemplate(template, {
    createdBy,
    mode: 'broadcast',
    targetSegment: (template.target_segment as AdminNotificationTargetSegment | null) || 'all',
  });

  await markRotationAfterSend(slot, rotationGroup, Number(template.id), index);

  return { template, result };
}

export async function sendTestNotification(templateId: number, adminTelegramId: string, createdBy: string) {
  const row = await db.scheduled_notification_templates.getById(templateId);
  if (!row) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }
  return sendNotificationFromTemplate(row, {
    createdBy,
    mode: 'test',
    targetUserId: adminTelegramId,
  });
}

type DueScheduleRun = {
  scheduleId: number;
  templateId: number;
  slot: string;
  rotation_group: string | null;
};

/**
 * Schedules that should fire this minute (each row = one template's schedule).
 */
export async function getDueSchedulesThisMinute(now: Date = new Date()): Promise<DueScheduleRun[]> {
  if (!process.env.DATABASE_URL) return [];
  const schedules = await db.notification_schedules.listAll();
  const active = schedules.filter((s: any) => s.is_active);
  const { toZonedTime } = await import('date-fns-tz');
  const out: DueScheduleRun[] = [];

  for (const s of active) {
    const template = await db.scheduled_notification_templates.getById(Number(s.template_id));
    if (!template || !template.is_active) continue;

    const tz = String(s.timezone || 'Europe/Moscow');
    const zoned = toZonedTime(now, tz);
    const hh = String(zoned.getHours()).padStart(2, '0');
    const mm = String(zoned.getMinutes()).padStart(2, '0');
    const currentHm = `${hh}:${mm}`;

    const st = s.send_time;
    const timeStr =
      typeof st === 'string'
        ? st.slice(0, 5)
        : st && typeof (st as Date).toISOString === 'function'
          ? (st as Date).toISOString().slice(11, 16)
          : String(st).slice(0, 5);

    if (timeStr !== currentHm) continue;
    if (!matchesRepeatMode(s.repeat_mode, zoned)) continue;

    const slot = String(template.slot);
    const rg = template.rotation_group != null ? String(template.rotation_group) : null;
    out.push({
      scheduleId: Number(s.id),
      templateId: Number(template.id),
      slot,
      rotation_group: rg,
    });
  }

  return out;
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Run all due schedules for the current minute; each schedule fires at most once per UTC day (last_sent_at).
 */
export async function runDueScheduledNotifications(createdBy: string, now: Date = new Date()): Promise<
  Array<{ scheduleId: number; slot: string; rotation_group: string | null; ok: boolean; detail?: string }>
> {
  const due = await getDueSchedulesThisMinute(now);
  const results: Array<{ scheduleId: number; slot: string; rotation_group: string | null; ok: boolean; detail?: string }> = [];
  const allSchedules = await db.notification_schedules.listAll();

  for (const run of due) {
    const row = allSchedules.find((s: any) => Number(s.id) === run.scheduleId);
    if (!row?.is_active) continue;
    if (row.last_sent_at && isSameUtcDay(new Date(row.last_sent_at), now)) {
      results.push({
        scheduleId: run.scheduleId,
        slot: run.slot,
        rotation_group: run.rotation_group,
        ok: true,
        detail: 'already_sent_today',
      });
      continue;
    }

    try {
      const templateRow = await db.scheduled_notification_templates.getById(run.templateId);
      if (!templateRow || !templateRow.is_active) {
        results.push({
          scheduleId: run.scheduleId,
          slot: run.slot,
          rotation_group: run.rotation_group,
          ok: false,
          detail: 'template_inactive',
        });
        continue;
      }

      const result = await sendNotificationFromTemplate(templateRow, {
        createdBy,
        mode: 'broadcast',
        targetSegment: (templateRow.target_segment as AdminNotificationTargetSegment | null) || 'all',
        scheduleTimezone: String(row.timezone || 'Europe/Moscow'),
      });
      await db.notification_schedules.updateLastSent(run.scheduleId);

      const list = await db.scheduled_notification_templates.listActiveForSlot(run.slot, run.rotation_group);
      const idx = list.findIndex((t: any) => Number(t.id) === run.templateId);
      if (idx >= 0) {
        await markRotationAfterSend(run.slot, run.rotation_group, run.templateId, idx);
      }

      results.push({
        scheduleId: run.scheduleId,
        slot: run.slot,
        rotation_group: run.rotation_group,
        ok: (result.failureCount ?? 0) < (result.totalRecipients ?? 1),
        detail: `template #${run.templateId}`,
      });
    } catch (e: any) {
      results.push({
        scheduleId: run.scheduleId,
        slot: run.slot,
        rotation_group: run.rotation_group,
        ok: false,
        detail: e?.message || 'error',
      });
    }
  }

  return results;
}
