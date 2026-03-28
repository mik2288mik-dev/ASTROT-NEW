import React, { memo } from 'react';
import type { AdminNotificationSchedule } from '../../../types';

export interface ScheduleRow {
  id?: number;
  sendTime: string;
  timezone: string;
  repeatMode: string;
  isActive: boolean;
}

interface NotificationScheduleEditorProps {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  lang: 'ru' | 'en';
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

export const NotificationScheduleEditor = memo<NotificationScheduleEditorProps>(({ rows, onChange, lang }) => {
  const update = (index: number, patch: Partial<ScheduleRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-astro-subtext">
        {T(lang, 'Время отправки (ежедневно)', 'Daily send time')}
      </p>
      {rows.map((row, index) => (
        <div key={row.id ?? `new-${index}`} className="flex flex-wrap items-end gap-2 rounded-lg bg-astro-bg/30 p-2">
          <label className="flex flex-col text-[10px] uppercase text-astro-subtext">
            HH:mm
            <input
              type="time"
              value={row.sendTime.length === 5 ? row.sendTime : row.sendTime.slice(0, 5)}
              onChange={(e) => update(index, { sendTime: e.target.value })}
              className="mt-1 rounded border border-astro-border bg-astro-bg px-2 py-1.5 text-sm text-astro-text"
            />
          </label>
          <label className="min-w-[140px] flex flex-col text-[10px] uppercase text-astro-subtext">
            TZ
            <input
              value={row.timezone}
              onChange={(e) => update(index, { timezone: e.target.value })}
              className="mt-1 rounded border border-astro-border bg-astro-bg px-2 py-1.5 text-sm text-astro-text"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-astro-text">
            <input
              type="checkbox"
              checked={row.isActive}
              onChange={(e) => update(index, { isActive: e.target.checked })}
            />
            {T(lang, 'Активно', 'Active')}
          </label>
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            className="ml-auto text-xs text-red-300"
          >
            {T(lang, 'Удалить строку', 'Remove')}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...rows,
            { sendTime: '09:00', timezone: 'Europe/Moscow', repeatMode: 'daily', isActive: true },
          ])
        }
        className="text-xs font-medium text-astro-highlight"
      >
        + {T(lang, 'Добавить время', 'Add time')}
      </button>
    </div>
  );
});

NotificationScheduleEditor.displayName = 'NotificationScheduleEditor';

export function schedulesToRows(schedules: AdminNotificationSchedule[] | undefined): ScheduleRow[] {
  if (!schedules?.length) {
    return [{ sendTime: '08:00', timezone: 'Europe/Moscow', repeatMode: 'daily', isActive: true }];
  }
  return schedules.map((s) => ({
    id: s.id,
    sendTime: s.sendTime,
    timezone: s.timezone,
    repeatMode: s.repeatMode || 'daily',
    isActive: s.isActive,
  }));
}
