import React, { memo, useMemo } from 'react';
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
  visualLabelRu: Record<'none' | 'uploaded' | 'generated', string>;
}

const SLOT_LABEL: Record<string, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  custom: 'Свой слот',
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
    visualLabelRu,
  }) => {
    const bySlot = useMemo(() => {
      const m: Record<string, AdminScheduledNotificationTemplate[]> = {
        morning: [],
        day: [],
        evening: [],
        custom: [],
      };
      for (const t of templates) {
        const k = m[t.slot] ? t.slot : 'custom';
        m[k].push(t);
      }
      for (const k of Object.keys(m)) {
        m[k].sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id));
      }
      return m;
    }, [templates]);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg text-astro-text">Очередь по слотам</h3>
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg bg-astro-highlight px-4 py-2 text-xs font-semibold text-white"
          >
            Новый шаблон
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
              Запустить сейчас: {SLOT_LABEL[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-astro-subtext">Загрузка…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-astro-subtext">Пока нет шаблонов</p>
        ) : (
          <div className="space-y-4">
            {(['morning', 'day', 'evening', 'custom'] as const).map((slotKey) => {
              const list = bySlot[slotKey] || [];
              if (!list.length) return null;
              return (
                <div key={slotKey}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-astro-highlight/90">
                    {SLOT_LABEL[slotKey]} · в очереди {list.length}
                  </p>
                  <div className="space-y-2">
                    {list.map((t, idx) => (
                      <div
                        key={t.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          selectedId === t.id
                            ? 'border-astro-highlight/50 bg-astro-highlight/5'
                            : 'border-astro-border bg-astro-card/50'
                        }`}
                      >
                        <button type="button" onClick={() => onSelect(t)} className="w-full text-left">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-astro-text">
                                <span className="mr-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-astro-bg/80 px-1 text-[10px] text-astro-subtext">
                                  {idx + 1}
                                </span>
                                {t.name}
                              </p>
                              <p className="mt-1 text-[11px] text-astro-subtext">
                                {t.schedules?.[0]?.sendTime ? `${t.schedules[0].sendTime} · ` : ''}
                                {visualLabelRu[t.visualMode] || t.visualMode}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-astro-subtext/90">{t.text}</p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${
                                t.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-astro-bg text-astro-subtext'
                              }`}
                            >
                              {t.isActive ? 'Вкл' : 'Выкл'}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-astro-subtext">
                            <span>обновлён {new Date(t.updatedAt).toLocaleString('ru-RU')}</span>
                          </div>
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2 border-t border-astro-border/40 pt-2">
                          <button
                            type="button"
                            onClick={() => onToggleActive(t.id, !t.isActive)}
                            className="text-xs text-astro-highlight"
                          >
                            {t.isActive ? 'Выключить' : 'Включить'}
                          </button>
                          <button type="button" onClick={() => onTestSend(t.id)} className="text-xs text-astro-text">
                            Тест
                          </button>
                          <button type="button" onClick={() => onDuplicate(t)} className="text-xs text-astro-text">
                            Дублировать
                          </button>
                          <button type="button" onClick={() => onDelete(t.id)} className="text-xs text-red-300">
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

NotificationTemplateList.displayName = 'NotificationTemplateList';
