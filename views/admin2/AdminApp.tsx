import React, { useEffect, useMemo, useState } from 'react';
import {
  admin2,
  type AdminMe,
  type AdminDashboard,
  type AdminUsersPage,
  type AdminUserRow,
  type AdminUserDetailV2,
  type AdminEntry,
  type AdminAuditRow,
  type AdminRole,
  type AdminChartRow,
  type AdminChartDetail,
  type AdminChartTestResult,
  type AdminPaymentRow,
  type AdminSubscriptionRow,
  type AdminRevenue,
  type AdminPromo,
} from '../../services/admin2Service';

/**
 * Admin v2 — новый каркас админ-панели (Фаза 1: Dashboard, Пользователи, Роли, Audit).
 * Меню и действия гейтятся по правам, которые сервер отдаёт в /api/admin/v2/me.
 * Сервер — единственный источник правды по доступу; клиент лишь прячет недоступное.
 */

type SectionId = 'dashboard' | 'users' | 'charts' | 'billing' | 'roles' | 'audit';

const SECTIONS: Array<{ id: SectionId; label: string; perm: string }> = [
  { id: 'dashboard', label: 'Дашборд', perm: 'analytics.view' },
  { id: 'users', label: 'Пользователи', perm: 'users.view' },
  { id: 'charts', label: 'Натальные профили', perm: 'charts.view' },
  { id: 'billing', label: 'Монетизация', perm: 'billing.view' },
  { id: 'roles', label: 'Роли и доступы', perm: 'roles.manage' },
  { id: 'audit', label: 'Журнал действий', perm: 'audit.view' },
];

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super Admin', admin: 'Admin', content_manager: 'Контент', support: 'Поддержка',
  analyst: 'Аналитик', finance: 'Финансы', marketing: 'Маркетинг', read_only: 'Только чтение',
};

const card = 'rounded-2xl border border-white/10 bg-white/[0.04] p-4';
const btn = 'rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50';
const btnPrimary = `${btn} bg-cyan-500 text-slate-950 hover:bg-cyan-400`;
const btnGhost = `${btn} border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]`;
const inputCls = 'rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/60';

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); } catch { return s; }
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className={card}>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{children}</div>;
}

