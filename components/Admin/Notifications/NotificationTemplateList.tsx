import React, { memo } from 'react';
import type { AdminScheduledNotificationTemplate, NotificationSlot } from '../../../types';

interface NotificationTemplateListProps {
  templates: AdminScheduledNotificationTemplate[];
  selectedId: number | null;
  onSelect: (t: AdminScheduledNotificationTemplate | null) => void;
  onDuplicate: (t: AdminScheduledNotificationTemplate) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
  onTestSend: (id: number) => void;
  onRunSlot: (slot: NotificationSlot) => void;
  onNew: () => void;
  loading: boolean;
  lang: 'ru' | 'en';
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

const slotLabel = (lang: 'ru' | 'en', slot: string) => {
  const m: Record<string, { ru: string; en: string }> = {
    morning: { ru: 'Утро', en: 'Morning' },
    day: { ru: 'День', en: 'Day' },
    evening: { ru: 'Вечер', en: 'Evening' },
    custom: { ru: 'Свой', en: 'Custom' },
  };
  return (m[slot] || m.custom)[lang];
};

export const NotificationTemplateList = memo<NotificationTemplateListProps>(
  ({
    templates,
    selectedId,
    onSelect,
    onDuplicate,
    onDelete,
    onToggleActive,
    onTestSend,
    onRunSlot,
    onNew,
    loading,
    lang,
  }) => {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg text-astro-text">
            {T(lang, 'Шаблоны рассылки', 'Scheduled templates')}
          </h3>
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg bg-astro-highlight px-4 py-2 text-xs font-semibold text-white"
          >
            {T(lang, 'Новый', 'New')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl bg-astro-bg/30 p-2">
          {(['morning', 'day', 'evening'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onRunSlot(s)}
              className="rounded-lg border border-astro-border px-3 py-1.5 text-[11px] font-medium text-astro-text"
            >
              {T(lang, `Запуск слота: ${slotLabel(lang, s)}`, `Run ${s} slot`)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-astro-subtext">{T(lang, 'Загрузка…', 'Loading…')}</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-astro-subtext">{T(lang, 'Пока пусто', 'No templates yet')}</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`rounded-xl border p-3 transition-colors ${
                  selectedId === t.id ? 'border-astro-highlight/50 bg-astro-highlight/5' : 'border-astro-border bg-astro-card/50'
                }`}
              >
                <button type="button" onClick={() => onSelect(t)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-astro-text">{t.name}</p>
                      <p className="mt-1 text-[11px] text-astro-subtext">
                        {slotLabel(lang, t.slot)} · {t.messageType}
                        {t.schedules?.[0]?.sendTime ? ` · ${t.schedules[0].sendTime}` : ''}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-astro-subtext/90">{t.text}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        t.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-astro-bg text-astro-subtext'
                      }`}
                    >
                      {t.isActive ? T(lang, 'Вкл', 'On') : T(lang, 'Выкл', 'Off')}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-astro-subtext">
                    <span>{t.assetId ? T(lang, 'с фото', 'with image') : T(lang, 'без фото', 'no image')}</span>
                    <span>·</span>
                    <span>{new Date(t.updatedAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}</span>
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap gap-2 border-t border-astro-border/40 pt-2">
                  <button
                    type="button"
                    onClick={() => onToggleActive(t.id, !t.isActive)}
                    className="text-xs text-astro-highlight"
                  >
                    {t.isActive ? T(lang, 'Выключить', 'Disable') : T(lang, 'Включить', 'Enable')}
                  </button>
                  <button type="button" onClick={() => onTestSend(t.id)} className="text-xs text-astro-text">
                    {T(lang, 'Тест', 'Test')}
                  </button>
                  <button type="button" onClick={() => onDuplicate(t)} className="text-xs text-astro-text">
                    {T(lang, 'Дублировать', 'Duplicate')}
                  </button>
                  <button type="button" onClick={() => onDelete(t.id)} className="text-xs text-red-300">
                    {T(lang, 'Удалить', 'Delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

NotificationTemplateList.displayName = 'NotificationTemplateList';
