import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AdminHistoryResultFilter,
  type AdminNotificationHistoryItem,
  type AdminNotificationModeFilter,
  type AdminNotificationTargetSegment,
  type AdminNotificationTemplate,
  type AdminNotificationTemplateKind,
  type UserProfile,
} from '../../types';
import {
  createNotificationTemplate,
  fetchNotificationHistory,
  fetchNotificationTemplates,
  sendNotification,
  updateNotificationTemplate,
} from '../../services/adminService';
import { AdminChipButton, AdminEmptyState, AdminPagination, AdminSectionHeader, AdminStateBanner, AdminSurface } from './AdminPrimitives';
import { formatAdminText, getAdminText } from './adminText';

type AdminNotificationSection = 'send' | 'templates' | 'history';

interface AdminNotificationsTabProps {
  profile: UserProfile;
  section: AdminNotificationSection;
  initialTargetUserId?: string;
  onClearInitialTarget?: () => void;
  onChangeSection?: (section: AdminNotificationSection) => void;
}

const SEGMENTS: AdminNotificationTargetSegment[] = ['all', 'premium', 'free', 'active_7d', 'inactive_30d'];
const KINDS: Array<AdminNotificationTemplateKind | 'all'> = ['all', 'both', 'personal', 'broadcast'];
const HISTORY_MODES: AdminNotificationModeFilter[] = ['all', 'personal', 'broadcast'];
const HISTORY_RESULTS: AdminHistoryResultFilter[] = ['all', 'success', 'partial', 'failed'];

const NOTIFICATION_PRESETS = [
  {
    key: 'maintenance',
    title: { ru: 'Техническое обновление Lumia', en: 'Lumia maintenance update' },
    bodyRu: 'Сегодня проводим техническое обновление Lumia. Если мини-приложение не откроется сразу, попробуйте зайти повторно через несколько минут.',
    bodyEn: 'We are running a Lumia maintenance update today. If the mini app does not open immediately, please try again in a few minutes.',
    mode: 'broadcast' as const,
    matches: ['maintenance', 'announcement'],
  },
  {
    key: 'premium_granted',
    title: { ru: 'Premium активирован', en: 'Premium activated' },
    bodyRu: 'Ваш Lumia Premium активирован. Откройте приложение, чтобы использовать все премиум-возможности.',
    bodyEn: 'Your Lumia Premium is active now. Open the app to use all premium features.',
    mode: 'personal' as const,
    matches: ['premium'],
  },
  {
    key: 'lumi_credited',
    title: { ru: 'Lumi начислены', en: 'Lumi credited' },
    bodyRu: 'На ваш баланс Lumia начислены Lumi. Откройте кошелёк, чтобы увидеть обновлённый баланс.',
    bodyEn: 'Lumi were added to your Lumia balance. Open the wallet to see the updated amount.',
    mode: 'personal' as const,
    matches: ['lumi'],
  },
  {
    key: 'comeback',
    title: { ru: 'Мы ждём вас в Lumia', en: 'We miss you in Lumia' },
    bodyRu: 'В Lumia появились новые возможности. Возвращайтесь, чтобы посмотреть обновления, карты и персональные подсказки.',
    bodyEn: 'Lumia has new updates waiting for you. Come back to check your charts, guidance, and fresh content.',
    mode: 'broadcast' as const,
    matches: ['come back', 'inactive'],
  },
  {
    key: 'announcement',
    title: { ru: 'Новость Lumia', en: 'Lumia announcement' },
    bodyRu: 'У Lumia есть важное обновление для вас. Откройте приложение, чтобы узнать подробности.',
    bodyEn: 'Lumia has an important update for you. Open the app to see the details.',
    mode: 'broadcast' as const,
    matches: ['announcement', 'important'],
  },
];

