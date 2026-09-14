import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  admin2,
  type AdminMe,
  type AdminUsersPage,
  type AdminUserRow,
  type AdminUserDetailV2,
} from '../../../services/admin2Service';
import { AdminUserActivity } from '../../admin2/AdminActivity';
import { KpiCard } from '../common/KpiCard';
import { StatusBadge } from '../common/StatusBadge';
import {
  Calendar, Check, Clock, Eye, Lock, RefreshCw, Search, Shield,
  Smartphone, Trash2, Unlock, UserCheck, Users, X,
} from 'lucide-react';

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return s;
  }
}

export function UserDetailDrawer({
  id,
  me,
  onClose,
  onChanged,
}: {
  id: string;
  me: AdminMe;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [user, setUser] = useState<AdminUserDetailV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [slotsDraft, setSlotsDraft] = useState(1);
  const [premiumDays, setPremiumDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'info' | 'activity'>('info');

  const canPii = me.permissions.includes('user.pii.view');
  const canEdit = me.permissions.includes('users.edit');
  const canBlock = me.permissions.includes('users.block');
  const canViewActivity = me.permissions.includes('analytics.view');

  const load = (pii = false) => {
    setError(null);
    return admin2.getUser(id, pii)
      .then((u) => {
        setUser(u);
        setNameDraft(u.name || '');
        setSlotsDraft(u.chartSlots || 1);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load(false);
  }, [id]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load(user?.pii.revealed ?? false);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform border-l border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#312D4B] truncate">{user?.name || 'Пользователь'}</h2>
            {user?.isPremium ? <StatusBadge status="active" /> : null}
            {user?.isBlocked ? <StatusBadge status="blocked" /> : null}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">ID: {id}</p>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onClick={onClose}
          aria-label="Закрыть карточку"
        >
          <X size={20} />
        </button>
      </div>

      {error ? (
        <div className="m-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-6">
        <button
          type="button"
          className={`py-3 text-sm font-semibold border-b-2 mr-6 ${
            activeTab === 'info' ? 'border-[#8C57FF] text-[#8C57FF]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setActiveTab('info')}
        >
          Основная информация и управление
        </button>
        <button
          type="button"
          className={`py-3 text-sm font-semibold border-b-2 ${
            activeTab === 'activity' ? 'border-[#8C57FF] text-[#8C57FF]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setActiveTab('activity')}
        >
          Таймлайн активности
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {!user ? (
          <p className="text-sm text-slate-400">Загрузка данных пользователя…</p>
        ) : activeTab === 'info' ? (
          <>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-400">Тариф</p>
                <p className="mt-1 font-bold text-[#312D4B]">
                  {user.isPremium ? 'Premium' : 'Бесплатный'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {user.premiumUntil ? `до ${fmtDate(user.premiumUntil)}` : 'нет подписки'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-400">Натальные карты</p>
                <p className="mt-1 font-bold text-[#312D4B]">
                  {user.savedCharts} / {user.chartSlots} слотов
                </p>
                <p className="text-[11px] text-slate-500">сохранено карт</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-400">Стрик входов</p>
                <p className="mt-1 font-bold text-[#312D4B]">{user.loginStreak ?? 0} дн.</p>
                <p className="text-[11px] text-slate-500">дней подряд</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-400">Регистрация</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{fmtDate(user.createdAt)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-400">Последний онлайн</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{fmtDate(user.lastSeenAt)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-400">Устройство</p>
                <p className="mt-1 text-xs font-semibold text-slate-700 truncate">{user.currentDevice || '—'}</p>
              </div>
            </div>

            {/* PII Card */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Данные рождения (PII)</p>
                  <p className="text-[11px] text-slate-500">Просмотр доступен только с правом user.pii.view и пишется в аудит.</p>
                </div>
                {canPii && !user.pii.revealed ? (
                  <button
                    type="button"
                    className="admin2-button admin2-button--secondary flex items-center gap-1.5 text-xs"
                    disabled={busy}
                    onClick={() => load(true)}
                  >
                    <Eye size={14} /> Показать
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>Дата: <b className="text-slate-800">{user.pii.birthDate || '—'}</b></div>
                <div>Время: <b className="text-slate-800">{user.pii.birthTime || '—'}</b></div>
                <div>Город: <b className="text-slate-800">{user.pii.birthPlace || '—'}</b></div>
              </div>
            </div>

            {/* Actions: Edit profile & slots */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Управление профилем</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                <input
                  className="admin2-input"
                  disabled={!canEdit}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Имя пользователя"
                />
                <input
                  className="admin2-input"
                  disabled={!canEdit}
                  type="number"
                  min={1}
                  max={50}
                  value={slotsDraft}
                  onChange={(e) => setSlotsDraft(Number(e.target.value))}
                  placeholder="Слоты карт"
                />
                <button
                  type="button"
                  className="admin2-button admin2-button--secondary text-xs"
                  disabled={!canEdit || busy}
                  onClick={() =>
                    act(() =>
                      admin2.patchUser(id, {
                        name: nameDraft.trim(),
                        chartSlots: Math.max(1, Math.min(50, Math.round(slotsDraft || 1))),
                      })
                    )
                  }
                >
                  Сохранить
                </button>
              </div>

              {/* Premium grant/revoke & block */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <input
                  className="admin2-input w-24 text-xs"
                  disabled={!canEdit}
                  type="number"
                  min={1}
                  max={3650}
                  value={premiumDays}
                  onChange={(e) => setPremiumDays(Number(e.target.value))}
                />
                <button
                  type="button"
                  className="admin2-button admin2-button--primary text-xs"
                  disabled={!canEdit || busy}
                  onClick={() => act(() => admin2.setPremium(id, 'grant', Math.max(1, Math.min(3650, Math.round(premiumDays || 30)))))}
                >
                  + Выдать Premium
                </button>
                <button
                  type="button"
                  className="admin2-button admin2-button--secondary text-xs"
                  disabled={!canEdit || busy}
                  onClick={() => act(() => admin2.setPremium(id, 'revoke'))}
                >
                  Снять Premium
                </button>
                <button
                  type="button"
                  className={`admin2-button text-xs ml-auto ${
                    user.isBlocked ? 'admin2-button--secondary text-emerald-600' : 'admin2-button--secondary text-rose-600'
                  }`}
                  disabled={!canBlock || busy}
                  onClick={() => act(() => admin2.patchUser(id, { isBlocked: !user.isBlocked }))}
                >
                  {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                </button>
              </div>
            </div>

            {/* Sessions History */}
            {user.recentSessions?.length ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Последние сессии</p>
                <div className="space-y-1.5">
                  {user.recentSessions.slice(0, 5).map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50 last:border-0">
                      <span className="text-slate-700 font-medium">{s.device_label || s.telegram_platform || 'Устройство'}</span>
                      <span className="text-slate-400">{fmtDate(s.last_seen_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          /* Activity Timeline Tab */
          <div>
            {canViewActivity ? (
              <AdminUserActivity userId={id} />
            ) : (
              <p className="text-sm text-slate-400">Просмотр активности доступен ролям с правом analytics.view.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function UsersSection({ me, initialUserId }: { me: AdminMe; initialUserId?: string }) {
  const [page, setPage] = useState<AdminUsersPage | null>(null);
  const [q, setQ] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [premium, setPremium] = useState('all');
  const [segment, setSegment] = useState('all');
  const [sortBy, setSortBy] = useState('last_seen');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [pageNum, setPageNum] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(initialUserId || null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkDays, setBulkDays] = useState(7);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canPii = me.permissions.includes('user.pii.view');
  const canEdit = me.permissions.includes('users.edit');
  const canBlock = me.permissions.includes('users.block');

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    admin2.listUsers({
      q: appliedQuery,
      premium,
      segment,
      sortBy,
      sortOrder,
      page: pageNum,
      pageSize,
    })
      .then(setPage)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [appliedQuery, premium, segment, sortBy, sortOrder, pageNum, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const searchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQuery(q.trim());
    setPageNum(1);
  };

  const visibleIds = page?.users.map((u) => u.id) || [];
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => checkedIds.includes(id));
  const toggleAll = () => {
    setCheckedIds((ids) =>
      allChecked ? ids.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...ids, ...visibleIds]))
    );
  };
  const toggleOne = (id: string) => {
    setCheckedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  };

  const bulkAct = async (label: string, fn: (id: string) => Promise<any>) => {
    if (!checkedIds.length) return;
    setBulkBusy(true);
    setError(null);
    setNote(null);
    let done = 0;
    for (const id of checkedIds) {
      try {
        await fn(id);
        done++;
      } catch (e: any) {
        setError(`${label}: ошибка при обработке ${id}: ${e.message}`);
      }
    }
    await load();
    setCheckedIds([]);
    setBulkBusy(false);
    if (done > 0) setNote(`${label}: успешно для ${done} пользователей.`);
  };

  return (
    <div className="space-y-5">
      {/* KPI Overview */}
      {page ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard color="blue" label="Всего пользователей" value={page.overview.totalUsers.toLocaleString('ru-RU')} />
          <KpiCard color="violet" label="Premium подписок" value={page.overview.activePremiumUsers.toLocaleString('ru-RU')} />
          <KpiCard color="emerald" label="Активны 7д" value={page.overview.activeUsers7d.toLocaleString('ru-RU')} />
          <KpiCard color="amber" label="Требуют внимания" value={page.overview.needAttentionUsers.toLocaleString('ru-RU')} />
          <KpiCard color="rose" label="Без даты рождения" value={page.overview.usersWithoutBirthData.toLocaleString('ru-RU')} />
        </div>
      ) : null}

      {/* Search & Filters */}
      <form onSubmit={searchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="admin2-input w-full pl-10"
            placeholder="Поиск по internal ID, Telegram ID, имени или телефону…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="submit" className="admin2-button admin2-button--primary">
          Найти
        </button>
      </form>

      <div className="admin2-card p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
        <select
          className="admin2-input"
          value={premium}
          onChange={(e) => { setPremium(e.target.value); setPageNum(1); }}
        >
          <option value="all">Все тарифы</option>
          <option value="premium">Только Premium</option>
          <option value="free">Бесплатный</option>
        </select>

        <select
          className="admin2-input"
          value={segment}
          onChange={(e) => { setSegment(e.target.value); setPageNum(1); }}
        >
          <option value="all">Все сегменты</option>
          <option value="active_7d">Активные 7д</option>
          <option value="inactive_7d">Неактивные 7д</option>
          <option value="inactive_30d">Неактивные 30д</option>
          <option value="need_attention">Требуют внимания</option>
          <option value="new_user_no_birth_data">Без даты рождения</option>
          <option value="high_intent_premium">Интерес к Premium</option>
        </select>

        <select
          className="admin2-input"
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPageNum(1); }}
        >
          <option value="last_seen">Сорт: последний онлайн</option>
          <option value="created_at">Сорт: дата регистрации</option>
          <option value="premium_until">Сорт: Premium до</option>
          <option value="saved_charts_count">Сорт: количество карт</option>
          <option value="name">Сорт: по имени</option>
        </select>

        <select
          className="admin2-input"
          value={sortOrder}
          onChange={(e) => { setSortOrder(e.target.value); setPageNum(1); }}
        >
          <option value="desc">По убыванию</option>
          <option value="asc">По возрастанию</option>
        </select>

        <select
          className="admin2-input"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPageNum(1); }}
        >
          <option value={25}>25 на странице</option>
          <option value={50}>50 на странице</option>
          <option value={100}>100 на странице</option>
        </select>
      </div>

      {note ? <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">{note}</div> : null}
      {error ? <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error}</div> : null}

      {/* Bulk actions bar */}
      {checkedIds.length > 0 ? (
        <div className="admin2-card p-3 flex flex-wrap items-center gap-2 bg-[#8C57FF]/5 border border-[#8C57FF]/20">
          <span className="text-xs font-bold text-slate-800 mr-2">Выбрано: {checkedIds.length}</span>
          <input
            className="admin2-input w-20 text-xs"
            type="number"
            min={1}
            max={365}
            value={bulkDays}
            onChange={(e) => setBulkDays(Number(e.target.value))}
          />
          <button
            type="button"
            className="admin2-button admin2-button--primary text-xs"
            disabled={!canEdit || bulkBusy}
            onClick={() => bulkAct('Выдача Premium', (id) => admin2.setPremium(id, 'grant', bulkDays))}
          >
            + Выдать Premium
          </button>
          <button
            type="button"
            className="admin2-button admin2-button--secondary text-xs"
            disabled={!canEdit || bulkBusy}
            onClick={() => bulkAct('Снятие Premium', (id) => admin2.setPremium(id, 'revoke'))}
          >
            Снять Premium
          </button>
          <button
            type="button"
            className="admin2-button admin2-button--secondary text-xs text-rose-600"
            disabled={!canBlock || bulkBusy}
            onClick={() => bulkAct('Блокировка', (id) => admin2.patchUser(id, { isBlocked: true }))}
          >
            Заблокировать
          </button>
          <button
            type="button"
            className="admin2-button admin2-button--secondary text-xs"
            disabled={bulkBusy}
            onClick={() => setCheckedIds([])}
          >
            Сбросить выбор
          </button>
        </div>
      ) : null}

      {/* Users Table */}
      <div className="admin2-table-wrap">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="admin2-table-heading w-10">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Выбрать всех" />
              </th>
              <th className="admin2-table-heading">Пользователь</th>
              <th className="admin2-table-heading">Статус</th>
              <th className="admin2-table-heading">Тариф</th>
              <th className="admin2-table-heading">Карт</th>
              <th className="admin2-table-heading">Последний визит</th>
              <th className="admin2-table-heading text-right">Действие</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  Загрузка пользователей…
                </td>
              </tr>
            ) : page?.users.length ? (
              page.users.map((u) => (
                <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="admin2-table-cell">
                    <input type="checkbox" checked={checkedIds.includes(u.id)} onChange={() => toggleOne(u.id)} />
                  </td>
                  <td className="admin2-table-cell">
                    <div className="font-semibold text-slate-800">{u.name || 'Гость'}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.id}</div>
                  </td>
                  <td className="admin2-table-cell">
                    {u.isBlocked ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">blocked</span>
                    ) : u.isAdmin ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-600">admin</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">active</span>
                    )}
                  </td>
                  <td className="admin2-table-cell">
                    {u.isPremium ? (
                      <span className="rounded-full bg-[#8C57FF]/10 px-2 py-0.5 text-xs font-semibold text-[#8C57FF]">Premium</span>
                    ) : (
                      <span className="text-slate-400 text-xs">free</span>
                    )}
                  </td>
                  <td className="admin2-table-cell tabular-nums">{u.savedCharts}</td>
                  <td className="admin2-table-cell text-xs text-slate-400">{fmtDate(u.lastSeenAt)}</td>
                  <td className="admin2-table-cell text-right">
                    <button
                      type="button"
                      className="admin2-button admin2-button--secondary text-xs"
                      onClick={() => setSelectedId(u.id)}
                    >
                      Карточка
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  Пользователи не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {page ? (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Всего найдено: {page.pagination.total.toLocaleString('ru-RU')}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="admin2-button admin2-button--secondary text-xs"
              disabled={pageNum <= 1}
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            >
              Назад
            </button>
            <span>
              Страница {page.pagination.page} из {page.pagination.totalPages}
            </span>
            <button
              type="button"
              className="admin2-button admin2-button--secondary text-xs"
              disabled={pageNum >= page.pagination.totalPages}
              onClick={() => setPageNum((p) => p + 1)}
            >
              Вперёд
            </button>
          </div>
        </div>
      ) : null}

      {/* User Detail Drawer */}
      {selectedId ? (
        <UserDetailDrawer
          id={selectedId}
          me={me}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      ) : null}
    </div>
  );
}
