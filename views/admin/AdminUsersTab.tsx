import React, { useMemo, useState } from 'react';
import {
  type AdminUsersOverview,
  type AdminPremiumFilter,
  type AdminSortOrder,
  type AdminUserDetail,
  type AdminUserSegment,
  type AdminUserSession,
  type AdminUserSortBy,
  type AdminUserSummary,
  type UserProfile,
} from '../../types';
import {
  AdminBadge,
  AdminButton,
  AdminChipButton,
  AdminEmptyState,
  AdminInput,
  AdminPagination,
  AdminSectionHeader,
  AdminSelect,
  AdminStateBanner,
  AdminSurface,
} from './AdminPrimitives';
import { formatAdminText, getAdminText } from './adminText';
import { useAdminUserDetail } from './hooks/useAdminUserDetail';
import { useAdminUsersList } from './hooks/useAdminUsersList';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'chartSlots' | 'loginStreak'>>;

interface AdminUsersTabProps {
  profile: UserProfile;
  segment: AdminUserSegment;
  onSegmentChange: (segment: AdminUserSegment) => void;
  onOverviewChange: (overview: AdminUsersOverview) => void;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onSendNotification: (userId: string) => void;
}

const FILTERS: AdminPremiumFilter[] = ['all', 'premium', 'free'];
const SEGMENTS: AdminUserSegment[] = [
  'all',
  'new_user_no_birth_data',
  'premium',
  'free',
  'active_7d',
  'inactive_3d',
  'inactive_7d',
  'inactive_30d',
  'need_attention',
];
const PAGE_SIZES = [25, 50, 100];

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return getAdminText(lang, 'no_data');
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const formatDateOnly = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return getAdminText(lang, 'no_data');
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

const getSegmentLabel = (lang: 'ru' | 'en', segment: AdminUserSegment) => {
  const map: Record<string, string> = {
    all: getAdminText(lang, 'segment_all'),
    premium: getAdminText(lang, 'segment_premium'),
    free: getAdminText(lang, 'segment_free'),
    active_7d: getAdminText(lang, 'segment_active_7d'),
    inactive_3d: getAdminText(lang, 'segment_inactive_3d'),
    inactive_7d: getAdminText(lang, 'segment_inactive_7d'),
    inactive_30d: getAdminText(lang, 'segment_inactive_30d'),
    need_attention: getAdminText(lang, 'segment_attention'),
    new_user_no_birth_data: getAdminText(lang, 'segment_no_birth_data'),
  };
  return map[segment] || segment.replaceAll('_', ' ');
};

const getSortLabel = (lang: 'ru' | 'en', value: AdminUserSortBy) => {
  switch (value) {
    case 'created_at':
      return getAdminText(lang, 'sort_created_at');
    case 'premium_until':
      return getAdminText(lang, 'sort_premium_until');
    case 'saved_charts_count':
      return getAdminText(lang, 'sort_saved_charts_count');
    case 'name':
      return getAdminText(lang, 'sort_name');
    case 'last_seen':
    default:
      return getAdminText(lang, 'sort_last_seen');
  }
};

