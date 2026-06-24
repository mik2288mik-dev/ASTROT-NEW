import React, { useCallback, useEffect, useState } from 'react';
import type { AdminNotificationHistoryItem, AdminUserSummary, AdminUsersOverview, UserProfile } from '../../types';
import { fetchAdminUsers, fetchNotificationHistory } from '../../services/adminService';
import { AdminBadge, AdminButton, AdminEmptyState, AdminSectionHeader, AdminStateBanner, AdminSurface } from './AdminPrimitives';
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

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return getAdminText(lang, 'no_data');
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

export const AdminOverviewTab: React.FC<Props> = ({ profile, onOpenSection, onOpenUsersSegment }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [overview, setOverview] = useState<AdminUsersOverview>(EMPTY_OVERVIEW);
  const [attentionUsers, setAttentionUsers] = useState<AdminUserSummary[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<AdminNotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersPayload, historyPayload] = await Promise.all([
        fetchAdminUsers({
          segment: 'need_attention',
          page: 1,
          pageSize: 5,
          sortBy: 'last_seen',
          sortOrder: 'asc',
        }),
        fetchNotificationHistory({
          page: 1,
          pageSize: 4,
        }),
      ]);

      setOverview(usersPayload.overview);
      setAttentionUsers(usersPayload.users);
      setRecentCampaigns(historyPayload.history);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'load_users_failed'));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Overview"
          title={getAdminText(lang, 'overview_title')}
          subtitle={getAdminText(lang, 'overview_subtitle')}
          action={(
            <AdminButton tone="secondary" onClick={() => void loadOverview()}>
              {getAdminText(lang, 'refresh')}
            </AdminButton>
          )}
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label={getAdminText(lang, 'metric_users')} value={overview.totalUsers} />
          <MetricCard label={getAdminText(lang, 'metric_premium')} value={overview.activePremiumUsers} />
          <MetricCard label={getAdminText(lang, 'metric_active')} value={overview.activeUsers7d} />
          <MetricCard
            label={getAdminText(lang, 'metric_no_birth_data')}
            value={overview.usersWithoutBirthData}
            tone="warning"
            onClick={onOpenUsersSegment ? () => onOpenUsersSegment('new_user_no_birth_data') : undefined}
          />
          <MetricCard label={getAdminText(lang, 'metric_attention')} value={overview.needAttentionUsers} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <QuickActionCard
            title={getAdminText(lang, 'section_analytics')}
            body={lang === 'ru' ? 'Воронка и активность: где люди отваливаются и что открывают.' : 'Funnel and activity: where users drop off and what they open.'}
            actionLabel={lang === 'ru' ? 'Открыть аналитику' : 'Open analytics'}
            onClick={() => onOpenSection('analytics')}
          />
          <QuickActionCard
            title={getAdminText(lang, 'section_users')}
            body={lang === 'ru' ? 'Найти пользователя, выдать Premium и посмотреть его путь.' : 'Find a user, grant Premium, and see their journey.'}
            actionLabel={getAdminText(lang, 'open_users')}
            onClick={() => onOpenSection('users')}
          />
          <QuickActionCard
            title={getAdminText(lang, 'section_send')}
            body={lang === 'ru' ? 'Отправить уведомление одному человеку или сегменту.' : 'Send a notification to one user or a segment.'}
            actionLabel={getAdminText(lang, 'open_send')}
            onClick={() => onOpenSection('send')}
          />
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="admin-label">{getAdminText(lang, 'metric_attention')}</p>
              <h3 className="admin-heading mt-2 text-2xl text-white">
                {lang === 'ru' ? 'Пользователи, которым нужен фокус' : 'Users that need attention'}
              </h3>
            </div>
            <AdminButton tone="secondary" onClick={() => onOpenSection('users')}>
              {getAdminText(lang, 'section_users')}
            </AdminButton>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-400">{getAdminText(lang, 'users_loading')}</p>
          ) : attentionUsers.length === 0 ? (
            <div className="mt-5">
              <AdminEmptyState
                title={lang === 'ru' ? 'Сейчас всё спокойно' : 'Everything looks healthy'}
                body={lang === 'ru'
                  ? 'Сегмент “Нужно внимание” сейчас пуст. Можно проверить активные рассылки или перейти к экономике.'
                  : 'The need-attention segment is currently empty. You can review active sends or switch to economy.'}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {attentionUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onOpenSection('users')}
                  className="admin-surface-muted block w-full px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{user.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminBadge tone={user.isPremium ? 'premium' : 'neutral'}>
                        {user.isPremium ? 'Premium' : 'Free'}
                      </AdminBadge>
                      <AdminBadge tone="warning">{getAdminText(lang, 'metric_attention')}</AdminBadge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>{getAdminText(lang, 'slots_charts')}: {user.savedChartsCount} / {user.chartSlots}</span>
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
              <h3 className="admin-heading mt-2 text-2xl text-white">
                {lang === 'ru' ? 'Последние отправки' : 'Recent sends'}
              </h3>
            </div>
            <AdminButton tone="secondary" onClick={() => onOpenSection('send')}>
              {getAdminText(lang, 'section_send')}
            </AdminButton>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-400">{getAdminText(lang, 'refresh')}…</p>
          ) : recentCampaigns.length === 0 ? (
            <div className="mt-5">
              <AdminEmptyState
                title={getAdminText(lang, 'history_empty')}
                body={getAdminText(lang, 'history_subtitle')}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentCampaigns.map((campaign) => {
                const tone = campaign.failedCount > 0
                  ? (campaign.successCount > 0 ? 'warning' : 'danger')
                  : 'success';
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => onOpenSection('send')}
                    className="admin-surface-muted block w-full px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{campaign.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(lang, campaign.createdAt)}</p>
                      </div>
                      <AdminBadge tone={tone}>
                        {campaign.failedCount > 0
                          ? (campaign.successCount > 0 ? getAdminText(lang, 'result_partial') : getAdminText(lang, 'result_failed'))
                          : getAdminText(lang, 'result_success')}
                      </AdminBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>{campaign.mode === 'personal' ? getAdminText(lang, 'personal') : getAdminText(lang, 'broadcast')}</span>
                      <span>{campaign.successCount}/{campaign.totalRecipients} {getAdminText(lang, 'sent_count')}</span>
                      <span>{campaign.failedCount} {getAdminText(lang, 'failed_count')}</span>
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

const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'warning';
  onClick?: () => void;
}> = ({ label, value, tone = 'default', onClick }) => {
  const className = `admin-surface-muted p-4 sm:p-5 ${tone === 'warning' ? 'border-amber-400/20 bg-amber-400/[0.06]' : ''} ${
    onClick ? 'cursor-pointer transition-colors hover:border-white/12 hover:bg-white/[0.05]' : ''
  }`;
  const content = (
    <>
      <p className="admin-label">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`${className} w-full text-left`} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
};

const QuickActionCard: React.FC<{
  title: string;
  body: string;
  actionLabel: string;
  onClick: () => void;
}> = ({ title, body, actionLabel, onClick }) => (
  <div className="admin-surface-muted flex h-full flex-col justify-between p-4 sm:p-5">
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
    <div className="mt-4">
      <AdminButton tone="secondary" onClick={onClick}>
        {actionLabel}
      </AdminButton>
    </div>
  </div>
);