const emptyTemplateDraft = {
  id: null as number | null,
  title: '',
  bodyRu: '',
  bodyEn: '',
  kind: 'both' as AdminNotificationTemplateKind,
  isActive: true,
};

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return getAdminText(lang, 'no_data');
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getSegmentLabel = (lang: 'ru' | 'en', value: AdminNotificationTargetSegment) => {
  const labels: Record<AdminNotificationTargetSegment, string> = {
    all: lang === 'ru' ? 'Все пользователи' : 'All users',
    premium: 'Premium',
    free: 'Free',
    active_7d: lang === 'ru' ? 'Активны за 7 дней' : 'Active in last 7 days',
    inactive_30d: lang === 'ru' ? 'Неактивны 30+ дней' : 'Inactive 30+ days',
  };
  return labels[value];
};

const getKindLabel = (lang: 'ru' | 'en', value: AdminNotificationTemplateKind | 'all') => {
  const labels: Record<AdminNotificationTemplateKind | 'all', string> = {
    all: getAdminText(lang, 'filter_all'),
    both: lang === 'ru' ? 'Личное и массовое' : 'Personal and broadcast',
    personal: getAdminText(lang, 'personal'),
    broadcast: getAdminText(lang, 'broadcast'),
  };
  return labels[value];
};

const getHistoryModeLabel = (lang: 'ru' | 'en', value: AdminNotificationModeFilter) => {
  if (value === 'all') return getAdminText(lang, 'result_all');
  return value === 'personal' ? getAdminText(lang, 'personal') : getAdminText(lang, 'broadcast');
};

