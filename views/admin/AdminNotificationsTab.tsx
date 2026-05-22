import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdminHistoryResultFilter,
  AdminNotificationHistoryItem,
  AdminNotificationModeFilter,
  AdminNotificationTargetSegment,
  AdminNotificationTemplate,
  AdminNotificationTemplateKind,
  AdminScheduledNotificationAsset,
  UserProfile,
} from '../../types';
import {
  createNotificationTemplate,
  fetchNotificationAssets,
  fetchNotificationHistory,
  fetchNotificationTemplates,
  generateAdminNotificationDrafts,
  sendNotification,
  updateNotificationTemplate,
  uploadNotificationAsset,
  type AdminNotificationAiDraftScenario,
  type AdminNotificationAiDraftVariant,
} from '../../services/adminService';
import {
  AdminBadge,
  AdminButton,
  AdminChipButton,
  AdminEmptyState,
  AdminInput,
  AdminPagination,
  AdminSectionHeader,
  AdminSelect,
  AdminStateBanner,
  AdminSurface,
  AdminTextarea,
} from './AdminPrimitives';
import { formatAdminText, getAdminText } from './adminText';

type AdminNotificationSection = 'send' | 'templates' | 'history';

interface AdminNotificationsTabProps {
  profile: UserProfile;
  section: AdminNotificationSection;
  initialTargetUserId?: string;
  onClearInitialTarget?: () => void;
  onChangeSection?: (section: AdminNotificationSection) => void;
}

const SEGMENTS: AdminNotificationTargetSegment[] = [
  'all',
  'premium',
  'free',
  'lumi',
  'active_7d',
  'inactive_3d',
  'inactive_7d',
  'inactive_30d',
  'need_attention',
  'new_user_no_birth_data',
  'birth_data_no_time',
  'free_natal_ready_not_opened',
  'free_natal_opened_no_premium',
  'daily_active_free',
  'daily_active_premium',
  'inactive_2_days',
  'inactive_14_days',
  'love_interested',
  'money_interested',
  'work_interested',
  'assistant_user',
  'high_intent_premium',
];
const KINDS: Array<AdminNotificationTemplateKind | 'all'> = ['all', 'both', 'personal', 'broadcast'];
const HISTORY_MODES: AdminNotificationModeFilter[] = ['all', 'personal', 'broadcast'];
const HISTORY_RESULTS: AdminHistoryResultFilter[] = ['all', 'success', 'partial', 'failed'];
const PRESETS = ['Утро', 'День', 'Вечер', 'Возвращение', 'Premium', 'Lumi'];
const WORKSPACE_SECTIONS: AdminNotificationSection[] = ['send', 'templates', 'history'];
const AI_DRAFT_SCENARIOS: Array<{
  value: AdminNotificationAiDraftScenario;
  labelRu: string;
  labelEn: string;
  hintRu: string;
  hintEn: string;
}> = [
  {
    value: 'morning',
    labelRu: 'Утро',
    labelEn: 'Morning',
    hintRu: 'Утренний вход: гороскоп дня и дневная натальная карта.',
    hintEn: 'Morning entry: daily horoscope and daily natal reading.',
  },
  {
    value: 'day',
    labelRu: 'День',
    labelEn: 'Day',
    hintRu: 'Дневной возврат в приложение и уточнение фокуса.',
    hintEn: 'Midday return to the app with a sharper focus.',
  },
  {
    value: 'evening',
    labelRu: 'Вечер',
    labelEn: 'Evening',
    hintRu: 'Спокойное вечернее закрытие дня и вывод.',
    hintEn: 'A calm evening close and final insight.',
  },
  {
    value: 'daily_lumi',
    labelRu: 'Ежедневные Lumi',
    labelEn: 'Daily Lumi',
    hintRu: 'Напомнить зайти и забрать ежедневные Lumi.',
    hintEn: 'Remind the user to collect daily Lumi.',
  },
  {
    value: 'upsell',
    labelRu: 'Полный день',
    labelEn: 'Full day upsell',
    hintRu: 'Продать полный и точный разбор дня через Premium или разовый Lumi unlock.',
    hintEn: 'Sell the full precise day reading through Premium or a one-off Lumi unlock.',
  },
  {
    value: 'promo',
    labelRu: 'Промо',
    labelEn: 'Promo',
    hintRu: 'Промо paid-разборов, совместимости и глубоких материалов.',
    hintEn: 'Promote paid readings, compatibility, and deeper materials.',
  },
  {
    value: 'reactivation',
    labelRu: 'Возврат',
    labelEn: 'Reactivation',
    hintRu: 'Вернуть неактивного пользователя обратно в Lumia.',
    hintEn: 'Bring an inactive user back into Lumia.',
  },
  {
    value: 'custom',
    labelRu: 'Свой сценарий',
    labelEn: 'Custom',
    hintRu: 'Полностью свой сценарий по короткому запросу.',
    hintEn: 'A fully custom scenario from a short brief.',
  },
];

const templateDraft = {
  id: null as number | null,
  title: '',
  bodyRu: '',
  bodyEn: '',
  kind: 'both' as AdminNotificationTemplateKind,
  assetId: null as number | null,
  isActive: true,
};

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : getAdminText(lang, 'no_data');

