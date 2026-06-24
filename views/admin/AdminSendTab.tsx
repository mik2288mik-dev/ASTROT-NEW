import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminNotificationHistoryItem,
  AdminNotificationTargetSegment,
  UserProfile,
} from '../../types';
import { sendNotification, fetchNotificationHistory } from '../../services/adminService';
import {
  AdminBadge,
  AdminButton,
  AdminInput,
  AdminSectionHeader,
  AdminSelect,
  AdminStateBanner,
  AdminSurface,
  AdminTextarea,
} from './AdminPrimitives';

type Props = {
  profile: UserProfile;
  initialTargetUserId?: string;
  onClearInitialTarget?: () => void;
};

/** Значение «кому»: либо конкретный пользователь, либо сегмент рассылки. */
type Audience = 'user' | AdminNotificationTargetSegment;

const AUDIENCES: Array<{ value: Audience; ru: string; en: string }> = [
  { value: 'user', ru: 'Конкретный пользователь', en: 'Specific user' },
  { value: 'all', ru: 'Все пользователи', en: 'All users' },
  { value: 'premium', ru: 'Только Premium', en: 'Premium only' },
  { value: 'free', ru: 'Только Free', en: 'Free only' },
  { value: 'active_7d', ru: 'Активные (7 дней)', en: 'Active (7d)' },
  { value: 'inactive_7d', ru: 'Не заходили 7 дней', en: 'Inactive 7d' },
  { value: 'inactive_30d', ru: 'Не заходили 30 дней', en: 'Inactive 30d' },
  { value: 'need_attention', ru: 'Нужно внимание', en: 'Need attention' },
];

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
};

