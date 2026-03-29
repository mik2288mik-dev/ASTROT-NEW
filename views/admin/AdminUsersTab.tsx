import React, { useMemo, useState } from 'react';
import {
  type AdminUsersOverview,
  type AdminPremiumFilter,
  type AdminSortOrder,
  type AdminUserSegment,
  type AdminUserSession,
  type AdminUserSortBy,
  type AdminUserSummary,
  type LumiTransaction,
  type UserProfile,
} from '../../types';
import { AdminChipButton, AdminEmptyState, AdminPagination, AdminSectionHeader, AdminStateBanner, AdminSurface } from './AdminPrimitives';
import { formatAdminText, getAdminText } from './adminText';
import { useAdminUserDetail } from './hooks/useAdminUserDetail';
import { useAdminUsersList } from './hooks/useAdminUsersList';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>;

interface AdminUsersTabProps {
  profile: UserProfile;
  segment: AdminUserSegment;
  onSegmentChange: (segment: AdminUserSegment) => void;
  onOverviewChange: (overview: AdminUsersOverview) => void;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onSendNotification: (userId: string) => void;
}

const FILTERS: AdminPremiumFilter[] = ['all', 'premium', 'free'];
const SEGMENTS: AdminUserSegment[] = ['all', 'premium', 'free', 'active_7d', 'inactive_30d', 'need_attention'];
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

const formatLumiReason = (lang: 'ru' | 'en', reason: string) => {
  const map: Record<string, { ru: string; en: string }> = {
    daily_login: { ru: 'Ежедневный вход', en: 'Daily login' },
    streak_bonus: { ru: 'Бонус за серию входов', en: 'Streak bonus' },
    chart_slot: { ru: 'Покупка слота для карты', en: 'Chart slot purchase' },
    admin_lumi_add: { ru: 'Начисление Lumi от admin', en: 'Admin Lumi credit' },
    admin_lumi_subtract: { ru: 'Списание Lumi от admin', en: 'Admin Lumi deduction' },
    refund: { ru: 'Возврат', en: 'Refund' },
  };
  return map[reason]?.[lang] || reason.replaceAll('_', ' ');
};

const getSegmentLabel = (lang: 'ru' | 'en', segment: AdminUserSegment) => {
  const map: Record<AdminUserSegment, string> = {
    all: getAdminText(lang, 'segment_all'),
    premium: getAdminText(lang, 'segment_premium'),
    free: getAdminText(lang, 'segment_free'),
    active_7d: getAdminText(lang, 'segment_active_7d'),
    inactive_30d: getAdminText(lang, 'segment_inactive_30d'),
    need_attention: getAdminText(lang, 'segment_attention'),
  };
  return map[segment];
};

