import React, { useCallback, useEffect, useState } from 'react';
import type { AdminUserDetail, AdminUserSummary, UserProfile } from '../../types';
import { fetchAdminUserDetail, fetchAdminUsers } from '../../services/adminService';
import { AdminBadge, AdminButton, AdminEmptyState, AdminInput, AdminSectionHeader, AdminStateBanner, AdminSurface } from './AdminPrimitives';
import { getAdminText } from './adminText';

type Props = {
  profile: UserProfile;
  onOpenUsers?: () => void;
};

const formatDate = (lang: 'ru' | 'en', value?: string | null) => {
  if (!value) return getAdminText(lang, 'no_data');
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

export const AdminChartsTab: React.FC<Props> = ({ profile, onOpenUsers }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAdminUsers({
        q: search.trim(),
        page: 1,
        pageSize: 25,
        sortBy: 'saved_charts_count',
        sortOrder: 'desc',
      });
      setUsers(payload.users);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'load_users_failed'));
    } finally {
      setLoading(false);
    }
  }, [lang, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 160);
    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const openUser = async (userId: string) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    try {
      const detail = await fetchAdminUserDetail(userId);
      setSelectedUser(detail);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'load_user_failed'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Charts"
          title={getAdminText(lang, 'charts')}
          subtitle={lang === 'ru'
            ? 'Слоты, сохранённые карты и основная карта пользователя в отдельной рабочей зоне.'
            : 'Slots, saved charts, and primary chart state in a dedicated workspace.'}
          action={(
            <div className="flex gap-2">
              {onOpenUsers ? (
                <AdminButton tone="secondary" onClick={onOpenUsers}>
                  {getAdminText(lang, 'section_users')}
                </AdminButton>
              ) : null}
              <AdminButton tone="secondary" onClick={() => void loadUsers()}>
                {getAdminText(lang, 'refresh')}
              </AdminButton>
            </div>
          )}
        />

        <div className="mt-6">
          <AdminInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={getAdminText(lang, 'search_users')}
          />
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <AdminSurface className="overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-sm text-slate-400">{getAdminText(lang, 'users_loading')}</div>
          ) : users.length === 0 ? (
            <div className="px-5 py-10">
              <AdminEmptyState title={getAdminText(lang, 'users_empty')} body={getAdminText(lang, 'charts_subtitle')} />
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => void openUser(user.id)}
                  className={`grid w-full gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03] md:grid-cols-[minmax(0,1fr)_132px_118px] md:items-center ${
                    selectedUserId === user.id ? 'bg-white/[0.04]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                      {user.isPremium ? <AdminBadge tone="premium">Premium</AdminBadge> : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{user.id}</p>
                  </div>
                  <p className="text-right text-sm text-white">{user.savedChartsCount}</p>
                  <p className="text-right text-sm text-slate-300">{user.chartSlots}</p>
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
                ? 'Откройте пользователя слева, чтобы посмотреть слоты, основную карту и дату создания профиля.'
                : 'Choose a user on the left to inspect slots, primary chart, and profile dates.'}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="admin-label">{getAdminText(lang, 'detail_title')}</p>
                <h3 className="admin-heading mt-2 text-2xl text-white">{selectedUser.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{selectedUser.id}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label={getAdminText(lang, 'saved_charts')} value={String(selectedUser.savedChartsCount)} />
                <Metric label={getAdminText(lang, 'total_slots')} value={String(selectedUser.chartSlots)} />
                <Metric label={getAdminText(lang, 'created_at')} value={formatDate(lang, selectedUser.createdAt)} />
                <Metric label={getAdminText(lang, 'last_seen')} value={formatDate(lang, selectedUser.lastSeenAt || selectedUser.lastLogin)} />
              </div>

              <div className="admin-surface-muted p-4">
                <p className="admin-label">{getAdminText(lang, 'primary_chart')}</p>
                {selectedUser.primaryChart ? (
                  <div className="mt-3 space-y-1 text-sm leading-6 text-slate-300">
                    <p className="font-semibold text-white">{selectedUser.primaryChart.name}</p>
                    <p>{selectedUser.primaryChart.birthDate} · {selectedUser.primaryChart.birthTime || '—'}</p>
                    <p>{selectedUser.primaryChart.birthPlace}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">{getAdminText(lang, 'no_primary_chart')}</p>
                )}
              </div>

              {selectedUser.recentSessions.length > 0 ? (
                <div className="space-y-3">
                  <p className="admin-label">{getAdminText(lang, 'sessions')}</p>
                  {selectedUser.recentSessions.map((session) => (
                    <div key={`${session.sessionId}-${session.lastSeenAt}`} className="admin-surface-muted p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{session.deviceLabel || getAdminText(lang, 'unknown_device')}</p>
                          <p className="mt-1 text-xs text-slate-500">{session.telegramPlatform || getAdminText(lang, 'platform_missing')}</p>
                        </div>
                        <p className="text-xs text-slate-400">{formatDate(lang, session.lastSeenAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
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