export const AdminSendTab: React.FC<Props> = ({ profile, initialTargetUserId, onClearInitialTarget }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';

  const [audience, setAudience] = useState<Audience>(initialTargetUserId ? 'user' : 'all');
  const [userId, setUserId] = useState(initialTargetUserId || '');
  const [title, setTitle] = useState('');
  const [bodyRu, setBodyRu] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const [history, setHistory] = useState<AdminNotificationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (initialTargetUserId) {
      setAudience('user');
      setUserId(initialTargetUserId);
    }
  }, [initialTargetUserId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const payload = await fetchNotificationHistory({ page: 1, pageSize: 12 });
      setHistory(payload.history);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const audienceLabel = useMemo(
    () => AUDIENCES.find((a) => a.value === audience),
    [audience],
  );

  const canSend = title.trim().length > 0
    && bodyRu.trim().length > 0
    && (audience !== 'user' || userId.trim().length > 0)
    && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);
    try {
      const isPersonal = audience === 'user';
      const { campaign } = await sendNotification({
        mode: isPersonal ? 'personal' : 'broadcast',
        targetUserId: isPersonal ? userId.trim() : null,
        targetSegment: isPersonal ? null : (audience as AdminNotificationTargetSegment),
        title: title.trim(),
        bodyRu: bodyRu.trim(),
        // EN-пользователям шлём английский текст, а если его нет — русский (чтобы дошло всем).
        bodyEn: bodyEn.trim() || bodyRu.trim(),
      });
      const ok = campaign.successCount;
      const total = campaign.totalRecipients;
      setResult({
        tone: campaign.failedCount > 0 && campaign.successCount === 0 ? 'error' : 'success',
        message: lang === 'ru'
          ? `Отправлено: ${ok} из ${total}${campaign.failedCount > 0 ? `, с ошибкой: ${campaign.failedCount}` : ''}`
          : `Sent: ${ok} of ${total}${campaign.failedCount > 0 ? `, failed: ${campaign.failedCount}` : ''}`,
      });
      setTitle('');
      setBodyRu('');
      setBodyEn('');
      onClearInitialTarget?.();
      await loadHistory();
    } catch (error: any) {
      setResult({
        tone: 'error',
        message: error?.message || (lang === 'ru' ? 'Не удалось отправить' : 'Failed to send'),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Push"
          title={lang === 'ru' ? 'Отправить уведомление' : 'Send a notification'}
          subtitle={lang === 'ru'
            ? 'Напишите заголовок и текст, выберите кому — и отправьте в Telegram. Дойдёт сразу.'
            : 'Write a title and text, pick the audience, and send to Telegram. Delivered instantly.'}
        />

        {result ? (
          <div className="mt-5">
            <AdminStateBanner tone={result.tone}>{result.message}</AdminStateBanner>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div>
            <label className="admin-field-label">{lang === 'ru' ? 'Кому' : 'Audience'}</label>
            <AdminSelect value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{lang === 'ru' ? a.ru : a.en}</option>
              ))}
            </AdminSelect>
          </div>

          {audience === 'user' ? (
            <div>
              <label className="admin-field-label">{lang === 'ru' ? 'Telegram ID пользователя' : 'User Telegram ID'}</label>
              <AdminInput
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="123456789"
                inputMode="numeric"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {lang === 'ru'
                ? `Получат все в сегменте «${audienceLabel ? audienceLabel.ru : ''}».`
                : `Everyone in the "${audienceLabel ? audienceLabel.en : ''}" segment will receive it.`}
            </p>
          )}

          <div>
            <label className="admin-field-label">{lang === 'ru' ? 'Заголовок' : 'Title'}</label>
            <AdminInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'ru' ? 'Например: Загляни в гороскоп на сегодня' : 'e.g. Check today\'s horoscope'}
              maxLength={120}
            />
          </div>

          <div>
            <label className="admin-field-label">{lang === 'ru' ? 'Текст' : 'Text'}</label>
            <AdminTextarea
              value={bodyRu}
              onChange={(e) => setBodyRu(e.target.value)}
              placeholder={lang === 'ru' ? 'Текст уведомления на русском…' : 'Notification text in Russian…'}
              maxLength={600}
            />
          </div>

          <details className="admin-surface-muted px-4 py-3">
            <summary className="cursor-pointer text-sm text-slate-300">
              {lang === 'ru' ? 'Текст на английском (необязательно)' : 'English text (optional)'}
            </summary>
            <div className="mt-3">
              <AdminTextarea
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                placeholder={lang === 'ru' ? 'Если пусто — англоязычным уйдёт русский текст.' : 'If empty, EN users get the Russian text.'}
                maxLength={600}
              />
            </div>
          </details>

          <div className="flex items-center gap-3 pt-1">
            <AdminButton tone="primary" onClick={() => void submit()} disabled={!canSend}>
              {sending ? (lang === 'ru' ? 'Отправляем…' : 'Sending…') : (lang === 'ru' ? 'Отправить сейчас' : 'Send now')}
            </AdminButton>
            {!title.trim() || !bodyRu.trim() ? (
              <span className="text-xs text-slate-500">
                {lang === 'ru' ? 'Заполните заголовок и текст' : 'Fill in title and text'}
              </span>
            ) : null}
          </div>
        </div>
      </AdminSurface>

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="admin-label">{lang === 'ru' ? 'История' : 'History'}</p>
            <h3 className="admin-heading mt-2 text-xl text-white">
              {lang === 'ru' ? 'Последние отправки' : 'Recent sends'}
            </h3>
          </div>
          <AdminButton tone="secondary" onClick={() => void loadHistory()} disabled={historyLoading}>
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </AdminButton>
        </div>

        {historyLoading ? (
          <p className="mt-5 text-sm text-slate-400">{lang === 'ru' ? 'Загружаем…' : 'Loading…'}</p>
        ) : history.length === 0 ? (
          <p className="mt-5 text-sm text-slate-400">
            {lang === 'ru' ? 'Пока ничего не отправляли.' : 'Nothing sent yet.'}
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {history.map((item) => {
              const tone = item.failedCount > 0
                ? (item.successCount > 0 ? 'warning' : 'danger')
                : 'success';
              return (
                <div key={item.id} className="admin-surface-muted px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(lang, item.createdAt)}</p>
                    </div>
                    <AdminBadge tone={tone}>
                      {item.successCount}/{item.totalRecipients}
                    </AdminBadge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {item.mode === 'personal'
                      ? (lang === 'ru' ? 'Личное' : 'Personal')
                      : (lang === 'ru' ? 'Рассылка' : 'Broadcast')}
                    {item.failedCount > 0 ? ` · ${lang === 'ru' ? 'ошибок' : 'failed'}: ${item.failedCount}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </AdminSurface>
    </div>
  );
};