const getSortLabel = (lang: 'ru' | 'en', value: AdminUserSortBy) => {
  switch (value) {
    case 'created_at':
      return getAdminText(lang, 'sort_created_at');
    case 'lumi_balance':
      return getAdminText(lang, 'sort_lumi_balance');
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

  const segmentBadgeValue = useMemo(() => ({
    premium: usersList.overview.activePremiumUsers,
    active_7d: usersList.overview.activeUsers7d,
    need_attention: usersList.overview.needAttentionUsers,
  }), [usersList.overview.activePremiumUsers, usersList.overview.activeUsers7d, usersList.overview.needAttentionUsers]);

  const handlePremiumAction = async (action: 'grant' | 'revoke') => {
    const ok = await detail.runPremiumAction(action, {
      success: action === 'grant' ? getAdminText(lang, 'premium_granted') : getAdminText(lang, 'premium_revoked'),
      failure: getAdminText(lang, 'update_premium_failed'),
    });
    if (ok) {
      await usersList.reload();
    }
  };

  const handleLumiAction = async (action: 'add' | 'subtract') => {
    const amount = Number(detail.lumiAmount);
    const result = await detail.runLumiAction(action, amount, {
      success: action === 'add'
        ? formatAdminText(lang, 'lumi_added', { amount })
        : formatAdminText(lang, 'lumi_subtracted', { amount }),
      failure: getAdminText(lang, 'update_lumi_failed'),
      invalidAmount: getAdminText(lang, 'invalid_lumi_amount'),
    });
    if (result.ok) {
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

  const handleOpenNotification = () => {
    if (!detail.selectedUser) return;
    onSendNotification(detail.selectedUser.id);
  };

  return (
    <div className="space-y-5">
      {combinedError ? <AdminStateBanner tone="error">{combinedError}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5">
        <AdminSectionHeader
          eyebrow="Users"
          title={getAdminText(lang, 'users_title')}
          subtitle={getAdminText(lang, 'users_subtitle')}
        />

        <div className="mt-5 space-y-4">
          <div className="scrollbar-hide -mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2">
              {SEGMENTS.map((item) => (
                <AdminChipButton key={item} active={segment === item} onClick={() => onSegmentChange(item)}>
                  {[getSegmentLabel(lang, item), segmentBadgeValue[item as keyof typeof segmentBadgeValue]]
                    .filter((value) => value !== undefined && value !== null && value !== '')
                    .join(' · ')}
                </AdminChipButton>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))]">
            <input
              value={usersList.search}
              onChange={(event) => {
                usersList.setSearch(event.target.value);
                usersList.setPage(1);
              }}
              placeholder={getAdminText(lang, 'search_users')}
              className="w-full rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/40"
            />

            <select
              value={usersList.premiumFilter}
              onChange={(event) => {
                usersList.setPremiumFilter(event.target.value as AdminPremiumFilter);
                usersList.setPage(1);
              }}
              className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
            >
              {FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {filter === 'all' ? getAdminText(lang, 'filter_all') : filter === 'premium' ? 'Premium' : getAdminText(lang, 'filter_free')}
                </option>
              ))}
            </select>

            <select
              value={usersList.sortBy}
              onChange={(event) => {
                usersList.setSortBy(event.target.value as any);
                usersList.setPage(1);
              }}
              className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
            >
              <option value="last_seen">{getSortLabel(lang, 'last_seen')}</option>
              <option value="created_at">{getSortLabel(lang, 'created_at')}</option>
              <option value="lumi_balance">{getSortLabel(lang, 'lumi_balance')}</option>
              <option value="premium_until">{getSortLabel(lang, 'premium_until')}</option>
              <option value="saved_charts_count">{getSortLabel(lang, 'saved_charts_count')}</option>
              <option value="name">{getSortLabel(lang, 'name')}</option>
            </select>

            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
              <select
                value={usersList.sortOrder}
                onChange={(event) => {
                  usersList.setSortOrder(event.target.value as AdminSortOrder);
                  usersList.setPage(1);
                }}
                className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
              >
                <option value="desc">{getAdminText(lang, 'order_desc')}</option>
                <option value="asc">{getAdminText(lang, 'order_asc')}</option>
              </select>

              <select
                value={usersList.pagination.pageSize}
                onChange={(event) => usersList.setPageSize(Number(event.target.value))}
                className="rounded-[18px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </AdminSurface>

      <AdminSurface className="overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="grid grid-cols-[minmax(0,1.3fr)_110px_120px_140px] gap-3 text-[11px] uppercase tracking-[0.22em] text-slate-500 max-md:hidden">
            <span>{getAdminText(lang, 'users_title')}</span>
            <span className="text-right">{getAdminText(lang, 'lumi')}</span>
            <span className="text-right">{getAdminText(lang, 'slots_charts')}</span>
            <span className="text-right">{getAdminText(lang, 'last_seen')}</span>
          </div>
        </div>

        {usersList.loading ? (
          <div className="px-5 py-8 text-sm text-slate-400">{getAdminText(lang, 'users_loading')}</div>
        ) : usersList.users.length === 0 ? (
          <div className="px-5 py-8">
            <AdminEmptyState
              title={getAdminText(lang, 'users_empty')}
              body={getAdminText(lang, 'users_subtitle')}
            />
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/10">
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
        <div className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm">
          <div
            className="absolute inset-x-0 bottom-0 top-20 overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#091221] shadow-2xl md:inset-y-4 md:right-4 md:left-auto md:w-[460px] md:rounded-[30px]"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#091221]/95 px-5 py-4 backdrop-blur">
              <button
                onClick={detail.closeUser}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200"
              >
                ← {getAdminText(lang, 'detail_back')}
              </button>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap gap-2">
                  <StickyActionButton active={detail.actionLoading === 'premium-grant'} onClick={() => void handlePremiumAction('grant')}>
                    {getAdminText(lang, 'premium_plus')}
                  </StickyActionButton>
                  <StickyActionButton active={detail.actionLoading === 'premium-revoke'} onClick={() => void handlePremiumAction('revoke')}>
                    {getAdminText(lang, 'revoke')}
                  </StickyActionButton>
                  <StickyActionButton active={detail.actionLoading === 'lumi-add'} onClick={() => void handleLumiAction('add')}>
                    {getAdminText(lang, 'add_lumi')}
                  </StickyActionButton>
                  <StickyActionButton active={detail.actionLoading === 'lumi-subtract'} onClick={() => void handleLumiAction('subtract')}>
                    {getAdminText(lang, 'subtract_lumi')}
                  </StickyActionButton>
                  <StickyActionButton onClick={handleOpenNotification}>
                    {getAdminText(lang, 'notify')}
                  </StickyActionButton>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <input
                    value={detail.lumiAmount}
                    onChange={(event) => detail.setLumiAmount(event.target.value.replace(/[^\d]/g, ''))}
                    placeholder={getAdminText(lang, 'amount_placeholder')}
                    className="rounded-[16px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
                  />
                  <input
                    value={detail.lumiNote}
                    onChange={(event) => detail.setLumiNote(event.target.value)}
                    placeholder={getAdminText(lang, 'note_placeholder')}
                    className="rounded-[16px] border border-white/10 bg-[#0b1525] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40"
                  />
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
                  <AdminSurface className="px-5 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-serif text-[28px] leading-tight text-white">{detail.selectedUser.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="text-sm text-slate-400">{detail.selectedUser.id}</p>
                          <button
                            onClick={() => void handleCopyTelegramId()}
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300"
                          >
                            {getAdminText(lang, 'copy_id')}
                          </button>
                        </div>
                        <p className="mt-3 text-sm text-slate-400">
                          {detail.selectedUser.birthDate || getAdminText(lang, 'no_data')}
                          {detail.selectedUser.birthPlace ? ` · ${detail.selectedUser.birthPlace}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em]">
                        <span className={`rounded-full px-3 py-1 ${detail.selectedUser.isPremium ? 'bg-yellow-500/15 text-yellow-300' : 'bg-white/[0.05] text-slate-400'}`}>
                          {detail.selectedUser.isPremium ? 'Premium' : 'Free'}
                        </span>
                        {detail.selectedUser.isAdmin ? (
                          <span className="rounded-full bg-red-500/15 px-3 py-1 text-red-200">Admin</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <StatCard label={getAdminText(lang, 'premium_until')} value={formatDateTime(lang, detail.selectedUser.premiumUntil)} />
                      <StatCard label={getAdminText(lang, 'lumi')} value={`${detail.selectedUser.lumiBalance}`} />
                      <StatCard label={getAdminText(lang, 'slots_charts')} value={`${detail.selectedUser.savedChartsCount} / ${detail.selectedUser.chartSlots}`} />
                      <StatCard label={getAdminText(lang, 'last_seen')} value={formatDateTime(lang, detail.selectedUser.lastSeenAt)} />
                    </div>

                    <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                      <span className="font-medium text-white">{getAdminText(lang, 'current_device')}:</span>{' '}
                      {detail.selectedUser.currentDeviceLabel || getAdminText(lang, 'no_data')}
                    </div>
                  </AdminSurface>

                  <AccordionCard title={getAdminText(lang, 'economy')} subtitle={getAdminText(lang, 'economy_subtitle')} defaultOpen>
                    <div className="space-y-4">
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{getAdminText(lang, 'latest_stars')}</p>
                        <p className="mt-2 text-sm text-white">
                          {detail.selectedUser.latestStarsPayment
                            ? `${detail.selectedUser.latestStarsPayment.starsAmount} Stars · ${formatDateOnly(lang, detail.selectedUser.latestStarsPayment.createdAt)}`
                            : getAdminText(lang, 'no_stars')}
                        </p>
                      </div>

                      {detail.selectedUser.recentLumiTransactions.length === 0 ? (
                        <p className="text-sm text-slate-400">{getAdminText(lang, 'no_transactions')}</p>
                      ) : (
                        <div className="space-y-3">
                          {detail.selectedUser.recentLumiTransactions.map((transaction: LumiTransaction, index) => (
                            <div key={`${transaction.created_at}-${transaction.reason}-${index}`} className="flex items-start justify-between gap-4 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                              <div>
                                <p className="text-sm text-white">{formatLumiReason(lang, transaction.reason)}</p>
                                <p className="mt-1 text-xs text-slate-400">{formatDateTime(lang, transaction.created_at)}</p>
                              </div>
                              <span className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                {transaction.amount >= 0 ? '+' : ''}{transaction.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionCard>

                  <AccordionCard title={getAdminText(lang, 'activity')} subtitle={getAdminText(lang, 'activity_subtitle')}>
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <StatCard label={getAdminText(lang, 'last_daily_login')} value={formatDateTime(lang, detail.selectedUser.lastLogin)} />
                        <StatCard label={getAdminText(lang, 'created_at')} value={formatDateOnly(lang, detail.selectedUser.createdAt)} />
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{getAdminText(lang, 'oracle_questions')}</p>
                        {detail.selectedUser.recentOracleQuestions.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-400">{getAdminText(lang, 'no_questions')}</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {detail.selectedUser.recentOracleQuestions.map((question) => (
                              <div key={`${question.createdAt}-${question.question}`} className="rounded-[16px] border border-white/10 bg-[#0b1525] p-3">
                                <p className="text-sm text-white">{question.question}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{question.answer}</p>
                                <p className="mt-2 text-xs text-slate-500">{formatDateTime(lang, question.createdAt)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionCard>

                  <AccordionCard title={getAdminText(lang, 'charts')} subtitle={getAdminText(lang, 'charts_subtitle')}>
                    <div className="space-y-4">
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{getAdminText(lang, 'primary_chart')}</p>
                        {detail.selectedUser.primaryChart ? (
                          <div className="mt-2 space-y-1 text-sm text-slate-300">
                            <p className="text-white">{detail.selectedUser.primaryChart.name}</p>
                            <p>{detail.selectedUser.primaryChart.birthDate}</p>
                            <p>{detail.selectedUser.primaryChart.birthPlace}</p>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-400">{getAdminText(lang, 'no_primary_chart')}</p>
                        )}
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                        <p><span className="font-medium text-white">{getAdminText(lang, 'saved_charts')}:</span> {detail.selectedUser.savedChartsCount}</p>
                        <p className="mt-2"><span className="font-medium text-white">{getAdminText(lang, 'total_slots')}:</span> {detail.selectedUser.chartSlots}</p>
                      </div>
                    </div>
                  </AccordionCard>

                  <AccordionCard title={getAdminText(lang, 'sessions')} subtitle={getAdminText(lang, 'sessions_subtitle')}>
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
                            onToggleUserAgent={() => setSessionDetailsOpen((prev) => ({ ...prev, [session.sessionId]: !prev[session.sessionId] }))}
                          />
                        ))}
                      </div>
                    )}
                  </AccordionCard>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const UserRow: React.FC<{
  user: AdminUserSummary;
  lang: 'ru' | 'en';
  onOpen: () => void;
}> = ({ user, lang, onOpen }) => (
  <button
    onClick={onOpen}
    className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.3fr)_110px_120px_140px] md:items-center"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        {user.isPremium ? <span className="rounded-full bg-yellow-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-yellow-300">Premium</span> : null}
        {user.isAdmin ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-red-200">Admin</span> : null}
      </div>
      <p className="mt-1 truncate text-xs text-slate-500">{user.id}</p>
      <p className="mt-2 text-xs text-slate-400 md:hidden">
        {getAdminText(lang, 'last_seen')}: {formatDateTime(lang, user.lastSeenAt || user.lastLogin)}
      </p>
    </div>
    <p className="text-right text-sm text-slate-300">{user.lumiBalance}</p>
    <p className="text-right text-sm text-slate-300">{user.savedChartsCount} / {user.chartSlots}</p>
    <p className="text-right text-sm text-slate-400 max-md:hidden">{formatDateTime(lang, user.lastSeenAt || user.lastLogin)}</p>
  </button>
);

const StickyActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}> = ({ children, onClick, active = false }) => (
  <button
    onClick={onClick}
    className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
      active
        ? 'bg-sky-400 text-[#07111f]'
        : 'border border-white/10 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.07]'
    }`}
  >
    {children}
  </button>
);

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm text-white">{value}</p>
  </div>
);

const AccordionCard: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, subtitle, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <AdminSurface className="overflow-hidden">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <h3 className="font-serif text-xl text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <span className="text-lg text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-white/10 px-5 py-4">{children}</div> : null}
    </AdminSurface>
  );
};

const SessionRow: React.FC<{
  session: AdminUserSession;
  lang: 'ru' | 'en';
  userAgentOpen: boolean;
  onToggleUserAgent: () => void;
}> = ({ session, lang, userAgentOpen, onToggleUserAgent }) => (
  <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white">{session.deviceLabel || getAdminText(lang, 'unknown_device')}</p>
        <p className="mt-1 text-xs text-slate-400">{session.telegramPlatform || getAdminText(lang, 'platform_missing')}</p>
      </div>
      <div className="text-right text-xs text-slate-400">
        <p>{formatDateTime(lang, session.lastSeenAt)}</p>
        <p className="mt-1">{formatDateTime(lang, session.startedAt)}</p>
      </div>
    </div>

    {session.userAgent ? (
      <div className="mt-3">
        <button onClick={onToggleUserAgent} className="text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline">
          {userAgentOpen ? (lang === 'ru' ? 'Скрыть user-agent' : 'Hide user agent') : getAdminText(lang, 'show_user_agent')}
        </button>
        {userAgentOpen ? <p className="mt-2 break-words text-[11px] leading-5 text-slate-500">{session.userAgent}</p> : null}
      </div>
    ) : null}
  </div>
);
