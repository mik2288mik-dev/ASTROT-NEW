import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminNotificationEngineStats,
  AdminNotificationScenario,
  AdminScheduledNotificationAsset,
  AdminScheduledNotificationTemplate,
  NotificationDayPart,
  UserProfile,
} from '../../../types';
import {
  createEngineNotificationTemplate,
  deleteNotificationAsset,
  deleteScheduledNotificationTemplate,
  fetchEngineNotificationTemplates,
  fetchNotificationAssets,
  fetchNotificationEngineStats,
  fetchNotificationScenarios,
  previewEngineNotification,
  runNotificationEngine,
  sendEngineNotificationTest,
  updateEngineNotificationTemplate,
  updateNotificationAsset,
  updateNotificationScenario,
  uploadNotificationAsset,
} from '../../../services/adminService';
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminInput,
  AdminSectionHeader,
  AdminSelect,
  AdminStateBanner,
  AdminSurface,
  AdminTextarea,
} from '../../../views/admin/AdminPrimitives';

interface NotificationsManagerProps {
  profile: UserProfile;
}

type EngineTab = 'scenarios' | 'templates' | 'media' | 'preview' | 'stats' | 'manual';

const TABS: Array<{ id: EngineTab; label: string }> = [
  { id: 'scenarios', label: 'Сценарии' },
  { id: 'templates', label: 'Шаблоны' },
  { id: 'media', label: 'Медиатека' },
  { id: 'preview', label: 'Предпросмотр' },
  { id: 'stats', label: 'Статистика' },
  { id: 'manual', label: 'Разовая рассылка' },
];

const DAY_PART_LABELS: Record<string, string> = {
  morning: 'утро',
  day: 'день',
  evening: 'вечер',
  reactivation: 'реактивация',
};

const MEDIA_CATEGORIES = [
  'morning',
  'day',
  'evening',
  'pulse',
  'checkin',
  'mini_win',
  'best_time',
  'calm',
  'focus',
  'social',
  'money',
  'weekend',
  'reactivation',
];

const KNOWN_VARIABLES = [
  '{{first_name}}',
  '{{main_title}}',
  '{{short_text}}',
  '{{current_state}}',
  '{{current_state_text}}',
  '{{best_slot_from}}',
  '{{best_slot_to}}',
  '{{best_slot_label}}',
  '{{mini_win}}',
  '{{checkin_streak}}',
  '{{pattern_progress}}',
  '{{good_for}}',
  '{{better_later}}',
  '{{minutes_to_slot}}',
];

function jsonText(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

function parseJsonField(value: string, label: string) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    throw new Error(`${label}: JSON не разобрался`);
  }
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function joinTags(tags?: string[] | null) {
  return (tags || []).join(', ');
}

function pct(value?: number | null) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function dayPartSlot(dayPart?: string | null) {
  return dayPart === 'morning' || dayPart === 'day' || dayPart === 'evening' ? dayPart : 'custom';
}

