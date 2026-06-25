import React, { useCallback, useEffect, useState } from 'react';
import type { AdminNotificationEngineStats, AdminNotificationDeliveryLogItem, UserProfile } from '../../types';
import {
  fetchAdminAiSettings,
  saveAdminAiModel,
  fetchNotificationEngineStats,
  fetchNotificationDeliveryLog,
  runNotificationSlot,
} from '../../services/adminService';
import {
  AdminBadge,
  AdminButton,
  AdminSelect,
  AdminSectionHeader,
  AdminStateBanner,
  AdminSurface,
} from './AdminPrimitives';

type Props = { profile: UserProfile };

type AiSettings = {
  modelId: string;
  storedModelId: string | null;
  envFallback: string;
  options: Array<{ id: string; label: string }>;
};

const SLOTS: Array<{ slot: string; ru: string; en: string }> = [
  { slot: 'morning', ru: 'Утро', en: 'Morning' },
  { slot: 'day', ru: 'День', en: 'Day' },
  { slot: 'evening', ru: 'Вечер', en: 'Evening' },
];

const fmtDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
};

export const AdminSystemTab: React.FC<Props> = ({ profile }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';

  // ── AI / генерация ──
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [aiModel, setAiModel] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // ── Движок уведомлений ──
  const [stats, setStats] = useState<AdminNotificationEngineStats | null>(null);
  const [log, setLog] = useState<AdminNotificationDeliveryLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSlot, setRunningSlot] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [aiSettings, engineStats, deliveryLog] = await Promise.all([
        fetchAdminAiSettings().catch(() => null),
        fetchNotificationEngineStats().catch(() => null),
        fetchNotificationDeliveryLog(8).catch(() => []),
      ]);
      if (aiSettings) { setAi(aiSettings); setAiModel(aiSettings.modelId); }
      setStats(engineStats);
      setLog(deliveryLog);
    } catch (e: any) {
      setError(e?.message || (lang === 'ru' ? 'Не удалось загрузить' : 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const saveModel = async () => {
    if (!aiModel) return;
    setAiSaving(true);
    setAiMsg(null);
    try {
      await saveAdminAiModel(aiModel);
      setAiMsg({ tone: 'success', text: lang === 'ru' ? 'Модель сохранена' : 'Model saved' });
    } catch (e: any) {
      setAiMsg({ tone: 'error', text: e?.message || (lang === 'ru' ? 'Не удалось сохранить' : 'Failed to save') });
    } finally {
      setAiSaving(false);
    }
  };

  const runSlot = async (slot: string) => {
    setRunningSlot(slot);
    setRunMsg(null);
    try {
      const result = await runNotificationSlot(slot);
      setRunMsg({
        tone: result.success ? 'success' : 'error',
        text: lang === 'ru'
          ? `Отправлено: ${result.successCount}/${result.totalRecipients}${result.failureCount ? `, ошибок: ${result.failureCount}` : ''}`
          : `Sent: ${result.successCount}/${result.totalRecipients}${result.failureCount ? `, failed: ${result.failureCount}` : ''}`,
      });
      await loadAll();
    } catch (e: any) {
      setRunMsg({ tone: 'error', text: e?.message || (lang === 'ru' ? 'Не удалось запустить' : 'Failed to run') });
    } finally {
      setRunningSlot(null);
    }
  };

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      {/* ── AI / генерация контента ── */}
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="AI"
          title={lang === 'ru' ? 'Генерация контента' : 'Content generation'}
          subtitle={lang === 'ru'
            ? 'Модель, которой Lumia пишет гороскопы, разборы и ответы. Влияет на всё приложение.'
            : 'The model Lumia uses for horoscopes, readings, and answers. Affects the whole app.'}
        />
        {aiMsg ? <div className="mt-4"><AdminStateBanner tone={aiMsg.tone === 'success' ? 'success' : 'error'}>{aiMsg.text}</AdminStateBanner></div> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="admin-field-label">{lang === 'ru' ? 'Модель' : 'Model'}</label>
            <AdminSelect value={aiModel} onChange={(e) => setAiModel(e.target.value)} disabled={!ai}>
              {(ai?.options || []).map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </AdminSelect>
          </div>
          <AdminButton tone="primary" onClick={() => void saveModel()} disabled={aiSaving || !ai || aiModel === ai?.modelId}>
            {aiSaving ? (lang === 'ru' ? 'Сохраняем…' : 'Saving…') : (lang === 'ru' ? 'Сохранить' : 'Save')}
          </AdminButton>
        </div>
        {ai ? (
          <p className="mt-3 text-xs text-slate-500">
            {lang === 'ru' ? 'Сейчас активна: ' : 'Active now: '}<span className="text-slate-300">{ai.modelId}</span>
            {ai.storedModelId ? '' : (lang === 'ru' ? ' (из env по умолчанию)' : ' (env default)')}
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">{lang === 'ru' ? 'Настройки AI недоступны.' : 'AI settings unavailable.'}</p>
        )}
      </AdminSurface>

      {/* ── Движок авто-уведомлений ── */}
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Engine"
          title={lang === 'ru' ? 'Авто-уведомления' : 'Automated notifications'}
          subtitle={lang === 'ru'
            ? 'Ежедневные пуши уходят по расписанию автоматически. Здесь — статистика и ручной запуск слота.'
            : 'Daily pushes are sent automatically on schedule. Here are the stats and a manual slot run.'}
          action={<AdminButton tone="secondary" onClick={() => void loadAll()} disabled={loading}>{lang === 'ru' ? 'Обновить' : 'Refresh'}</AdminButton>}
        />

        {runMsg ? <div className="mt-4"><AdminStateBanner tone={runMsg.tone === 'success' ? 'success' : 'error'}>{runMsg.text}</AdminStateBanner></div> : null}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={lang === 'ru' ? 'Отправлено' : 'Sent'} value={stats ? stats.sent : '—'} />
          <Stat label={lang === 'ru' ? 'Клики' : 'Clicks'} value={stats ? stats.clicked : '—'} />
          <Stat label="CTR" value={stats ? `${Math.round(stats.ctr * 100)}%` : '—'} />
          <Stat label={lang === 'ru' ? 'Ошибки' : 'Errors'} value={stats ? stats.errors : '—'} tone={stats && stats.errors > 0 ? 'warn' : undefined} />
        </div>

        <div className="mt-5">
          <p className="admin-field-label">{lang === 'ru' ? 'Запустить слот сейчас' : 'Run a slot now'}</p>
          <div className="flex flex-wrap gap-2">
            {SLOTS.map((s) => (
              <AdminButton
                key={s.slot}
                tone="secondary"
                onClick={() => void runSlot(s.slot)}
                disabled={runningSlot !== null}
              >
                {runningSlot === s.slot ? (lang === 'ru' ? 'Запуск…' : 'Running…') : (lang === 'ru' ? s.ru : s.en)}
              </AdminButton>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {lang === 'ru'
              ? 'Отправит соответствующий дневной пуш всем подходящим пользователям прямо сейчас.'
              : 'Sends the matching daily push to all eligible users right now.'}
          </p>
        </div>

        <div className="mt-6">
          <p className="admin-label">{lang === 'ru' ? 'Последние доставки' : 'Recent deliveries'}</p>
          {loading && log.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{lang === 'ru' ? 'Загружаем…' : 'Loading…'}</p>
          ) : log.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{lang === 'ru' ? 'Пока нет доставок.' : 'No deliveries yet.'}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {log.map((item) => {
                const tone = item.failureCount > 0 ? (item.successCount > 0 ? 'warning' : 'danger') : 'success';
                return (
                  <div key={item.id} className="admin-surface-muted flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{item.templateName || `#${item.id}`}</p>
                      <p className="text-xs text-slate-500">{fmtDateTime(lang, item.sentAt || item.createdAt)}</p>
                    </div>
                    <AdminBadge tone={tone}>{item.successCount}/{item.recipientCount}</AdminBadge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AdminSurface>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'warn' }> = ({ label, value, tone }) => (
  <div className="admin-surface-muted p-3.5">
    <p className="admin-label">{label}</p>
    <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-300' : 'text-white'}`}>{value}</p>
  </div>
);
