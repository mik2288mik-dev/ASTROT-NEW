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
  sendNotification,
  updateNotificationTemplate,
  uploadNotificationAsset,
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

const SEGMENTS: AdminNotificationTargetSegment[] = ['all', 'premium', 'free', 'active_7d', 'inactive_3d', 'inactive_7d', 'inactive_30d', 'need_attention'];
const KINDS: Array<AdminNotificationTemplateKind | 'all'> = ['all', 'both', 'personal', 'broadcast'];
const HISTORY_MODES: AdminNotificationModeFilter[] = ['all', 'personal', 'broadcast'];
const HISTORY_RESULTS: AdminHistoryResultFilter[] = ['all', 'success', 'partial', 'failed'];
const PRESETS = ['Утро', 'День', 'Вечер', 'Возвращение', 'Premium', 'Lumi'];

const templateDraft = { id: null as number | null, title: '', bodyRu: '', bodyEn: '', kind: 'both' as AdminNotificationTemplateKind, assetId: null as number | null, isActive: true };

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : getAdminText(lang, 'no_data');

const segmentLabel = (lang: 'ru' | 'en', value: AdminNotificationTargetSegment) => {
  const labels: Record<AdminNotificationTargetSegment, string> = {
    all: getAdminText(lang, 'segment_all'),
    premium: getAdminText(lang, 'segment_premium'),
    free: getAdminText(lang, 'segment_free'),
    active_7d: getAdminText(lang, 'segment_active_7d'),
    inactive_3d: getAdminText(lang, 'segment_inactive_3d'),
    inactive_7d: getAdminText(lang, 'segment_inactive_7d'),
    inactive_30d: getAdminText(lang, 'segment_inactive_30d'),
    need_attention: getAdminText(lang, 'segment_attention'),
  };
  return labels[value];
};

const kindLabel = (lang: 'ru' | 'en', value: AdminNotificationTemplateKind | 'all') =>
  value === 'all' ? getAdminText(lang, 'filter_all') : value === 'both' ? (lang === 'ru' ? 'Личное и массовое' : 'Personal and broadcast') : getAdminText(lang, value);

