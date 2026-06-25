import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminNotificationHistoryItem, AdminUserSummary, AdminUsersOverview, UserProfile } from '../../types';
import { fetchAdminUsers, fetchNotificationHistory, fetchAdminAnalytics, type AdminAnalytics } from '../../services/adminService';
import { AdminBadge, AdminButton, AdminEmptyState, AdminStateBanner, AdminSurface } from './AdminPrimitives';
import { getAdminText } from './adminText';
import type { AdminBackofficeSection } from './adminSections';
import type { AdminUserSegment } from '../../types';

type Props = {
  profile: UserProfile;
  onOpenSection: (section: AdminBackofficeSection) => void;
  onOpenUsersSegment?: (segment: AdminUserSegment) => void;
};

const EMPTY_OVERVIEW: AdminUsersOverview = {
  totalUsers: 0,
  activePremiumUsers: 0,
  activeUsers7d: 0,
  needAttentionUsers: 0,
  usersWithoutBirthData: 0,
};

const fmtNum = (n: number) => new Intl.NumberFormat('ru-RU').format(n);

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return getAdminText(lang, 'no_data');
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
};

/** Мини-спарклайн из реальных значений (без осей) для KPI-плитки. */
function Spark({ values }: { values: number[] }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const W = 240, H = 38;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = Math.max(1, max - min);
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - min) / span) * (H - 8);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="admin-kpi-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill="rgba(255,255,255,0.18)" />
      <path d={d} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const AdminOverviewTab: React.FC<Props> = ({ profile, onOpenSection, onOpenUsersSegment }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [overview, setOverview] = useState<AdminUsersOverview>(EMPTY_OVERVIEW);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [attentionUsers, setAttentionUsers] = useState<AdminUserSummary[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<AdminNotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersPayload, historyPayload] = await Promise.all([
        fetchAdminUsers({ segment: 'need_attention', page: 1, pageSize: 5, sortBy: 'last_seen', sortOrder: 'asc' }),
        fetchNotificationHistory({ page: 1, pageSize: 4 }),
      ]);
      setOverview(usersPayload.overview);
      setAttentionUsers(usersPayload.users);
      setRecentCampaigns(historyPayload.history);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'load_users_failed'));
    } finally {
      setLoading(false);
    }
    // Аналитика (доход, активность, тренд) грузится отдельно — не блокирует KPI.
    fetchAdminAnalytics().then(setAnalytics).catch(() => undefined);
  }, [lang]);

  useEffect(() => { void load(); }, [load]);

  const newUsersValues = useMemo(() => (analytics?.newUsers || []).map((d) => d.count), [analytics]);
  const maxNew = useMemo(() => (newUsersValues.length ? Math.max(...newUsersValues, 1) : 1), [newUsersValues]);
  const premiumShare = overview.totalUsers > 0 ? Math.round((overview.activePremiumUsers / overview.totalUsers) * 100) : 0;

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      {/* Цветные KPI-плитки */}
      <div className="admin-kpi-tiles">
        <button type="button" className="admin-kpi-tile admin-kpi-tile--purple text-left" onClick={() => onOpenSection('users')}>
          <div>
            <div className="admin-kpi-tile-value">{fmtNum(overview.totalUsers)}</div>
            <div className="admin-kpi-tile-sub">{analytics ? `+${fmtNum(analytics.totals.newUsers14d)} ${lang === 'ru' ? 'за 14 дней' : 'in 14 days'}` : ' '}</div>
          </div>
          <Spark values={newUsersValues} />
          <div className="admin-kpi-tile-label">{lang === 'ru' ? 'Пользователи' : 'Users'}</div>
        </button>

        <button type="button" className="admin-kpi-tile admin-kpi-tile--blue text-left" onClick={() => onOpenSection('analytics')}>
          <div>
            <div className="admin-kpi-tile-value">{analytics ? `${fmtNum(analytics.revenue.totalStars)} ★` : '—'}</div>
            <div className="admin-kpi-tile-sub">{analytics ? `${fmtNum(analytics.revenue.totalPayments)} ${lang === 'ru' ? 'платежей' : 'payments'}` : ' '}</div>
          </div>
          <div className="admin-kpi-tile-label">{lang === 'ru' ? 'Доход (Stars)' : 'Revenue (Stars)'}</div>
        </button>

        <button type="button" className="admin-kpi-tile admin-kpi-tile--amber text-left" onClick={() => onOpenUsersSegment ? onOpenUsersSegment('premium') : onOpenSection('users')}>
          <div>
            <div className="admin-kpi-tile-value">{premiumShare}%</div>
            <div className="admin-kpi-tile-sub">{fmtNum(overview.activePremiumUsers)} Premium</div>
          </div>
          <div className="admin-kpi-tile-label">{lang === 'ru' ? 'Доля Premium' : 'Premium share'}</div>
        </button>

        <button type="button" className="admin-kpi-tile admin-kpi-tile--red text-left" onClick={() => onOpenSection('analytics')}>
          <div>
            <div className="admin-kpi-tile-value">{fmtNum(overview.activeUsers7d)}</div>
            <div className="admin-kpi-tile-sub">{analytics ? `${fmtNum(analytics.active.dau)} ${lang === 'ru' ? 'сегодня' : 'today'}` : ' '}</div>
          </div>
          <div className="admin-kpi-tile-label">{lang === 'ru' ? 'Активны за неделю' : 'Active this week'}</div>
        </button>
      </div>

      {/* График: новые пользователи (как Traffic) */}
      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="admin-heading text-xl text-white sm:text-2xl">{lang === 'ru' ? 'Новые пользователи' : 'New users'}</h3>
            <p className="mt-1 text-sm text-slate-500">{lang === 'ru' ? 'Последние 14 дней' : 'Last 14 days'}</p>
          </div>
          <AdminButton tone="secondary" onClick={() => onOpenSection('analytics')}>{lang === 'ru' ? 'Аналитика' : 'Analytics'}</AdminButton>
        </div>
        <div className="mt-5 flex items-end gap-1.5" style={{ height: 150 }}>
          {analytics?.newUsers?.length ? analytics.newUsers.map((d) => {
            const h = Math.round((d.count / maxNew) * 100);
            return (
              <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-md" style={{ height: `${Math.max(d.count > 0 ? 6 : 2, h)}%`, background: 'linear-gradient(180deg, #6d5bdf, #8b5cf6)' }} />
                </div>
                <span className="text-[9px] tabular-nums text-slate-400">{d.date.slice(8, 10)}</span>
              </div>
            );
          }) : (
            <p className="text-sm text-slate-400">{lang === 'ru' ? 'Загружаем график…' : 'Loading chart…'}</p>
          )}
        </div>
      </AdminSurface>

      {/* Быстрые действия */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickActionCard title={getAdminText(lang, 'section_analytics')} body={lang === 'ru' ? 'Воронка, активность и доход.' : 'Funnel, activity, and revenue.'} actionLabel={lang === 'ru' ? 'Открыть' : 'Open'} onClick={() => onOpenSection('analytics')} />
        <QuickActionCard title={getAdminText(lang, 'section_users')} body={lang === 'ru' ? 'Premium, бан, правка, путь юзера.' : 'Premium, ban, edit, journey.'} actionLabel={getAdminText(lang, 'open_users')} onClick={() => onOpenSection('users')} />
        <QuickActionCard title={getAdminText(lang, 'section_send')} body={lang === 'ru' ? 'Отправить уведомление.' : 'Send a notification.'} actionLabel={getAdminText(lang, 'open_send')} onClick={() => onOpenSection('send')} />
        <QuickActionCard title={getAdminText(lang, 'section_system')} body={lang === 'ru' ? 'AI-модель и движок пушей.' : 'AI model and push engine.'} actionLabel={lang === 'ru' ? 'Открыть' : 'Open'} onClick={() => onOpenSection('system')} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="admin-label">{getAdminText(lang, 'metric_attention')}</p>
              <h3 className="admin-heading mt-2 text-2xl text-white">
                {lang === 'ru' ? 'Пользователи, которым нужен фокус' : 'Users that need attention'}
              </h3>
            </div>
            <AdminButton tone="secondary" onClick={() => onOpenSection('users')}>{getAdminText(lang, 'section_users')}</AdminButton>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-400">{getAdminText(lang, 'users_loading')}</p>
          ) : attentionUsers.length === 0 ? (
            <div className="mt-5">
              <AdminEmptyState
                title={lang === 'ru' ? 'Сейчас всё спокойно' : 'Everything looks healthy'}
                body={lang === 'ru' ? 'Сегмент «Нужно внимание» сейчас пуст.' : 'The need-attention segment is currently empty.'}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {attentionUsers.map((user) => (
                <button key={user.id} type="button" onClick={() => onOpenSection('users')} className="admin-surface-muted block w-full px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/[0.05]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{user.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminBadge tone={user.isPremium ? 'premium' : 'neutral'}>{user.isPremium ? 'Premium' : 'Free'}</AdminBadge>
                      <AdminBadge tone="warning">{getAdminText(lang, 'metric_attention')}</AdminBadge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>{getAdminText(lang, 'slots_charts')}: {user.savedChartsCount} / {user.chartSlots}</span>
                    <span>{getAdminText(lang, 'last_seen')}: {formatDateTime(lang, user.lastSeenAt || user.lastLogin)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminSurface>

        <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="admin-label">{getAdminText(lang, 'section_send')}</p>
              <h3 className="admin-heading mt-2 text-2xl text-white">{lang === 'ru' ? 'Последние отправки' : 'Recent sends'}</h3>
            </div>
            <AdminButton tone="secondary" onClick={() => onOpenSection('send')}>{getAdminText(lang, 'section_send')}</AdminButton>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-400">{getAdminText(lang, 'refresh')}…</p>
          ) : recentCampaigns.length === 0 ? (
            <div className="mt-5">
              <AdminEmptyState title={getAdminText(lang, 'history_empty')} body={getAdminText(lang, 'history_subtitle')} />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentCampaigns.map((campaign) => {
                const tone = campaign.failedCount > 0 ? (campaign.successCount > 0 ? 'warning' : 'danger') : 'success';
                return (
                  <button key={campaign.id} type="button" onClick={() => onOpenSection('send')} className="admin-surface-muted block w-full px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/[0.05]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{campaign.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(lang, campaign.createdAt)}</p>
                      </div>
                      <AdminBadge tone={tone}>
                        {campaign.failedCount > 0 ? (campaign.successCount > 0 ? getAdminText(lang, 'result_partial') : getAdminText(lang, 'result_failed')) : getAdminText(lang, 'result_success')}
                      </AdminBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>{campaign.mode === 'personal' ? getAdminText(lang, 'personal') : getAdminText(lang, 'broadcast')}</span>
                      <span>{campaign.successCount}/{campaign.totalRecipients} {getAdminText(lang, 'sent_count')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </AdminSurface>
      </div>
    </div>
  );
};

const QuickActionCard: React.FC<{ title: string; body: string; actionLabel: string; onClick: () => void }> = ({ title, body, actionLabel, onClick }) => (
  <div className="admin-surface-muted flex h-full flex-col justify-between p-4 sm:p-5">
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
    <div className="mt-4">
      <AdminButton tone="secondary" onClick={onClick}>{actionLabel}</AdminButton>
    </div>
  </div>
);
