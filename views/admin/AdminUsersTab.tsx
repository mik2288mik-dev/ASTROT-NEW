import React, { useCallback, useEffect, useState } from 'react';
import {
  type AdminPremiumFilter,
  type AdminUserDetail,
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
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
  onSendNotification: (userId: string) => void;
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);
const FILTERS: AdminPremiumFilter[] = ['all', 'premium', 'free'];

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

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ profile, onPatchOwnProfile, onSendNotification }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [search, setSearch] = useState('');
  const [premiumFilter, setPremiumFilter] = useState<AdminPremiumFilter>('all');
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lumiAmount, setLumiAmount] = useState('10');
  const [lumiNote, setLumiNote] = useState('');

  const patchOwnProfileFromDetail = useCallback((detail: AdminUserDetail) => {
    if (detail.id !== profile.id) return;
    onPatchOwnProfile({
      isPremium: detail.isPremium,
      lumiBalance: detail.lumiBalance,
      chartSlots: detail.chartSlots,
      loginStreak: detail.loginStreak,
    });
  }, [onPatchOwnProfile, profile.id]);

  const loadUsers = useCallback(async (keepSelection = true) => {
    setListLoading(true);
    setError(null);
    try {
      const nextUsers = await fetchAdminUsers({
        q: search.trim(),
        premium: premiumFilter,
        limit: 120,
      });
      setUsers(nextUsers);
      const nextSelectedId = keepSelection && selectedUserId && nextUsers.some((user) => user.id === selectedUserId)
        ? selectedUserId
        : (nextUsers[0]?.id || null);
      setSelectedUserId(nextSelectedId);
    } catch (loadError: any) {
      setUsers([]);
      setSelectedUserId(null);
      setSelectedUser(null);
      setError(loadError?.message || T(lang, 'Не удалось загрузить пользователей', 'Failed to load users'));
    } finally {
      setListLoading(false);
    }
  }, [lang, premiumFilter, search, selectedUserId]);

  const loadSelectedUser = useCallback(async (userId: string | null) => {
    if (!userId) {
      setSelectedUser(null);
      return;
    }

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
    void loadSelectedUser(selectedUserId);
  }, [loadSelectedUser, selectedUserId]);

  const handlePremiumAction = async (action: 'grant' | 'revoke') => {
    if (!selectedUserId) return;
    setActionLoading(`premium-${action}`);
    setError(null);
    try {
      const updated = await updateAdminPremium(selectedUserId, action);
      setSelectedUser(updated);
      patchOwnProfileFromDetail(updated);
      await loadUsers(true);
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
      await loadUsers(true);
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

  return (
    <>
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-astro-border bg-astro-card p-4 space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={T(lang, 'Поиск по имени или Telegram ID', 'Search by name or Telegram ID')}
          className="w-full rounded-xl border border-astro-border bg-astro-bg px-4 py-3 text-sm text-astro-text outline-none focus:border-astro-highlight/50"
        />

        <div className="flex gap-2">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="rounded-2xl border border-astro-border bg-astro-card">
          <div className="border-b border-astro-border px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg text-astro-text">{T(lang, 'Пользователи', 'Users')}</h3>
                <p className="mt-1 text-xs text-astro-subtext">{T(lang, 'Реальные пользователи из базы данных', 'Real users from the database')}</p>
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
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full px-4 py-4 text-left transition-colors ${user.id === selectedUserId ? 'bg-astro-highlight/10' : 'hover:bg-astro-bg/40'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-astro-text">{user.name}</p>
                      <p className="mt-1 text-xs text-astro-subtext">{user.id}</p>
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

        <section className="rounded-2xl border border-astro-border bg-astro-card">
          <div className="border-b border-astro-border px-4 py-4">
            <h3 className="font-serif text-lg text-astro-text">{T(lang, 'Карточка пользователя', 'User overview')}</h3>
            <p className="mt-1 text-xs text-astro-subtext">{T(lang, 'Premium, Lumi, слоты, карты и активность', 'Premium, Lumi, slots, charts, and activity')}</p>
          </div>

          {detailLoading ? (
            <div className="p-6 text-sm text-astro-subtext">{T(lang, 'Загружаем данные пользователя...', 'Loading user details...')}</div>
          ) : !selectedUser ? (
            <div className="p-6 text-sm text-astro-subtext">{T(lang, 'Выберите пользователя слева', 'Select a user from the list')}</div>
          ) : (
            <div className="space-y-6 p-4">
              <div className="rounded-xl border border-astro-border bg-astro-bg/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-xl text-astro-text">{selectedUser.name}</p>
                    <p className="mt-1 text-sm text-astro-subtext">{selectedUser.id}</p>
                    <p className="mt-2 text-sm text-astro-subtext">
                      {selectedUser.birthDate || T(lang, 'Дата не указана', 'Birth date not set')}
                      {selectedUser.birthPlace ? `, ${selectedUser.birthPlace}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
                    <span className={`rounded-full px-2 py-1 ${selectedUser.isPremium ? 'bg-yellow-500/15 text-yellow-400' : 'bg-astro-bg text-astro-subtext'}`}>
                      {selectedUser.isPremium ? 'Premium' : 'Free'}
                    </span>
                    {selectedUser.isAdmin && <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-300">Admin</span>}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard label="Premium until" value={formatDateTime(lang, selectedUser.premiumUntil)} />
                <StatCard label="Lumi" value={String(selectedUser.lumiBalance)} />
                <StatCard label={T(lang, 'Слоты / карты', 'Slots / charts')} value={`${selectedUser.savedChartsCount} / ${selectedUser.chartSlots}`} />
                <StatCard label={T(lang, 'Серия входов', 'Login streak')} value={String(selectedUser.loginStreak)} />
                <StatCard label={T(lang, 'Последний вход за бонусом', 'Last daily login')} value={formatDateTime(lang, selectedUser.lastLogin)} />
                <StatCard label={T(lang, 'Последняя активность', 'Last seen')} value={formatDateTime(lang, selectedUser.lastSeenAt)} />
              </div>

              <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
                <div className="mb-4 flex flex-wrap gap-3">
                  <button onClick={() => handlePremiumAction('grant')} disabled={actionLoading === 'premium-grant'} className="rounded-lg bg-astro-highlight px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {actionLoading === 'premium-grant' ? T(lang, 'Обновляем...', 'Updating...') : T(lang, 'Выдать Premium +30 дней', 'Grant Premium +30 days')}
                  </button>
                  <button onClick={() => handlePremiumAction('revoke')} disabled={actionLoading === 'premium-revoke'} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-50">
                    {actionLoading === 'premium-revoke' ? T(lang, 'Обновляем...', 'Updating...') : T(lang, 'Отозвать Premium', 'Revoke Premium')}
                  </button>
                  <button onClick={() => onSendNotification(selectedUser.id)} className="rounded-lg border border-astro-highlight/40 px-4 py-2 text-sm font-semibold text-astro-text">
                    {T(lang, 'Отправить уведомление', 'Send notification')}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
                  <input
                    value={lumiAmount}
                    onChange={(event) => setLumiAmount(event.target.value.replace(/[^\d]/g, ''))}
                    placeholder="10"
                    className="rounded-lg border border-astro-border bg-astro-card px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
                  />
                  <input
                    value={lumiNote}
                    onChange={(event) => setLumiNote(event.target.value)}
                    placeholder={T(lang, 'Сообщение пользователю (необязательно)', 'Message to user (optional)')}
                    className="rounded-lg border border-astro-border bg-astro-card px-3 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight/40"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button onClick={() => handleLumiAction('add')} disabled={actionLoading === 'lumi-add'} className="rounded-lg bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {actionLoading === 'lumi-add' ? T(lang, 'Обновляем...', 'Updating...') : T(lang, 'Добавить Lumi', 'Add Lumi')}
                  </button>
                  <button onClick={() => handleLumiAction('subtract')} disabled={actionLoading === 'lumi-subtract'} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-50">
                    {actionLoading === 'lumi-subtract' ? T(lang, 'Обновляем...', 'Updating...') : T(lang, 'Списать Lumi', 'Subtract Lumi')}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <InfoCard title={T(lang, 'Основная карта', 'Primary chart')}>
                  {selectedUser.primaryChart ? (
                    <div className="space-y-1 text-sm text-astro-subtext">
                      <p className="text-astro-text">{selectedUser.primaryChart.name}</p>
                      <p>{selectedUser.primaryChart.birthDate}</p>
                      <p>{selectedUser.primaryChart.birthPlace}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-astro-subtext">{T(lang, 'Основная карта пока отсутствует', 'Primary chart is not available')}</p>
                  )}
                </InfoCard>

                <InfoCard title={T(lang, 'Последний Stars платёж', 'Latest Stars payment')}>
                  {selectedUser.latestStarsPayment ? (
                    <div className="text-sm text-astro-subtext">
                      <p className="text-astro-text">{selectedUser.latestStarsPayment.starsAmount} Stars</p>
                      <p className="mt-1">{formatDateOnly(lang, selectedUser.latestStarsPayment.createdAt)}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-astro-subtext">{T(lang, 'Платежи не найдены', 'No Stars payments found')}</p>
                  )}
                </InfoCard>
              </div>

              <InfoCard title={T(lang, 'Последние устройства и сессии', 'Recent sessions and devices')}>
                {selectedUser.recentSessions.length === 0 ? (
                  <p className="text-sm text-astro-subtext">{T(lang, 'Сессий пока нет', 'No recent sessions yet')}</p>
                ) : (
                  <div className="space-y-3">
                    {selectedUser.recentSessions.map((session) => (
                      <SessionRow key={`${session.sessionId}-${session.lastSeenAt}`} session={session} lang={lang} />
                    ))}
                  </div>
                )}
              </InfoCard>

              <InfoCard title={T(lang, 'Последние операции Lumi', 'Recent Lumi transactions')}>
                {selectedUser.recentLumiTransactions.length === 0 ? (
                  <p className="text-sm text-astro-subtext">{T(lang, 'Транзакций пока нет', 'No transactions yet')}</p>
                ) : (
                  <div className="space-y-3">
                    {selectedUser.recentLumiTransactions.map((transaction: LumiTransaction, index) => {
                      const income = transaction.amount >= 0;
                      return (
                        <div key={`${transaction.created_at}-${transaction.reason}-${index}`} className="flex items-start justify-between gap-4 rounded-lg border border-astro-border bg-astro-card p-3">
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
              </InfoCard>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
    <p className="text-[10px] uppercase tracking-widest text-astro-subtext">{label}</p>
    <p className="mt-2 text-sm text-astro-text">{value}</p>
  </div>
);

const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-astro-border bg-astro-bg/20 p-4">
    <h4 className="font-medium text-astro-text">{title}</h4>
    <div className="mt-3">{children}</div>
  </div>
);

const SessionRow: React.FC<{ session: AdminUserSession; lang: 'ru' | 'en' }> = ({ session, lang }) => (
  <div className="rounded-lg border border-astro-border bg-astro-card p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-astro-text">{session.deviceLabel || T(lang, 'Неизвестное устройство', 'Unknown device')}</p>
        <p className="mt-1 text-xs text-astro-subtext">{session.telegramPlatform || T(lang, 'Платформа не указана', 'Platform not available')}</p>
      </div>
      <div className="text-right text-xs text-astro-subtext">
        <p>{formatDateTime(lang, session.lastSeenAt)}</p>
        <p className="mt-1">{formatDateTime(lang, session.startedAt)}</p>
      </div>
    </div>
    {session.userAgent && (
      <p className="mt-2 break-words text-[11px] text-astro-subtext/80">{session.userAgent}</p>
    )}
  </div>
);
