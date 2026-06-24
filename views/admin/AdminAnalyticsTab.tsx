import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../../types';
import { fetchAdminAnalytics, type AdminAnalytics } from '../../services/adminService';
import { AdminBadge, AdminButton, AdminSectionHeader, AdminStateBanner, AdminSurface } from './AdminPrimitives';

type Props = {
  profile: UserProfile;
  onOpenUsers?: () => void;
};

const FUNNEL_LABELS: Record<string, { ru: string; en: string; hint_ru: string; hint_en: string }> = {
  opened: {
    ru: 'Открыли приложение',
    en: 'Opened the app',
    hint_ru: 'Все, кто хотя бы раз зашёл',
    hint_en: 'Everyone who opened at least once',
  },
  birth_data: {
    ru: 'Указали дату рождения',
    en: 'Set birth date',
    hint_ru: 'Прошли первый шаг онбординга',
    hint_en: 'Completed the first onboarding step',
  },
  chart: {
    ru: 'Построили натальную карту',
    en: 'Built natal chart',
    hint_ru: 'Главная ценность продукта',
    hint_en: 'Core product value',
  },
  returned: {
    ru: 'Вернулись (2+ визита)',
    en: 'Returned (2+ visits)',
    hint_ru: 'Не ушли после первого раза',
    hint_en: 'Did not churn after first visit',
  },
  paywall: {
    ru: 'Открыли экран Premium',
    en: 'Opened Premium screen',
    hint_ru: 'Дошли до оплаты',
    hint_en: 'Reached the paywall',
  },
  premium: {
    ru: 'Оформили Premium',
    en: 'Purchased Premium',
    hint_ru: 'Заплатили — это деньги',
    hint_en: 'Paid — this is revenue',
  },
};

const EVENT_LABELS: Record<string, { ru: string; en: string }> = {
  click: { ru: 'Клик по уведомлению', en: 'Notification click' },
  clicked: { ru: 'Клик по уведомлению', en: 'Notification click' },
  open: { ru: 'Открытие из уведомления', en: 'Open from notification' },
  opened_app: { ru: 'Открытие приложения', en: 'App open' },
  opened_target_screen: { ru: 'Открытие экрана из пуша', en: 'Target screen from push' },
  paywall_view: { ru: 'Показ экрана Premium', en: 'Paywall view' },
  natal_upgrade_success: { ru: 'Покупка из натальной карты', en: 'Purchase from natal chart' },
  later: { ru: 'Отложил уведомления', en: 'Snoozed notifications' },
  muted_type: { ru: 'Отключил тип уведомлений', en: 'Muted notification type' },
  disabled_all: { ru: 'Отключил все уведомления', en: 'Disabled all notifications' },
};

const funnelLabel = (lang: 'ru' | 'en', key: string) =>
  FUNNEL_LABELS[key] ? FUNNEL_LABELS[key][lang] : key;
const funnelHint = (lang: 'ru' | 'en', key: string) =>
  FUNNEL_LABELS[key] ? FUNNEL_LABELS[key][lang === 'ru' ? 'hint_ru' : 'hint_en'] : '';
const eventLabel = (lang: 'ru' | 'en', type: string) =>
  EVENT_LABELS[type] ? EVENT_LABELS[type][lang] : type;

const fmtNum = (n: number) => new Intl.NumberFormat('ru-RU').format(n);

