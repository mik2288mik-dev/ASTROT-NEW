import React, { useCallback, useEffect, useState } from 'react';
import {
  type AdminPremiumFilter,
  type AdminUserDetail,
  type AdminUserSegment,
  type AdminUsersOverview,
  type AdminUserSession,
  type AdminUserSummary,
  type LumiTransaction,
  type UserProfile,
} from '../../types';
import {
  fetchAdminUserDetail,
  fetchAdminUsers,
  updateAdminLumi,
  updateAdminPremium,
} from '../../services/adminService';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>;

interface AdminUsersTabProps {
  profile: UserProfile;
  segment: AdminUserSegment;
  onSegmentChange: (segment: AdminUserSegment) => void;
  onOverviewChange: (overview: AdminUsersOverview) => void;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onSendNotification: (userId: string) => void;
}

type ActionResult = {
  tone: 'success' | 'info';
  message: string;
};

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);
const FILTERS: AdminPremiumFilter[] = ['all', 'premium', 'free'];
const SEGMENTS: AdminUserSegment[] = ['all', 'premium', 'free', 'active_7d', 'inactive_30d', 'need_attention'];

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return lang === 'ru' ? 'Нет данных' : 'No data';
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const formatDateOnly = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return lang === 'ru' ? 'Нет данных' : 'No data';
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
  return map[reason]?.[lang] || reason.replace(/_/g, ' ');
};