// ────────────────────────────── Dashboard ──────────────────────────────
function DashboardSection() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { admin2.dashboard().then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <p className="text-sm text-slate-400">Загрузка…</p>;
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Всего юзеров" value={k.totalUsers} sub={`+${k.newUsers1d} за день`} />
        <Stat label="Премиум" value={k.activePremiumUsers} sub={`${k.premiumRate}% от всех`} />
        <Stat label="DAU / WAU / MAU" value={`${k.dau}/${k.wau}/${k.mau}`} />
        <Stat label="Натальных карт" value={k.totalCharts} />
        <Stat label="Новые 7д / 30д" value={`${k.newUsers7d}/${k.newUsers30d}`} />
        <Stat label="Звёзды всего" value={k.totalStars} sub={`${k.stars30d} за 30д`} />
        <Stat label="Платежей" value={k.totalPayments} />
        <Stat label="Без даты рожд." value={k.usersWithoutBirthData} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={card}>
          <p className="mb-3 text-sm font-semibold text-white">Воронка</p>
          <div className="space-y-2">
            {data.funnel.map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>{s.label}</span>
                  <span className="text-slate-400">{s.users} · {s.pctOfStart}%{s.key !== 'signup' ? ` · ${s.pctOfPrev}% от пред.` : ''}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(2, s.pctOfStart)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className={card}>
            <p className="mb-3 text-sm font-semibold text-white">Retention (когорты 90д)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {([['D1', data.retention.d1], ['D7', data.retention.d7], ['D30', data.retention.d30]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/[0.04] py-3">
                  <p className="text-[11px] text-slate-400">{k}</p>
                  <p className="text-xl font-bold text-white">{v == null ? '—' : `${v}%`}</p>
                </div>
              ))}
            </div>
          </div>
          <div className={card}>
            <p className="mb-2 text-sm font-semibold text-white">События за 30 дней</p>
            <div className="space-y-1">
              {data.events.length === 0 ? <p className="text-xs text-slate-500">Пока нет данных</p> : null}
              {data.events.slice(0, 8).map((e) => (
                <div key={e.type} className="flex items-center justify-between text-xs text-slate-300">
                  <span className="truncate">{e.label}</span>
                  <span className="text-slate-400">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── Users ──────────────────────────────
function UserDetailPanel({ id, canPii, onClose, onChanged }: { id: string; canPii: boolean; onClose: () => void; onChanged: () => void }) {
  const [user, setUser] = useState<AdminUserDetailV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (pii = false) => admin2.getUser(id, pii).then(setUser).catch((e) => setError(e.message));
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [id]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(user?.pii.revealed ?? false); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (error && !user) return <div className={card}><ErrorNote>{error}</ErrorNote></div>;
  if (!user) return <div className={card}><p className="text-sm text-slate-400">Загрузка…</p></div>;

  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold text-white">{user.name}</p>
          <p className="text-xs text-slate-400">ID {user.id}</p>
        </div>
        <button className={btnGhost} onClick={onClose}>Закрыть</button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div>Премиум: <b className="text-white">{user.isPremium ? 'да' : 'нет'}</b> {user.premiumUntil ? `до ${fmtDate(user.premiumUntil)}` : ''}</div>
        <div>Статус: <b className="text-white">{user.isBlocked ? 'заблокирован' : 'активен'}</b></div>
        <div>Карт: <b className="text-white">{user.savedCharts}</b> / слотов {user.chartSlots}</div>
        <div>Был онлайн: <b className="text-white">{fmtDate(user.lastSeenAt)}</b></div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Данные рождения (PII)</p>
          {canPii && !user.pii.revealed ? (
            <button className={btnGhost} disabled={busy} onClick={() => load(true)}>Показать</button>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div>Дата: <b className="text-white">{user.pii.birthDate || '—'}</b></div>
          <div>Время: <b className="text-white">{user.pii.birthTime || '—'}</b></div>
          <div>Место: <b className="text-white">{user.pii.birthPlace || '—'}</b></div>
        </div>
        {!canPii ? <p className="mt-1 text-[11px] text-slate-500">Нет права на просмотр персональных данных.</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={btnGhost} disabled={busy} onClick={() => act(() => admin2.patchUser(id, { isBlocked: !user.isBlocked }))}>
          {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
        </button>
        <button className={btnPrimary} disabled={busy} onClick={() => act(() => admin2.setPremium(id, 'grant', 30))}>+30 дней Premium</button>
        <button className={btnGhost} disabled={busy} onClick={() => act(() => admin2.setPremium(id, 'revoke'))}>Снять Premium</button>
      </div>
    </div>
  );
}

function UsersSection({ me }: { me: AdminMe }) {
  const [page, setPage] = useState<AdminUsersPage | null>(null);
  const [q, setQ] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canPii = me.permissions.includes('user.pii.view');

  const load = () => admin2.listUsers({ q, page: pageNum, pageSize: 25 }).then(setPage).catch((e) => setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [pageNum]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className={`${inputCls} flex-1`} placeholder="Поиск по имени или ID…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPageNum(1); load(); } }} />
        <button className={btnPrimary} onClick={() => { setPageNum(1); load(); }}>Найти</button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {selected ? (
        <UserDetailPanel id={selected} canPii={canPii} onClose={() => setSelected(null)} onChanged={load} />
      ) : null}
      {page ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-3 py-2">Имя</th><th className="px-3 py-2">Премиум</th><th className="px-3 py-2">Карты</th><th className="px-3 py-2">Онлайн</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {page.users.map((u: AdminUserRow) => (
                  <tr key={u.id} className="border-t border-white/[0.06] text-slate-200">
                    <td className="px-3 py-2"><div className="font-medium text-white">{u.name}</div><div className="text-[11px] text-slate-500">{u.id}</div></td>
                    <td className="px-3 py-2">{u.isPremium ? <span className="text-cyan-400">Premium</span> : '—'}</td>
                    <td className="px-3 py-2">{u.savedCharts}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(u.lastSeenAt)}</td>
                    <td className="px-3 py-2"><button className={btnGhost} onClick={() => setSelected(u.id)}>Открыть</button></td>
                  </tr>
                ))}
                {page.users.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Ничего не найдено</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Всего: {page.pagination.total}</span>
            <div className="flex gap-2">
              <button className={btnGhost} disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>Назад</button>
              <span className="px-2 py-2">{page.pagination.page} / {page.pagination.totalPages}</span>
              <button className={btnGhost} disabled={pageNum >= page.pagination.totalPages} onClick={() => setPageNum((p) => p + 1)}>Вперёд</button>
            </div>
          </div>
        </>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>}
    </div>
  );
}

// ────────────────────────────── Roles ──────────────────────────────
function RolesSection() {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [busy, setBusy] = useState(false);

  const load = () => admin2.listAdmins().then((d) => { setAdmins(d.admins); setRoles(d.roles); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className={`${card} space-y-2`}>
        <p className="text-sm font-semibold text-white">Добавить / изменить админа</p>
        <div className="flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1`} placeholder="Telegram user ID" value={newId} onChange={(e) => setNewId(e.target.value)} />
          <select className={inputCls} value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button className={btnPrimary} disabled={busy || !newId.trim()} onClick={() => act(() => admin2.setRole(newId.trim(), newRole))}>Сохранить</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
            <tr><th className="px-3 py-2">Админ</th><th className="px-3 py-2">Роль</th><th className="px-3 py-2">Статус</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.userId} className="border-t border-white/[0.06] text-slate-200">
                <td className="px-3 py-2"><div className="font-medium text-white">{a.name || a.userId}</div><div className="text-[11px] text-slate-500">{a.userId}</div></td>
                <td className="px-3 py-2">{ROLE_LABEL[a.role]}{a.isOwner ? ' · owner' : ''}</td>
                <td className="px-3 py-2 text-xs">{a.status}</td>
                <td className="px-3 py-2">{a.isOwner ? <span className="text-[11px] text-slate-500">защищён</span> : <button className={btnGhost} disabled={busy} onClick={() => act(() => admin2.removeAdmin(a.userId))}>Снять</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────── Audit ──────────────────────────────
function AuditSection() {
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { admin2.audit({ page: 1 }).then((d) => setRows(d.entries)).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
          <tr><th className="px-3 py-2">Когда</th><th className="px-3 py-2">Кто</th><th className="px-3 py-2">Действие</th><th className="px-3 py-2">Объект</th><th className="px-3 py-2">Итог</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/[0.06] text-slate-200">
              <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(r.createdAt)}</td>
              <td className="px-3 py-2 text-xs">{r.actorUserId || '—'}<div className="text-[11px] text-slate-500">{r.actorRole}</div></td>
              <td className="px-3 py-2"><span className="text-white">{r.action}</span></td>
              <td className="px-3 py-2 text-xs text-slate-400">{r.entityType ? `${r.entityType} ${r.entityId ?? ''}` : '—'}</td>
              <td className="px-3 py-2 text-xs">{r.result === 'ok' ? <span className="text-emerald-400">ok</span> : <span className="text-red-400">{r.result}</span>}</td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Журнал пуст</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────── Charts (natal profiles) ──────────────────────────────
function TestModePanel() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Тест');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<AdminChartTestResult | null>(null);

  const run = async () => {
    setBusy(true); setOut(null);
    try { setOut(await admin2.testChart({ name, birthDate: date, birthTime: time, birthPlace: place })); }
    catch (e: any) { setOut({ ok: false, error: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className={card}>
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="text-sm font-semibold text-white">Тест-режим расчёта</span>
        <span className="text-xs text-slate-400">{open ? 'скрыть' : 'открыть'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input className={inputCls} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <input className={inputCls} placeholder="Город" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <button className={btnPrimary} disabled={busy || !date || !place} onClick={run}>{busy ? 'Считаю…' : 'Проверить расчёт'}</button>
          {out ? (
            out.ok ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                <p>OK · {out.durationMs}ms · {out.coordinates?.timezone} ({out.coordinates?.lat}, {out.coordinates?.lon})</p>
                <p className="mt-1 text-white">☉ {out.result?.sun?.sign} · ☽ {out.result?.moon?.sign} · ASC {out.result?.ascendant?.sign} · {out.result?.element} · домов {out.result?.houses} · аспектов {out.result?.aspects}</p>
              </div>
            ) : <ErrorNote>{out.error}{out.code ? ` [${out.code}]` : ''}</ErrorNote>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChartDetailPanel({ id, canPii, canRecalc, onClose }: { id: number; canPii: boolean; canRecalc: boolean; onClose: () => void }) {
  const [chart, setChart] = useState<AdminChartDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const load = (pii = false) => admin2.getChart(id, pii).then(setChart).catch((e) => setError(e.message));
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [id]);

  if (error && !chart) return <div className={card}><ErrorNote>{error}</ErrorNote></div>;
  if (!chart) return <div className={card}><p className="text-sm text-slate-400">Загрузка…</p></div>;

  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold text-white">{chart.name}</p>
          <p className="text-xs text-slate-400">карта #{chart.id} · юзер {chart.userId} · {chart.version || '—'}</p>
        </div>
        <button className={btnGhost} onClick={onClose}>Закрыть</button>
      </div>
      {note ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{note}</div> : null}
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
        <div>☉ Солнце: <b className="text-white">{chart.result.sun?.sign || '—'}</b></div>
        <div>☽ Луна: <b className="text-white">{chart.result.moon?.sign || '—'}</b></div>
        <div>ASC: <b className="text-white">{chart.result.ascendant?.sign || '—'}</b></div>
        <div>Стихия: <b className="text-white">{chart.result.element || '—'}</b></div>
        <div>Домов: <b className="text-white">{chart.result.housesCount}</b></div>
        <div>Аспектов: <b className="text-white">{chart.result.aspectsCount}</b></div>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Вход расчёта (PII)</p>
          {canPii && chart.input.birthDate === '•••' ? <button className={btnGhost} disabled={busy} onClick={() => load(true)}>Показать</button> : null}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div>Дата: <b className="text-white">{chart.input.birthDate || '—'}</b></div>
          <div>Время: <b className="text-white">{chart.input.birthTime || '—'}</b></div>
          <div>Место: <b className="text-white">{chart.input.birthPlace || '—'}</b></div>
          <div>Коорд.: <b className="text-white">{chart.input.latitude ?? '—'}, {chart.input.longitude ?? '—'}</b></div>
          <div>TZ: <b className="text-white">{chart.input.timezone || '—'}</b></div>
        </div>
      </div>
      {canRecalc ? (
        <button className={btnPrimary} disabled={busy} onClick={async () => {
          setBusy(true); setError(null); setNote(null);
          try { const r = await admin2.recalcChart(id); setNote(`Пересчитано (${r.source}): ☉ ${r.result?.sunSign} · ☽ ${r.result?.moonSign} · ASC ${r.result?.ascendantSign}`); await load(chart.input.birthDate !== '•••'); }
          catch (e: any) { setError(e.message); } finally { setBusy(false); }
        }}>{busy ? 'Пересчёт…' : 'Пересчитать карту'}</button>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

function ChartsSection({ me }: { me: AdminMe }) {
  const [rows, setRows] = useState<AdminChartRow[] | null>(null);
  const [q, setQ] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canPii = me.permissions.includes('user.pii.view');
  const canRecalc = me.permissions.includes('charts.recalc');

  const load = () => admin2.listCharts({ q, page: pageNum }).then((d) => { setRows(d.charts); setPages(d.pagination.totalPages); setTotal(d.pagination.total); }).catch((e) => setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [pageNum]);

  return (
    <div className="space-y-3">
      <TestModePanel />
      <div className="flex gap-2">
        <input className={`${inputCls} flex-1`} placeholder="Поиск по имени карты / владельцу / ID…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPageNum(1); load(); } }} />
        <button className={btnPrimary} onClick={() => { setPageNum(1); load(); }}>Найти</button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {selected != null ? <ChartDetailPanel id={selected} canPii={canPii} canRecalc={canRecalc} onClose={() => setSelected(null)} /> : null}
      {rows ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-3 py-2">Профиль</th><th className="px-3 py-2">☉/☽/ASC</th><th className="px-3 py-2">Статус</th><th className="px-3 py-2">Создан</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-white/[0.06] text-slate-200">
                    <td className="px-3 py-2"><div className="font-medium text-white">{c.name}</div><div className="text-[11px] text-slate-500">{c.ownerName || c.userId}{c.isPrimary ? ' · основная' : ''}</div></td>
                    <td className="px-3 py-2 text-xs">{c.sunSign || '—'} / {c.moonSign || '—'} / {c.ascendantSign || '—'}</td>
                    <td className="px-3 py-2 text-xs">{c.status === 'ok' ? <span className="text-emerald-400">ok</span> : <span className="text-red-400">error</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(c.createdAt)}</td>
                    <td className="px-3 py-2"><button className={btnGhost} onClick={() => setSelected(c.id)}>Открыть</button></td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Карты не найдены</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Всего: {total}</span>
            <div className="flex gap-2">
              <button className={btnGhost} disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>Назад</button>
              <span className="px-2 py-2">{pageNum} / {pages}</span>
              <button className={btnGhost} disabled={pageNum >= pages} onClick={() => setPageNum((p) => p + 1)}>Вперёд</button>
            </div>
          </div>
        </>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>}
    </div>
  );
}

// ────────────────────────────── Billing (monetization) ──────────────────────────────
function BillingSection({ me }: { me: AdminMe }) {
  type Tab = 'revenue' | 'payments' | 'subs' | 'promo';
  const [tab, setTab] = useState<Tab>('revenue');
  const canRefund = me.permissions.includes('billing.refund');
  const canPromo = me.permissions.includes('promo.manage');

  const [rev, setRev] = useState<AdminRevenue | null>(null);
  const [pays, setPays] = useState<AdminPaymentRow[] | null>(null);
  const [subs, setSubs] = useState<AdminSubscriptionRow[] | null>(null);
  const [promos, setPromos] = useState<AdminPromo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pCode, setPCode] = useState(''); const [pVal, setPVal] = useState(30);

  useEffect(() => {
    setError(null);
    if (tab === 'revenue') admin2.revenue().then(setRev).catch((e) => setError(e.message));
    if (tab === 'payments') admin2.payments(1).then((d) => setPays(d.payments)).catch((e) => setError(e.message));
    if (tab === 'subs') admin2.subscriptions(1).then((d) => setSubs(d.subscriptions)).catch((e) => setError(e.message));
    if (tab === 'promo' && canPromo) admin2.listPromos().then((d) => setPromos(d.promos)).catch((e) => setError(e.message));
  }, [tab, canPromo]);

  const refund = async (id: number) => {
    if (!window.confirm('Точно вернуть платёж? Это необратимо.')) return;
    setBusy(true); setError(null);
    try { await admin2.refund(id); const d = await admin2.payments(1); setPays(d.payments); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const tabs: Array<[Tab, string, boolean]> = [
    ['revenue', 'Доход', true], ['payments', 'Платежи', true], ['subs', 'Подписки', true], ['promo', 'Промокоды', canPromo],
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.filter((t) => t[2]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${tab === id ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{label}</button>
        ))}
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {tab === 'revenue' && (rev ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Звёзды всего" value={rev.totalStars} sub={`${rev.totalPayments} платежей`} />
          <Stat label="За 30 дней" value={rev.stars30d} sub={`${rev.payments30d} платежей`} />
          <Stat label="Активный премиум" value={rev.activePremium} />
          <Stat label="Триалы" value={rev.trials} />
          <Stat label="Возвраты" value={rev.refunds} sub={`${rev.refundedStars}⭐`} />
        </div>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>)}

      {tab === 'payments' && (pays ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
              <tr><th className="px-3 py-2">Юзер</th><th className="px-3 py-2">Сумма</th><th className="px-3 py-2">Провайдер</th><th className="px-3 py-2">Статус</th><th className="px-3 py-2">Когда</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {pays.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.06] text-slate-200">
                  <td className="px-3 py-2"><div className="text-white">{p.ownerName || p.userId}</div><div className="text-[11px] text-slate-500">{p.userId}</div></td>
                  <td className="px-3 py-2">{p.amount} {p.currency}</td>
                  <td className="px-3 py-2 text-xs">{p.provider} · {p.platform}</td>
                  <td className="px-3 py-2 text-xs">{p.status === 'refunded' ? <span className="text-amber-400">возврат</span> : <span className="text-emerald-400">{p.status}</span>}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(p.createdAt)}</td>
                  <td className="px-3 py-2">{canRefund && p.status !== 'refunded' ? <button className={btnGhost} disabled={busy} onClick={() => refund(p.id)}>Вернуть</button> : null}</td>
                </tr>
              ))}
              {pays.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Платежей нет</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>)}

      {tab === 'subs' && (subs ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
              <tr><th className="px-3 py-2">Юзер</th><th className="px-3 py-2">Статус</th><th className="px-3 py-2">Платформа</th><th className="px-3 py-2">До</th></tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.userId} className="border-t border-white/[0.06] text-slate-200">
                  <td className="px-3 py-2"><div className="text-white">{s.name || s.userId}</div><div className="text-[11px] text-slate-500">{s.userId}</div></td>
                  <td className="px-3 py-2 text-xs">{s.status === 'active' ? <span className="text-cyan-400">активна</span> : s.status === 'trial' ? <span className="text-amber-400">триал</span> : <span className="text-slate-500">истекла</span>}</td>
                  <td className="px-3 py-2 text-xs">{s.provider} · {s.platform}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(s.premiumUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>)}

      {tab === 'promo' && canPromo && (
        <div className="space-y-3">
          <div className={`${card} flex flex-wrap items-end gap-2`}>
            <input className={`${inputCls} flex-1`} placeholder="КОД (A-Z 0-9)" value={pCode} onChange={(e) => setPCode(e.target.value.toUpperCase())} />
            <div><label className="block text-[11px] text-slate-400">дней премиум</label><input className={`${inputCls} w-24`} type="number" value={pVal} onChange={(e) => setPVal(Number(e.target.value))} /></div>
            <button className={btnPrimary} disabled={busy || pCode.trim().length < 3} onClick={async () => {
              setBusy(true); setError(null);
              try { await admin2.createPromo({ code: pCode.trim(), value: pVal }); setPCode(''); const d = await admin2.listPromos(); setPromos(d.promos); }
              catch (e: any) { setError(e.message); } finally { setBusy(false); }
            }}>Создать</button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-3 py-2">Код</th><th className="px-3 py-2">Награда</th><th className="px-3 py-2">Исп.</th><th className="px-3 py-2">Статус</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {(promos || []).map((p) => (
                  <tr key={p.code} className="border-t border-white/[0.06] text-slate-200">
                    <td className="px-3 py-2 font-medium text-white">{p.code}</td>
                    <td className="px-3 py-2 text-xs">{p.value} дн. премиум</td>
                    <td className="px-3 py-2 text-xs">{p.usedCount}{p.maxUses ? `/${p.maxUses}` : ''}</td>
                    <td className="px-3 py-2 text-xs">{p.status === 'active' ? <span className="text-emerald-400">активен</span> : <span className="text-slate-500">{p.status}</span>}</td>
                    <td className="px-3 py-2">{p.status === 'active' ? <button className={btnGhost} disabled={busy} onClick={async () => { setBusy(true); try { await admin2.disablePromo(p.code); const d = await admin2.listPromos(); setPromos(d.promos); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>Отключить</button> : null}</td>
                  </tr>
                ))}
                {promos && promos.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Промокодов нет</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── Shell ──────────────────────────────
export const AdminApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<SectionId>('dashboard');

  useEffect(() => { admin2.me().then(setMe).catch((e) => setError(e.message)); }, []);

  const visible = useMemo(
    () => (me ? SECTIONS.filter((s) => me.permissions.includes(s.perm)) : []),
    [me]
  );
  useEffect(() => {
    if (visible.length && !visible.some((s) => s.id === active)) setActive(visible[0].id);
  }, [visible, active]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Lumia Admin</p>
          <h1 className="text-lg font-bold text-white">{visible.find((s) => s.id === active)?.label || 'Админка'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {me ? <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-300">{ROLE_LABEL[me.role]}</span> : null}
          <button className={btnPrimary} onClick={onClose}>В приложение</button>
        </div>
      </header>

      {error ? <div className="p-4"><ErrorNote>{error}</ErrorNote></div> : null}

      {me ? (
        <>
          <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2">
            {visible.map((s) => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${active === s.id ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>
                {s.label}
              </button>
            ))}
          </nav>
          <main className="min-h-0 flex-1 overflow-y-auto p-4">
            {active === 'dashboard' && <DashboardSection />}
            {active === 'users' && <UsersSection me={me} />}
            {active === 'charts' && <ChartsSection me={me} />}
            {active === 'billing' && <BillingSection me={me} />}
            {active === 'roles' && <RolesSection />}
            {active === 'audit' && <AuditSection />}
          </main>
        </>
      ) : (!error ? <p className="p-4 text-sm text-slate-400">Загрузка…</p> : null)}
    </div>
  );
};

export default AdminApp;
