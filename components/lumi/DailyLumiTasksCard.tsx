import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getText } from '../../constants';
import type { DailyLumiTaskKey, DailyLumiTasksStatus, Language } from '../../types';
import { getDailyLumiTasksStatus } from '../../services/storageService';
import { cn } from '../../lib/cn';

const FALLBACK_TASKS: Array<{ key: DailyLumiTaskKey; reward: number }> = [
  { key: 'open_horoscope', reward: 5 },
  { key: 'open_chart', reward: 5 },
];

function replaceVars(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (value, [key, next]) => value.replace(new RegExp(`\\{${key}\\}`, 'g'), String(next)),
    template
  );
}

function getTaskTitle(language: Language, key: DailyLumiTaskKey) {
  if (key === 'open_chart') {
    return getText(language, 'lumi_wallet.daily_task_open_chart');
  }
  return getText(language, 'lumi_wallet.daily_task_open_horoscope');
}

interface DailyLumiTasksCardProps {
  userId?: string;
  language: Language;
  onBalanceUpdate?: (balance: number) => void;
  compact?: boolean;
  className?: string;
}

export const DailyLumiTasksCard: React.FC<DailyLumiTasksCardProps> = ({
  userId,
  language,
  onBalanceUpdate,
  compact = false,
  className,
}) => {
  const [status, setStatus] = useState<DailyLumiTasksStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!userId) return;
    try {
      const nextStatus = await getDailyLumiTasksStatus(userId);
      setStatus(nextStatus);
      onBalanceUpdate?.(nextStatus.lumiBalance);
      setError(null);
    } catch (statusError: any) {
      setError(
        statusError?.message ||
          (language === 'ru'
            ? 'Не удалось загрузить ежедневные задания'
            : 'Failed to load daily tasks')
      );
    }
  }, [language, onBalanceUpdate, userId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const tasks = useMemo(
    () =>
      status?.tasks?.length
        ? status.tasks
        : FALLBACK_TASKS.map((task) => ({
            ...task,
            completed: false,
            completedAt: null,
          })),
    [status?.tasks]
  );

  const completedCount = status?.completedCount ?? tasks.filter((task) => task.completed).length;
  const totalReward = status?.totalReward ?? tasks.reduce((sum, task) => sum + task.reward, 0);
  const earnedToday = status?.earnedToday ?? tasks.reduce((sum, task) => sum + (task.completed ? task.reward : 0), 0);
  const allDone = tasks.length > 0 && completedCount === tasks.length;

  return (
    <section
      className={cn(
        'rounded-[28px] border border-black/8 bg-white/82 shadow-[0_18px_44px_rgba(0,0,0,0.07)]',
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="lumia-label tracking-[0.18em]">{getText(language, 'lumi_wallet.daily_tasks_kicker')}</p>
          <h2 className={cn('mt-1.5 font-serif text-astro-text', compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl')}>
            {getText(language, 'lumi_wallet.daily_tasks_title')}
          </h2>
          <p className={cn('mt-2 leading-relaxed text-astro-subtext', compact ? 'text-sm' : 'text-sm sm:text-[15px]')}>
            {replaceVars(getText(language, 'lumi_wallet.daily_tasks_subtitle'), { amount: totalReward })}
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-black/8 bg-white/78 px-3 py-1 text-[11px] font-medium text-astro-text shadow-sm">
          {replaceVars(getText(language, 'lumi_wallet.daily_tasks_progress'), {
            done: completedCount,
            total: tasks.length,
          })}
        </div>
      </div>

      <div className={cn('mt-4 space-y-3', compact ? '' : 'mt-5')}>
        {tasks.map((task, index) => (
          <div
            key={task.key}
            className={cn(
              'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3',
              task.completed
                ? 'border-emerald-300/50 bg-emerald-50/70'
                : 'border-black/7 bg-white/72'
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                  task.completed
                    ? 'border-emerald-400/60 bg-emerald-500/12 text-emerald-700'
                    : 'border-black/10 bg-black/[0.03] text-astro-text'
                )}
              >
                {task.completed ? 'OK' : index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-astro-text">{getTaskTitle(language, task.key)}</p>
                <p className="mt-1 text-xs text-astro-subtext">
                  {task.completed
                    ? getText(language, 'lumi_wallet.daily_tasks_status_done')
                    : getText(language, 'lumi_wallet.daily_tasks_status_open')}
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-black/8 bg-white/90 px-3 py-1 text-xs font-medium text-astro-text">
              {replaceVars(getText(language, 'lumi_wallet.daily_tasks_reward'), { amount: task.reward })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <p className={cn('leading-relaxed', allDone ? 'text-emerald-700' : 'text-astro-subtext')}>
          {allDone
            ? getText(language, 'lumi_wallet.daily_tasks_done')
            : `${earnedToday}/${totalReward} Lumi`}
        </p>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    </section>
  );
};
