import React, { useCallback, useEffect, useState } from 'react';
import type { AdminPremiumFilter, AdminUserDetail, AdminUserSummary, UserProfile } from '../../types';
import { fetchAdminUserDetail, fetchAdminUsers, updateAdminLumi, updateAdminPremium } from '../../services/adminService';
import { AdminBadge, AdminButton, AdminEmptyState, AdminInput, AdminSectionHeader, AdminSelect, AdminStateBanner, AdminSurface } from './AdminPrimitives';
import { formatAdminText, getAdminText } from './adminText';

type Props = {
  profile: UserProfile;
  onPatchOwnProfile: (patch: Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>) => void;
  onSendNotification: (userId: string) => void;
};

const FILTERS: AdminPremiumFilter[] = ['all', 'premium', 'free'];

const formatDateTime = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return getAdminText(lang, 'no_data');
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

export const AdminEconomyTab: React.FC<Props> = ({ profile, onPatchOwnProfile, onSendNotification }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [premiumFilter, setPremiumFilter] = useState<AdminPremiumFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lumiAmount, setLumiAmount] = useState('10');
  const [lumiNote, setLumiNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAdminUsers({
        q: search.trim(),
        premium: premiumFilter,
        page: 1,
        pageSize: 25,
        sortBy: 'lumi_balance',
        sortOrder: 'desc',
      });
      setUsers(payload.users);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'load_users_failed'));
    } finally {
      setLoading(false);
    }
  }, [lang, premiumFilter, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 160);
    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const openUser = async (userId: string) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    setActionMessage(null);
    try {
      const detail = await fetchAdminUserDetail(userId);
      setSelectedUser(detail);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'load_user_failed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const patchOwn = (detail: AdminUserDetail) => {
    if (detail.id !== profile.id) return;
    onPatchOwnProfile({
      isPremium: detail.isPremium,
      lumiBalance: detail.lumiBalance,
      chartSlots: detail.chartSlots,
      loginStreak: detail.loginStreak,
    });
  };

  const runPremiumAction = async (action: 'grant' | 'revoke') => {
    if (!selectedUserId) return;
    setActionLoading(`premium-${action}`);
    setError(null);
    try {
      const next = await updateAdminPremium(selectedUserId, action);
      setSelectedUser(next);
      patchOwn(next);
      setActionMessage(action === 'grant' ? getAdminText(lang, 'premium_granted') : getAdminText(lang, 'premium_revoked'));
      await loadUsers();
    } catch (actionError: any) {
      setError(actionError?.message || getAdminText(lang, 'update_premium_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const runLumiAction = async (action: 'add' | 'subtract') => {
    if (!selectedUserId) return;
    const amount = Number(lumiAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError(getAdminText(lang, 'invalid_lumi_amount'));
      return;
    }
    setActionLoading(`lumi-${action}`);
    setError(null);
    try {
      const result = await updateAdminLumi(selectedUserId, action, amount, lumiNote.trim());
      setSelectedUser(result.user);
      patchOwn(result.user);
      setActionMessage(action === 'add'
        ? formatAdminText(lang, 'lumi_added', { amount })
        : formatAdminText(lang, 'lumi_subtracted', { amount }));
      setLumiNote('');
      await loadUsers();
    } catch (actionError: any) {
      setError(actionError?.message || getAdminText(lang, 'update_lumi_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}
      {actionMessage ? <AdminStateBanner tone="success">{actionMessage}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Economy"
          title={getAdminText(lang, 'economy')}
          subtitle={lang === 'ru'
            ? 'Баланс Lumi, последние движения и быстрые действия по Premium и начислениям.'
            : 'Lumi balance, recent movements, and quick Premium/Lumi actions.'}
          action={<AdminButton tone="secondary" onClick={() => void loadUsers()}>{getAdminText(lang, 'refresh')}</AdminButton>}
        />

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <AdminInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={getAdminText(lang, 'search_users')}
          />
          <AdminSelect value={premiumFilter} onChange={(event) => setPremiumFilter(event.target.value as AdminPremiumFilter)}>
            {FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {filter === 'all' ? getAdminText(lang, 'filter_all') : filter === 'premium' ? 'Premium' : getAdminText(lang, 'filter_free')}
              </option>
            ))}
          </AdminSelect>
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <AdminSurface className="overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-sm text-slate-400">{getAdminText(lang, 'users_loading')}</div>
          ) : users.length === 0 ? (
            <div className="px-5 py-10">
              <AdminEmptyState title={getAdminText(lang, 'users_empty')} body={getAdminText(lang, 'economy_subtitle')} />
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => void openUser(user.id)}
                  className={`grid w-full gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03] md:grid-cols-[minmax(0,1fr)_100px_140px] md:items-center ${
                    selectedUserId === user.id ? 'bg-white/[0.04]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                      <AdminBadge tone={user.isPremium ? 'premium' : 'neutral'}>{user.isPremium ? 'Premium' : 'Free'}</AdminBadge>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{user.id}</p>
                  </div>
                  <p className="text-right text-sm font-semibold text-white">{user.lumiBalance}</p>
                  <p className="text-right text-xs text-slate-400">{formatDateTime(lang, user.lastSeenAt || user.lastLogin)}</p>
                </button>
              ))}
            </div>
          )}
        </AdminSurface>

        <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
          {detailLoading ? (
            <p className="text-sm text-slate-400">{getAdminText(lang, 'user_loading')}</p>
          ) : !selectedUser ? (
            <AdminEmptyState
              title={lang === 'ru' ? 'Выберите пользователя' : 'Select a user'}
              body={lang === 'ru'
                ? 'Откройте пользователя слева, чтобы посмотреть баланс, платёж и последние операции.'
                : 'Choose a user on the left to inspect balance, payment, and recent transactions.'}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="admin-label">{getAdminText(lang, 'detail_title')}</p>
                <h3 className="admin-heading mt-2 text-2xl text-white">{selectedUser.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{selectedUser.id}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label={getAdminText(lang, 'lumi')} value={String(selectedUser.lumiBalance)} />
                <Metric label={getAdminText(lang, 'premium_until')} value={formatDateTime(lang, selectedUser.premiumUntil)} />
              </div>

              <div className="admin-surface-muted p-4">
                <div className="flex flex-wrap gap-2">
                  <AdminButton tone="secondary" onClick={() => void runPremiumAction('grant')} disabled={actionLoading === 'premium-grant'}>
                    {getAdminText(lang, 'premium_plus')}
                  </AdminButton>
                  <AdminButton tone="secondary" onClick={() => void runPremiumAction('revoke')} disabled={actionLoading === 'premium-revoke'}>
                    {getAdminText(lang, 'revoke')}
                  </AdminButton>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <AdminInput
                    value={lumiAmount}
                    onChange={(event) => setLumiAmount(event.target.value.replace(/[^\d]/g, ''))}
                    inputMode="numeric"
                    placeholder={getAdminText(lang, 'amount_placeholder')}
                  />
                  <AdminInput
                    value={lumiNote}
                    onChange={(event) => setLumiNote(event.target.value)}
                    placeholder={getAdminText(lang, 'note_placeholder')}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminButton tone="primary" onClick={() => void runLumiAction('add')} disabled={actionLoading === 'lumi-add'}>
                    {getAdminText(lang, 'add_lumi')}
                  </AdminButton>
                  <AdminButton tone="danger" onClick={() => void runLumiAction('subtract')} disabled={actionLoading === 'lumi-subtract'}>
                    {getAdminText(lang, 'subtract_lumi')}
                  </AdminButton>
                  <AdminButton tone="ghost" onClick={() => onSendNotification(selectedUser.id)}>
                    {getAdminText(lang, 'notify')}
                  </AdminButton>
                </div>
              </div>

              <div className="admin-surface-muted p-4">
                <p className="admin-label">{getAdminText(lang, 'latest_stars')}</p>
                <p className="mt-3 text-sm leading-6 text-white">
                  {selectedUser.latestStarsPayment
                    ? `${selectedUser.latestStarsPayment.starsAmount} Stars · ${formatDateTime(lang, selectedUser.latestStarsPayment.createdAt)}`
                    : getAdminText(lang, 'no_stars')}
                </p>
              </div>

              <div className="space-y-3">
                {selectedUser.recentLumiTransactions.length === 0 ? (
                  <p className="text-sm text-slate-400">{getAdminText(lang, 'no_transactions')}</p>
                ) : (
                  selectedUser.recentLumiTransactions.map((transaction, index) => (
                    <div key={`${transaction.created_at}-${transaction.reason}-${index}`} className="admin-surface-muted p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{transaction.reason.replaceAll('_', ' ')}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(lang, transaction.created_at)}</p>
                        </div>
                        <p className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </AdminSurface>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="admin-surface-muted p-4">
    <p className="admin-label">{label}</p>
    <p className="mt-2 text-sm font-semibold text-white">{value}</p>
  </div>
);
