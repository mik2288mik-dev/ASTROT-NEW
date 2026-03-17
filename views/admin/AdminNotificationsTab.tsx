import React, { useEffect, useMemo, useState } from 'react';
import {
  type AdminNotificationHistoryItem,
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

interface AdminNotificationsTabProps {
  profile: UserProfile;
  initialTargetUserId?: string;
  onClearInitialTarget?: () => void;
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);
const SEGMENTS: AdminNotificationTargetSegment[] = ['all', 'premium', 'free', 'active_7d', 'inactive_30d'];
const KINDS: AdminNotificationTemplateKind[] = ['both', 'personal', 'broadcast'];

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return lang === 'ru' ? 'Нет данных' : 'No data';
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getSegmentLabel = (lang: 'ru' | 'en', value: AdminNotificationTargetSegment) => {
  const labels: Record<AdminNotificationTargetSegment, { ru: string; en: string }> = {
    all: { ru: 'Все пользователи', en: 'All users' },
    premium: { ru: 'Premium', en: 'Premium' },
    free: { ru: 'Free', en: 'Free' },
    active_7d: { ru: 'Активные за 7 дней', en: 'Active in last 7 days' },
    inactive_30d: { ru: 'Неактивные 30+ дней', en: 'Inactive 30+ days' },
  };
  return labels[value][lang];
};

const getKindLabel = (lang: 'ru' | 'en', value: AdminNotificationTemplateKind) => {
  const labels: Record<AdminNotificationTemplateKind, { ru: string; en: string }> = {
    both: { ru: 'Личное и массовое', en: 'Personal and broadcast' },
    personal: { ru: 'Личное', en: 'Personal' },
    broadcast: { ru: 'Массовое', en: 'Broadcast' },
  };
  return labels[value][lang];
};

const emptyTemplateDraft = {
  id: null as number | null,
  title: '',
  bodyRu: '',
  bodyEn: '',
  kind: 'both' as AdminNotificationTemplateKind,
  isActive: true,
};

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({
  profile,
  initialTargetUserId,
  onClearInitialTarget,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [templates, setTemplates] = useState<AdminNotificationTemplate[]>([]);
  const [history, setHistory] = useState<AdminNotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<'personal' | 'broadcast'>(initialTargetUserId ? 'personal' : 'broadcast');
  const [targetUserId, setTargetUserId] = useState(initialTargetUserId || '');
  const [targetSegment, setTargetSegment] = useState<AdminNotificationTargetSegment>('all');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [bodyRu, setBodyRu] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [draft, setDraft] = useState(emptyTemplateDraft);

  const filteredTemplates = useMemo(
    () => templates.filter((template) => template.isActive && (template.kind === 'both' || template.kind === mode)),
    [mode, templates]
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTemplates, nextHistory] = await Promise.all([
        fetchNotificationTemplates(),
        fetchNotificationHistory(20),
      ]);
      setTemplates(nextTemplates);
      setHistory(nextHistory);
    } catch (loadError: any) {
      setError(loadError?.message || T(lang, 'Не удалось загрузить уведомления', 'Failed to load notifications'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (initialTargetUserId) {
      setMode('personal');
      setTargetUserId(initialTargetUserId);
      onClearInitialTarget?.();
    }
  }, [initialTargetUserId, onClearInitialTarget]);

  const handleUseTemplate = (template: AdminNotificationTemplate) => {
    setTemplateId(template.id);
    setTitle(template.title);
    setBodyRu(template.bodyRu);
    setBodyEn(template.bodyEn);
    if (template.kind === 'personal' || template.kind === 'broadcast') {
      setMode(template.kind);
    }
  };

  const handleEditTemplate = (template?: AdminNotificationTemplate) => {
    if (!template) {
      setDraft(emptyTemplateDraft);
      return;
    }
    setDraft({
      id: template.id,
      title: template.title,
      bodyRu: template.bodyRu,
      bodyEn: template.bodyEn,
      kind: template.kind,
      isActive: template.isActive,
    });
  };

  const handleSaveTemplate = async () => {
    if (!draft.title.trim()) {
      setError(T(lang, 'У шаблона должен быть заголовок', 'Template title is required'));
      return;
    }
    if (!draft.bodyRu.trim() && !draft.bodyEn.trim()) {
      setError(T(lang, 'Добавьте текст хотя бы на одном языке', 'Add body text in at least one language'));
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

      await loadData();
      handleEditTemplate(savedTemplate);
    } catch (saveError: any) {
      setError(saveError?.message || T(lang, 'Не удалось сохранить шаблон', 'Failed to save template'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSend = async () => {
    if (!title.trim()) {
      setError(T(lang, 'Укажите заголовок уведомления', 'Notification title is required'));
      return;
    }
    if (!bodyRu.trim() && !bodyEn.trim()) {
      setError(T(lang, 'Добавьте текст хотя бы на одном языке', 'Add body text in at least one language'));
      return;
    }
    if (mode === 'personal' && !targetUserId.trim()) {
      setError(T(lang, 'Укажите Telegram ID пользователя', 'Target user Telegram ID is required'));
      return;
    }

    setActionLoading('send');
    setError(null);
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
      setHistory((prev) => [result.campaign, ...prev].slice(0, 20));
    } catch (sendError: any) {
      setError(sendError?.message || T(lang, 'Не удалось отправить уведомление', 'Failed to send notification'));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-astro-border bg-astro-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg text-astro-text">{T(lang, 'Отправка уведомлений', 'Send notifications')}</h3>
              <p className="mt-1 text-xs text-astro-subtext">{T(lang, 'Личные сообщения и массовые рассылки через Telegram', 'Personal and broadcast Telegram messages')}</p>
            </div>
            {loading && <span className="text-xs text-astro-subtext">{T(lang, 'Загрузка...', 'Loading...')}</span>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMode('personal')}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                mode === 'personal'
                  ? 'bg-astro-highlight text-white'
                  : 'border border-astro-border text-astro-subtext hover:border-astro-highlight/40 hover:text-astro-text'
              }`}
            >
              {T(lang, 'Личное', 'Personal')}
            </button>
            <button
              onClick={() => setMode('broadcast')}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                mode === 'broadcast'
                  ? 'bg-astro-highlight text-white'
                  : 'border border-astro-border text-astro-subtext hover:border-astro-highlight/40 hover:text-astro-text'
              }`}
            >
              {T(lang, 'Массовое', 'Broadcast')}
            </button>
          </div>

          {mode === 'personal' ? (
            <input
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              placeholder={T(lang, 'Telegram ID пользователя', 'Target user Telegram ID')}
              className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
            />
          ) : (
            <select
              value={targetSegment}
              onChange={(event) => setTargetSegment(event.target.value as AdminNotificationTargetSegment)}
              className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
            >
              {SEGMENTS.map((segment) => (
                <option key={segment} value={segment}>{getSegmentLabel(lang, segment)}</option>
              ))}
            </select>
          )}

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
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
          >
            <option value="">{T(lang, 'Без шаблона', 'No template')}</option>
            {filteredTemplates.map((template: AdminNotificationTemplate) => (
              <option key={template.id} value={template.id}>{template.title}</option>
            ))}
          </select>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={T(lang, 'Заголовок', 'Title')}
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <textarea
              value={bodyRu}
              onChange={(event) => setBodyRu(event.target.value)}
              rows={5}
              placeholder="RU"
              className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
            />
            <textarea
              value={bodyEn}
              onChange={(event) => setBodyEn(event.target.value)}
              rows={5}
              placeholder="EN"
              className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={actionLoading === 'send'}
            className="rounded-lg bg-astro-highlight px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {actionLoading === 'send' ? T(lang, 'Отправляем...', 'Sending...') : T(lang, 'Отправить уведомление', 'Send notification')}
          </button>
        </div>

        <div className="rounded-2xl border border-astro-border bg-astro-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-serif text-lg text-astro-text">{T(lang, 'Шаблоны сообщений', 'Message templates')}</h3>
            <button onClick={() => handleEditTemplate()} className="rounded-lg border border-astro-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-astro-text">
              {T(lang, 'Новый шаблон', 'New template')}
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="rounded-lg border border-astro-border bg-astro-bg/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-astro-text">{template.title}</p>
                      <p className="mt-1 text-xs text-astro-subtext">{getKindLabel(lang, template.kind)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${template.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-astro-bg text-astro-subtext'}`}>
                      {template.isActive ? T(lang, 'Активен', 'Active') : T(lang, 'Выключен', 'Disabled')}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => handleUseTemplate(template)} className="rounded-lg border border-astro-border px-3 py-2 text-xs font-semibold uppercase tracking-widest text-astro-text">
                      {T(lang, 'Использовать', 'Use')}
                    </button>
                    <button onClick={() => handleEditTemplate(template)} className="rounded-lg border border-astro-border px-3 py-2 text-xs font-semibold uppercase tracking-widest text-astro-text">
                      {T(lang, 'Редактировать', 'Edit')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4 space-y-4">
              <h4 className="font-medium text-astro-text">{draft.id ? T(lang, 'Редактирование шаблона', 'Edit template') : T(lang, 'Новый шаблон', 'New template')}</h4>
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={T(lang, 'Заголовок', 'Title')}
                className="w-full rounded-lg border border-astro-border bg-astro-card px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
              />
              <select
                value={draft.kind}
                onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value as AdminNotificationTemplateKind }))}
                className="w-full rounded-lg border border-astro-border bg-astro-card px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>{getKindLabel(lang, kind)}</option>
                ))}
              </select>
              <textarea
                value={draft.bodyRu}
                onChange={(event) => setDraft((prev) => ({ ...prev, bodyRu: event.target.value }))}
                rows={4}
                placeholder="RU"
                className="w-full rounded-lg border border-astro-border bg-astro-card px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
              />
              <textarea
                value={draft.bodyEn}
                onChange={(event) => setDraft((prev) => ({ ...prev, bodyEn: event.target.value }))}
                rows={4}
                placeholder="EN"
                className="w-full rounded-lg border border-astro-border bg-astro-card px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
              />
              <button
                onClick={() => setDraft((prev) => ({ ...prev, isActive: !prev.isActive }))}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${draft.isActive ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border border-astro-border bg-astro-card text-astro-subtext'}`}
              >
                {draft.isActive ? T(lang, 'Активен', 'Active') : T(lang, 'Выключен', 'Disabled')}
              </button>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleSaveTemplate} disabled={actionLoading === 'template-save'} className="rounded-lg bg-astro-highlight px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {actionLoading === 'template-save' ? T(lang, 'Сохраняем...', 'Saving...') : T(lang, 'Сохранить шаблон', 'Save template')}
                </button>
                <button onClick={() => setDraft(emptyTemplateDraft)} className="rounded-lg border border-astro-border px-4 py-2 text-sm font-semibold text-astro-text">
                  {T(lang, 'Сбросить', 'Reset')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-astro-border bg-astro-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-serif text-lg text-astro-text">{T(lang, 'История отправок', 'Notification history')}</h3>
          <button onClick={() => void loadData()} className="rounded-lg border border-astro-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-astro-text">
            {T(lang, 'Обновить', 'Refresh')}
          </button>
        </div>

        {loading && history.length === 0 ? (
          <p className="text-sm text-astro-subtext">{T(lang, 'Загружаем историю...', 'Loading history...')}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-astro-subtext">{T(lang, 'История отправок пока пуста', 'No notification history yet')}</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-astro-text">{item.title}</p>
                    <p className="mt-1 text-xs text-astro-subtext">
                      {item.mode === 'personal'
                        ? `${T(lang, 'Личное', 'Personal')}: ${item.targetUserName || item.targetUserId || '—'}`
                        : `${T(lang, 'Массовое', 'Broadcast')}: ${item.targetSegment ? getSegmentLabel(lang, item.targetSegment) : '—'}`}
                    </p>
                    <p className="mt-1 text-xs text-astro-subtext">{formatDateTime(lang, item.createdAt)}</p>
                  </div>
                  <div className="text-right text-xs text-astro-subtext">
                    <p>{item.successCount}/{item.totalRecipients} {T(lang, 'доставлено', 'sent')}</p>
                    <p className="mt-1 text-red-300">{item.failedCount} {T(lang, 'ошибок', 'failed')}</p>
                  </div>
                </div>
                {item.recentFailures.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {item.recentFailures.map((failure) => (
                      <div key={`${item.id}-${failure.userId}-${failure.createdAt}`} className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                        <p className="text-sm text-red-200">{failure.userName}</p>
                        <p className="mt-1 text-xs text-red-200/80">{failure.error}</p>
                        <p className="mt-1 text-xs text-astro-subtext">{formatDateTime(lang, failure.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