export const NotificationsManager: React.FC<NotificationsManagerProps> = ({ profile }) => {
  const [tab, setTab] = useState<EngineTab>('scenarios');
  const [scenarios, setScenarios] = useState<AdminNotificationScenario[]>([]);
  const [templates, setTemplates] = useState<AdminScheduledNotificationTemplate[]>([]);
  const [assets, setAssets] = useState<AdminScheduledNotificationAsset[]>([]);
  const [stats, setStats] = useState<AdminNotificationEngineStats | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [scenarioDraft, setScenarioDraft] = useState<AdminNotificationScenario | null>(null);
  const [triggerJson, setTriggerJson] = useState('{}');
  const [audienceJson, setAudienceJson] = useState('{}');
  const [strategyJson, setStrategyJson] = useState('{}');
  const [buttonsJson, setButtonsJson] = useState('[]');
  const [selectedTemplate, setSelectedTemplate] = useState<AdminScheduledNotificationTemplate | null>(null);
  const [templateTags, setTemplateTags] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AdminScheduledNotificationAsset | null>(null);
  const [assetTags, setAssetTags] = useState('');
  const [previewScenarioId, setPreviewScenarioId] = useState<number | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<number | null>(null);
  const [previewDate, setPreviewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [previewTime, setPreviewTime] = useState('09:30');
  const [preview, setPreview] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) || scenarios[0] || null,
    [scenarios, selectedScenarioId]
  );

  const scenarioTemplates = useMemo(
    () => templates.filter((template) => !selectedScenario?.id || template.scenarioId === selectedScenario.id),
    [selectedScenario?.id, templates]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scenarioRows, templateRows, assetRows, statsPayload] = await Promise.all([
        fetchNotificationScenarios(),
        fetchEngineNotificationTemplates(),
        fetchNotificationAssets(),
        fetchNotificationEngineStats(),
      ]);
      setScenarios(scenarioRows);
      setTemplates(templateRows);
      setAssets(assetRows);
      setStats(statsPayload);
      setSelectedScenarioId((prev) => prev || scenarioRows[0]?.id || null);
      setPreviewScenarioId((prev) => prev || scenarioRows[0]?.id || null);
    } catch (loadError: any) {
      setError(loadError?.message || 'Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedScenario) {
      setScenarioDraft(null);
      return;
    }
    setScenarioDraft(selectedScenario);
    setTriggerJson(jsonText(selectedScenario.triggerRuleJson));
    setAudienceJson(jsonText(selectedScenario.audienceRuleJson));
    setStrategyJson(jsonText(selectedScenario.imageStrategyJson));
    setButtonsJson(JSON.stringify(selectedScenario.buttons || [], null, 2));
  }, [selectedScenario]);

  useEffect(() => {
    if (!selectedTemplate && scenarioTemplates[0]) {
      setSelectedTemplate(scenarioTemplates[0]);
    }
  }, [scenarioTemplates, selectedTemplate]);

  useEffect(() => {
    setTemplateTags(joinTags(selectedTemplate?.tags));
  }, [selectedTemplate]);

  useEffect(() => {
    setAssetTags(joinTags(selectedAsset?.tags));
  }, [selectedAsset]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const saveScenario = async () => {
    if (!scenarioDraft) return;
    setSaving(true);
    setError(null);
    try {
      const scenario = await updateNotificationScenario(scenarioDraft.id, {
        name: scenarioDraft.name,
        description: scenarioDraft.description,
        enabled: scenarioDraft.enabled,
        dayPart: scenarioDraft.dayPart,
        timeWindowStart: scenarioDraft.timeWindowStart,
        timeWindowEnd: scenarioDraft.timeWindowEnd,
        priority: scenarioDraft.priority,
        maxPerDay: scenarioDraft.maxPerDay,
        cooldownHours: scenarioDraft.cooldownHours,
        imageMode: scenarioDraft.imageMode,
        defaultMediaAssetId: scenarioDraft.defaultMediaAssetId,
        deepLink: scenarioDraft.deepLink,
        triggerRuleJson: parseJsonField(triggerJson, 'Триггер'),
        audienceRuleJson: parseJsonField(audienceJson, 'Аудитория'),
        imageStrategyJson: parseJsonField(strategyJson, 'Картинки'),
        buttons: parseJsonField(buttonsJson || '[]', 'Кнопки'),
      });
      setScenarios((prev) => prev.map((item) => (item.id === scenario.id ? scenario : item)));
      setToast('Сценарий сохранён');
    } catch (saveError: any) {
      setError(saveError?.message || 'Не удалось сохранить сценарий');
    } finally {
      setSaving(false);
    }
  };

  const newTemplate = () => {
    const scenario = selectedScenario || scenarios[0] || null;
    setSelectedTemplate({
      id: 0,
      scenarioId: scenario?.id ?? null,
      scenarioKey: scenario?.key ?? null,
      name: 'Новый вариант',
      slot: dayPartSlot(scenario?.dayPart) as any,
      targetSegment: null,
      messageType: 'text',
      visualMode: 'none',
      title: 'Сегодня уже собран',
      body: '{{main_title}}\n\n{{short_text}}',
      text: '{{main_title}}\n\n{{short_text}}',
      buttonText: 'Открыть сегодня',
      deepLink: scenario?.deepLink || 'today',
      assetId: null,
      assetPublicUrl: null,
      assetMimeType: null,
      assetFileName: null,
      tags: [],
      weight: 100,
      lastUsedAt: null,
      generatedPreset: null,
      generatedTitle: null,
      generatedSubtitle: null,
      generatedAccent: null,
      generatedShowDate: false,
      generatedShowSlotLabel: false,
      generatedZodiacMode: null,
      generatedCustomZodiac: null,
      isActive: true,
      sortOrder: 0,
      rotationGroup: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        scenarioId: selectedTemplate.scenarioId || selectedScenario?.id || null,
        name: selectedTemplate.name,
        slot: selectedTemplate.slot,
        title: selectedTemplate.title || selectedTemplate.name,
        body: selectedTemplate.body || selectedTemplate.text,
        text: selectedTemplate.body || selectedTemplate.text,
        buttonText: selectedTemplate.buttonText,
        deepLink: selectedTemplate.deepLink,
        assetId: selectedTemplate.assetId,
        isActive: selectedTemplate.isActive,
        tags: splitTags(templateTags),
        weight: selectedTemplate.weight || 100,
        visualMode: selectedTemplate.visualMode,
        notes: selectedTemplate.notes,
      };
      const saved = selectedTemplate.id
        ? await updateEngineNotificationTemplate(selectedTemplate.id, payload)
        : await createEngineNotificationTemplate(payload);
      setSelectedTemplate(saved);
      await loadAll();
      setToast('Шаблон сохранён');
    } catch (saveError: any) {
      setError(saveError?.message || 'Не удалось сохранить шаблон');
    } finally {
      setSaving(false);
    }
  };

  const duplicateTemplate = async (template: AdminScheduledNotificationTemplate) => {
    try {
      const saved = await createEngineNotificationTemplate({
        scenarioId: template.scenarioId,
        name: `${template.name} copy`,
        slot: template.slot,
        title: template.title || template.name,
        body: template.body || template.text,
        text: template.body || template.text,
        buttonText: template.buttonText,
        deepLink: template.deepLink,
        assetId: template.assetId,
        isActive: false,
        tags: template.tags || [],
        weight: template.weight || 100,
        visualMode: template.visualMode,
        notes: template.notes,
      });
      setSelectedTemplate(saved);
      await loadAll();
      setToast('Копия создана');
    } catch (duplicateError: any) {
      setError(duplicateError?.message || 'Не удалось дублировать');
    }
  };

  const saveAsset = async () => {
    if (!selectedAsset) return;
    setSaving(true);
    try {
      const saved = await updateNotificationAsset(selectedAsset.id, {
        ...selectedAsset,
        tags: splitTags(assetTags),
      });
      setAssets((prev) => prev.map((asset) => (asset.id === saved.id ? saved : asset)));
      setSelectedAsset(saved);
      setToast('Картинка сохранена');
    } catch (saveError: any) {
      setError(saveError?.message || 'Не удалось сохранить картинку');
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (file: File | null | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadNotificationAsset(file);
      setAssets((prev) => [asset, ...prev]);
      setSelectedAsset(asset);
      setToast('Картинка загружена');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Не удалось загрузить картинку');
    } finally {
      setUploading(false);
    }
  };

  const runPreview = async () => {
    const scenarioId = previewScenarioId || selectedScenario?.id;
    if (!scenarioId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await previewEngineNotification({
        scenarioId,
        templateId: previewTemplateId || null,
        userId: profile.id,
        date: previewDate,
        time: previewTime,
      });
      setPreview(result.preview);
    } catch (previewError: any) {
      setError(previewError?.message || 'Не удалось собрать preview');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const scenarioId = previewScenarioId || selectedScenario?.id;
    if (!scenarioId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await sendEngineNotificationTest({
        scenarioId,
        templateId: previewTemplateId || null,
        userId: profile.id,
      });
      setToast(`Тест: ${result.successCount}/${result.totalRecipients}, dry-run: ${result.dryRun ? 'да' : 'нет'}`);
      await loadAll();
    } catch (sendError: any) {
      setError(sendError?.message || 'Не удалось отправить тест');
    } finally {
      setSaving(false);
    }
  };

  const runDryEngine = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await runNotificationEngine({ dryRun: true, limit: 25 });
      setToast(`Dry-run: ${result.result?.successCount || 0} sent, ${result.result?.failureCount || 0} failed`);
      await loadAll();
    } catch (runError: any) {
      setError(runError?.message || 'Dry-run не прошёл');
    } finally {
      setSaving(false);
    }
  };

  const scenarioStatusTone = (scenario: AdminNotificationScenario) => {
    if (!scenario.enabled) return 'neutral' as const;
    if (scenario.errorCount > 0) return 'warning' as const;
    return 'success' as const;
  };

  return (
    <div className="space-y-5">
      {toast ? <AdminStateBanner tone="success">{toast}</AdminStateBanner> : null}
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Telegram"
          title="Сценарный движок уведомлений"
          subtitle="Админ включает сценарии, пополняет пул текстов и медиатеку, а система сама выбирает момент, сообщение, картинку и deep link."
          action={(
            <div className="flex flex-wrap gap-2">
              <AdminButton tone="secondary" onClick={() => void loadAll()} disabled={loading}>
                Обновить
              </AdminButton>
              <AdminButton tone="primary" onClick={() => void runDryEngine()} disabled={saving}>
                Dry-run
              </AdminButton>
            </div>
          )}
        />
        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <AdminButton
              key={item.id}
              tone={tab === item.id ? 'primary' : 'secondary'}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </AdminButton>
          ))}
        </div>
      </AdminSurface>

      {tab === 'scenarios' ? (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <AdminSurface className="p-4">
            <div className="space-y-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    setSelectedScenarioId(scenario.id);
                    setPreviewScenarioId(scenario.id);
                  }}
                  className={`admin-surface-muted w-full p-4 text-left transition ${
                    selectedScenario?.id === scenario.id ? 'border-sky-400/35 bg-sky-400/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{scenario.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{scenario.key}</p>
                    </div>
                    <AdminBadge tone={scenarioStatusTone(scenario)}>
                      {scenario.enabled ? 'включено' : 'выключено'}
                    </AdminBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminBadge>{DAY_PART_LABELS[scenario.dayPart] || scenario.dayPart}</AdminBadge>
                    <AdminBadge>{scenario.timeWindowStart}-{scenario.timeWindowEnd}</AdminBadge>
                    <AdminBadge>CTR {pct(scenario.ctr)}</AdminBadge>
                  </div>
                </button>
              ))}
            </div>
          </AdminSurface>

          <AdminSurface className="p-5">
            {!scenarioDraft ? (
              <AdminEmptyState title="Нет сценариев" body="Миграция создаёт базовые сценарии выключенными. Обнови список после миграции." />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="admin-label">Scenario</p>
                    <h3 className="admin-heading mt-2 text-2xl text-white">{scenarioDraft.key}</h3>
                  </div>
                  <AdminButton
                    tone={scenarioDraft.enabled ? 'danger' : 'primary'}
                    onClick={() => setScenarioDraft((prev) => prev ? { ...prev, enabled: !prev.enabled } : prev)}
                  >
                    {scenarioDraft.enabled ? 'Выключить' : 'Включить'}
                  </AdminButton>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-xs text-slate-400">
                    Название
                    <AdminInput value={scenarioDraft.name} onChange={(event) => setScenarioDraft({ ...scenarioDraft, name: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Тип дня
                    <AdminSelect
                      value={scenarioDraft.dayPart}
                      onChange={(event) => setScenarioDraft({ ...scenarioDraft, dayPart: event.target.value as NotificationDayPart })}
                    >
                      <option value="morning">Утро</option>
                      <option value="day">День</option>
                      <option value="evening">Вечер</option>
                      <option value="reactivation">Реактивация</option>
                    </AdminSelect>
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Начало окна
                    <AdminInput type="time" value={scenarioDraft.timeWindowStart} onChange={(event) => setScenarioDraft({ ...scenarioDraft, timeWindowStart: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Конец окна
                    <AdminInput type="time" value={scenarioDraft.timeWindowEnd} onChange={(event) => setScenarioDraft({ ...scenarioDraft, timeWindowEnd: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Приоритет
                    <AdminInput type="number" value={scenarioDraft.priority} onChange={(event) => setScenarioDraft({ ...scenarioDraft, priority: Number(event.target.value) })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Cooldown, часов
                    <AdminInput type="number" value={scenarioDraft.cooldownHours} onChange={(event) => setScenarioDraft({ ...scenarioDraft, cooldownHours: Number(event.target.value) })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Max per day
                    <AdminInput type="number" value={scenarioDraft.maxPerDay} onChange={(event) => setScenarioDraft({ ...scenarioDraft, maxPerDay: Number(event.target.value) })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Deep link section
                    <AdminInput value={scenarioDraft.deepLink} onChange={(event) => setScenarioDraft({ ...scenarioDraft, deepLink: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Image mode
                    <AdminSelect value={String(scenarioDraft.imageMode)} onChange={(event) => setScenarioDraft({ ...scenarioDraft, imageMode: event.target.value })}>
                      <option value="auto">Auto</option>
                      <option value="manual">Manual</option>
                      <option value="none">None</option>
                    </AdminSelect>
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Конкретная картинка
                    <AdminSelect
                      value={scenarioDraft.defaultMediaAssetId ?? ''}
                      onChange={(event) => setScenarioDraft({ ...scenarioDraft, defaultMediaAssetId: event.target.value ? Number(event.target.value) : null })}
                    >
                      <option value="">auto / нет</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>{asset.title || asset.fileName}</option>
                      ))}
                    </AdminSelect>
                  </label>
                </div>

                <label className="space-y-2 text-xs text-slate-400">
                  Описание
                  <AdminTextarea rows={3} value={scenarioDraft.description} onChange={(event) => setScenarioDraft({ ...scenarioDraft, description: event.target.value })} />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-xs text-slate-400">
                    Audience rule JSON
                    <AdminTextarea rows={8} value={audienceJson} onChange={(event) => setAudienceJson(event.target.value)} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Trigger rule JSON
                    <AdminTextarea rows={8} value={triggerJson} onChange={(event) => setTriggerJson(event.target.value)} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Image strategy JSON
                    <AdminTextarea rows={6} value={strategyJson} onChange={(event) => setStrategyJson(event.target.value)} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Buttons JSON
                    <AdminTextarea rows={6} value={buttonsJson} onChange={(event) => setButtonsJson(event.target.value)} />
                  </label>
                </div>

                <div className="flex justify-end">
                  <AdminButton tone="primary" onClick={() => void saveScenario()} disabled={saving}>
                    Сохранить сценарий
                  </AdminButton>
                </div>
              </div>
            )}
          </AdminSurface>
        </div>
      ) : null}

      {tab === 'templates' ? (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <AdminSurface className="p-4">
            <div className="flex items-center justify-between gap-3">
              <AdminSelect
                value={selectedScenario?.id || ''}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  setSelectedScenarioId(id);
                  setSelectedTemplate(null);
                }}
              >
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                ))}
              </AdminSelect>
              <AdminButton tone="primary" onClick={newTemplate}>Новый</AdminButton>
            </div>
            <div className="mt-4 space-y-3">
              {scenarioTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`admin-surface-muted w-full p-4 text-left ${selectedTemplate?.id === template.id ? 'border-sky-400/35 bg-sky-400/10' : ''}`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{template.title || template.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{template.body || template.text}</p>
                    </div>
                    <AdminBadge tone={template.isActive ? 'success' : 'neutral'}>{template.isActive ? 'on' : 'off'}</AdminBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(template.tags || []).slice(0, 4).map((tag) => <AdminBadge key={tag}>{tag}</AdminBadge>)}
                    <AdminBadge>weight {template.weight || 100}</AdminBadge>
                  </div>
                </button>
              ))}
            </div>
          </AdminSurface>

          <AdminSurface className="p-5">
            {!selectedTemplate ? (
              <AdminEmptyState title="Выбери шаблон" body="У каждого сценария должен быть пул из нескольких вариантов, чтобы сообщения не повторялись." />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="admin-label">Template pool</p>
                    <h3 className="admin-heading mt-2 text-2xl text-white">
                      {selectedTemplate.id ? `#${selectedTemplate.id}` : 'Новый шаблон'}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.id ? (
                      <AdminButton tone="secondary" onClick={() => void duplicateTemplate(selectedTemplate)}>
                        Дублировать
                      </AdminButton>
                    ) : null}
                    {selectedTemplate.id ? (
                      <AdminButton
                        tone={selectedTemplate.isActive ? 'danger' : 'primary'}
                        onClick={() => setSelectedTemplate({ ...selectedTemplate, isActive: !selectedTemplate.isActive })}
                      >
                        {selectedTemplate.isActive ? 'Выключить' : 'Включить'}
                      </AdminButton>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-xs text-slate-400">
                    Сценарий
                    <AdminSelect
                      value={selectedTemplate.scenarioId ?? selectedScenario?.id ?? ''}
                      onChange={(event) => setSelectedTemplate({ ...selectedTemplate, scenarioId: Number(event.target.value) })}
                    >
                      {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
                    </AdminSelect>
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Name
                    <AdminInput value={selectedTemplate.name} onChange={(event) => setSelectedTemplate({ ...selectedTemplate, name: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Title
                    <AdminInput value={selectedTemplate.title || ''} onChange={(event) => setSelectedTemplate({ ...selectedTemplate, title: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Button
                    <AdminInput value={selectedTemplate.buttonText} onChange={(event) => setSelectedTemplate({ ...selectedTemplate, buttonText: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Deep link section
                    <AdminInput value={selectedTemplate.deepLink} onChange={(event) => setSelectedTemplate({ ...selectedTemplate, deepLink: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Weight
                    <AdminInput type="number" value={selectedTemplate.weight || 100} onChange={(event) => setSelectedTemplate({ ...selectedTemplate, weight: Number(event.target.value) })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                    Tags
                    <AdminInput value={templateTags} onChange={(event) => setTemplateTags(event.target.value)} placeholder="morning, calm, pulse" />
                  </label>
                </div>

                <label className="space-y-2 text-xs text-slate-400">
                  Body
                  <AdminTextarea
                    rows={10}
                    value={selectedTemplate.body || selectedTemplate.text}
                    onChange={(event) => setSelectedTemplate({ ...selectedTemplate, body: event.target.value, text: event.target.value })}
                  />
                </label>

                <div className="admin-surface-muted p-4">
                  <p className="admin-label">Переменные</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {KNOWN_VARIABLES.map((variable) => (
                      <code key={variable} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-sky-100">{variable}</code>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                  {selectedTemplate.id ? (
                    <AdminButton
                      tone="danger"
                      onClick={async () => {
                        if (!confirm('Удалить шаблон?')) return;
                        await deleteScheduledNotificationTemplate(selectedTemplate.id);
                        setSelectedTemplate(null);
                        await loadAll();
                      }}
                    >
                      Удалить
                    </AdminButton>
                  ) : <span />}
                  <AdminButton tone="primary" onClick={() => void saveTemplate()} disabled={saving}>
                    Сохранить шаблон
                  </AdminButton>
                </div>
              </div>
            )}
          </AdminSurface>
        </div>
      ) : null}

      {tab === 'media' ? (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <AdminSurface className="p-4">
            <label className="block">
              <span className="admin-button admin-button-primary inline-flex cursor-pointer">
                {uploading ? 'Загрузка...' : 'Загрузить картинку'}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAsset(event.target.files?.[0])} />
              </span>
            </label>
            <div className="mt-4 grid gap-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`admin-surface-muted flex gap-3 p-3 text-left ${selectedAsset?.id === asset.id ? 'border-sky-400/35 bg-sky-400/10' : ''}`}
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
                    {asset.publicUrl ? <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{asset.title || asset.fileName}</p>
                    <p className="mt-1 text-xs text-slate-400">{asset.category || 'day'} · cooldown {asset.cooldownDays || 30}d</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(asset.tags || []).slice(0, 3).map((tag) => <AdminBadge key={tag}>{tag}</AdminBadge>)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </AdminSurface>

          <AdminSurface className="p-5">
            {!selectedAsset ? (
              <AdminEmptyState title="Выбери картинку" body="Auto mode берёт картинки по тегам сценария, затем по части дня, затем отправляет без картинки." />
            ) : (
              <div className="space-y-5">
                {selectedAsset.publicUrl ? (
                  <img src={selectedAsset.publicUrl} alt="" className="max-h-[320px] w-full rounded-2xl object-cover" />
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-xs text-slate-400">
                    Title
                    <AdminInput value={selectedAsset.title || ''} onChange={(event) => setSelectedAsset({ ...selectedAsset, title: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Category
                    <AdminSelect value={selectedAsset.category || 'day'} onChange={(event) => setSelectedAsset({ ...selectedAsset, category: event.target.value })}>
                      {MEDIA_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </AdminSelect>
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Day part
                    <AdminSelect value={selectedAsset.dayPart || ''} onChange={(event) => setSelectedAsset({ ...selectedAsset, dayPart: event.target.value || null })}>
                      <option value="">любой</option>
                      <option value="morning">morning</option>
                      <option value="day">day</option>
                      <option value="evening">evening</option>
                      <option value="reactivation">reactivation</option>
                    </AdminSelect>
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Cooldown days
                    <AdminInput type="number" value={selectedAsset.cooldownDays || 30} onChange={(event) => setSelectedAsset({ ...selectedAsset, cooldownDays: Number(event.target.value) })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Telegram file id
                    <AdminInput value={selectedAsset.telegramFileId || ''} onChange={(event) => setSelectedAsset({ ...selectedAsset, telegramFileId: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    Mood
                    <AdminInput value={selectedAsset.mood || ''} onChange={(event) => setSelectedAsset({ ...selectedAsset, mood: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                    Tags
                    <AdminInput value={assetTags} onChange={(event) => setAssetTags(event.target.value)} />
                  </label>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <AdminButton
                    tone={selectedAsset.enabled === false ? 'primary' : 'danger'}
                    onClick={() => setSelectedAsset({ ...selectedAsset, enabled: selectedAsset.enabled === false })}
                  >
                    {selectedAsset.enabled === false ? 'Включить' : 'Выключить'}
                  </AdminButton>
                  <div className="flex gap-2">
                    <AdminButton
                      tone="danger"
                      onClick={async () => {
                        if (!confirm('Удалить картинку?')) return;
                        await deleteNotificationAsset(selectedAsset.id);
                        setSelectedAsset(null);
                        await loadAll();
                      }}
                    >
                      Удалить
                    </AdminButton>
                    <AdminButton tone="primary" onClick={() => void saveAsset()} disabled={saving}>
                      Сохранить
                    </AdminButton>
                  </div>
                </div>
              </div>
            )}
          </AdminSurface>
        </div>
      ) : null}

      {tab === 'preview' ? (
        <AdminSurface className="p-5">
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <label className="space-y-2 text-xs text-slate-400">
                Сценарий
                <AdminSelect value={previewScenarioId || ''} onChange={(event) => setPreviewScenarioId(Number(event.target.value))}>
                  {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
                </AdminSelect>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                Шаблон
                <AdminSelect value={previewTemplateId || ''} onChange={(event) => setPreviewTemplateId(event.target.value ? Number(event.target.value) : null)}>
                  <option value="">auto</option>
                  {templates
                    .filter((template) => !previewScenarioId || template.scenarioId === previewScenarioId)
                    .map((template) => <option key={template.id} value={template.id}>{template.title || template.name}</option>)}
                </AdminSelect>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                Дата
                <AdminInput type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} />
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                Время
                <AdminInput type="time" value={previewTime} onChange={(event) => setPreviewTime(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <AdminButton tone="primary" onClick={() => void runPreview()} disabled={saving}>
                  Сгенерировать
                </AdminButton>
                <AdminButton tone="secondary" onClick={() => void sendTest()} disabled={saving}>
                  Отправить мне
                </AdminButton>
              </div>
            </div>

            <div className="admin-surface-muted p-5">
              {!preview ? (
                <p className="text-sm text-slate-400">Preview покажет payload, подстановки, выбранную картинку и причину выбора сценария.</p>
              ) : preview.status === 'skipped' ? (
                <AdminStateBanner tone="info">Skipped: {preview.reason}</AdminStateBanner>
              ) : (
                <div className="space-y-5">
                  {preview.imageUrl ? <img src={preview.imageUrl} alt="" className="max-h-[260px] w-full rounded-2xl object-cover" /> : null}
                  <div>
                    <p className="text-lg font-semibold text-white">{preview.title}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{preview.body}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminBadge tone="info">{preview.buttonText || 'button'}</AdminBadge>
                    <AdminBadge>{preview.scenario?.key || 'scenario'}</AdminBadge>
                    <AdminBadge>{preview.reason || 'reason'}</AdminBadge>
                  </div>
                  <p className="break-all text-xs leading-5 text-slate-400">{preview.deepLink}</p>
                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer text-slate-200">Подстановки и контекст</summary>
                    <pre className="mt-3 max-h-[340px] overflow-auto rounded-2xl bg-black/30 p-4">{JSON.stringify({ variables: preview.variables, context: preview.context }, null, 2)}</pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </AdminSurface>
      ) : null}

      {tab === 'stats' ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['sent', stats?.sent || 0],
              ['delivered', stats?.delivered || 0],
              ['clicked', stats?.clicked || 0],
              ['CTR', pct(stats?.ctr || 0)],
              ['opened_app', stats?.openedApp || 0],
              ['errors', stats?.errors || 0],
              ['checkin_completed', stats?.checkinCompleted || 0],
              ['disabled', stats?.disabledNotifications || 0],
            ].map(([label, value]) => (
              <AdminSurface key={label} className="p-4">
                <p className="admin-label">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
              </AdminSurface>
            ))}
          </div>
          <AdminSurface className="p-5">
            <AdminSectionHeader title="Сценарии за 30 дней" />
            <div className="mt-5 space-y-3">
              {(stats?.byScenario || []).map((row) => (
                <div key={row.scenarioKey} className="admin-surface-muted flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="text-sm font-semibold text-white">{row.scenarioKey}</span>
                  <div className="flex gap-2">
                    <AdminBadge>{row.sent} sent</AdminBadge>
                    <AdminBadge>{row.clicked} clicks</AdminBadge>
                    <AdminBadge>CTR {pct(row.ctr)}</AdminBadge>
                    {row.errors ? <AdminBadge tone="warning">{row.errors} errors</AdminBadge> : null}
                  </div>
                </div>
              ))}
            </div>
          </AdminSurface>
        </div>
      ) : null}

      {tab === 'manual' ? (
        <AdminSurface className="p-5">
          <AdminSectionHeader
            title="Ручная рассылка остаётся отдельно"
            subtitle="Communication Cockpit не удалён: он нужен для разовых операторских сообщений. Этот экран отвечает за автоматические сценарии, а ручные campaigns живут в прежнем разделе админки."
          />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <AdminBadge tone="info">legacy templates сохранены</AdminBadge>
            <AdminBadge tone="success">manual campaigns работают</AdminBadge>
            <AdminBadge>scheduled autosends выключены миграцией</AdminBadge>
          </div>
        </AdminSurface>
      ) : null}
    </div>
  );
};