const getHistoryResultLabel = (lang: 'ru' | 'en', value: AdminHistoryResultFilter) => {
  if (value === 'all') return getAdminText(lang, 'result_all');
  if (value === 'success') return getAdminText(lang, 'result_success');
  if (value === 'partial') return getAdminText(lang, 'result_partial');
  return getAdminText(lang, 'result_failed');
};

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function getCampaignTone(item: AdminNotificationHistoryItem): 'success' | 'partial' | 'failed' {
  if (item.failedCount > 0 && item.successCount === 0) return 'failed';
  if (item.failedCount > 0 && item.successCount > 0) return 'partial';
  return 'success';
}

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({
  profile,
  section,
  initialTargetUserId,
  onClearInitialTarget,
  onChangeSection,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [templates, setTemplates] = useState<AdminNotificationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [history, setHistory] = useState<AdminNotificationHistoryItem[]>([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastSendMessage, setLastSendMessage] = useState<string | null>(null);

  const [mode, setMode] = useState<'personal' | 'broadcast'>(initialTargetUserId ? 'personal' : 'broadcast');
  const [targetUserId, setTargetUserId] = useState(initialTargetUserId || '');
  const [targetSegment, setTargetSegment] = useState<AdminNotificationTargetSegment>('all');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [bodyRu, setBodyRu] = useState('');
  const [bodyEn, setBodyEn] = useState('');

  const [templateSearch, setTemplateSearch] = useState('');
  const [templateKindFilter, setTemplateKindFilter] = useState<AdminNotificationTemplateKind | 'all'>('all');
  const [templateStatus, setTemplateStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [draft, setDraft] = useState(emptyTemplateDraft);
  const [editorOpen, setEditorOpen] = useState(false);

  const [historyMode, setHistoryMode] = useState<AdminNotificationModeFilter>('all');
  const [historyResult, setHistoryResult] = useState<AdminHistoryResultFilter>('all');
  const [expandedFailures, setExpandedFailures] = useState<Record<number, boolean>>({});

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setError(null);
    try {
      const nextTemplates = await fetchNotificationTemplates();
      setTemplates(nextTemplates);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'notifications_failed'));
    } finally {
      setTemplatesLoading(false);
    }
  }, [lang]);

  const loadHistory = useCallback(async (page = historyPagination.page) => {
    setHistoryLoading(true);
    setError(null);
    try {
      const payload = await fetchNotificationHistory({
        page,
        pageSize: historyPagination.pageSize,
        mode: historyMode,
        result: historyResult,
      });
      setHistory(payload.history);
      setHistoryPagination(payload.pagination);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'notifications_failed'));
    } finally {
      setHistoryLoading(false);
    }
  }, [historyMode, historyPagination.page, historyPagination.pageSize, historyResult, lang]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    void loadHistory(historyPagination.page);
  }, [historyMode, historyPagination.page, historyPagination.pageSize, historyResult, loadHistory]);

  useEffect(() => {
    if (!initialTargetUserId) return;
    setMode('personal');
    setTargetUserId(initialTargetUserId);
    setLastSendMessage(null);
    onClearInitialTarget?.();
  }, [initialTargetUserId, onClearInitialTarget]);

  const filteredTemplates = useMemo(() => {
    const searchValue = normalizeTitle(templateSearch);
    return templates.filter((template) => {
      if (templateKindFilter !== 'all' && template.kind !== templateKindFilter) return false;
      if (templateStatus === 'active' && !template.isActive) return false;
      if (templateStatus === 'disabled' && template.isActive) return false;
      if (!searchValue) return true;
      return normalizeTitle(template.title).includes(searchValue);
    });
  }, [templateKindFilter, templateSearch, templateStatus, templates]);

  const composePreview = useMemo(() => ({
    title: title.trim(),
    bodyRu: bodyRu.trim(),
    bodyEn: bodyEn.trim(),
  }), [bodyEn, bodyRu, title]);

  const applyComposePayload = useCallback((payload: {
    mode: 'personal' | 'broadcast';
    targetUserId?: string | null;
    targetSegment?: AdminNotificationTargetSegment | null;
    templateId?: number | null;
    title: string;
    bodyRu: string;
    bodyEn: string;
  }) => {
    setMode(payload.mode);
    setTargetUserId(payload.targetUserId || '');
    setTargetSegment(payload.targetSegment || 'all');
    setTemplateId(payload.templateId ?? null);
    setTitle(payload.title);
    setBodyRu(payload.bodyRu);
    setBodyEn(payload.bodyEn);
    setError(null);
    setLastSendMessage(null);
  }, []);

  const handleUseTemplate = useCallback((template: AdminNotificationTemplate) => {
    applyComposePayload({
      mode: template.kind === 'personal' || template.kind === 'broadcast' ? template.kind : mode,
      targetUserId,
      targetSegment,
      templateId: template.id,
      title: template.title,
      bodyRu: template.bodyRu,
      bodyEn: template.bodyEn,
    });
    onChangeSection?.('send');
  }, [applyComposePayload, mode, onChangeSection, targetSegment, targetUserId]);

  const handleApplyPreset = useCallback((presetKey: string) => {
    const preset = NOTIFICATION_PRESETS.find((item) => item.key === presetKey);
    if (!preset) return;

    const matchingTemplate = templates.find((template) => {
      const titleNormalized = normalizeTitle(template.title);
      return preset.matches.some((candidate) => titleNormalized.includes(candidate));
    });

    if (matchingTemplate) {
      handleUseTemplate(matchingTemplate);
      if (matchingTemplate.kind === 'both') {
        setMode(preset.mode);
      }
    } else {
      applyComposePayload({
        mode: preset.mode,
        targetUserId: preset.mode === 'personal' ? targetUserId : '',
        targetSegment: preset.mode === 'broadcast' ? targetSegment : null,
        templateId: null,
        title: preset.title[lang],
        bodyRu: preset.bodyRu,
        bodyEn: preset.bodyEn,
      });
      onChangeSection?.('send');
    }
  }, [applyComposePayload, handleUseTemplate, lang, onChangeSection, targetSegment, targetUserId, templates]);

  const handleReuseCampaign = (campaign: AdminNotificationHistoryItem) => {
    applyComposePayload({
      mode: campaign.mode,
      targetUserId: campaign.mode === 'personal' ? campaign.targetUserId : null,
      targetSegment: campaign.mode === 'broadcast' ? campaign.targetSegment : null,
      templateId: campaign.templateId,
      title: campaign.title,
      bodyRu: campaign.bodyRu,
      bodyEn: campaign.bodyEn,
    });
    onChangeSection?.('send');
  };

  const handleEditTemplate = (template?: AdminNotificationTemplate, duplicate = false) => {
    if (!template) {
      setDraft(emptyTemplateDraft);
    } else {
      setDraft({
        id: duplicate ? null : template.id,
        title: duplicate ? `${template.title} Copy` : template.title,
        bodyRu: template.bodyRu,
        bodyEn: template.bodyEn,
        kind: template.kind,
        isActive: template.isActive,
      });
    }
    setEditorOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!draft.title.trim()) {
      setError(getAdminText(lang, 'template_title_required'));
      return;
    }
    if (!draft.bodyRu.trim() && !draft.bodyEn.trim()) {
      setError(getAdminText(lang, 'body_required'));
      return;
    }

    setActionLoading('template-save');
    setError(null);
    try {
      const payload = {
        title: draft.title.trim(),
        bodyRu: draft.bodyRu.trim(),
        bodyEn: draft.bodyEn.trim(),
        kind: draft.kind,
        isActive: draft.isActive,
      };

      const savedTemplate = draft.id
        ? await updateNotificationTemplate(draft.id, payload)
        : await createNotificationTemplate(payload);

      await loadTemplates();
      handleEditTemplate(savedTemplate);
    } catch (saveError: any) {
      setError(saveError?.message || getAdminText(lang, 'template_save_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSend = async () => {
    if (!title.trim()) {
      setError(getAdminText(lang, 'notification_title_required'));
      return;
    }
    if (!bodyRu.trim() && !bodyEn.trim()) {
      setError(getAdminText(lang, 'body_required'));
      return;
    }
    if (mode === 'personal' && !targetUserId.trim()) {
      setError(getAdminText(lang, 'target_user_required'));
      return;
    }

    setActionLoading('send');
    setError(null);
    setLastSendMessage(null);
    try {
      const result = await sendNotification({
        mode,
        targetUserId: mode === 'personal' ? targetUserId.trim() : null,
        targetSegment: mode === 'broadcast' ? targetSegment : null,
        templateId,
        title: title.trim(),
        bodyRu: bodyRu.trim(),
        bodyEn: bodyEn.trim(),
      });

      setLastSendMessage(formatAdminText(lang, 'send_success', {
        success: result.campaign.successCount,
        total: result.campaign.totalRecipients,
      }));
      setHistory((prev) => [result.campaign, ...prev].slice(0, historyPagination.pageSize));
      setHistoryPagination((prev) => ({ ...prev, total: Math.max(prev.total, 1), totalPages: Math.max(prev.totalPages, 1) }));
      onChangeSection?.('history');
    } catch (sendError: any) {
      setError(sendError?.message || getAdminText(lang, 'notification_send_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const renderSend = () => (
    <div className="space-y-5">
      {lastSendMessage ? <AdminStateBanner tone="success">{lastSendMessage}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5">
        <AdminSectionHeader
          eyebrow="Notify"
          title={getAdminText(lang, 'send_title')}
          subtitle={getAdminText(lang, 'send_subtitle')}
        />

        <div className="scrollbar-hide -mx-1 mt-5 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2">
            {NOTIFICATION_PRESETS.map((preset) => (
              <AdminChipButton key={preset.key} onClick={() => handleApplyPreset(preset.key)}>
                {preset.title[lang]}
              </AdminChipButton>
            ))}
          </div>
        </div>
      </AdminSurface>

      <AdminSurface className="px-5 py-5">
        <AdminSectionHeader title={getAdminText(lang, 'audience')} />
        <div className="mt-5 flex flex-wrap gap-2">
          <AdminChipButton active={mode === 'personal'} onClick={() => setMode('personal')}>{getAdminText(lang, 'personal')}</AdminChipButton>
          <AdminChipButton active={mode === 'broadcast'} onClick={() => setMode('broadcast')}>{getAdminText(lang, 'broadcast')}</AdminChipButton>
        </div>

        <div className="mt-4">
          {mode === 'personal' ? (
            <input
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              placeholder={getAdminText(lang, 'target_user')}
              className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
            />
          ) : (
            <select
              value={targetSegment}
              onChange={(event) => setTargetSegment(event.target.value as AdminNotificationTargetSegment)}
              className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
            >
              {SEGMENTS.map((segment) => (
                <option key={segment} value={segment}>{getSegmentLabel(lang, segment)}</option>
              ))}
            </select>
          )}
        </div>
      </AdminSurface>

      <AdminSurface className="px-5 py-5">
        <AdminSectionHeader title={getAdminText(lang, 'message_source')} />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <select
            value={templateId ?? ''}
            onChange={(event) => {
              const value = Number(event.target.value);
              const template = templates.find((item) => item.id === value);
              if (!template) {
                setTemplateId(null);
                return;
              }
              handleUseTemplate(template);
            }}
            className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
          >
            <option value="">{getAdminText(lang, 'no_template')}</option>
            {templates
              .filter((template) => template.isActive && (template.kind === 'both' || template.kind === mode))
              .map((template) => (
                <option key={template.id} value={template.id}>{template.title}</option>
              ))}
          </select>

          <button
            onClick={() => onChangeSection?.('templates')}
            className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
          >
            {getAdminText(lang, 'section_templates')}
          </button>
        </div>
      </AdminSurface>

      <AdminSurface className="px-5 py-5">
        <AdminSectionHeader title={getAdminText(lang, 'content_preview')} />

        <div className="mt-4 space-y-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={getAdminText(lang, 'title')}
            className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <textarea
              value={bodyRu}
              onChange={(event) => setBodyRu(event.target.value)}
              rows={7}
              placeholder={getAdminText(lang, 'body_ru')}
              className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
            />
            <textarea
              value={bodyEn}
              onChange={(event) => setBodyEn(event.target.value)}
              rows={7}
              placeholder={getAdminText(lang, 'body_en')}
              className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
            />
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{getAdminText(lang, 'preview')}</p>
            <p className="mt-3 text-lg font-semibold text-white">{composePreview.title || '—'}</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[18px] border border-white/10 bg-[#0b1525] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">RU</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{composePreview.bodyRu || '—'}</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-[#0b1525] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">EN</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{composePreview.bodyEn || '—'}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              {mode === 'personal' ? getAdminText(lang, 'preview_hint_personal') : getAdminText(lang, 'preview_hint_broadcast')}
            </p>
          </div>

          <div className="sticky bottom-3 rounded-[22px] border border-sky-400/20 bg-[#0b1525]/95 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-300">
                {mode === 'personal'
                  ? `${getAdminText(lang, 'personal')}: ${targetUserId || '—'}`
                  : `${getAdminText(lang, 'broadcast')}: ${getSegmentLabel(lang, targetSegment)}`}
              </div>
              <button
                onClick={() => void handleSend()}
                disabled={actionLoading === 'send'}
                className="rounded-[18px] bg-sky-400 px-5 py-3 text-sm font-semibold text-[#081120] transition-opacity disabled:opacity-60"
              >
                {actionLoading === 'send' ? getAdminText(lang, 'sending') : getAdminText(lang, 'send_now')}
              </button>
            </div>
          </div>
        </div>
      </AdminSurface>
    </div>
  );

  const renderTemplates = () => (
    <div className="space-y-5">
      <AdminSurface className="px-5 py-5">
        <AdminSectionHeader
          eyebrow="Templates"
          title={getAdminText(lang, 'templates_title')}
          subtitle={getAdminText(lang, 'templates_subtitle')}
          action={(
            <button
              onClick={() => handleEditTemplate()}
              className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
            >
              {getAdminText(lang, 'template_new')}
            </button>
          )}
        />

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
          <input
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
            placeholder={getAdminText(lang, 'search_users')}
            className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
          />
          <select
            value={templateKindFilter}
            onChange={(event) => setTemplateKindFilter(event.target.value as any)}
            className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>{getKindLabel(lang, kind)}</option>
            ))}
          </select>
          <select
            value={templateStatus}
            onChange={(event) => setTemplateStatus(event.target.value as any)}
            className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
          >
            <option value="all">{getAdminText(lang, 'result_all')}</option>
            <option value="active">{getAdminText(lang, 'template_active')}</option>
            <option value="disabled">{getAdminText(lang, 'template_disabled')}</option>
          </select>
        </div>
      </AdminSurface>

      <AdminSurface className="overflow-hidden">
        {templatesLoading ? (
          <div className="px-5 py-8 text-sm text-slate-400">{getAdminText(lang, 'notifications_failed')}</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="px-5 py-8">
            <AdminEmptyState title={getAdminText(lang, 'templates_empty')} body={getAdminText(lang, 'templates_subtitle')} />
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-white">{template.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em]">
                      <span className="rounded-full border border-white/10 px-2 py-1 text-slate-400">{getKindLabel(lang, template.kind)}</span>
                      <span className={`rounded-full px-2 py-1 ${template.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.05] text-slate-400'}`}>
                        {template.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminChipButton onClick={() => handleUseTemplate(template)}>{getAdminText(lang, 'template_use')}</AdminChipButton>
                    <AdminChipButton onClick={() => handleEditTemplate(template)}>{getAdminText(lang, 'template_edit')}</AdminChipButton>
                    <AdminChipButton onClick={() => handleEditTemplate(template, true)}>{getAdminText(lang, 'template_duplicate')}</AdminChipButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSurface>
 
      {editorOpen ? (
        <div className="fixed inset-0 z-[85] bg-black/55 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 top-24 overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#091221] shadow-2xl md:inset-y-6 md:right-6 md:left-auto md:w-[520px] md:rounded-[30px]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#091221]/95 px-5 py-4 backdrop-blur">
              <button
                onClick={() => setEditorOpen(false)}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200"
              >
                ← {getAdminText(lang, 'close')}
              </button>
              <div className="mt-3">
                <h3 className="font-serif text-2xl text-white">
                  {draft.id ? getAdminText(lang, 'template_edit') : getAdminText(lang, 'template_new')}
                </h3>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={getAdminText(lang, 'title')}
                className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
              />
              <select
                value={draft.kind}
                onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value as AdminNotificationTemplateKind }))}
                className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
              >
                {KINDS.filter((item): item is AdminNotificationTemplateKind => item !== 'all').map((kind) => (
                  <option key={kind} value={kind}>{getKindLabel(lang, kind)}</option>
                ))}
              </select>
              <textarea
                value={draft.bodyRu}
                onChange={(event) => setDraft((prev) => ({ ...prev, bodyRu: event.target.value }))}
                rows={6}
                placeholder={getAdminText(lang, 'body_ru')}
                className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
              />
              <textarea
                value={draft.bodyEn}
                onChange={(event) => setDraft((prev) => ({ ...prev, bodyEn: event.target.value }))}
                rows={6}
                placeholder={getAdminText(lang, 'body_en')}
                className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
              />
              <button
                onClick={() => setDraft((prev) => ({ ...prev, isActive: !prev.isActive }))}
                className={`rounded-[18px] px-4 py-3 text-sm font-semibold ${
                  draft.isActive ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border border-white/10 bg-white/[0.03] text-slate-300'
                }`}
              >
                {draft.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}
              </button>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void handleSaveTemplate()}
                  disabled={actionLoading === 'template-save'}
                  className="rounded-[18px] bg-sky-400 px-5 py-3 text-sm font-semibold text-[#07111f] disabled:opacity-60"
                >
                  {actionLoading === 'template-save' ? getAdminText(lang, 'sending') : getAdminText(lang, 'template_save')}
                </button>
                <button
                  onClick={() => setDraft(emptyTemplateDraft)}
                  className="rounded-[18px] border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white"
                >
                  {getAdminText(lang, 'reset')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-5">
      <AdminSurface className="px-5 py-5">
        <AdminSectionHeader
          eyebrow="History"
          title={getAdminText(lang, 'history_title')}
          subtitle={getAdminText(lang, 'history_subtitle')}
          action={(
            <button
              onClick={() => void loadHistory(historyPagination.page)}
              className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
            >
              {getAdminText(lang, 'refresh')}
            </button>
          )}
        />

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <select
            value={historyMode}
            onChange={(event) => {
              setHistoryMode(event.target.value as AdminNotificationModeFilter);
              setHistoryPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
          >
            {HISTORY_MODES.map((item) => (
              <option key={item} value={item}>{getHistoryModeLabel(lang, item)}</option>
            ))}
          </select>
          <select
            value={historyResult}
            onChange={(event) => {
              setHistoryResult(event.target.value as AdminHistoryResultFilter);
              setHistoryPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
          >
            {HISTORY_RESULTS.map((item) => (
              <option key={item} value={item}>{getHistoryResultLabel(lang, item)}</option>
            ))}
          </select>
        </div>
      </AdminSurface>

      <AdminSurface className="overflow-hidden">
        {historyLoading ? (
          <div className="px-5 py-8 text-sm text-slate-400">{getAdminText(lang, 'refresh')}…</div>
        ) : history.length === 0 ? (
          <div className="px-5 py-8">
            <AdminEmptyState title={getAdminText(lang, 'history_empty')} body={getAdminText(lang, 'history_subtitle')} />
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/10">
              {history.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  lang={lang}
                  expanded={!!expandedFailures[item.id]}
                  onToggleFailures={() => setExpandedFailures((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  onReuse={() => handleReuseCampaign(item)}
                />
              ))}
            </div>
            <AdminPagination
              page={historyPagination.page}
              totalPages={historyPagination.totalPages}
              total={historyPagination.total}
              pageSize={historyPagination.pageSize}
              label={getAdminText(lang, 'users_page')}
              onPageChange={(page) => setHistoryPagination((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </AdminSurface>
    </div>
  );

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}
      {section === 'send' ? renderSend() : null}
      {section === 'templates' ? renderTemplates() : null}
      {section === 'history' ? renderHistory() : null}
    </div>
  );
};

const HistoryCard: React.FC<{
  item: AdminNotificationHistoryItem;
  lang: 'ru' | 'en';
  expanded: boolean;
  onToggleFailures: () => void;
  onReuse: () => void;
}> = ({ item, lang, expanded, onToggleFailures, onReuse }) => {
  const tone = getCampaignTone(item);
  const toneClass = tone === 'success'
    ? 'bg-emerald-500/12 text-emerald-200'
    : tone === 'partial'
      ? 'bg-amber-500/12 text-amber-200'
      : 'bg-red-500/12 text-red-200';

  return (
    <div className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-medium text-white">{item.title}</p>
            <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${toneClass}`}>
              {getHistoryResultLabel(lang, getCampaignTone(item))}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {item.mode === 'personal'
              ? `${getAdminText(lang, 'personal')}: ${item.targetUserName || item.targetUserId || '—'}`
              : `${getAdminText(lang, 'broadcast')}: ${item.targetSegment ? getSegmentLabel(lang, item.targetSegment) : '—'}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(lang, item.createdAt)}</p>
        </div>

        <div className="text-right text-sm text-slate-300">
          <p>{item.successCount}/{item.totalRecipients} {getAdminText(lang, 'sent_count')}</p>
          <p className="mt-1 text-red-300">{item.failedCount} {getAdminText(lang, 'failed_count')}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AdminChipButton onClick={onReuse}>{getAdminText(lang, 'reuse')}</AdminChipButton>
        {item.recentFailures.length > 0 ? (
          <AdminChipButton onClick={onToggleFailures}>
            {expanded ? getAdminText(lang, 'hide_failures') : getAdminText(lang, 'show_failures')}
          </AdminChipButton>
        ) : null}
      </div>

      {expanded && item.recentFailures.length > 0 ? (
        <div className="mt-4 space-y-3">
          {item.recentFailures.map((failure) => (
            <div key={`${item.id}-${failure.userId}-${failure.createdAt}`} className="rounded-[18px] border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-100">{failure.userName}</p>
              <p className="mt-1 text-xs leading-5 text-red-200/80">{failure.error}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(lang, failure.createdAt)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