const getSegmentLabel = (lang: 'ru' | 'en', segment: AdminUserSegment) => {
  const labels: Record<AdminUserSegment, { ru: string; en: string }> = {
    all: { ru: 'Все', en: 'All' },
    premium: { ru: 'Premium', en: 'Premium' },
    free: { ru: 'Free', en: 'Free' },
    active_7d: { ru: 'Активны 7д', en: 'Active 7d' },
    inactive_30d: { ru: 'Неактивны 30д', en: 'Inactive 30d' },
    need_attention: { ru: 'Нужно внимание', en: 'Need attention' },
  };
  return labels[segment][lang];
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
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [overview, setOverview] = useState<AdminUsersOverview>({
    totalUsers: 0,
    activePremiumUsers: 0,
    totalLumiBalance: 0,
    activeUsers7d: 0,
    needAttentionUsers: 0,
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [premiumFilter, setPremiumFilter] = useState<AdminPremiumFilter>('all');
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [lumiAmount, setLumiAmount] = useState('10');
  const [lumiNote, setLumiNote] = useState('');

  useEffect(() => {
    if (segment === 'premium' || segment === 'free') {
      setPremiumFilter(segment);
      return;
    }
    if (segment === 'all') {
      setPremiumFilter('all');
    }
  }, [segment]);

  const patchOwnProfileFromDetail = useCallback((detail: AdminUserDetail) => {
    if (detail.id !== profile.id) return;
    onPatchOwnProfile({
      isPremium: detail.isPremium,
      lumiBalance: detail.lumiBalance,
      chartSlots: detail.chartSlots,
      loginStreak: detail.loginStreak,
    });
  }, [onPatchOwnProfile, profile.id]);

  const loadUsers = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const payload = await fetchAdminUsers({
        q: search.trim(),
        premium: premiumFilter,
        segment,
        limit: 120,
      });
      setUsers(payload.users);
      setOverview(payload.overview);
      onOverviewChange(payload.overview);
    } catch (loadError: any) {
      setUsers([]);
      setOverview({
        totalUsers: 0,
        activePremiumUsers: 0,
        totalLumiBalance: 0,
        activeUsers7d: 0,
        needAttentionUsers: 0,
      });
      onOverviewChange({
        totalUsers: 0,
        activePremiumUsers: 0,
        totalLumiBalance: 0,
        activeUsers7d: 0,
        needAttentionUsers: 0,
      });
      setError(loadError?.message || T(lang, 'Не удалось загрузить пользователей', 'Failed to load users'));
    } finally {
      setListLoading(false);
    }
  }, [lang, onOverviewChange, premiumFilter, search, segment]);

  const loadSelectedUser = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchAdminUserDetail(userId);
      setSelectedUser(detail);
    } catch (loadError: any) {
      setSelectedUser(null);
      setError(loadError?.message || T(lang, 'Не удалось загрузить пользователя', 'Failed to load user'));
    } finally {
      setDetailLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  useEffect(() => {
    if (!detailOpen || !selectedUserId) return;
    void loadSelectedUser(selectedUserId);
  }, [detailOpen, loadSelectedUser, selectedUserId]);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedUser(null);
    setDetailOpen(true);
    setError(null);
    setActionResult(null);
  };

  const handleBackToList = () => {
    setDetailOpen(false);
    setSelectedUser(null);
    setError(null);
    setActionResult(null);
  };

  const handlePremiumAction = async (action: 'grant' | 'revoke') => {
    if (!selectedUserId) return;
    setActionLoading(`premium-${action}`);
    setError(null);
    try {
      const updated = await updateAdminPremium(selectedUserId, action);
      setSelectedUser(updated);
      patchOwnProfileFromDetail(updated);
      setActionResult({
        tone: 'success',
        message: action === 'grant'
          ? T(lang, 'Premium продлён на 30 дней', 'Premium extended by 30 days')
          : T(lang, 'Premium отключён', 'Premium revoked'),
      });
      await loadUsers();
    } catch (actionError: any) {
      setError(actionError?.message || T(lang, 'Не удалось обновить premium', 'Failed to update premium'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleLumiAction = async (action: 'add' | 'subtract') => {
    if (!selectedUserId) return;
    const amount = Number(lumiAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError(T(lang, 'Введите целое положительное число Lumi', 'Enter a positive Lumi amount'));
      return;
    }

    setActionLoading(`lumi-${action}`);
    setError(null);
    try {
      const result = await updateAdminLumi(selectedUserId, action, amount, lumiNote.trim());
      const updated = result.user;
      setSelectedUser(updated);
      patchOwnProfileFromDetail(updated);
      setActionResult({
        tone: 'success',
        message: action === 'add'
          ? T(lang, `Начислено ${amount} Lumi`, `Added ${amount} Lumi`)
          : T(lang, `Списано ${amount} Lumi`, `Subtracted ${amount} Lumi`),
      });
      await loadUsers();
      setLumiNote('');
      if (lumiNote.trim() && result.notificationError) {
        setError(result.notificationError);
      }
    } catch (actionError: any) {
      setError(actionError?.message || T(lang, 'Не удалось обновить Lumi', 'Failed to update Lumi'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyTelegramId = async () => {
    if (!selectedUser) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedUser.id);
      } else {
        window.prompt(T(lang, 'Скопируйте Telegram ID', 'Copy Telegram ID'), selectedUser.id);
      }
      setActionResult({
        tone: 'info',
        message: T(lang, 'Telegram ID скопирован', 'Telegram ID copied'),
      });
    } catch {
      setError(T(lang, 'Не удалось скопировать Telegram ID', 'Failed to copy Telegram ID'));
    }
  };

  if (detailOpen) {
    return (
      <div className="space-y-4">
        <div
          className="sticky z-[5] rounded-2xl border border-astro-border bg-astro-card/95 p-4 shadow-md backdrop-blur"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)' }}
        >
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-astro-highlight"
          >
            <span>←</span>
            <span>{T(lang, 'К списку пользователей', 'Back to users')}</span>
          </button>

          {!selectedUser ? null : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handlePremiumAction('grant')}
                  disabled={!!actionLoading}
                  className="rounded-full bg-astro-highlight px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {actionLoading === 'premium-grant' ? T(lang, 'Идёт...', 'Working...') : 'Premium +30'}
                </button>
                <button
                  onClick={() => handlePremiumAction('revoke')}
                  disabled={!!actionLoading}
                  className="rounded-full border border-red-500/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-red-300 disabled:opacity-50"
                >
                  {actionLoading === 'premium-revoke' ? T(lang, 'Идёт...', 'Working...') : T(lang, 'Revoke', 'Revoke')}
                </button>
                <button
                  onClick={() => handleLumiAction('add')}
                  disabled={!!actionLoading}
                  className="rounded-full bg-emerald-500/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {actionLoading === 'lumi-add' ? T(lang, 'Идёт...', 'Working...') : '+ Lumi'}
                </button>
                <button
                  onClick={() => handleLumiAction('subtract')}
                  disabled={!!actionLoading}
                  className="rounded-full border border-red-500/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-red-300 disabled:opacity-50"
                >
                  {actionLoading === 'lumi-subtract' ? T(lang, 'Идёт...', 'Working...') : '- Lumi'}
                </button>
                <button
                  onClick={() => onSendNotification(selectedUser.id)}
                  className="rounded-full border border-astro-highlight/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-astro-text"
                >
                  {T(lang, 'Notify', 'Notify')}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <input
                  value={lumiAmount}
                  onChange={(event) => setLumiAmount(event.target.value.replace(/[^\d]/g, ''))}
                  placeholder="10"
                  className="rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
                />
                <input
                  value={lumiNote}
                  onChange={(event) => setLumiNote(event.target.value)}
                  placeholder={T(lang, 'Сообщение пользователю (необязательно)', 'Message to user (optional)')}
                  className="rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
                />
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {actionResult && (
          <div className={`rounded-xl border p-4 text-sm ${
            actionResult.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-astro-highlight/40 bg-astro-highlight/10 text-astro-text'
          }`}>
            {actionResult.message}
          </div>
        )}

        {detailLoading ? (
          <div className="rounded-2xl border border-astro-border bg-astro-card p-6 text-sm text-astro-subtext">
            {T(lang, 'Загружаем данные пользователя...', 'Loading user details...')}
          </div>
        ) : !selectedUser ? (
          <div className="rounded-2xl border border-astro-border bg-astro-card p-6 text-sm text-astro-subtext">
            {T(lang, 'Пользователь не найден', 'User not found')}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-astro-border bg-astro-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-serif text-xl text-astro-text">{selectedUser.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-astro-subtext">{selectedUser.id}</p>
                    <button
                      onClick={handleCopyTelegramId}
                      className="rounded-full border border-astro-border px-2 py-1 text-[10px] uppercase tracking-widest text-astro-subtext transition-colors hover:border-astro-highlight/40 hover:text-astro-text"
                    >
                      {T(lang, 'Копировать ID', 'Copy ID')}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-astro-subtext">
                    {selectedUser.birthDate || T(lang, 'Дата не указана', 'Birth date not set')}
                    {selectedUser.birthPlace ? `, ${selectedUser.birthPlace}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
                  <span className={`rounded-full px-2 py-1 ${selectedUser.isPremium ? 'bg-yellow-500/15 text-yellow-400' : 'bg-astro-bg text-astro-subtext'}`}>
                    {selectedUser.isPremium ? 'Premium' : 'Free'}
                  </span>
                  {selectedUser.isAdmin && (
                    <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-300">Admin</span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatCard label="Premium until" value={formatDateTime(lang, selectedUser.premiumUntil)} />
                <StatCard label="Lumi" value={`${selectedUser.lumiBalance}`} />
                <StatCard label={T(lang, 'Слоты / карты', 'Slots / charts')} value={`${selectedUser.savedChartsCount} / ${selectedUser.chartSlots}`} />
                <StatCard label={T(lang, 'Последняя активность', 'Last seen')} value={formatDateTime(lang, selectedUser.lastSeenAt)} />
              </div>

              <div className="mt-3 rounded-xl border border-astro-border bg-astro-bg/30 p-3 text-sm text-astro-subtext">
                <span className="font-medium text-astro-text">
                  {T(lang, 'Текущее устройство', 'Current device')}:
                </span>{' '}
                {selectedUser.currentDeviceLabel || T(lang, 'Нет данных', 'No data')}
              </div>
            </section>

            <AccordionCard
              title={T(lang, 'Экономика', 'Economy')}
              subtitle={T(lang, 'Lumi и последний Stars платёж', 'Lumi and latest Stars payment')}
              defaultOpen
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                    {T(lang, 'Последний Stars платёж', 'Latest Stars payment')}
                  </p>
                  <p className="mt-2 text-sm text-astro-text">
                    {selectedUser.latestStarsPayment
                      ? `${selectedUser.latestStarsPayment.starsAmount} Stars · ${formatDateOnly(lang, selectedUser.latestStarsPayment.createdAt)}`
                      : T(lang, 'Платежи не найдены', 'No Stars payments found')}
                  </p>
                </div>

                {selectedUser.recentLumiTransactions.length === 0 ? (
                  <p className="text-sm text-astro-subtext">{T(lang, 'Транзакций пока нет', 'No transactions yet')}</p>
                ) : (
                  <div className="space-y-3">
                    {selectedUser.recentLumiTransactions.map((transaction: LumiTransaction, index) => {
                      const income = transaction.amount >= 0;
                      return (
                        <div
                          key={`${transaction.created_at}-${transaction.reason}-${index}`}
                          className="flex items-start justify-between gap-4 rounded-lg border border-astro-border bg-astro-bg/20 p-3"
                        >
                          <div>
                            <p className="text-sm text-astro-text">{formatLumiReason(lang, transaction.reason)}</p>
                            <p className="mt-1 text-xs text-astro-subtext">{formatDateTime(lang, transaction.created_at)}</p>
                          </div>
                          <span className={`text-sm font-semibold ${income ? 'text-emerald-400' : 'text-red-300'}`}>
                            {income ? '+' : ''}
                            {transaction.amount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </AccordionCard>

            <AccordionCard
              title={T(lang, 'Активность', 'Activity')}
              subtitle={T(lang, 'Последние действия и Oracle', 'Recent activity and Oracle')}
            >
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard label={T(lang, 'Последний вход за бонусом', 'Last daily login')} value={formatDateTime(lang, selectedUser.lastLogin)} />
                  <StatCard label={T(lang, 'Создан аккаунт', 'Created at')} value={formatDateOnly(lang, selectedUser.createdAt)} />
                </div>

                <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                    {T(lang, 'Oracle вопросы', 'Oracle questions')}
                  </p>
                  {selectedUser.recentOracleQuestions.length === 0 ? (
                    <p className="mt-2 text-sm text-astro-subtext">{T(lang, 'Вопросов пока нет', 'No questions yet')}</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {selectedUser.recentOracleQuestions.map((question) => (
                        <div key={`${question.createdAt}-${question.question}`} className="rounded-lg border border-astro-border bg-astro-card p-3">
                          <p className="text-sm text-astro-text">{question.question}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-astro-subtext">{question.answer}</p>
                          <p className="mt-2 text-xs text-astro-subtext">{formatDateTime(lang, question.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </AccordionCard>

            <AccordionCard
              title={T(lang, 'Карты', 'Charts')}
              subtitle={T(lang, 'Основная карта и слоты', 'Primary chart and slots')}
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                    {T(lang, 'Основная карта', 'Primary chart')}
                  </p>
                  {selectedUser.primaryChart ? (
                    <div className="mt-2 space-y-1 text-sm text-astro-subtext">
                      <p className="text-astro-text">{selectedUser.primaryChart.name}</p>
                      <p>{selectedUser.primaryChart.birthDate}</p>
                      <p>{selectedUser.primaryChart.birthPlace}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-astro-subtext">
                      {T(lang, 'Основная карта пока отсутствует', 'Primary chart is not available')}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4 text-sm text-astro-subtext">
                  <p>
                    <span className="font-medium text-astro-text">{T(lang, 'Сохранённых карт', 'Saved charts')}:</span>{' '}
                    {selectedUser.savedChartsCount}
                  </p>
                  <p className="mt-2">
                    <span className="font-medium text-astro-text">{T(lang, 'Всего слотов', 'Total slots')}:</span>{' '}
                    {selectedUser.chartSlots}
                  </p>
                </div>
              </div>
            </AccordionCard>

            <AccordionCard
              title={T(lang, 'Сессии', 'Sessions')}
              subtitle={T(lang, 'Последние 3 входа и устройства', 'Last 3 logins and devices')}
            >
              {selectedUser.recentSessions.length === 0 ? (
                <p className="text-sm text-astro-subtext">{T(lang, 'Сессий пока нет', 'No recent sessions yet')}</p>
              ) : (
                <div className="space-y-3">
                  {selectedUser.recentSessions.map((userSession) => (
                    <SessionRow key={`${userSession.sessionId}-${userSession.lastSeenAt}`} session={userSession} lang={lang} />
                  ))}
                </div>
              )}
            </AccordionCard>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-astro-border bg-astro-card p-4">
        <div className="scrollbar-hide -mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2">
            {SEGMENTS.map((item) => (
              <button
                key={item}
                onClick={() => onSegmentChange(item)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  segment === item
                    ? 'bg-astro-highlight text-white'
                    : 'border border-astro-border text-astro-subtext hover:border-astro-highlight/40 hover:text-astro-text'
                }`}
              >
                {getSegmentLabel(lang, item)}
                {item === 'premium' ? ` · ${overview.activePremiumUsers}` : ''}
                {item === 'active_7d' ? ` · ${overview.activeUsers7d}` : ''}
                {item === 'need_attention' ? ` · ${overview.needAttentionUsers}` : ''}
              </button>
            ))}
          </div>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={T(lang, 'Поиск по имени или Telegram ID', 'Search by name or Telegram ID')}
          className="w-full rounded-xl border border-astro-border bg-astro-bg px-4 py-3 text-sm text-astro-text outline-none focus:border-astro-highlight/50"
        />

        <div className="scrollbar-hide -mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setPremiumFilter(filter)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  premiumFilter === filter
                    ? 'bg-astro-highlight text-white'
                    : 'border border-astro-border text-astro-subtext hover:border-astro-highlight/40 hover:text-astro-text'
                }`}
              >
                {filter === 'all' ? T(lang, 'Все', 'All') : filter === 'premium' ? 'Premium' : 'Free'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-astro-border bg-astro-card">
        <div className="border-b border-astro-border px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg text-astro-text">{T(lang, 'Пользователи', 'Users')}</h3>
              <p className="mt-1 text-xs text-astro-subtext">
                {T(lang, 'Компактный список для быстрых действий', 'Compact list for quick operations')}
              </p>
            </div>
            <span className="rounded-full border border-astro-border px-3 py-1 text-xs text-astro-subtext">{users.length}</span>
          </div>
        </div>

        {listLoading ? (
          <div className="p-6 text-sm text-astro-subtext">{T(lang, 'Загружаем список пользователей...', 'Loading users...')}</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-sm text-astro-subtext">{T(lang, 'Пользователи не найдены', 'No users found')}</div>
        ) : (
          <div className="divide-y divide-astro-border">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className="w-full px-4 py-4 text-left transition-colors hover:bg-astro-bg/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-astro-text">{user.name}</p>
                      {user.isPremium && (
                        <span className="rounded-full bg-yellow-500/15 px-2 py-1 text-[10px] uppercase tracking-widest text-yellow-400">
                          Premium
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-astro-subtext">{user.id}</p>
                    <p className="mt-2 text-xs text-astro-subtext">
                      {T(lang, 'Последняя активность', 'Last seen')}: {formatDateTime(lang, user.lastSeenAt || user.lastLogin)}
                    </p>
                  </div>

                  <div className="text-right text-xs text-astro-subtext">
                    <p>{user.lumiBalance} Lumi</p>
                    <p className="mt-1">{user.savedChartsCount}/{user.chartSlots} {T(lang, 'карт', 'charts')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
    <p className="text-[10px] uppercase tracking-widest text-astro-subtext">{label}</p>
    <p className="mt-2 text-sm text-astro-text">{value}</p>
  </div>
);

const AccordionCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title,
  subtitle,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details className="rounded-2xl border border-astro-border bg-astro-card" open={open}>
      <summary
        className="cursor-pointer list-none p-5"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg text-astro-text">{title}</h3>
            <p className="mt-1 text-xs text-astro-subtext">{subtitle}</p>
          </div>
          <span className="text-astro-subtext">{open ? '−' : '+'}</span>
        </div>
      </summary>
      {open && (
        <div className="border-t border-astro-border px-5 py-4">
          {children}
        </div>
      )}
    </details>
  );
};

const SessionRow: React.FC<{ session: AdminUserSession; lang: 'ru' | 'en' }> = ({ session, lang }) => (
  <div className="rounded-lg border border-astro-border bg-astro-bg/20 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-astro-text">
          {session.deviceLabel || T(lang, 'Неизвестное устройство', 'Unknown device')}
        </p>
        <p className="mt-1 text-xs text-astro-subtext">
          {session.telegramPlatform || T(lang, 'Платформа не указана', 'Platform not available')}
        </p>
      </div>
      <div className="text-right text-xs text-astro-subtext">
        <p>{formatDateTime(lang, session.lastSeenAt)}</p>
        <p className="mt-1">{formatDateTime(lang, session.startedAt)}</p>
      </div>
    </div>

    {session.userAgent && (
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-astro-subtext">
          {T(lang, 'Показать user-agent', 'Show user agent')}
        </summary>
        <p className="mt-2 break-words text-[11px] text-astro-subtext/80">{session.userAgent}</p>
      </details>
    )}
  </div>
);