const historyTone = (item: AdminNotificationHistoryItem) => (item.failedCount > 0 ? (item.successCount > 0 ? 'warning' : 'danger') : 'success') as 'warning' | 'danger' | 'success';

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({ profile, section, initialTargetUserId, onClearInitialTarget, onChangeSection }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const inputRef = useRef<HTMLInputElement>(null);
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

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<AdminNotificationTemplateKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [draft, setDraft] = useState(templateDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyMode, setHistoryMode] = useState<AdminNotificationModeFilter>('all');
  const [historyResult, setHistoryResult] = useState<AdminHistoryResultFilter>('all');
  const [expandedFailures, setExpandedFailures] = useState<Record<number, boolean>>({});

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

  const loadHistory = useCallback(async (page = historyPagination.page) => {
    setLoading((prev) => ({ ...prev, history: true }));
    try {
      const payload = await fetchNotificationHistory({ page, pageSize: historyPagination.pageSize, mode: historyMode, result: historyResult });
      setHistory(payload.history);
      setHistoryPagination(payload.pagination);
    } catch (e: any) {
      setError(e?.message || getAdminText(lang, 'notifications_failed'));
    } finally {
      setLoading((prev) => ({ ...prev, history: false }));
    }
  }, [historyMode, historyPagination.page, historyPagination.pageSize, historyResult, lang]);

  useEffect(() => { void loadTemplates(); void loadAssets(); }, [loadAssets, loadTemplates]);
  useEffect(() => { void loadHistory(historyPagination.page); }, [historyMode, historyPagination.page, historyPagination.pageSize, historyResult, loadHistory]);
  useEffect(() => {
    if (!initialTargetUserId) return;
    setMode('personal');
    setTargetUserId(initialTargetUserId);
    onClearInitialTarget?.();
  }, [initialTargetUserId, onClearInitialTarget]);

  const filteredTemplates = useMemo(() => templates.filter((template) => {
    if (kindFilter !== 'all' && template.kind !== kindFilter) return false;
    if (statusFilter === 'active' && !template.isActive) return false;
    if (statusFilter === 'disabled' && template.isActive) return false;
    if (!search.trim()) return true;
    return template.title.toLowerCase().includes(search.trim().toLowerCase());
  }), [kindFilter, search, statusFilter, templates]);

  const selectedAsset = assets.find((asset) => asset.id === assetId) || null;

  const applyCompose = (payload: { mode: 'personal' | 'broadcast'; targetUserId?: string | null; targetSegment?: AdminNotificationTargetSegment | null; templateId?: number | null; assetId?: number | null; title: string; bodyRu: string; bodyEn: string; }) => {
    setMode(payload.mode); setTargetUserId(payload.targetUserId || ''); setTargetSegment(payload.targetSegment || 'all');
    setTemplateId(payload.templateId ?? null); setAssetId(payload.assetId ?? null); setTitle(payload.title); setBodyRu(payload.bodyRu); setBodyEn(payload.bodyEn);
    setError(null); setMessage(null);
  };

  const useTemplate = (template: AdminNotificationTemplate) => {
    applyCompose({ mode: template.kind === 'personal' || template.kind === 'broadcast' ? template.kind : mode, targetUserId, targetSegment, templateId: template.id, assetId: template.assetId ?? null, title: template.title, bodyRu: template.bodyRu, bodyEn: template.bodyEn });
    onChangeSection?.('send');
  };

  const reuseCampaign = (item: AdminNotificationHistoryItem) => {
    applyCompose({ mode: item.mode, targetUserId: item.targetUserId, targetSegment: item.targetSegment, templateId: item.templateId, assetId: item.assetId ?? null, title: item.title, bodyRu: item.bodyRu, bodyEn: item.bodyEn });
    onChangeSection?.('send');
  };

  const saveTemplate = async () => {
    if (!draft.title.trim()) return setError(getAdminText(lang, 'template_title_required'));
    if (!draft.bodyRu.trim() && !draft.bodyEn.trim()) return setError(getAdminText(lang, 'body_required'));
    setBusy('template');
    try {
      const payload = { title: draft.title.trim(), bodyRu: draft.bodyRu.trim(), bodyEn: draft.bodyEn.trim(), kind: draft.kind, assetId: draft.assetId, isActive: draft.isActive };
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
      if (target === 'compose') setAssetId(asset.id); else setDraft((prev) => ({ ...prev, assetId: asset.id }));
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
      const result = await sendNotification({ mode, targetUserId: mode === 'personal' ? targetUserId.trim() : null, targetSegment: mode === 'broadcast' ? targetSegment : null, templateId, assetId, title: title.trim(), bodyRu: bodyRu.trim(), bodyEn: bodyEn.trim() });
      setMessage(formatAdminText(lang, 'send_success', { success: result.campaign.successCount, total: result.campaign.totalRecipients }));
      setHistory((prev) => [result.campaign, ...prev].slice(0, historyPagination.pageSize));
      onChangeSection?.('history');
    } catch (e: any) {
      setError(e?.message || getAdminText(lang, 'notification_send_failed'));
    } finally {
      setBusy(null);
    }
  };

  const sendView = (
    <div className="space-y-5">
      {message ? <AdminStateBanner tone="success">{message}</AdminStateBanner> : null}
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader eyebrow="Send" title={getAdminText(lang, 'send_title')} subtitle={getAdminText(lang, 'send_subtitle')} />
        <div className="mt-5 flex flex-wrap gap-2">{PRESETS.map((preset) => <AdminChipButton key={preset} onClick={() => setTitle(preset)}>{preset}</AdminChipButton>)}</div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-[320px_320px_minmax(0,1fr)]">
        <AdminSurface className="px-5 py-5">
          <AdminSectionHeader title={getAdminText(lang, 'audience')} />
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminChipButton active={mode === 'personal'} onClick={() => setMode('personal')}>{getAdminText(lang, 'personal')}</AdminChipButton>
            <AdminChipButton active={mode === 'broadcast'} onClick={() => setMode('broadcast')}>{getAdminText(lang, 'broadcast')}</AdminChipButton>
          </div>
          <div className="mt-4">{mode === 'personal'
            ? <AdminInput value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder={getAdminText(lang, 'target_user')} />
            : <AdminSelect value={targetSegment} onChange={(e) => setTargetSegment(e.target.value as AdminNotificationTargetSegment)}>{SEGMENTS.map((s) => <option key={s} value={s}>{segmentLabel(lang, s)}</option>)}</AdminSelect>}
          </div>
          <div className="mt-4 admin-surface-muted p-4">
            <p className="admin-label">{getAdminText(lang, 'message_source')}</p>
            <div className="mt-3 space-y-3">
              <AdminSelect value={templateId ?? ''} onChange={(e) => {
                const value = Number(e.target.value);
                const template = templates.find((item) => item.id === value);
                if (!template) return setTemplateId(null);
                useTemplate(template);
              }}>
                <option value="">{getAdminText(lang, 'no_template')}</option>
                {templates.filter((t) => t.isActive && (t.kind === 'both' || t.kind === mode)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </AdminSelect>
              <AdminButton tone="secondary" onClick={() => onChangeSection?.('templates')}>{getAdminText(lang, 'section_templates')}</AdminButton>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface className="px-5 py-5">
          <AdminSectionHeader title={getAdminText(lang, 'choose_image')} />
          <div className="mt-4 space-y-3">
            <AdminSelect value={assetId ?? ''} onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{getAdminText(lang, 'no_image')}</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.fileName}</option>)}
            </AdminSelect>
            <div className="flex flex-wrap gap-2">
              <AdminButton tone="secondary" disabled={busy === 'upload-compose'} onClick={() => inputRef.current?.click()}>{getAdminText(lang, 'upload_image')}</AdminButton>
              <AdminButton tone="secondary" disabled={loading.assets} onClick={() => void loadAssets()}>{getAdminText(lang, 'refresh')}</AdminButton>
            </div>
            {selectedAsset ? <div className="overflow-hidden rounded-[20px] border border-white/10"><img src={selectedAsset.publicUrl} alt={selectedAsset.fileName} className="h-52 w-full object-cover" /></div> : <div className="admin-surface-muted px-4 py-6 text-sm text-slate-400">{getAdminText(lang, 'no_image')}</div>}
          </div>
        </AdminSurface>

        <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
          <AdminSectionHeader title={getAdminText(lang, 'content_preview')} />
          <div className="mt-5 space-y-4">
            <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={getAdminText(lang, 'title')} />
            <div className="grid gap-4 xl:grid-cols-2">
              <div><label className="admin-field-label">RU</label><AdminTextarea rows={8} value={bodyRu} onChange={(e) => setBodyRu(e.target.value)} placeholder={getAdminText(lang, 'body_ru')} /></div>
              <div><label className="admin-field-label">EN</label><AdminTextarea rows={8} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} placeholder={getAdminText(lang, 'body_en')} /></div>
            </div>
            <div className="admin-surface-muted overflow-hidden">{selectedAsset ? <img src={selectedAsset.publicUrl} alt={selectedAsset.fileName} className="h-40 w-full object-cover" /> : null}<div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="admin-label">{getAdminText(lang, 'preview')}</p><p className="mt-3 text-lg font-semibold text-white">{title.trim() || '—'}</p></div><AdminBadge tone="info">{mode === 'personal' ? getAdminText(lang, 'personal') : getAdminText(lang, 'broadcast')}</AdminBadge></div><div className="mt-4 grid gap-4 xl:grid-cols-2"><PreviewPane label="RU" value={bodyRu} /><PreviewPane label="EN" value={bodyEn} /></div></div></div>
            <div className="admin-sticky-footer rounded-[22px] border border-sky-400/20 bg-[#081120]/92 p-4 backdrop-blur"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="text-sm leading-6 text-slate-300">{mode === 'personal' ? `${getAdminText(lang, 'personal')}: ${targetUserId || '—'}` : `${getAdminText(lang, 'broadcast')}: ${segmentLabel(lang, targetSegment)}`}</div><AdminButton tone="primary" disabled={busy === 'send'} onClick={() => void doSend()}>{busy === 'send' ? getAdminText(lang, 'sending') : getAdminText(lang, 'send_now')}</AdminButton></div></div>
          </div>
        </AdminSurface>
      </div>
    </div>
  );

  const templatesView = (
    <div className="space-y-5">
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader eyebrow="Templates" title={getAdminText(lang, 'templates_title')} subtitle={getAdminText(lang, 'templates_subtitle')} action={<AdminButton tone="primary" onClick={() => { setDraft(templateDraft); setEditorOpen(true); }}>{getAdminText(lang, 'template_new')}</AdminButton>} />
        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <AdminInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={getAdminText(lang, 'search_users')} />
          <AdminSelect value={kindFilter} onChange={(e) => setKindFilter(e.target.value as AdminNotificationTemplateKind | 'all')}>{KINDS.map((kind) => <option key={kind} value={kind}>{kindLabel(lang, kind)}</option>)}</AdminSelect>
          <AdminSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'disabled')}><option value="all">{getAdminText(lang, 'result_all')}</option><option value="active">{getAdminText(lang, 'template_active')}</option><option value="disabled">{getAdminText(lang, 'template_disabled')}</option></AdminSelect>
        </div>
      </AdminSurface>

      <AdminSurface className="overflow-hidden">
        {loading.templates ? <div className="px-5 py-8 text-sm text-slate-400">{getAdminText(lang, 'notifications_failed')}</div> : filteredTemplates.length === 0 ? <div className="px-5 py-10"><AdminEmptyState title={getAdminText(lang, 'templates_empty')} body={getAdminText(lang, 'templates_subtitle')} /></div> : <div className="grid gap-4 p-5 xl:grid-cols-2">{filteredTemplates.map((template) => <div key={template.id} className="admin-surface-muted overflow-hidden">{template.assetPublicUrl ? <img src={template.assetPublicUrl} alt={template.title} className="h-40 w-full object-cover" /> : null}<div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-white">{template.title}</p><div className="mt-3 flex flex-wrap gap-2"><AdminBadge tone="neutral">{kindLabel(lang, template.kind)}</AdminBadge><AdminBadge tone={template.isActive ? 'success' : 'neutral'}>{template.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}</AdminBadge></div></div><div className="text-xs text-slate-500">{formatDateTime(lang, template.updatedAt)}</div></div><div className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">{template.bodyRu || template.bodyEn}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><AdminButton tone="primary" onClick={() => useTemplate(template)}>{getAdminText(lang, 'template_use')}</AdminButton><AdminButton tone="secondary" onClick={() => { setDraft({ id: template.id, title: template.title, bodyRu: template.bodyRu, bodyEn: template.bodyEn, kind: template.kind, assetId: template.assetId ?? null, isActive: template.isActive }); setEditorOpen(true); }}>{getAdminText(lang, 'template_edit')}</AdminButton><AdminButton tone="secondary" onClick={() => { setDraft({ id: null, title: `${template.title} Copy`, bodyRu: template.bodyRu, bodyEn: template.bodyEn, kind: template.kind, assetId: template.assetId ?? null, isActive: template.isActive }); setEditorOpen(true); }}>{getAdminText(lang, 'template_duplicate')}</AdminButton></div></div></div>)}</div>}
      </AdminSurface>

      {editorOpen ? <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-md"><div className="admin-sheet admin-scroll"><div className="admin-sticky-toolbar border-b border-white/10 bg-[#071220]/88 px-5 py-4"><div className="flex items-center justify-between gap-3"><AdminButton tone="ghost" className="min-h-[2.5rem] px-0" onClick={() => setEditorOpen(false)}>← {getAdminText(lang, 'close')}</AdminButton><AdminBadge tone={draft.isActive ? 'success' : 'neutral'}>{draft.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}</AdminBadge></div><div className="mt-4"><h3 className="admin-heading text-[28px] text-white">{draft.id ? getAdminText(lang, 'template_edit') : getAdminText(lang, 'template_new')}</h3></div></div><div className="space-y-4 px-5 py-5"><AdminInput value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder={getAdminText(lang, 'title')} /><AdminSelect value={draft.kind} onChange={(e) => setDraft((prev) => ({ ...prev, kind: e.target.value as AdminNotificationTemplateKind }))}>{KINDS.filter((item): item is AdminNotificationTemplateKind => item !== 'all').map((kind) => <option key={kind} value={kind}>{kindLabel(lang, kind)}</option>)}</AdminSelect><AdminSelect value={draft.assetId ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, assetId: e.target.value ? Number(e.target.value) : null }))}><option value="">{getAdminText(lang, 'no_image')}</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.fileName}</option>)}</AdminSelect><div className="flex flex-wrap gap-2"><AdminButton tone="secondary" onClick={() => inputRef.current?.click()}>{getAdminText(lang, 'upload_image')}</AdminButton><AdminButton tone="secondary" onClick={() => void loadAssets()}>{getAdminText(lang, 'refresh')}</AdminButton></div>{draft.assetId ? <div className="overflow-hidden rounded-[20px] border border-white/10"><img src={assets.find((asset) => asset.id === draft.assetId)?.publicUrl || ''} alt="" className="h-40 w-full object-cover" /></div> : null}<AdminTextarea rows={7} value={draft.bodyRu} onChange={(e) => setDraft((prev) => ({ ...prev, bodyRu: e.target.value }))} placeholder={getAdminText(lang, 'body_ru')} /><AdminTextarea rows={7} value={draft.bodyEn} onChange={(e) => setDraft((prev) => ({ ...prev, bodyEn: e.target.value }))} placeholder={getAdminText(lang, 'body_en')} /><div className="flex flex-wrap gap-3"><AdminButton tone={draft.isActive ? 'secondary' : 'primary'} onClick={() => setDraft((prev) => ({ ...prev, isActive: !prev.isActive }))}>{draft.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}</AdminButton><AdminButton tone="secondary" onClick={() => setDraft(templateDraft)}>{getAdminText(lang, 'reset')}</AdminButton></div><div className="admin-sticky-footer rounded-[22px] border border-sky-400/20 bg-[#081120]/92 p-4 backdrop-blur"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><p className="text-sm leading-6 text-slate-300">{lang === 'ru' ? 'Шаблон сохраняется без выхода из панели.' : 'Template is saved without leaving the panel.'}</p><AdminButton tone="primary" disabled={busy === 'template'} onClick={() => void saveTemplate()}>{busy === 'template' ? getAdminText(lang, 'sending') : getAdminText(lang, 'template_save')}</AdminButton></div></div></div></div></div> : null}
    </div>
  );

  const historyView = (
    <div className="space-y-5">
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader eyebrow="History" title={getAdminText(lang, 'history_title')} subtitle={getAdminText(lang, 'history_subtitle')} action={<AdminButton tone="secondary" onClick={() => void loadHistory(historyPagination.page)}>{getAdminText(lang, 'refresh')}</AdminButton>} />
        <div className="mt-6 grid gap-3 lg:grid-cols-2"><AdminSelect value={historyMode} onChange={(e) => { setHistoryMode(e.target.value as AdminNotificationModeFilter); setHistoryPagination((prev) => ({ ...prev, page: 1 })); }}>{HISTORY_MODES.map((item) => <option key={item} value={item}>{item === 'all' ? getAdminText(lang, 'result_all') : getAdminText(lang, item)}</option>)}</AdminSelect><AdminSelect value={historyResult} onChange={(e) => { setHistoryResult(e.target.value as AdminHistoryResultFilter); setHistoryPagination((prev) => ({ ...prev, page: 1 })); }}>{HISTORY_RESULTS.map((item) => <option key={item} value={item}>{item === 'all' ? getAdminText(lang, 'result_all') : getAdminText(lang, `result_${item}` as any)}</option>)}</AdminSelect></div>
      </AdminSurface>
      <AdminSurface className="overflow-hidden">
        {loading.history ? <div className="px-5 py-8 text-sm text-slate-400">{getAdminText(lang, 'refresh')}…</div> : history.length === 0 ? <div className="px-5 py-10"><AdminEmptyState title={getAdminText(lang, 'history_empty')} body={getAdminText(lang, 'history_subtitle')} /></div> : <><div className="grid gap-4 p-5 xl:grid-cols-2">{history.map((item) => <div key={item.id} className="admin-surface-muted overflow-hidden">{item.assetPublicUrl ? <img src={item.assetPublicUrl} alt={item.title} className="h-40 w-full object-cover" /> : null}<div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold text-white">{item.title}</p><AdminBadge tone={historyTone(item)}>{item.failedCount > 0 ? (item.successCount > 0 ? getAdminText(lang, 'result_partial') : getAdminText(lang, 'result_failed')) : getAdminText(lang, 'result_success')}</AdminBadge></div><p className="mt-3 text-sm leading-6 text-slate-400">{item.mode === 'personal' ? `${getAdminText(lang, 'personal')}: ${item.targetUserName || item.targetUserId || '—'}` : `${getAdminText(lang, 'broadcast')}: ${item.targetSegment ? segmentLabel(lang, item.targetSegment) : '—'}`}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(lang, item.createdAt)}</p></div><div className="text-right text-sm leading-6 text-slate-300"><p>{item.successCount}/{item.totalRecipients} {getAdminText(lang, 'sent_count')}</p><p className="mt-1 text-red-300">{item.failedCount} {getAdminText(lang, 'failed_count')}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><AdminButton tone="secondary" onClick={() => reuseCampaign(item)}>{getAdminText(lang, 'reuse')}</AdminButton>{item.recentFailures.length > 0 ? <AdminButton tone="ghost" onClick={() => setExpandedFailures((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}>{expandedFailures[item.id] ? getAdminText(lang, 'hide_failures') : getAdminText(lang, 'show_failures')}</AdminButton> : null}</div>{expandedFailures[item.id] && item.recentFailures.length > 0 ? <div className="mt-4 space-y-3">{item.recentFailures.map((failure) => <div key={`${item.id}-${failure.userId}-${failure.createdAt}`} className="rounded-[18px] border border-red-500/20 bg-red-500/8 p-4"><p className="text-sm text-red-100">{failure.userName}</p><p className="mt-1 text-xs leading-5 text-red-200/80">{failure.error}</p><p className="mt-2 text-xs text-slate-500">{formatDateTime(lang, failure.createdAt)}</p></div>)}</div> : null}</div></div>)}</div><AdminPagination page={historyPagination.page} totalPages={historyPagination.totalPages} total={historyPagination.total} pageSize={historyPagination.pageSize} label={getAdminText(lang, 'users_page')} onPageChange={(page) => setHistoryPagination((prev) => ({ ...prev, page }))} /></>}
      </AdminSurface>
    </div>
  );

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void uploadAsset(file, editorOpen ? 'template' : 'compose');
        e.target.value = '';
      }} />
      {section === 'send' ? sendView : null}
      {section === 'templates' ? templatesView : null}
      {section === 'history' ? historyView : null}
    </div>
  );
};

const PreviewPane: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="admin-surface-muted bg-[#08111f] p-4">
    <p className="admin-label">{label}</p>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value || '—'}</p>
  </div>
);
