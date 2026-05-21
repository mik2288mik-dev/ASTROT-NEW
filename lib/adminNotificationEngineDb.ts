import { getPool } from './db';
import { NOTIFICATION_SCENARIO_SEEDS } from './notificationScenarioCatalog';
import type {
  AdminNotificationEngineStats,
  AdminNotificationScenario,
  AdminNotificationScenarioPayload,
  AdminNotificationTemplatePayload,
  AdminScheduledNotificationAsset,
  AdminScheduledNotificationTemplate,
} from '../types';

function json<T>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function arr(value: any): string[] {
  const parsed = json<any[]>(value, []);
  return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
}

function toBool(value: any, fallback = false) {
  return value == null ? fallback : !!value;
}

function time5(value: any, fallback = '00:00') {
  if (!value) return fallback;
  if (typeof value === 'string') return value.slice(0, 5);
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  return String(value).slice(0, 5) || fallback;
}

function iso(value: any): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function serializeNotificationScenario(row: any): AdminNotificationScenario {
  return {
    id: Number(row.id),
    key: String(row.key || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    enabled: !!row.enabled,
    dayPart: row.day_part || 'day',
    timeWindowStart: time5(row.time_window_start, '08:30'),
    timeWindowEnd: time5(row.time_window_end, '10:30'),
    timezoneMode: row.timezone_mode || 'user_local',
    priority: Number(row.priority ?? 0),
    triggerRuleJson: json<Record<string, any>>(row.trigger_rule_json, {}),
    audienceRuleJson: json<Record<string, any>>(row.audience_rule_json, {}),
    maxPerDay: Number(row.max_per_day ?? 1),
    cooldownHours: Number(row.cooldown_hours ?? 20),
    imageMode: row.image_mode || 'auto',
    imageStrategyJson: json<Record<string, any>>(row.image_strategy_json, {}),
    defaultMediaAssetId: row.default_media_asset_id != null ? Number(row.default_media_asset_id) : null,
    deepLink: row.deep_link || 'today',
    buttons: json<any[]>(row.buttons, []),
    templatesCount: Number(row.templates_count ?? 0),
    activeTemplatesCount: Number(row.active_templates_count ?? 0),
    lastSentAt: iso(row.last_sent_at),
    sentCount: Number(row.sent_count ?? 0),
    clickedCount: Number(row.clicked_count ?? 0),
    ctr: Number(row.sent_count ?? 0) > 0 ? Number(row.clicked_count ?? 0) / Number(row.sent_count ?? 1) : 0,
    errorCount: Number(row.error_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeEngineTemplate(row: any): AdminScheduledNotificationTemplate {
  const vm = String(row.visual_mode || 'none').toLowerCase();
  const visualMode = vm === 'uploaded' || vm === 'generated' ? vm : 'none';
  const body = row.body || row.text || '';
  return {
    id: Number(row.id),
    scenarioId: row.scenario_id != null ? Number(row.scenario_id) : null,
    scenarioKey: row.scenario_key ?? null,
    name: row.name || row.title || '',
    slot: row.slot || row.day_part || 'custom',
    targetSegment: row.target_segment ?? null,
    messageType: row.message_type === 'photo' ? 'photo' : 'text',
    visualMode,
    title: row.title || '',
    body,
    text: row.text || body,
    buttonText: row.button_text || '',
    deepLink: row.deep_link || '',
    assetId: row.asset_id != null ? Number(row.asset_id) : null,
    assetPublicUrl: row.asset_public_url || null,
    assetMimeType: row.asset_mime_type || null,
    assetFileName: row.asset_file_name || null,
    tags: arr(row.tags),
    weight: Number(row.weight ?? 100),
    lastUsedAt: iso(row.last_used_at),
    generatedPreset: row.generated_preset ?? null,
    generatedTitle: row.generated_title ?? null,
    generatedSubtitle: row.generated_subtitle ?? null,
    generatedAccent: row.generated_accent ?? null,
    generatedShowDate: !!row.generated_show_date,
    generatedShowSlotLabel: !!row.generated_show_slot_label,
    generatedZodiacMode: row.generated_zodiac_mode ?? null,
    generatedCustomZodiac: row.generated_custom_zodiac ?? null,
    isActive: !!row.is_active,
    sortOrder: Number(row.sort_order ?? 0),
    rotationGroup: row.rotation_group ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeEngineAsset(row: any): AdminScheduledNotificationAsset {
  return {
    id: Number(row.id),
    fileName: row.file_name || '',
    publicUrl: row.public_url || '',
    mimeType: row.mime_type || '',
    fileSize: Number(row.file_size ?? 0),
    refCount: Number(row.ref_count ?? 0),
    telegramFileId: row.telegram_file_id ?? null,
    title: row.title ?? null,
    category: row.category || 'day',
    tags: arr(row.tags),
    mood: row.mood ?? null,
    dayPart: row.day_part ?? null,
    enabled: toBool(row.enabled, true),
    lastUsedAt: iso(row.last_used_at),
    cooldownDays: Number(row.cooldown_days ?? 30),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanPayloadText(value: any, max = 4000): string {
  return String(value || '').trim().slice(0, max);
}

export const notificationEngineAdminDb = {
  async ensureScenarioSeeds() {
    const pool = getPool();
    for (const seed of NOTIFICATION_SCENARIO_SEEDS) {
      const result = await pool.query(
        `INSERT INTO notification_scenarios (
           key, name, description, enabled, day_part, time_window_start, time_window_end, timezone_mode,
           priority, trigger_rule_json, audience_rule_json, max_per_day, cooldown_hours, image_mode,
           image_strategy_json, deep_link, buttons
         )
         VALUES ($1, $2, $3, FALSE, $4, $5::time, $6::time, 'user_local', $7, $8::jsonb, $9::jsonb,
           $10, $11, $12, $13::jsonb, $14, $15::jsonb)
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           day_part = EXCLUDED.day_part,
           time_window_start = EXCLUDED.time_window_start,
           time_window_end = EXCLUDED.time_window_end,
           priority = EXCLUDED.priority,
           trigger_rule_json = EXCLUDED.trigger_rule_json,
           audience_rule_json = EXCLUDED.audience_rule_json,
           max_per_day = EXCLUDED.max_per_day,
           cooldown_hours = EXCLUDED.cooldown_hours,
           image_strategy_json = EXCLUDED.image_strategy_json,
           deep_link = EXCLUDED.deep_link,
           buttons = EXCLUDED.buttons,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          seed.key,
          seed.name,
          seed.description,
          seed.dayPart,
          seed.timeWindowStart,
          seed.timeWindowEnd,
          seed.priority,
          JSON.stringify(seed.triggerRule),
          JSON.stringify(seed.audienceRule),
          seed.maxPerDay,
          seed.cooldownHours,
          seed.imageMode,
          JSON.stringify({ tags: seed.imageTags, dayPart: seed.dayPart }),
          seed.deepLinkSection,
          JSON.stringify([{ text: seed.buttonText, section: seed.deepLinkSection }]),
        ]
      );
      const scenarioId = Number(result.rows[0].id);
      for (let index = 0; index < seed.templates.length; index += 1) {
        const template = seed.templates[index];
        const name = `${seed.name} · ${String(index + 1).padStart(2, '0')}`;
        await pool.query(
          `INSERT INTO notification_templates (
             scenario_id, name, slot, target_segment, message_type, title, body, text, button_text,
             deep_link, is_active, sort_order, tags, weight, visual_mode, notes
           )
           VALUES ($1, $2, $3, $4, 'text', $5, $6, $6, $7, $8, TRUE, $9, $10::jsonb, $11, 'none', $12)
           ON CONFLICT DO NOTHING`,
          [
            scenarioId,
            name,
            seed.dayPart === 'reactivation' ? 'custom' : seed.dayPart,
            (seed.audienceRule.segment as string) || null,
            template.title,
            template.body,
            template.buttonText || seed.buttonText,
            seed.deepLinkSection,
            index,
            JSON.stringify(template.tags || []),
            template.weight || 100,
            seed.description,
          ]
        );
      }
    }
  },

  async listScenarios() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT s.*,
              COUNT(t.id)::int AS templates_count,
              COUNT(t.id) FILTER (WHERE t.is_active = TRUE)::int AS active_templates_count,
              MAX(l.sent_at) AS last_sent_at,
              COUNT(l.id) FILTER (WHERE l.status = 'sent')::int AS sent_count,
              COUNT(l.id) FILTER (WHERE l.clicked_at IS NOT NULL)::int AS clicked_count,
              COUNT(l.id) FILTER (WHERE l.status = 'failed')::int AS error_count
       FROM notification_scenarios s
       LEFT JOIN notification_templates t ON t.scenario_id = s.id
       LEFT JOIN notification_logs l ON l.scenario_id = s.id
       GROUP BY s.id
       ORDER BY s.day_part, s.priority DESC, s.id ASC`
    );
    return result.rows.map(serializeNotificationScenario);
  },

  async getScenario(id: number) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT s.*,
              COUNT(t.id)::int AS templates_count,
              COUNT(t.id) FILTER (WHERE t.is_active = TRUE)::int AS active_templates_count,
              MAX(l.sent_at) AS last_sent_at,
              COUNT(l.id) FILTER (WHERE l.status = 'sent')::int AS sent_count,
              COUNT(l.id) FILTER (WHERE l.clicked_at IS NOT NULL)::int AS clicked_count,
              COUNT(l.id) FILTER (WHERE l.status = 'failed')::int AS error_count
       FROM notification_scenarios s
       LEFT JOIN notification_templates t ON t.scenario_id = s.id
       LEFT JOIN notification_logs l ON l.scenario_id = s.id
       WHERE s.id = $1
       GROUP BY s.id`,
      [id]
    );
    return result.rows[0] ? serializeNotificationScenario(result.rows[0]) : null;
  },

  async updateScenario(id: number, payload: Partial<AdminNotificationScenarioPayload>) {
    const pool = getPool();
    const existing = await this.getScenario(id);
    if (!existing) return null;
    const next = {
      name: cleanPayloadText(payload.name ?? existing.name, 200) || existing.name,
      description: cleanPayloadText(payload.description ?? existing.description, 1000),
      enabled: payload.enabled ?? existing.enabled,
      dayPart: payload.dayPart ?? existing.dayPart,
      timeWindowStart: payload.timeWindowStart ?? existing.timeWindowStart,
      timeWindowEnd: payload.timeWindowEnd ?? existing.timeWindowEnd,
      priority: Number(payload.priority ?? existing.priority),
      triggerRuleJson: payload.triggerRuleJson ?? existing.triggerRuleJson,
      audienceRuleJson: payload.audienceRuleJson ?? existing.audienceRuleJson,
      maxPerDay: Number(payload.maxPerDay ?? existing.maxPerDay),
      cooldownHours: Number(payload.cooldownHours ?? existing.cooldownHours),
      imageMode: payload.imageMode ?? existing.imageMode,
      imageStrategyJson: payload.imageStrategyJson ?? existing.imageStrategyJson,
      defaultMediaAssetId: payload.defaultMediaAssetId ?? existing.defaultMediaAssetId,
      deepLink: cleanPayloadText(payload.deepLink ?? existing.deepLink, 2000) || 'today',
      buttons: payload.buttons ?? existing.buttons,
    };
    const result = await pool.query(
      `UPDATE notification_scenarios SET
         name = $2, description = $3, enabled = $4, day_part = $5,
         time_window_start = $6::time, time_window_end = $7::time, priority = $8,
         trigger_rule_json = $9::jsonb, audience_rule_json = $10::jsonb,
         max_per_day = $11, cooldown_hours = $12, image_mode = $13,
         image_strategy_json = $14::jsonb, default_media_asset_id = $15,
         deep_link = $16, buttons = $17::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        next.name,
        next.description,
        next.enabled,
        next.dayPart,
        next.timeWindowStart,
        next.timeWindowEnd,
        next.priority,
        JSON.stringify(next.triggerRuleJson || {}),
        JSON.stringify(next.audienceRuleJson || {}),
        next.maxPerDay,
        next.cooldownHours,
        next.imageMode,
        JSON.stringify(next.imageStrategyJson || {}),
        next.defaultMediaAssetId,
        next.deepLink,
        JSON.stringify(next.buttons || []),
      ]
    );
    return result.rows[0] ? serializeNotificationScenario(result.rows[0]) : null;
  },

  async listTemplates(scenarioId?: number | null) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT t.*, s.key AS scenario_key, a.public_url AS asset_public_url, a.mime_type AS asset_mime_type, a.file_name AS asset_file_name
       FROM notification_templates t
       LEFT JOIN notification_scenarios s ON s.id = t.scenario_id
       LEFT JOIN notification_assets a ON a.id = t.asset_id
       WHERE ($1::bigint IS NULL OR t.scenario_id = $1)
       ORDER BY COALESCE(s.day_part, t.slot), s.priority DESC NULLS LAST, t.sort_order ASC, t.id ASC`,
      [scenarioId ?? null]
    );
    return result.rows.map(serializeEngineTemplate);
  },

  async getTemplate(id: number) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT t.*, s.key AS scenario_key, a.public_url AS asset_public_url, a.mime_type AS asset_mime_type, a.file_name AS asset_file_name
       FROM notification_templates t
       LEFT JOIN notification_scenarios s ON s.id = t.scenario_id
       LEFT JOIN notification_assets a ON a.id = t.asset_id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0] ? serializeEngineTemplate(result.rows[0]) : null;
  },

  async saveTemplate(payload: AdminNotificationTemplatePayload & { id?: number | null }) {
    const pool = getPool();
    const scenarioId = payload.scenarioId != null ? Number(payload.scenarioId) : null;
    const title = cleanPayloadText(payload.title, 500);
    const body = cleanPayloadText(payload.body ?? payload.text, 4000);
    const name = cleanPayloadText(payload.name || title || 'Untitled', 200);
    const buttonText = cleanPayloadText(payload.buttonText || 'Открыть LUMIA', 64);
    const deepLink = cleanPayloadText(payload.deepLink || 'today', 2000);
    const tags = payload.tags || [];
    const slot = cleanPayloadText(payload.slot || 'custom', 32) || 'custom';
    const targetSegment = payload.targetSegment || null;
    const isActive = payload.isActive !== false;
    const visualMode = payload.visualMode || 'none';
    const messageType = visualMode === 'none' ? 'text' : 'photo';
    const assetId = payload.assetId ?? null;
    const weight = Number(payload.weight ?? 100);

    if (payload.id) {
      const result = await pool.query(
        `UPDATE notification_templates SET
           scenario_id = $2, name = $3, slot = $4, target_segment = $5, message_type = $6,
           title = $7, body = $8, text = $8, button_text = $9, deep_link = $10, asset_id = $11,
           is_active = $12, tags = $13::jsonb, weight = $14, visual_mode = $15, notes = $16,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [
          payload.id,
          scenarioId,
          name,
          slot,
          targetSegment,
          messageType,
          title,
          body,
          buttonText,
          deepLink,
          assetId,
          isActive,
          JSON.stringify(tags),
          weight,
          visualMode,
          cleanPayloadText(payload.notes, 2000) || null,
        ]
      );
      return this.getTemplate(Number(result.rows[0]?.id));
    }

    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM notification_templates WHERE scenario_id IS NOT DISTINCT FROM $1`,
      [scenarioId]
    );
    const sortOrder = Number(orderResult.rows[0]?.next_order ?? 0);
    const result = await pool.query(
      `INSERT INTO notification_templates (
         scenario_id, name, slot, target_segment, message_type, title, body, text, button_text, deep_link,
         asset_id, is_active, sort_order, tags, weight, visual_mode, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16)
       RETURNING *`,
      [
        scenarioId,
        name,
        slot,
        targetSegment,
        messageType,
        title,
        body,
        buttonText,
        deepLink,
        assetId,
        isActive,
        sortOrder,
        JSON.stringify(tags),
        weight,
        visualMode,
        cleanPayloadText(payload.notes, 2000) || null,
      ]
    );
    return this.getTemplate(Number(result.rows[0]?.id));
  },

  async deleteTemplate(id: number) {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM notification_templates WHERE id = $1 RETURNING id`, [id]);
    return !!result.rows[0];
  },

  async listAssets() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT a.*,
              ((SELECT COUNT(*)::int FROM notification_templates t WHERE t.asset_id = a.id)
              + (SELECT COUNT(*)::int FROM legacy_notification_templates lt WHERE lt.asset_id = a.id)
              + (SELECT COUNT(*)::int FROM notification_scenarios s WHERE s.default_media_asset_id = a.id)) AS ref_count
       FROM notification_assets a
       ORDER BY a.created_at DESC`
    );
    return result.rows.map(serializeEngineAsset);
  },

  async updateAsset(id: number, payload: Partial<AdminScheduledNotificationAsset>) {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE notification_assets SET
         title = $2, category = $3, tags = $4::jsonb, mood = $5, day_part = $6,
         enabled = $7, cooldown_days = $8, telegram_file_id = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *, 0 AS ref_count`,
      [
        id,
        payload.title != null ? cleanPayloadText(payload.title, 200) : null,
        payload.category || 'day',
        JSON.stringify(payload.tags || []),
        payload.mood != null ? cleanPayloadText(payload.mood, 80) : null,
        payload.dayPart != null ? cleanPayloadText(payload.dayPart, 32) : null,
        payload.enabled !== false,
        Number(payload.cooldownDays ?? 30),
        payload.telegramFileId != null ? cleanPayloadText(payload.telegramFileId, 200) : null,
      ]
    );
    return result.rows[0] ? serializeEngineAsset(result.rows[0]) : null;
  },

  async getStats(): Promise<AdminNotificationEngineStats> {
    const pool = getPool();
    const overview = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
         COUNT(*) FILTER (WHERE status = 'sent')::int AS delivered,
         COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
         COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened_app,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS errors
       FROM notification_logs
       WHERE created_at >= NOW() - INTERVAL '30 days'`
    );
    const scenarios = await pool.query(
      `SELECT scenario_key,
              COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
              COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS errors
       FROM notification_logs
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY scenario_key
       ORDER BY sent DESC
       LIMIT 20`
    );
    const templates = await pool.query(
      `SELECT t.id, COALESCE(NULLIF(t.title, ''), t.name) AS title,
              COUNT(l.id) FILTER (WHERE l.status = 'sent')::int AS sent,
              COUNT(l.id) FILTER (WHERE l.clicked_at IS NOT NULL)::int AS clicked
       FROM notification_templates t
       LEFT JOIN notification_logs l ON l.template_id = t.id AND l.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY t.id
       HAVING COUNT(l.id) > 0
       ORDER BY clicked DESC, sent DESC
       LIMIT 10`
    );
    const row = overview.rows[0] || {};
    const sent = Number(row.sent ?? 0);
    const clicked = Number(row.clicked ?? 0);
    return {
      sent,
      delivered: Number(row.delivered ?? sent),
      clicked,
      ctr: sent > 0 ? clicked / sent : 0,
      checkinCompleted: 0,
      openedApp: Number(row.opened_app ?? 0),
      disabledNotifications: 0,
      errors: Number(row.errors ?? 0),
      byScenario: scenarios.rows.map((item: any) => ({
        scenarioKey: String(item.scenario_key || ''),
        sent: Number(item.sent ?? 0),
        clicked: Number(item.clicked ?? 0),
        ctr: Number(item.sent ?? 0) > 0 ? Number(item.clicked ?? 0) / Number(item.sent ?? 1) : 0,
        errors: Number(item.errors ?? 0),
      })),
      bestTemplates: templates.rows.map((item: any) => ({
        templateId: Number(item.id),
        title: item.title || '',
        sent: Number(item.sent ?? 0),
        clicked: Number(item.clicked ?? 0),
        ctr: Number(item.sent ?? 0) > 0 ? Number(item.clicked ?? 0) / Number(item.sent ?? 1) : 0,
      })),
      worstTemplates: [],
      bestTimeWindows: [],
    };
  },
};