const segmentLabel = (lang: 'ru' | 'en', value: AdminNotificationTargetSegment) => {
  const labels: Record<AdminNotificationTargetSegment, string> = {
    all: getAdminText(lang, 'segment_all'),
    premium: getAdminText(lang, 'segment_premium'),
    free: getAdminText(lang, 'segment_free'),
    lumi: getAdminText(lang, 'segment_lumi'),
    active_7d: getAdminText(lang, 'segment_active_7d'),
    inactive_3d: getAdminText(lang, 'segment_inactive_3d'),
    inactive_7d: getAdminText(lang, 'segment_inactive_7d'),
    inactive_30d: getAdminText(lang, 'segment_inactive_30d'),
    need_attention: getAdminText(lang, 'segment_attention'),
    new_user_no_birth_data: lang === 'ru' ? 'Нет данных рождения' : 'No birth data',
    birth_data_no_time: lang === 'ru' ? 'Нет времени рождения' : 'No birth time',
    free_natal_ready_not_opened: lang === 'ru' ? 'Карта готова' : 'Natal ready',
    free_natal_opened_no_premium: lang === 'ru' ? 'Карта открыта, free' : 'Natal opened, free',
    daily_active_free: lang === 'ru' ? 'Активные free' : 'Active free',
    daily_active_premium: lang === 'ru' ? 'Активные premium' : 'Active premium',
    inactive_2_days: lang === 'ru' ? 'Неактивны 2 дня' : 'Inactive 2 days',
    inactive_14_days: lang === 'ru' ? 'Неактивны 14 дней' : 'Inactive 14 days',
    love_interested: lang === 'ru' ? 'Интерес: любовь' : 'Interest: love',
    money_interested: lang === 'ru' ? 'Интерес: деньги' : 'Interest: money',
    work_interested: lang === 'ru' ? 'Интерес: работа' : 'Interest: work',
    assistant_user: lang === 'ru' ? 'Помощник' : 'Assistant users',
    high_intent_premium: lang === 'ru' ? 'Premium intent' : 'Premium intent',
  };
  return labels[value];
};

const kindLabel = (lang: 'ru' | 'en', value: AdminNotificationTemplateKind | 'all') =>
  value === 'all'
    ? getAdminText(lang, 'filter_all')
    : value === 'both'
      ? lang === 'ru'
        ? 'Личное и массовое'
        : 'Personal and broadcast'
      : getAdminText(lang, value);

const historyTone = (item: AdminNotificationHistoryItem) =>
  (item.failedCount > 0 ? (item.successCount > 0 ? 'warning' : 'danger') : 'success') as
    | 'warning'
    | 'danger'
    | 'success';

const workspaceLabel = (lang: 'ru' | 'en', section: AdminNotificationSection) => {
  if (section === 'send') return getAdminText(lang, 'send_title');
  if (section === 'templates') return getAdminText(lang, 'templates_title');
  return getAdminText(lang, 'history_title');
};

const workspaceBlurb = (lang: 'ru' | 'en', section: AdminNotificationSection) => {
  if (section === 'send') {
    return lang === 'ru'
      ? 'Собирай рассылку здесь же: аудитория, шаблон, визуал и мгновенный preview в одном экране.'
      : 'Build the send here: audience, template, visual, and instant preview in one screen.';
  }
  if (section === 'templates') {
    return lang === 'ru'
      ? 'Шаблоны находятся рядом с отправкой, чтобы брать, править и запускать их без лишних переходов.'
      : 'Templates sit next to the send flow so they can be reused, edited, and launched without context switching.';
  }
  return lang === 'ru'
    ? 'История не уводит из рабочего контекста: результат отправок и повтор кампаний всегда под рукой.'
    : 'History stays inside the working context so results and campaign reuse remain one click away.';
};