export const AdminAnalyticsTab: React.FC<Props> = ({ profile, onOpenUsers }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAdminAnalytics();
      setData(payload);
    } catch (loadError: any) {
      setError(loadError?.message || (lang === 'ru' ? 'Не удалось загрузить аналитику' : 'Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxEventCount = useMemo(
    () => (data?.events?.length ? Math.max(...data.events.map((e) => e.count)) : 0),
    [data],
  );
  const maxNewUsers = useMemo(
    () => (data?.newUsers?.length ? Math.max(...data.newUsers.map((d) => d.count)) : 0),
    [data],
  );

  const bottleneck = data?.bottleneckKey ? funnelLabel(lang, data.bottleneckKey) : null;

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Analytics"
          title={lang === 'ru' ? 'Аналитика и воронка' : 'Analytics & funnel'}
          subtitle={
            lang === 'ru'
              ? 'Где люди в продукте и на каком шаге отваливаются. Всё считается по реальным действиям пользователей.'
              : 'Where users are in the product and where they drop off. Computed from real user actions.'
          }
          action={(
            <AdminButton tone="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? (lang === 'ru' ? 'Обновляем…' : 'Refreshing…') : (lang === 'ru' ? 'Обновить' : 'Refresh')}
            </AdminButton>
          )}
        />

        {/* KPI */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard label={lang === 'ru' ? 'Всего' : 'Total'} value={data ? fmtNum(data.totals.users) : '—'} hint={lang === 'ru' ? 'пользователей' : 'users'} />
          <KpiCard label={lang === 'ru' ? 'Сегодня' : 'Today'} value={data ? fmtNum(data.active.dau) : '—'} hint={lang === 'ru' ? 'активны (DAU)' : 'active (DAU)'} accent="sky" />
          <KpiCard label={lang === 'ru' ? 'За неделю' : 'Week'} value={data ? fmtNum(data.active.wau) : '—'} hint={lang === 'ru' ? 'активны (WAU)' : 'active (WAU)'} accent="sky" />
          <KpiCard label={lang === 'ru' ? 'За месяц' : 'Month'} value={data ? fmtNum(data.active.mau) : '—'} hint={lang === 'ru' ? 'активны (MAU)' : 'active (MAU)'} />
          <KpiCard label="Premium" value={data ? fmtNum(data.totals.premium) : '—'} hint={data ? `${data.totals.premiumRate}%` : ''} accent="amber" />
          <KpiCard label={lang === 'ru' ? 'Новые 14 дн.' : 'New 14d'} value={data ? fmtNum(data.totals.newUsers14d) : '—'} hint={lang === 'ru' ? 'регистраций' : 'sign-ups'} accent="emerald" />
        </div>
      </AdminSurface>

      {/* Воронка */}
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="admin-label">{lang === 'ru' ? 'Воронка' : 'Funnel'}</p>
            <h3 className="admin-heading mt-2 text-xl text-white sm:text-2xl">
              {lang === 'ru' ? 'Путь пользователя по шагам' : 'User journey by step'}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {lang === 'ru'
                ? 'Каждый шаг — сколько людей до него дошло. Процент справа — конверсия с прошлого шага. Красным отмечено самое узкое место.'
                : 'Each step shows how many users reached it. The percent on the right is conversion from the previous step. The biggest drop is marked red.'}
            </p>
          </div>
          {onOpenUsers ? (
            <AdminButton tone="secondary" onClick={onOpenUsers}>
              {lang === 'ru' ? 'К пользователям' : 'To users'}
            </AdminButton>
          ) : null}
        </div>

        {bottleneck ? (
          <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm leading-6 text-amber-100">
            {lang === 'ru'
              ? <>Где дожимать: больше всего людей теряется на шаге «<strong>{bottleneck}</strong>». Сюда стоит направить уведомления и улучшения.</>
              : <>Where to push: most users are lost at “<strong>{bottleneck}</strong>”. Focus notifications and improvements here.</>}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {loading && !data ? (
            <p className="text-sm text-slate-400">{lang === 'ru' ? 'Загружаем…' : 'Loading…'}</p>
          ) : (
            data?.funnel.map((step, i) => {
              const isBottleneck = data.bottleneckKey === step.key;
              const width = Math.max(2, Math.min(100, step.pctOfStart));
              return (
                <div key={step.key}>
                  {i > 0 ? (
                    <div className="mb-1 flex items-center gap-2 pl-1 text-[11px] text-slate-500">
                      <span aria-hidden>↓</span>
                      <span className={isBottleneck ? 'text-amber-300' : ''}>
                        {step.pctOfPrev}% {lang === 'ru' ? 'дошли' : 'reached'}
                        {step.droppedFromPrev > 0
                          ? ` · −${fmtNum(step.droppedFromPrev)} ${lang === 'ru' ? 'ушло' : 'lost'}`
                          : ''}
                      </span>
                    </div>
                  ) : null}
                  <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${
                    isBottleneck ? 'border-amber-400/40 bg-amber-400/[0.06]' : 'border-white/8 bg-white/[0.03]'
                  }`}>
                    <div
                      className={`absolute inset-y-0 left-0 ${isBottleneck ? 'bg-amber-400/15' : 'bg-sky-400/12'}`}
                      style={{ width: `${width}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{funnelLabel(lang, step.key)}</span>
                          {isBottleneck ? <AdminBadge tone="warning">{lang === 'ru' ? 'узкое место' : 'bottleneck'}</AdminBadge> : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{funnelHint(lang, step.key)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-semibold tabular-nums text-white">{fmtNum(step.users)}</div>
                        <div className="text-[11px] tabular-nums text-slate-500">{step.pctOfStart}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Новые пользователи */}
        <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
          <p className="admin-label">{lang === 'ru' ? 'Рост' : 'Growth'}</p>
          <h3 className="admin-heading mt-2 text-xl text-white">
            {lang === 'ru' ? 'Новые пользователи · 14 дней' : 'New users · 14 days'}
          </h3>
          <div className="mt-5 flex items-end gap-1.5" style={{ height: 120 }}>
            {loading && !data ? (
              <p className="text-sm text-slate-400">{lang === 'ru' ? 'Загружаем…' : 'Loading…'}</p>
            ) : (
              data?.newUsers.map((d) => {
                const h = maxNewUsers > 0 ? Math.round((d.count / maxNewUsers) * 100) : 0;
                return (
                  <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-emerald-400/40"
                        style={{ height: `${Math.max(d.count > 0 ? 6 : 0, h)}%` }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-slate-600">{d.date.slice(8, 10)}</span>
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {lang === 'ru' ? 'Сколько новых людей заходило каждый день.' : 'How many new users joined each day.'}
          </p>
        </AdminSurface>

        {/* События */}
        <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
          <p className="admin-label">{lang === 'ru' ? 'Действия' : 'Actions'}</p>
          <h3 className="admin-heading mt-2 text-xl text-white">
            {lang === 'ru' ? 'Что нажимают · 30 дней' : 'What users tap · 30 days'}
          </h3>
          <div className="mt-5 space-y-2.5">
            {loading && !data ? (
              <p className="text-sm text-slate-400">{lang === 'ru' ? 'Загружаем…' : 'Loading…'}</p>
            ) : data && data.events.length > 0 ? (
              data.events.map((e) => {
                const w = maxEventCount > 0 ? Math.round((e.count / maxEventCount) * 100) : 0;
                return (
                  <div key={e.type}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-slate-300">{eventLabel(lang, e.type)}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">{fmtNum(e.count)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full bg-sky-400/45" style={{ width: `${Math.max(2, w)}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">
                {lang === 'ru'
                  ? 'Событий пока нет. Они появятся, как только пользователи начнут нажимать кнопки и открывать экраны.'
                  : 'No events yet. They will appear once users start tapping and opening screens.'}
              </p>
            )}
          </div>
        </AdminSurface>
      </div>

      {data ? (
        <p className="px-1 text-[11px] text-slate-600">
          {lang === 'ru' ? 'Обновлено: ' : 'Updated: '}
          {new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          }).format(new Date(data.generatedAt))}
        </p>
      ) : null}
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: 'sky' | 'amber' | 'emerald';
}> = ({ label, value, hint, accent }) => {
  const accentClass =
    accent === 'sky' ? 'text-sky-300'
      : accent === 'amber' ? 'text-amber-300'
        : accent === 'emerald' ? 'text-emerald-300'
          : 'text-white';
  return (
    <div className="admin-surface-muted p-3.5 sm:p-4">
      <p className="admin-label">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
};