const getPremiumLabel = (lang: 'ru' | 'en', isPremium: boolean) => {
  if (isPremium) return 'Premium';
  return lang === 'ru' ? 'Free' : 'Free';
};

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  profile,
  segment,
  onSegmentChange,
  onOverviewChange,
  onPatchOwnProfile,
  onSendNotification,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const usersList = useAdminUsersList({ segment, onOverviewChange });
  const detail = useAdminUserDetail({ currentUserId: profile.id || '', onPatchOwnProfile });
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState<Record<string, boolean>>({});

  const combinedError = detail.error || usersList.error;

  const segmentCount = useMemo(() => {
    switch (segment) {
      case 'premium':
        return usersList.overview.activePremiumUsers;
      case 'active_7d':
        return usersList.overview.activeUsers7d;
      case 'need_attention':
        return usersList.overview.needAttentionUsers;
      case 'new_user_no_birth_data':
        return usersList.overview.usersWithoutBirthData;
      default:
        return usersList.pagination.total;
    }
  }, [
    segment,
    usersList.overview.activePremiumUsers,
    usersList.overview.activeUsers7d,
    usersList.overview.needAttentionUsers,
    usersList.overview.usersWithoutBirthData,
    usersList.pagination.total,
  ]);

  const handlePremiumAction = async (action: 'grant' | 'revoke') => {
    const ok = await detail.runPremiumAction(action, {
      success: action === 'grant' ? getAdminText(lang, 'premium_granted') : getAdminText(lang, 'premium_revoked'),
      failure: getAdminText(lang, 'update_premium_failed'),
    });
    if (ok) {
      await usersList.reload();
    }
  };

  const handleCopyTelegramId = async () => {
    if (!detail.selectedUser) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(detail.selectedUser.id);
      } else {
        window.prompt(getAdminText(lang, 'copy_id'), detail.selectedUser.id);
      }
      detail.setActionResult({ tone: 'info', message: getAdminText(lang, 'copied') });
    } catch {
      detail.setError(getAdminText(lang, 'copy_failed'));
    }
  };

  return (
    <div className="space-y-5">
      {combinedError ? <AdminStateBanner tone="error">{combinedError}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Users"
          title={getAdminText(lang, 'users_title')}
          subtitle={lang === 'ru'
            ? 'Список пользователей, быстрые сегменты и действия с Premium в одном рабочем пространстве.'
            : 'Users list, quick segments, and Premium actions in one workspace.'}
          action={(
            <AdminButton tone="secondary" onClick={() => void usersList.reload()}>
              {lang === 'ru' ? 'Обновить' : 'Refresh'}
            </AdminButton>
          )}
        />

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
          <div className="space-y-4">
            <div className="admin-surface-muted p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_190px_210px] xl:grid-cols-[minmax(0,1.5fr)_170px_220px_150px_110px]">
                <div>
                  <label className="admin-field-label" htmlFor="admin-users-search">
                    {lang === 'ru' ? 'Поиск' : 'Search'}
                  </label>
                  <AdminInput
                    id="admin-users-search"
                    value={usersList.search}
                    onChange={(event) => {
                      usersList.setSearch(event.target.value);
                      usersList.setPage(1);
                    }}
                    placeholder={getAdminText(lang, 'search_users')}
                  />
                </div>

                <div>
                  <label className="admin-field-label" htmlFor="admin-users-filter">
                    {lang === 'ru' ? 'Доступ' : 'Access'}
                  </label>
                  <AdminSelect
                    id="admin-users-filter"
                    value={usersList.premiumFilter}
                    onChange={(event) => {
                      usersList.setPremiumFilter(event.target.value as AdminPremiumFilter);
                      usersList.setPage(1);
                    }}
                  >
                    {FILTERS.map((filter) => (
                      <option key={filter} value={filter}>
                        {filter === 'all' ? getAdminText(lang, 'filter_all') : filter === 'premium' ? 'Premium' : getAdminText(lang, 'filter_free')}
                      </option>
                    ))}
                  </AdminSelect>
                </div>

                <div>
                  <label className="admin-field-label" htmlFor="admin-users-sort">
                    {lang === 'ru' ? 'Сортировка' : 'Sort by'}
                  </label>
                  <AdminSelect
                    id="admin-users-sort"
                    value={usersList.sortBy}
                    onChange={(event) => {
                      usersList.setSortBy(event.target.value as AdminUserSortBy);
                      usersList.setPage(1);
                    }}
                  >
                    <option value="last_seen">{getSortLabel(lang, 'last_seen')}</option>
                    <option value="created_at">{getSortLabel(lang, 'created_at')}</option>
                    <option value="premium_until">{getSortLabel(lang, 'premium_until')}</option>
                    <option value="saved_charts_count">{getSortLabel(lang, 'saved_charts_count')}</option>
                    <option value="name">{getSortLabel(lang, 'name')}</option>
                  </AdminSelect>
                </div>

                <div>
                  <label className="admin-field-label" htmlFor="admin-users-order">
                    {lang === 'ru' ? 'Порядок' : 'Order'}
                  </label>
                  <AdminSelect
                    id="admin-users-order"
                    value={usersList.sortOrder}
                    onChange={(event) => {
                      usersList.setSortOrder(event.target.value as AdminSortOrder);
                      usersList.setPage(1);
                    }}
                  >
                    <option value="desc">{getAdminText(lang, 'order_desc')}</option>
                    <option value="asc">{getAdminText(lang, 'order_asc')}</option>
                  </AdminSelect>
                </div>

                <div>
                  <label className="admin-field-label" htmlFor="admin-users-size">
                    {lang === 'ru' ? 'На странице' : 'Per page'}
                  </label>
                  <AdminSelect
                    id="admin-users-size"
                    value={usersList.pagination.pageSize}
                    onChange={(event) => usersList.setPageSize(Number(event.target.value))}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </AdminSelect>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((item) => (
                <AdminChipButton key={item} active={segment === item} onClick={() => onSegmentChange(item)}>
                  {getSegmentLabel(lang, item)}
                </AdminChipButton>
              ))}
            </div>
          </div>

          <div className="admin-surface-muted p-4 sm:p-5">
            <p className="admin-label">{lang === 'ru' ? 'Текущий фокус' : 'Current focus'}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{getSegmentLabel(lang, segment)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {lang === 'ru'
                ? `Сейчас в выборке ${segmentCount} записей. Открывайте карточку пользователя, не теряя контекст списка.`
                : `${segmentCount} records in the current view. Open user details without losing list context.`}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric label={lang === 'ru' ? 'Premium' : 'Premium'} value={usersList.overview.activePremiumUsers} />
              <MiniMetric label={getAdminText(lang, 'metric_no_birth_data')} value={usersList.overview.usersWithoutBirthData} />
              <MiniMetric label={lang === 'ru' ? 'Активны 7д' : 'Active 7d'} value={usersList.overview.activeUsers7d} />
            </div>
          </div>
        </div>
      </AdminSurface>

      <AdminSurface className="overflow-hidden">
        <div className="admin-divider border-t-0 px-5 py-4">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_134px_160px] gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid">
            <span>{getAdminText(lang, 'users_title')}</span>
            <span className="text-right">{getAdminText(lang, 'slots_charts')}</span>
            <span className="text-right">{getAdminText(lang, 'last_seen')}</span>
          </div>
        </div>

        {usersList.loading ? (
          <div className="px-5 py-10 text-sm leading-6 text-slate-400">{getAdminText(lang, 'users_loading')}</div>
        ) : usersList.users.length === 0 ? (
          <div className="px-5 py-10">
            <AdminEmptyState
              title={getAdminText(lang, 'users_empty')}
              body={getAdminText(lang, 'users_subtitle')}
            />
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/8">
              {usersList.users.map((user) => (
                <UserRow key={user.id} user={user} lang={lang} onOpen={() => detail.openUser(user.id)} />
              ))}
            </div>

            <AdminPagination
              page={usersList.pagination.page}
              totalPages={usersList.pagination.totalPages}
              total={usersList.pagination.total}
              pageSize={usersList.pagination.pageSize}
              label={getAdminText(lang, 'users_page')}
              onPageChange={usersList.setPage}
            />
          </>
        )}
      </AdminSurface>

      {detail.detailOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md">
          <div className="admin-sheet admin-scroll" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
            <div className="admin-sticky-toolbar border-b border-white/10 bg-[#071220]/88 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <AdminButton tone="ghost" className="min-h-[2.5rem] px-0" onClick={detail.closeUser}>
                  ← {getAdminText(lang, 'detail_back')}
                </AdminButton>
                {detail.selectedUser ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminBadge tone={detail.selectedUser.isPremium ? 'premium' : 'neutral'}>
                      {getPremiumLabel(lang, detail.selectedUser.isPremium)}
                    </AdminBadge>
                    {detail.selectedUser.isAdmin ? <AdminBadge tone="admin">Admin</AdminBadge> : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 admin-surface-muted p-4">
                <div className="flex flex-wrap gap-2">
                  <ActionPill active={detail.actionLoading === 'premium-grant'} onClick={() => void handlePremiumAction('grant')}>
                    {getAdminText(lang, 'premium_plus')}
                  </ActionPill>
                  <ActionPill active={detail.actionLoading === 'premium-revoke'} onClick={() => void handlePremiumAction('revoke')}>
                    {getAdminText(lang, 'revoke')}
                  </ActionPill>
                  <ActionPill onClick={() => detail.selectedUser ? onSendNotification(detail.selectedUser.id) : undefined}>
                    {getAdminText(lang, 'notify')}
                  </ActionPill>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              {detail.actionResult ? (
                <AdminStateBanner tone={detail.actionResult.tone === 'success' ? 'success' : 'info'}>
                  {detail.actionResult.message}
                </AdminStateBanner>
              ) : null}

              {detail.detailLoading ? (
                <AdminSurface className="px-5 py-8 text-sm text-slate-400">{getAdminText(lang, 'user_loading')}</AdminSurface>
              ) : !detail.selectedUser ? (
                <AdminSurface className="px-5 py-8">
                  <AdminEmptyState title={getAdminText(lang, 'user_not_found')} body={getAdminText(lang, 'detail_title')} />
                </AdminSurface>
              ) : (
                <>
                  <IdentityCard detail={detail.selectedUser} lang={lang} onCopyTelegramId={() => void handleCopyTelegramId()} />
                  <DetailAccordion
                    title={getAdminText(lang, 'economy')}
                    subtitle={getAdminText(lang, 'economy_subtitle')}
                    defaultOpen
                  >
                    <div className="space-y-3">
                      <DetailCard>
                        <p className="admin-label">{getAdminText(lang, 'latest_stars')}</p>
                        <p className="mt-3 text-sm leading-6 text-white">
                          {detail.selectedUser.latestStarsPayment
                            ? `${detail.selectedUser.latestStarsPayment.starsAmount} Stars · ${formatDateOnly(lang, detail.selectedUser.latestStarsPayment.createdAt)}`
                            : getAdminText(lang, 'no_stars')}
                        </p>
                      </DetailCard>
                    </div>
                  </DetailAccordion>

                  <DetailAccordion
                    title={getAdminText(lang, 'activity')}
                    subtitle={getAdminText(lang, 'activity_subtitle')}
                  >
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <StatCard label={getAdminText(lang, 'last_daily_login')} value={formatDateTime(lang, detail.selectedUser.lastLogin)} />
                        <StatCard label={getAdminText(lang, 'created_at')} value={formatDateOnly(lang, detail.selectedUser.createdAt)} />
                      </div>
                      <DetailCard>
                        <p className="admin-label">{getAdminText(lang, 'oracle_questions')}</p>
                        {detail.selectedUser.recentOracleQuestions.length === 0 ? (
                          <p className="mt-3 text-sm text-slate-400">{getAdminText(lang, 'no_questions')}</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {detail.selectedUser.recentOracleQuestions.map((question) => (
                              <div key={`${question.createdAt}-${question.question}`} className="admin-surface-muted p-3">
                                <p className="text-sm text-white">{question.question}</p>
                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{question.answer}</p>
                                <p className="mt-2 text-xs text-slate-500">{formatDateTime(lang, question.createdAt)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </DetailCard>
                    </div>
                  </DetailAccordion>

                  <DetailAccordion
                    title={getAdminText(lang, 'charts')}
                    subtitle={getAdminText(lang, 'charts_subtitle')}
                  >
                    <div className="space-y-3">
                      <DetailCard>
                        <p className="admin-label">{getAdminText(lang, 'primary_chart')}</p>
                        {detail.selectedUser.primaryChart ? (
                          <div className="mt-3 space-y-1 text-sm leading-6 text-slate-300">
                            <p className="text-white">{detail.selectedUser.primaryChart.name}</p>
                            <p>{detail.selectedUser.primaryChart.birthDate}</p>
                            <p>{detail.selectedUser.primaryChart.birthPlace}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-400">{getAdminText(lang, 'no_primary_chart')}</p>
                        )}
                      </DetailCard>
                      <DetailCard>
                        <p className="text-sm text-slate-300">
                          <span className="font-semibold text-white">{getAdminText(lang, 'saved_charts')}:</span> {detail.selectedUser.savedChartsCount}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          <span className="font-semibold text-white">{getAdminText(lang, 'total_slots')}:</span> {detail.selectedUser.chartSlots}
                        </p>
                      </DetailCard>
                    </div>
                  </DetailAccordion>

                  <DetailAccordion
                    title={getAdminText(lang, 'sessions')}
                    subtitle={getAdminText(lang, 'sessions_subtitle')}
                  >
                    {detail.selectedUser.recentSessions.length === 0 ? (
                      <p className="text-sm text-slate-400">{getAdminText(lang, 'no_sessions')}</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.selectedUser.recentSessions.map((session) => (
                          <SessionRow
                            key={`${session.sessionId}-${session.lastSeenAt}`}
                            session={session}
                            lang={lang}
                            userAgentOpen={!!sessionDetailsOpen[session.sessionId]}
                            onToggleUserAgent={() => setSessionDetailsOpen((prev) => ({
                              ...prev,
                              [session.sessionId]: !prev[session.sessionId],
                            }))}
                          />
                        ))}
                      </div>
                    )}
                  </DetailAccordion>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MiniMetric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="admin-surface-muted p-3">
    <p className="admin-label">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
  </div>
);

const UserRow: React.FC<{
  user: AdminUserSummary;
  lang: 'ru' | 'en';
  onOpen: () => void;
}> = ({ user, lang, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="grid w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] lg:grid-cols-[minmax(0,1.6fr)_134px_160px] lg:items-center"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-[15px] font-semibold text-white">{user.name}</p>
        <AdminBadge tone={user.isPremium ? 'premium' : 'neutral'}>{getPremiumLabel(lang, user.isPremium)}</AdminBadge>
        {!user.hasBirthData ? <AdminBadge tone="warning">{getAdminText(lang, 'badge_no_chart')}</AdminBadge> : null}
        {user.isAdmin ? <AdminBadge tone="admin">Admin</AdminBadge> : null}
      </div>
      <p className="mt-1 truncate text-xs text-slate-500">{user.id}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 lg:hidden">
        <span>{getAdminText(lang, 'slots_charts')}: {user.savedChartsCount} / {user.chartSlots}</span>
        <span>{getAdminText(lang, 'last_seen')}: {formatDateTime(lang, user.lastSeenAt || user.lastLogin)}</span>
      </div>
    </div>
    <p className="hidden text-right text-sm text-slate-300 lg:block">{user.savedChartsCount} / {user.chartSlots}</p>
    <p className="hidden text-right text-sm text-slate-400 lg:block">{formatDateTime(lang, user.lastSeenAt || user.lastLogin)}</p>
  </button>
);

const ActionPill: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}> = ({ children, onClick, active = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-[2.5rem] items-center justify-center rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
      active
        ? 'border-sky-300/35 bg-sky-300 text-[#081523] shadow-[0_10px_24px_rgba(125,211,252,0.26)]'
        : 'border-white/10 bg-white/[0.045] text-white hover:border-white/16 hover:bg-white/[0.08]'
    }`}
  >
    {children}
  </button>
);

const IdentityCard: React.FC<{
  detail: AdminUserDetail;
  lang: 'ru' | 'en';
  onCopyTelegramId: () => void;
}> = ({ detail, lang, onCopyTelegramId }) => (
  <AdminSurface className="px-5 py-5">
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="admin-heading truncate text-[28px] leading-tight text-white">{detail.name}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-400">{detail.id}</p>
            <AdminButton tone="secondary" className="min-h-[2.2rem] px-3 text-[11px]" onClick={onCopyTelegramId}>
              {getAdminText(lang, 'copy_id')}
            </AdminButton>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {detail.birthDate || getAdminText(lang, 'no_data')}
            {detail.birthPlace ? ` · ${detail.birthPlace}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminBadge tone={detail.isPremium ? 'premium' : 'neutral'}>{getPremiumLabel(lang, detail.isPremium)}</AdminBadge>
          {!detail.birthDate ? <AdminBadge tone="warning">{getAdminText(lang, 'badge_no_chart')}</AdminBadge> : null}
          {detail.isAdmin ? <AdminBadge tone="admin">Admin</AdminBadge> : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label={getAdminText(lang, 'premium_until')} value={formatDateTime(lang, detail.premiumUntil)} />
        <StatCard label={getAdminText(lang, 'slots_charts')} value={`${detail.savedChartsCount} / ${detail.chartSlots}`} />
        <StatCard label={getAdminText(lang, 'last_seen')} value={formatDateTime(lang, detail.lastSeenAt)} />
      </div>

      <DetailCard>
        <p className="text-sm leading-6 text-slate-300">
          <span className="font-semibold text-white">{getAdminText(lang, 'current_device')}:</span>{' '}
          {detail.currentDeviceLabel || getAdminText(lang, 'no_data')}
        </p>
      </DetailCard>
    </div>
  </AdminSurface>
);

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="admin-surface-muted p-4">
    <p className="admin-label">{label}</p>
    <p className="mt-2 text-sm leading-6 text-white">{value}</p>
  </div>
);

const DetailAccordion: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, subtitle, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <AdminSurface className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="admin-heading text-xl text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
        </div>
        <span className="text-xl text-slate-500">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="admin-divider px-5 py-4">{children}</div> : null}
    </AdminSurface>
  );
};

const DetailCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="admin-surface-muted p-4">{children}</div>
);

const SessionRow: React.FC<{
  session: AdminUserSession;
  lang: 'ru' | 'en';
  userAgentOpen: boolean;
  onToggleUserAgent: () => void;
}> = ({ session, lang, userAgentOpen, onToggleUserAgent }) => (
  <DetailCard>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white">{session.deviceLabel || getAdminText(lang, 'unknown_device')}</p>
        <p className="mt-1 text-xs text-slate-400">{session.telegramPlatform || getAdminText(lang, 'platform_missing')}</p>
      </div>
      <div className="shrink-0 text-right text-xs text-slate-400">
        <p>{formatDateTime(lang, session.lastSeenAt)}</p>
        <p className="mt-1">{formatDateTime(lang, session.startedAt)}</p>
      </div>
    </div>

    {session.userAgent ? (
      <div className="mt-3">
        <button type="button" onClick={onToggleUserAgent} className="text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline">
          {userAgentOpen ? (lang === 'ru' ? 'Скрыть user-agent' : 'Hide user agent') : getAdminText(lang, 'show_user_agent')}
        </button>
        {userAgentOpen ? <p className="mt-2 break-words text-[11px] leading-5 text-slate-500">{session.userAgent}</p> : null}
      </div>
    ) : null}
  </DetailCard>
);