const workspaceMetricTone = (section: AdminNotificationSection): 'info' | 'neutral' | 'success' => {
  if (section === 'send') return 'info';
  if (section === 'templates') return 'neutral';
  return 'success';
};

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({
  profile,
  section,
  initialTargetUserId,
  onClearInitialTarget,
  onChangeSection,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const inputRef = useRef<HTMLInputElement>(null);

  const [workspaceSection, setWorkspaceSection] = useState<AdminNotificationSection>(section);
  const [templates, setTemplates] = useState<AdminNotificationTemplate[]>([]);
  const [assets, setAssets] = useState<AdminScheduledNotificationAsset[]>([]);
  const [history, setHistory] = useState<AdminNotificationHistoryItem[]>([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState({ templates: true, assets: true, history: true });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [mode, setMode] = useState<'personal' | 'broadcast'>(initialTargetUserId ? 'personal' : 'broadcast');
  const [targetUserId, setTargetUserId] = useState(initialTargetUserId || '');
  const [targetSegment, setTargetSegment] = useState<AdminNotificationTargetSegment>('all');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [assetId, setAssetId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [bodyRu, setBodyRu] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [aiScenario, setAiScenario] = useState<AdminNotificationAiDraftScenario>('morning');
  const [aiBrief, setAiBrief] = useState('');
  const [aiDrafts, setAiDrafts] = useState<AdminNotificationAiDraftVariant[]>([]);
  const [aiSource, setAiSource] = useState<'openai' | 'fallback' | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<AdminNotificationTemplateKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [draft, setDraft] = useState(templateDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyMode, setHistoryMode] = useState<AdminNotificationModeFilter>('all');
  const [historyResult, setHistoryResult] = useState<AdminHistoryResultFilter>('all');
  const [expandedFailures, setExpandedFailures] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setWorkspaceSection(section);
  }, [section]);

  const focusSection = useCallback(
    (nextSection: AdminNotificationSection) => {
      setWorkspaceSection(nextSection);
      onChangeSection?.(nextSection);
    },
    [onChangeSection]
  );

  const loadTemplates = useCallback(async () => {
    setLoading((prev) => ({ ...prev, templates: true }));
    try {
      setTemplates(await fetchNotificationTemplates());
    } catch (e: any) {
      setError(e?.message || getAdminText(lang, 'notifications_failed'));
    } finally {
      setLoading((prev) => ({ ...prev, templates: false }));
    }
  }, [lang]);

  const loadAssets = useCallback(async () => {
    setLoading((prev) => ({ ...prev, assets: true }));
    try {
      setAssets(await fetchNotificationAssets());
    } catch (e: any) {
      setError(e?.message || getAdminText(lang, 'select_asset_failed'));
    } finally {
      setLoading((prev) => ({ ...prev, assets: false }));
    }
  }, [lang]);

  const loadHistory = useCallback(
    async (page = historyPagination.page) => {
      setLoading((prev) => ({ ...prev, history: true }));
      try {
        const payload = await fetchNotificationHistory({
          page,
          pageSize: historyPagination.pageSize,
          mode: historyMode,
          result: historyResult,
        });
        setHistory(payload.history);
        setHistoryPagination(payload.pagination);
      } catch (e: any) {
        setError(e?.message || getAdminText(lang, 'notifications_failed'));
      } finally {
        setLoading((prev) => ({ ...prev, history: false }));
      }
    },
    [historyMode, historyPagination.page, historyPagination.pageSize, historyResult, lang]
  );

  useEffect(() => {
    void loadTemplates();
    void loadAssets();
  }, [loadAssets, loadTemplates]);

  useEffect(() => {
    void loadHistory(historyPagination.page);
  }, [historyMode, historyPagination.page, historyPagination.pageSize, historyResult, loadHistory]);

  useEffect(() => {
    if (!initialTargetUserId) return;
    setMode('personal');
    setTargetUserId(initialTargetUserId);
    setWorkspaceSection('send');
    onClearInitialTarget?.();
  }, [initialTargetUserId, onClearInitialTarget]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (kindFilter !== 'all' && template.kind !== kindFilter) return false;
        if (statusFilter === 'active' && !template.isActive) return false;
        if (statusFilter === 'disabled' && template.isActive) return false;
        if (!search.trim()) return true;
        return template.title.toLowerCase().includes(search.trim().toLowerCase());
      }),
    [kindFilter, search, statusFilter, templates]
  );

  const selectedAsset = assets.find((asset) => asset.id === assetId) || null;
  const selectedTemplate = templates.find((item) => item.id === templateId) || null;
  const selectedAiScenario =
    AI_DRAFT_SCENARIOS.find((item) => item.value === aiScenario) || AI_DRAFT_SCENARIOS[0];
  const activeTemplates = templates.filter((t) => t.isActive && (t.kind === 'both' || t.kind === mode));
  const visibleTemplates = workspaceSection === 'templates' ? filteredTemplates : filteredTemplates.slice(0, 6);
  const visibleHistory = workspaceSection === 'history' ? history : history.slice(0, 6);

  const panelOrder = useMemo(() => {
    const ordered: AdminNotificationSection[] = [workspaceSection];
    for (const item of WORKSPACE_SECTIONS) {
      if (item !== workspaceSection) ordered.push(item);
    }
    return ordered;
  }, [workspaceSection]);

  const applyCompose = (payload: {
    mode: 'personal' | 'broadcast';
    targetUserId?: string | null;
    targetSegment?: AdminNotificationTargetSegment | null;
    templateId?: number | null;
    assetId?: number | null;
    title: string;
    bodyRu: string;
    bodyEn: string;
  }) => {
    setMode(payload.mode);
    setTargetUserId(payload.targetUserId || '');
    setTargetSegment(payload.targetSegment || 'all');
    setTemplateId(payload.templateId ?? null);
    setAssetId(payload.assetId ?? null);
    setTitle(payload.title);
    setBodyRu(payload.bodyRu);
    setBodyEn(payload.bodyEn);
    setError(null);
    setMessage(null);
  };

  const useTemplate = (template: AdminNotificationTemplate) => {
    applyCompose({
      mode: template.kind === 'personal' || template.kind === 'broadcast' ? template.kind : mode,
      targetUserId,
      targetSegment,
      templateId: template.id,
      assetId: template.assetId ?? null,
      title: template.title,
      bodyRu: template.bodyRu,
      bodyEn: template.bodyEn,
    });
    focusSection('send');
  };

  const reuseCampaign = (item: AdminNotificationHistoryItem) => {
    applyCompose({
      mode: item.mode,
      targetUserId: item.targetUserId,
      targetSegment: item.targetSegment,
      templateId: item.templateId,
      assetId: item.assetId ?? null,
      title: item.title,
      bodyRu: item.bodyRu,
      bodyEn: item.bodyEn,
    });
    focusSection('send');
  };

  const saveTemplate = async () => {
    if (!draft.title.trim()) return setError(getAdminText(lang, 'template_title_required'));
    if (!draft.bodyRu.trim() && !draft.bodyEn.trim()) return setError(getAdminText(lang, 'body_required'));
    setBusy('template');
    try {
      const payload = {
        title: draft.title.trim(),
        bodyRu: draft.bodyRu.trim(),
        bodyEn: draft.bodyEn.trim(),
        kind: draft.kind,
        assetId: draft.assetId,
        isActive: draft.isActive,
      };
      if (draft.id) {
        await updateNotificationTemplate(draft.id, payload);
      } else {
        await createNotificationTemplate(payload);
      }
      await loadTemplates();
      setEditorOpen(false);
      setDraft(templateDraft);
    } catch (e: any) {
      setError(e?.message || getAdminText(lang, 'template_save_failed'));
    } finally {
      setBusy(null);
    }
  };

  const uploadAsset = async (file: File, target: 'compose' | 'template') => {
    setBusy(`upload-${target}`);
    try {
      const asset = await uploadNotificationAsset(file);
      setAssets((prev) => [asset, ...prev]);
      if (target === 'compose') {
        setAssetId(asset.id);
      } else {
        setDraft((prev) => ({ ...prev, assetId: asset.id }));
      }
    } catch (e: any) {
      setError(e?.message || getAdminText(lang, 'notification_send_failed'));
    } finally {
      setBusy(null);
    }
  };

  const doSend = async () => {
    if (!title.trim()) return setError(getAdminText(lang, 'notification_title_required'));
    if (!bodyRu.trim() && !bodyEn.trim()) return setError(getAdminText(lang, 'body_required'));
    if (mode === 'personal' && !targetUserId.trim()) return setError(getAdminText(lang, 'target_user_required'));
    setBusy('send');
    try {
      const result = await sendNotification({
        mode,
        targetUserId: mode === 'personal' ? targetUserId.trim() : null,
        targetSegment: mode === 'broadcast' ? targetSegment : null,
        templateId,
        assetId,
        title: title.trim(),
        bodyRu: bodyRu.trim(),
        bodyEn: bodyEn.trim(),
      });
      setMessage(
        formatAdminText(lang, 'send_success', {
          success: result.campaign.successCount,
          total: result.campaign.totalRecipients,
        })
      );
      setHistory((prev) => [result.campaign, ...prev].slice(0, historyPagination.pageSize));
      setError(null);
    } catch (e: any) {
      setError(e?.message || getAdminText(lang, 'notification_send_failed'));
    } finally {
      setBusy(null);
    }
  };

  const generateAiDrafts = async () => {
    if (aiScenario === 'custom' && !aiBrief.trim()) {
      setError(
        lang === 'ru'
          ? 'Для своего сценария добавь короткий запрос.'
          : 'Add a short brief for the custom scenario.'
      );
      return;
    }

    setBusy('ai-drafts');
    setError(null);
    setMessage(null);
    try {
      const result = await generateAdminNotificationDrafts({
        mode,
        targetSegment: mode === 'broadcast' ? targetSegment : null,
        scenario: aiScenario,
        brief: aiBrief.trim() || undefined,
      });
      setAiDrafts(result.variants);
      setAiSource(result.source);
      setAiModel(result.model);
      setMessage(
        lang === 'ru'
          ? 'AI подготовил 3 варианта. Сначала посмотри, потом вставь лучший в compose.'
          : 'AI prepared 3 variants. Review them first, then insert the best one into compose.'
      );
    } catch (e: any) {
      setError(
        e?.message || (lang === 'ru' ? 'Не удалось сгенерировать варианты.' : 'Failed to generate variants.')
      );
    } finally {
      setBusy(null);
    }
  };

  const insertAiDraft = (variant: AdminNotificationAiDraftVariant) => {
    applyCompose({
      mode,
      targetUserId,
      targetSegment,
      templateId: null,
      assetId,
      title: variant.title,
      bodyRu: variant.bodyRu,
      bodyEn: variant.bodyEn,
    });
    setMessage(
      lang === 'ru'
        ? `Вариант «${variant.label}» перенесён в compose.`
        : `Variant "${variant.label}" has been inserted into compose.`
    );
  };

  const saveAiDraftAsTemplate = async (variant: AdminNotificationAiDraftVariant, index: number) => {
    setBusy(`ai-save-${index}`);
    setError(null);
    setMessage(null);
    try {
      await createNotificationTemplate({
        title: variant.title,
        bodyRu: variant.bodyRu,
        bodyEn: variant.bodyEn,
        kind: mode,
        assetId,
        isActive: true,
      });
      await loadTemplates();
      setMessage(
        lang === 'ru'
          ? `Шаблон «${variant.title}» сохранён.`
          : `Template "${variant.title}" has been saved.`
      );
    } catch (e: any) {
      setError(
        e?.message || (lang === 'ru' ? 'Не удалось сохранить AI-вариант как шаблон.' : 'Failed to save the AI draft as a template.')
      );
    } finally {
      setBusy(null);
    }
  };

  const previewTargetSummary =
    mode === 'personal'
      ? `${getAdminText(lang, 'personal')}: ${targetUserId || '—'}`
      : `${getAdminText(lang, 'broadcast')}: ${segmentLabel(lang, targetSegment)}`;

  const sendPanel = (
    <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
      <AdminSectionHeader
        eyebrow="Send"
        title={getAdminText(lang, 'send_title')}
        subtitle={workspaceBlurb(lang, 'send')}
        action={
          <div className="flex flex-wrap gap-2">
            <AdminButton tone="secondary" onClick={() => focusSection('templates')}>
              {getAdminText(lang, 'section_templates')}
            </AdminButton>
            <AdminButton tone="secondary" onClick={() => focusSection('history')}>
              {getAdminText(lang, 'section_history')}
            </AdminButton>
          </div>
        }
      />

      <div className="mt-5 grid gap-5 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="admin-surface-muted p-4">
            <p className="admin-label">{getAdminText(lang, 'audience')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminChipButton active={mode === 'personal'} onClick={() => setMode('personal')}>
                {getAdminText(lang, 'personal')}
              </AdminChipButton>
              <AdminChipButton active={mode === 'broadcast'} onClick={() => setMode('broadcast')}>
                {getAdminText(lang, 'broadcast')}
              </AdminChipButton>
            </div>
            <div className="mt-4">
              {mode === 'personal' ? (
                <AdminInput
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder={getAdminText(lang, 'target_user')}
                />
              ) : (
                <AdminSelect
                  value={targetSegment}
                  onChange={(e) => setTargetSegment(e.target.value as AdminNotificationTargetSegment)}
                >
                  {SEGMENTS.map((item) => (
                    <option key={item} value={item}>
                      {segmentLabel(lang, item)}
                    </option>
                  ))}
                </AdminSelect>
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{previewTargetSummary}</p>
          </div>

          <div className="admin-surface-muted p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="admin-label">{getAdminText(lang, 'message_source')}</p>
              <AdminBadge tone="neutral">{activeTemplates.length}</AdminBadge>
            </div>
            <div className="mt-3 space-y-3">
              <AdminSelect
                value={templateId ?? ''}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  if (!rawValue) {
                    setTemplateId(null);
                    return;
                  }
                  const value = Number(rawValue);
                  const template = templates.find((item) => item.id === value);
                  if (!template) {
                    setTemplateId(null);
                    return;
                  }
                  useTemplate(template);
                }}
              >
                <option value="">{getAdminText(lang, 'no_template')}</option>
                {activeTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </AdminSelect>
              {selectedTemplate ? (
                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminBadge tone="info">{kindLabel(lang, selectedTemplate.kind)}</AdminBadge>
                    <AdminBadge tone={selectedTemplate.isActive ? 'success' : 'neutral'}>
                      {selectedTemplate.isActive
                        ? getAdminText(lang, 'template_active')
                        : getAdminText(lang, 'template_disabled')}
                    </AdminBadge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{selectedTemplate.title}</p>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">
                    {selectedTemplate.bodyRu || selectedTemplate.bodyEn}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="admin-surface-muted p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="admin-label">{getAdminText(lang, 'choose_image')}</p>
              <AdminButton tone="ghost" className="min-h-[2.35rem] px-0 text-xs" onClick={() => void loadAssets()}>
                {getAdminText(lang, 'refresh')}
              </AdminButton>
            </div>
            <div className="mt-3 space-y-3">
              <AdminSelect
                value={assetId ?? ''}
                onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{getAdminText(lang, 'no_image')}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.fileName}
                  </option>
                ))}
              </AdminSelect>
              <AdminButton
                tone="secondary"
                disabled={busy === 'upload-compose'}
                onClick={() => inputRef.current?.click()}
              >
                {getAdminText(lang, 'upload_image')}
              </AdminButton>
              {selectedAsset ? (
                <div className="overflow-hidden rounded-[18px] border border-white/10">
                  <img
                    src={selectedAsset.publicUrl}
                    alt={selectedAsset.fileName}
                    className="h-44 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                  {getAdminText(lang, 'no_image')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="admin-surface-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="admin-label">AI Draft Helper</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {lang === 'ru'
                    ? 'Сценарий плюс короткий запрос: AI соберёт 3 варианта, а ты выберешь лучший и только потом вставишь его в compose.'
                    : 'Scenario plus a short brief: AI prepares 3 variants, and you choose the best one before inserting it into compose.'}
                </p>
              </div>
              <AdminBadge tone={aiSource === 'fallback' ? 'warning' : 'info'}>
                {busy === 'ai-drafts'
                  ? lang === 'ru'
                    ? 'ГЕНЕРАЦИЯ'
                    : 'GENERATING'
                  : aiSource === 'fallback'
                    ? 'Fallback'
                    : aiSource === 'openai'
                      ? 'OpenAI'
                      : '3x'}
              </AdminBadge>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_auto]">
              <AdminSelect
                value={aiScenario}
                onChange={(e) => setAiScenario(e.target.value as AdminNotificationAiDraftScenario)}
              >
                {AI_DRAFT_SCENARIOS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {lang === 'ru' ? item.labelRu : item.labelEn}
                  </option>
                ))}
              </AdminSelect>
              <AdminInput
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
                placeholder={
                  lang === 'ru'
                    ? 'Короткий запрос: например, мягче для free или акцент на полный день'
                    : 'Short brief: for example softer for free users or more focus on the full day'
                }
              />
              <AdminButton tone="primary" disabled={busy === 'ai-drafts'} onClick={() => void generateAiDrafts()}>
                {busy === 'ai-drafts'
                  ? lang === 'ru'
                    ? 'Собираем…'
                    : 'Generating…'
                  : lang === 'ru'
                    ? 'Сгенерировать'
                    : 'Generate'}
              </AdminButton>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              {lang === 'ru' ? selectedAiScenario.hintRu : selectedAiScenario.hintEn}
              {aiModel ? ` · ${aiModel}` : ''}
              {aiSource === 'fallback'
                ? lang === 'ru'
                  ? ' · Показан fallback, если AI сейчас недоступен.'
                  : ' · Fallback is shown if AI is unavailable right now.'
                : ''}
            </p>

            {aiDrafts.length > 0 ? (
              <div className="mt-4 space-y-3">
                {aiDrafts.map((variant, index) => (
                  <div
                    key={`${variant.label}-${variant.title}-${index}`}
                    className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminBadge tone="info">{variant.label}</AdminBadge>
                          <AdminBadge tone="neutral">{variant.title}</AdminBadge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton tone="secondary" onClick={() => insertAiDraft(variant)}>
                          {lang === 'ru' ? 'Вставить в compose' : 'Insert into compose'}
                        </AdminButton>
                        <AdminButton
                          tone="ghost"
                          disabled={busy === `ai-save-${index}`}
                          onClick={() => void saveAiDraftAsTemplate(variant, index)}
                        >
                          {busy === `ai-save-${index}`
                            ? lang === 'ru'
                              ? 'Сохраняем…'
                              : 'Saving…'
                            : lang === 'ru'
                              ? 'Сохранить как шаблон'
                              : 'Save as template'}
                        </AdminButton>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <PreviewPane label="RU" value={variant.bodyRu} />
                      <PreviewPane label="EN" value={variant.bodyEn} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="admin-surface-muted p-4">
            <p className="admin-label">{getAdminText(lang, 'content_preview')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <AdminChipButton key={preset} onClick={() => setTitle(preset)}>
                  {preset}
                </AdminChipButton>
              ))}
            </div>
            <div className="mt-4">
              <AdminInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={getAdminText(lang, 'title')}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <label className="admin-field-label">RU</label>
              <AdminTextarea
                rows={10}
                value={bodyRu}
                onChange={(e) => setBodyRu(e.target.value)}
                placeholder={getAdminText(lang, 'body_ru')}
              />
            </div>
            <div>
              <label className="admin-field-label">EN</label>
              <AdminTextarea
                rows={10}
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                placeholder={getAdminText(lang, 'body_en')}
              />
            </div>
          </div>

          <div className="admin-sticky-footer rounded-[22px] border border-sky-400/20 bg-[#081120]/92 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-6 text-slate-300">{message ? message : previewTargetSummary}</div>
              <AdminButton tone="primary" disabled={busy === 'send'} onClick={() => void doSend()}>
                {busy === 'send' ? getAdminText(lang, 'sending') : getAdminText(lang, 'send_now')}
              </AdminButton>
            </div>
          </div>
        </div>
      </div>
    </AdminSurface>
  );

  const templatesPanel = (
    <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
      <AdminSectionHeader
        eyebrow="Templates"
        title={getAdminText(lang, 'templates_title')}
        subtitle={workspaceBlurb(lang, 'templates')}
        action={
          <div className="flex flex-wrap gap-2">
            {workspaceSection !== 'templates' ? (
              <AdminButton tone="secondary" onClick={() => focusSection('templates')}>
                {lang === 'ru' ? 'Фокус' : 'Focus'}
              </AdminButton>
            ) : null}
            <AdminButton
              tone="primary"
              onClick={() => {
                setDraft(templateDraft);
                setEditorOpen(true);
              }}
            >
              {getAdminText(lang, 'template_new')}
            </AdminButton>
          </div>
        }
      />

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <AdminInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={getAdminText(lang, 'search_users')}
        />
        <AdminSelect
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as AdminNotificationTemplateKind | 'all')}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kindLabel(lang, kind)}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'disabled')}
        >
          <option value="all">{getAdminText(lang, 'result_all')}</option>
          <option value="active">{getAdminText(lang, 'template_active')}</option>
          <option value="disabled">{getAdminText(lang, 'template_disabled')}</option>
        </AdminSelect>
      </div>

      {loading.templates ? (
        <div className="mt-6 text-sm text-slate-400">{getAdminText(lang, 'notifications_failed')}</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="mt-6">
          <AdminEmptyState
            title={getAdminText(lang, 'templates_empty')}
            body={getAdminText(lang, 'templates_subtitle')}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {visibleTemplates.map((template) => (
            <div key={template.id} className="admin-surface-muted overflow-hidden">
              {template.assetPublicUrl ? (
                <img src={template.assetPublicUrl} alt={template.title} className="h-36 w-full object-cover" />
              ) : null}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{template.title}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminBadge tone="neutral">{kindLabel(lang, template.kind)}</AdminBadge>
                      <AdminBadge tone={template.isActive ? 'success' : 'neutral'}>
                        {template.isActive
                          ? getAdminText(lang, 'template_active')
                          : getAdminText(lang, 'template_disabled')}
                      </AdminBadge>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(lang, template.updatedAt)}</div>
                </div>
                <div className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">
                  {template.bodyRu || template.bodyEn}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <AdminButton tone="primary" onClick={() => useTemplate(template)}>
                    {getAdminText(lang, 'template_use')}
                  </AdminButton>
                  <AdminButton
                    tone="secondary"
                    onClick={() => {
                      setDraft({
                        id: template.id,
                        title: template.title,
                        bodyRu: template.bodyRu,
                        bodyEn: template.bodyEn,
                        kind: template.kind,
                        assetId: template.assetId ?? null,
                        isActive: template.isActive,
                      });
                      setEditorOpen(true);
                    }}
                  >
                    {getAdminText(lang, 'template_edit')}
                  </AdminButton>
                  <AdminButton
                    tone="secondary"
                    onClick={() => {
                      setDraft({
                        id: null,
                        title: `${template.title} Copy`,
                        bodyRu: template.bodyRu,
                        bodyEn: template.bodyEn,
                        kind: template.kind,
                        assetId: template.assetId ?? null,
                        isActive: template.isActive,
                      });
                      setEditorOpen(true);
                    }}
                  >
                    {getAdminText(lang, 'template_duplicate')}
                  </AdminButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {workspaceSection !== 'templates' && filteredTemplates.length > visibleTemplates.length ? (
        <div className="mt-5">
          <AdminButton tone="secondary" onClick={() => focusSection('templates')}>
            {lang === 'ru' ? 'Открыть всю библиотеку шаблонов' : 'Open full template library'}
          </AdminButton>
        </div>
      ) : null}
    </AdminSurface>
  );

  const historyPanel = (
    <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
      <AdminSectionHeader
        eyebrow="History"
        title={getAdminText(lang, 'history_title')}
        subtitle={workspaceBlurb(lang, 'history')}
        action={
          <div className="flex flex-wrap gap-2">
            {workspaceSection !== 'history' ? (
              <AdminButton tone="secondary" onClick={() => focusSection('history')}>
                {lang === 'ru' ? 'Фокус' : 'Focus'}
              </AdminButton>
            ) : null}
            <AdminButton tone="secondary" onClick={() => void loadHistory(historyPagination.page)}>
              {getAdminText(lang, 'refresh')}
            </AdminButton>
          </div>
        }
      />

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <AdminSelect
          value={historyMode}
          onChange={(e) => {
            setHistoryMode(e.target.value as AdminNotificationModeFilter);
            setHistoryPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          {HISTORY_MODES.map((item) => (
            <option key={item} value={item}>
              {item === 'all' ? getAdminText(lang, 'result_all') : getAdminText(lang, item)}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect
          value={historyResult}
          onChange={(e) => {
            setHistoryResult(e.target.value as AdminHistoryResultFilter);
            setHistoryPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          {HISTORY_RESULTS.map((item) => (
            <option key={item} value={item}>
              {item === 'all'
                ? getAdminText(lang, 'result_all')
                : getAdminText(lang, `result_${item}` as never)}
            </option>
          ))}
        </AdminSelect>
      </div>

      {loading.history ? (
        <div className="mt-6 text-sm text-slate-400">{getAdminText(lang, 'refresh')}…</div>
      ) : history.length === 0 ? (
        <div className="mt-6">
          <AdminEmptyState
            title={getAdminText(lang, 'history_empty')}
            body={getAdminText(lang, 'history_subtitle')}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {visibleHistory.map((item) => (
            <div key={item.id} className="admin-surface-muted overflow-hidden">
              {item.assetPublicUrl ? (
                <img src={item.assetPublicUrl} alt={item.title} className="h-36 w-full object-cover" />
              ) : null}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-white">{item.title}</p>
                      <AdminBadge tone={historyTone(item)}>
                        {item.failedCount > 0
                          ? item.successCount > 0
                            ? getAdminText(lang, 'result_partial')
                            : getAdminText(lang, 'result_failed')
                          : getAdminText(lang, 'result_success')}
                      </AdminBadge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {item.mode === 'personal'
                        ? `${getAdminText(lang, 'personal')}: ${item.targetUserName || item.targetUserId || '—'}`
                        : `${getAdminText(lang, 'broadcast')}: ${
                            item.targetSegment ? segmentLabel(lang, item.targetSegment) : '—'
                          }`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(lang, item.createdAt)}</p>
                  </div>
                  <div className="text-right text-sm leading-6 text-slate-300">
                    <p>
                      {item.successCount}/{item.totalRecipients} {getAdminText(lang, 'sent_count')}
                    </p>
                    <p className="mt-1 text-red-300">
                      {item.failedCount} {getAdminText(lang, 'failed_count')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminButton tone="secondary" onClick={() => reuseCampaign(item)}>
                    {getAdminText(lang, 'reuse')}
                  </AdminButton>
                  {item.recentFailures.length > 0 ? (
                    <AdminButton
                      tone="ghost"
                      onClick={() =>
                        setExpandedFailures((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                    >
                      {expandedFailures[item.id]
                        ? getAdminText(lang, 'hide_failures')
                        : getAdminText(lang, 'show_failures')}
                    </AdminButton>
                  ) : null}
                </div>
                {expandedFailures[item.id] && item.recentFailures.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {item.recentFailures.map((failure) => (
                      <div
                        key={`${item.id}-${failure.userId}-${failure.createdAt}`}
                        className="rounded-[18px] border border-red-500/20 bg-red-500/8 p-4"
                      >
                        <p className="text-sm text-red-100">{failure.userName}</p>
                        <p className="mt-1 text-xs leading-5 text-red-200/80">{failure.error}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {formatDateTime(lang, failure.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <AdminPagination
          page={historyPagination.page}
          totalPages={historyPagination.totalPages}
          total={historyPagination.total}
          pageSize={historyPagination.pageSize}
          label={getAdminText(lang, 'users_page')}
          onPageChange={(page) => setHistoryPagination((prev) => ({ ...prev, page }))}
        />
      </div>
    </AdminSurface>
  );

  const renderPanel = (panel: AdminNotificationSection) => {
    if (panel === 'send') return sendPanel;
    if (panel === 'templates') return templatesPanel;
    return historyPanel;
  };

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}
      {message ? <AdminStateBanner tone="success">{message}</AdminStateBanner> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void uploadAsset(file, editorOpen ? 'template' : 'compose');
          e.target.value = '';
        }}
      />

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Communications"
          title={lang === 'ru' ? 'Communication Cockpit' : 'Communication Cockpit'}
          subtitle={
            lang === 'ru'
              ? 'Отправка, шаблоны и история теперь работают как единый рабочий контур: быстрее собирать, проще повторять, легче контролировать.'
              : 'Send, templates, and history now work as one operating loop: faster to compose, easier to reuse, and clearer to control.'
          }
          action={
            <div className="flex flex-wrap gap-2">
              <AdminButton tone="secondary" onClick={() => void Promise.all([loadTemplates(), loadAssets(), loadHistory()])}>
                {getAdminText(lang, 'refresh')}
              </AdminButton>
              <AdminButton
                tone="primary"
                onClick={() => {
                  setDraft(templateDraft);
                  setEditorOpen(true);
                }}
              >
                {getAdminText(lang, 'template_new')}
              </AdminButton>
            </div>
          }
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {WORKSPACE_SECTIONS.map((item) => (
            <AdminChipButton key={item} active={workspaceSection === item} onClick={() => focusSection(item)}>
              {workspaceLabel(lang, item)}
            </AdminChipButton>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {WORKSPACE_SECTIONS.map((item) => (
            <div key={item} className="admin-surface-muted p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="admin-label">{workspaceLabel(lang, item)}</p>
                <AdminBadge tone={workspaceMetricTone(item)}>
                  {item === 'send'
                    ? mode === 'personal'
                      ? getAdminText(lang, 'personal')
                      : getAdminText(lang, 'broadcast')
                    : item === 'templates'
                      ? filteredTemplates.length
                      : history.length}
                </AdminBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{workspaceBlurb(lang, item)}</p>
            </div>
          ))}
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <aside className="order-first xl:order-last xl:self-start">
          <div className="space-y-5 xl:sticky xl:top-5">
            <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="admin-label">{getAdminText(lang, 'preview')}</p>
                  <h3 className="admin-heading mt-2 text-2xl text-white">
                    {lang === 'ru' ? 'Живой preview' : 'Live preview'}
                  </h3>
                </div>
                <AdminBadge tone="info">{workspaceLabel(lang, workspaceSection)}</AdminBadge>
              </div>

              <div className="mt-5 admin-surface-muted overflow-hidden">
                {selectedAsset ? (
                  <img src={selectedAsset.publicUrl} alt={selectedAsset.fileName} className="h-44 w-full object-cover" />
                ) : null}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminBadge tone="info">
                      {mode === 'personal' ? getAdminText(lang, 'personal') : getAdminText(lang, 'broadcast')}
                    </AdminBadge>
                    {selectedTemplate ? <AdminBadge tone="neutral">{selectedTemplate.title}</AdminBadge> : null}
                  </div>
                  <p className="mt-4 text-lg font-semibold text-white">{title.trim() || '—'}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{previewTargetSummary}</p>
                  <div className="mt-4 space-y-3">
                    <PreviewPane label="RU" value={bodyRu} />
                    <PreviewPane label="EN" value={bodyEn} />
                  </div>
                </div>
              </div>
            </AdminSurface>

            <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
              <p className="admin-label">{lang === 'ru' ? 'Быстрый контекст' : 'Quick context'}</p>
              <div className="mt-4 grid gap-3">
                <div className="admin-surface-muted p-4">
                  <span className="admin-label">{lang === 'ru' ? 'Текущий фокус' : 'Current focus'}</span>
                  <p className="mt-2 text-base font-semibold text-white">{workspaceLabel(lang, workspaceSection)}</p>
                </div>
                <div className="admin-surface-muted p-4">
                  <span className="admin-label">{lang === 'ru' ? 'Шаблон' : 'Template'}</span>
                  <p className="mt-2 text-base font-semibold text-white">
                    {selectedTemplate?.title || getAdminText(lang, 'no_template')}
                  </p>
                </div>
                <div className="admin-surface-muted p-4">
                  <span className="admin-label">{lang === 'ru' ? 'Визуал' : 'Visual'}</span>
                  <p className="mt-2 text-base font-semibold text-white">
                    {selectedAsset?.fileName || getAdminText(lang, 'no_image')}
                  </p>
                </div>
              </div>
            </AdminSurface>
          </div>
        </aside>

        <div className="space-y-5">
          {panelOrder.map((item) => (
            <div key={item}>{renderPanel(item)}</div>
          ))}
        </div>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-md">
          <div className="admin-sheet admin-scroll">
            <div className="admin-sticky-toolbar border-b border-white/10 bg-[#071220]/88 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <AdminButton tone="ghost" className="min-h-[2.5rem] px-0" onClick={() => setEditorOpen(false)}>
                  ← {getAdminText(lang, 'close')}
                </AdminButton>
                <AdminBadge tone={draft.isActive ? 'success' : 'neutral'}>
                  {draft.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}
                </AdminBadge>
              </div>
              <div className="mt-4">
                <h3 className="admin-heading text-[28px] text-white">
                  {draft.id ? getAdminText(lang, 'template_edit') : getAdminText(lang, 'template_new')}
                </h3>
              </div>
            </div>
            <div className="space-y-4 px-5 py-5">
              <AdminInput
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={getAdminText(lang, 'title')}
              />
              <AdminSelect
                value={draft.kind}
                onChange={(e) => setDraft((prev) => ({ ...prev, kind: e.target.value as AdminNotificationTemplateKind }))}
              >
                {KINDS.filter((item): item is AdminNotificationTemplateKind => item !== 'all').map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(lang, kind)}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect
                value={draft.assetId ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    assetId: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">{getAdminText(lang, 'no_image')}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.fileName}
                  </option>
                ))}
              </AdminSelect>
              <div className="flex flex-wrap gap-2">
                <AdminButton tone="secondary" onClick={() => inputRef.current?.click()}>
                  {getAdminText(lang, 'upload_image')}
                </AdminButton>
                <AdminButton tone="secondary" onClick={() => void loadAssets()}>
                  {getAdminText(lang, 'refresh')}
                </AdminButton>
              </div>
              {draft.assetId ? (
                <div className="overflow-hidden rounded-[20px] border border-white/10">
                  <img
                    src={assets.find((asset) => asset.id === draft.assetId)?.publicUrl || ''}
                    alt=""
                    className="h-40 w-full object-cover"
                  />
                </div>
              ) : null}
              <AdminTextarea
                rows={7}
                value={draft.bodyRu}
                onChange={(e) => setDraft((prev) => ({ ...prev, bodyRu: e.target.value }))}
                placeholder={getAdminText(lang, 'body_ru')}
              />
              <AdminTextarea
                rows={7}
                value={draft.bodyEn}
                onChange={(e) => setDraft((prev) => ({ ...prev, bodyEn: e.target.value }))}
                placeholder={getAdminText(lang, 'body_en')}
              />
              <div className="flex flex-wrap gap-3">
                <AdminButton
                  tone={draft.isActive ? 'secondary' : 'primary'}
                  onClick={() => setDraft((prev) => ({ ...prev, isActive: !prev.isActive }))}
                >
                  {draft.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}
                </AdminButton>
                <AdminButton tone="secondary" onClick={() => setDraft(templateDraft)}>
                  {getAdminText(lang, 'reset')}
                </AdminButton>
              </div>
              <div className="admin-sticky-footer rounded-[22px] border border-sky-400/20 bg-[#081120]/92 p-4 backdrop-blur">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm leading-6 text-slate-300">
                    {lang === 'ru'
                      ? 'Шаблон сохраняется прямо внутри communication cockpit.'
                      : 'The template is saved directly inside the communication cockpit.'}
                  </p>
                  <AdminButton tone="primary" disabled={busy === 'template'} onClick={() => void saveTemplate()}>
                    {busy === 'template' ? getAdminText(lang, 'sending') : getAdminText(lang, 'template_save')}
                  </AdminButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const PreviewPane: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="admin-surface-muted bg-[#08111f] p-4">
    <p className="admin-label">{label}</p>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value || '—'}</p>
  </div>
);
