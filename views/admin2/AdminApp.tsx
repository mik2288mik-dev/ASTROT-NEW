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
 * Admin v2 — светлый дашборд в стиле Spike Admin: белый сайдбар с группами, белые
 * карточки с мягкими тенями и крупными скруглениями, воздушные отступы, синий акцент.
 * Меню и действия гейтятся по правам из /api/admin/v2/me (сервер — источник правды).
 */

type SectionId = 'dashboard' | 'users' | 'charts' | 'billing' | 'roles' | 'audit';

const NAV: Array<{ id: SectionId; label: string; perm: string; icon: string }> = [
  { id: 'dashboard', label: 'Дашборд', perm: 'analytics.view', icon: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7V11h-7v9Zm0-16v5h7V4h-7Z' },
  { id: 'users', label: 'Пользователи', perm: 'users.view', icon: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-8 1.3-8 4v2h9v-2c0-1 .4-1.9 1-2.6A14 14 0 0 0 8 14Zm8 0c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5Z' },
  { id: 'charts', label: 'Натальные профили', perm: 'charts.view', icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-13h-2v6l5 3 1-1.7-4-2.3Z' },
  { id: 'billing', label: 'Монетизация', perm: 'billing.view', icon: 'M3 6h18v12H3V6Zm2 2v2h14V8H5Zm0 4v4h8v-4H5Z' },
  { id: 'roles', label: 'Роли и доступы', perm: 'roles.manage', icon: 'M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4Zm0 10.9h7c-.5 4.1-3.3 7.8-7 8.9V12H5V6.3l7-3.1v8.7Z' },
  { id: 'audit', label: 'Журнал действий', perm: 'audit.view', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm2 16H8v-2h8v2Zm0-4H8v-2h8v2Zm-3-5V3.5L18.5 9H13Z' },
];

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super Admin', admin: 'Admin', content_manager: 'Контент', support: 'Поддержка',
  analyst: 'Аналитик', finance: 'Финансы', marketing: 'Маркетинг', read_only: 'Только чтение',
};

// ── Spike-style light tokens ──
const PAGE_BG = '#F4F5FA';
const card = 'rounded-3xl bg-white p-5 shadow-[0_4px_24px_rgba(20,30,60,0.05)]';
const btn = 'rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50';
const btnPrimary = `${btn} bg-[#8C57FF] text-white hover:bg-[#7E4EE6] shadow-[0_2px_8px_rgba(140,87,255,0.35)]`;
const btnGhost = `${btn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`;
const inputCls = 'rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#8C57FF] focus:bg-white focus:ring-4 focus:ring-[#8C57FF]/15';
const th = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const td = 'px-4 py-3 text-slate-600';
const tableWrap = 'overflow-x-auto rounded-3xl bg-white shadow-[0_4px_24px_rgba(20,30,60,0.05)]';
const trow = 'border-t border-slate-50 hover:bg-slate-50/60';

// Materio-палитра: primary #8C57FF, info #16B1FF, success #56CA00, warning #FFB400, error #FF4C51
const ICON_CHIP: Record<string, string> = {
  blue: 'bg-[#8C57FF]/12 text-[#8C57FF]',
  violet: 'bg-[#8C57FF]/12 text-[#8C57FF]',
  emerald: 'bg-[#56CA00]/12 text-[#56CA00]',
  amber: 'bg-[#FFB400]/15 text-[#E6A200]',
  rose: 'bg-[#FF4C51]/12 text-[#FF4C51]',
  sky: 'bg-[#16B1FF]/12 text-[#16B1FF]',
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); } catch { return s; }
}

function Kpi({ label, value, sub, color = 'blue' }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className={card}>
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${ICON_CHIP[color] || ICON_CHIP.blue}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
        </span>
        {sub ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{sub}</span> : null}
      </div>
      <p className="mt-4 text-[26px] font-bold leading-none text-[#312D4B]">{value}</p>
      <p className="mt-1.5 text-[13px] text-slate-400">{label}</p>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{children}</div>;
}

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return <div className={`${card} ${className}`}>{title ? <p className="mb-4 text-base font-bold text-slate-800">{title}</p> : null}{children}</div>;
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi color="blue" label="Всего пользователей" value={k.totalUsers} sub={`+${k.newUsers1d} день`} />
        <Kpi color="violet" label="Премиум" value={k.activePremiumUsers} sub={`${k.premiumRate}%`} />
        <Kpi color="sky" label="DAU / WAU / MAU" value={`${k.dau}/${k.wau}/${k.mau}`} />
        <Kpi color="emerald" label="Натальных карт" value={k.totalCharts} />
        <Kpi color="amber" label="Новые 7д / 30д" value={`${k.newUsers7d}/${k.newUsers30d}`} />
        <Kpi color="rose" label="Звёзды всего" value={k.totalStars} sub={`${k.stars30d}/30д`} />
        <Kpi color="blue" label="Платежей" value={k.totalPayments} />
        <Kpi color="amber" label="Без даты рожд." value={k.usersWithoutBirthData} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Воронка">
          <div className="space-y-3">
            {data.funnel.map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-slate-700">{s.label}</span>
                  <span className="text-slate-400">{s.users} · {s.pctOfStart}%{s.key !== 'signup' ? ` · ${s.pctOfPrev}% от пред.` : ''}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#8C57FF] to-[#A379FF]" style={{ width: `${Math.max(2, s.pctOfStart)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Retention (когорты 90 дней)">
            <div className="grid grid-cols-3 gap-3 text-center">
              {([['D1', data.retention.d1], ['D7', data.retention.d7], ['D30', data.retention.d30]] as const).map(([kk, v]) => (
                <div key={kk} className="rounded-2xl bg-slate-50 py-4">
                  <p className="text-[11px] font-medium text-slate-400">{kk}</p>
                  <p className="mt-1 text-2xl font-bold text-[#312D4B]">{v == null ? '—' : `${v}%`}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="События за 30 дней">
            <div className="space-y-2">
              {data.events.length === 0 ? <p className="text-xs text-slate-400">Пока нет данных</p> : null}
              {data.events.slice(0, 8).map((e) => (
                <div key={e.type} className="flex items-center justify-between text-[13px]">
                  <span className="truncate text-slate-600">{e.label}</span>
                  <span className="font-semibold text-slate-400">{e.count}</span>
                </div>
              ))}
            </div>
          </Card>
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
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  if (error && !user) return <Card><ErrorNote>{error}</ErrorNote></Card>;
  if (!user) return <Card><p className="text-sm text-slate-400">Загрузка…</p></Card>;
  return (
    <div className={`${card} space-y-4`}>
      <div className="flex items-start justify-between">
        <div><p className="text-lg font-bold text-[#312D4B]">{user.name}</p><p className="text-xs text-slate-400">ID {user.id}</p></div>
        <button className={btnGhost} onClick={onClose}>Закрыть</button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="grid grid-cols-2 gap-2 text-[13px] text-slate-500">
        <div>Премиум: <b className="text-slate-800">{user.isPremium ? 'да' : 'нет'}</b> {user.premiumUntil ? `до ${fmtDate(user.premiumUntil)}` : ''}</div>
        <div>Статус: <b className="text-slate-800">{user.isBlocked ? 'заблокирован' : 'активен'}</b></div>
        <div>Карт: <b className="text-slate-800">{user.savedCharts}</b> / слотов {user.chartSlots}</div>
        <div>Был онлайн: <b className="text-slate-800">{fmtDate(user.lastSeenAt)}</b></div>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Данные рождения (PII)</p>
          {canPii && !user.pii.revealed ? <button className={btnGhost} disabled={busy} onClick={() => load(true)}>Показать</button> : null}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[13px] text-slate-500">
          <div>Дата: <b className="text-slate-800">{user.pii.birthDate || '—'}</b></div>
          <div>Время: <b className="text-slate-800">{user.pii.birthTime || '—'}</b></div>
          <div>Место: <b className="text-slate-800">{user.pii.birthPlace || '—'}</b></div>
        </div>
        {!canPii ? <p className="mt-1 text-[11px] text-slate-400">Нет права на просмотр персональных данных.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btnGhost} disabled={busy} onClick={() => act(() => admin2.patchUser(id, { isBlocked: !user.isBlocked }))}>{user.isBlocked ? 'Разблокировать' : 'Заблокировать'}</button>
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
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={`${inputCls} flex-1`} placeholder="Поиск по имени или ID…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPageNum(1); load(); } }} />
        <button className={btnPrimary} onClick={() => { setPageNum(1); load(); }}>Найти</button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {selected ? <UserDetailPanel id={selected} canPii={canPii} onClose={() => setSelected(null)} onChanged={load} /> : null}
      {page ? (
        <>
          <div className={tableWrap}>
            <table className="w-full text-left text-sm">
              <thead><tr>{['Имя', 'Премиум', 'Карты', 'Онлайн', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {page.users.map((u: AdminUserRow) => (
                  <tr key={u.id} className={trow}>
                    <td className={td}><div className="font-semibold text-slate-800">{u.name}</div><div className="text-[11px] text-slate-400">{u.id}</div></td>
                    <td className={td}>{u.isPremium ? <span className="rounded-full bg-[#8C57FF]/10 px-2 py-0.5 text-xs font-semibold text-[#8C57FF]">Premium</span> : '—'}</td>
                    <td className={td}>{u.savedCharts}</td>
                    <td className={`${td} text-xs text-slate-400`}>{fmtDate(u.lastSeenAt)}</td>
                    <td className={td}><button className={btnGhost} onClick={() => setSelected(u.id)}>Открыть</button></td>
                  </tr>
                ))}
                {page.users.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Ничего не найдено</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Всего: {page.pagination.total}</span>
            <div className="flex items-center gap-2">
              <button className={btnGhost} disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>Назад</button>
              <span className="px-1">{page.pagination.page} / {page.pagination.totalPages}</span>
              <button className={btnGhost} disabled={pageNum >= page.pagination.totalPages} onClick={() => setPageNum((p) => p + 1)}>Вперёд</button>
            </div>
          </div>
        </>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>}
    </div>
  );
}

// ────────────────────────────── Charts ──────────────────────────────
function TestModePanel() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Тест'); const [date, setDate] = useState(''); const [time, setTime] = useState('12:00'); const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false); const [out, setOut] = useState<AdminChartTestResult | null>(null);
  const run = async () => { setBusy(true); setOut(null); try { setOut(await admin2.testChart({ name, birthDate: date, birthTime: time, birthPlace: place })); } catch (e: any) { setOut({ ok: false, error: e.message }); } finally { setBusy(false); } };
  return (
    <div className={card}>
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="text-base font-bold text-slate-800">Тест-режим расчёта</span>
        <span className="text-xs text-slate-400">{open ? 'скрыть' : 'открыть'}</span>
      </button>
      {open ? (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input className={inputCls} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <input className={inputCls} placeholder="Город" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <button className={btnPrimary} disabled={busy || !date || !place} onClick={run}>{busy ? 'Считаю…' : 'Проверить расчёт'}</button>
          {out ? (out.ok ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
              <p>OK · {out.durationMs}ms · {out.coordinates?.timezone} ({out.coordinates?.lat}, {out.coordinates?.lon})</p>
              <p className="mt-1 font-semibold">☉ {out.result?.sun?.sign} · ☽ {out.result?.moon?.sign} · ASC {out.result?.ascendant?.sign} · {out.result?.element} · домов {out.result?.houses} · аспектов {out.result?.aspects}</p>
            </div>
          ) : <ErrorNote>{out.error}{out.code ? ` [${out.code}]` : ''}</ErrorNote>) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChartDetailPanel({ id, canPii, canRecalc, onClose }: { id: number; canPii: boolean; canRecalc: boolean; onClose: () => void }) {
  const [chart, setChart] = useState<AdminChartDetail | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [note, setNote] = useState<string | null>(null);
  const load = (pii = false) => admin2.getChart(id, pii).then(setChart).catch((e) => setError(e.message));
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [id]);
  if (error && !chart) return <Card><ErrorNote>{error}</ErrorNote></Card>;
  if (!chart) return <Card><p className="text-sm text-slate-400">Загрузка…</p></Card>;
  return (
    <div className={`${card} space-y-4`}>
      <div className="flex items-start justify-between">
        <div><p className="text-lg font-bold text-[#312D4B]">{chart.name}</p><p className="text-xs text-slate-400">карта #{chart.id} · юзер {chart.userId} · {chart.version || '—'}</p></div>
        <button className={btnGhost} onClick={onClose}>Закрыть</button>
      </div>
      {note ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">{note}</div> : null}
      <div className="grid grid-cols-3 gap-2 text-[13px] text-slate-500">
        <div>☉ Солнце: <b className="text-slate-800">{chart.result.sun?.sign || '—'}</b></div>
        <div>☽ Луна: <b className="text-slate-800">{chart.result.moon?.sign || '—'}</b></div>
        <div>ASC: <b className="text-slate-800">{chart.result.ascendant?.sign || '—'}</b></div>
        <div>Стихия: <b className="text-slate-800">{chart.result.element || '—'}</b></div>
        <div>Домов: <b className="text-slate-800">{chart.result.housesCount}</b></div>
        <div>Аспектов: <b className="text-slate-800">{chart.result.aspectsCount}</b></div>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Вход расчёта (PII)</p>
          {canPii && chart.input.birthDate === '•••' ? <button className={btnGhost} disabled={busy} onClick={() => load(true)}>Показать</button> : null}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[13px] text-slate-500">
          <div>Дата: <b className="text-slate-800">{chart.input.birthDate || '—'}</b></div>
          <div>Время: <b className="text-slate-800">{chart.input.birthTime || '—'}</b></div>
          <div>Место: <b className="text-slate-800">{chart.input.birthPlace || '—'}</b></div>
          <div>Коорд.: <b className="text-slate-800">{chart.input.latitude ?? '—'}, {chart.input.longitude ?? '—'}</b></div>
          <div>TZ: <b className="text-slate-800">{chart.input.timezone || '—'}</b></div>
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
  const [q, setQ] = useState(''); const [pageNum, setPageNum] = useState(1); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number | null>(null); const [error, setError] = useState<string | null>(null);
  const canPii = me.permissions.includes('user.pii.view'); const canRecalc = me.permissions.includes('charts.recalc');
  const load = () => admin2.listCharts({ q, page: pageNum }).then((d) => { setRows(d.charts); setPages(d.pagination.totalPages); setTotal(d.pagination.total); }).catch((e) => setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [pageNum]);
  return (
    <div className="space-y-4">
      <TestModePanel />
      <div className="flex gap-2">
        <input className={`${inputCls} flex-1`} placeholder="Поиск по имени карты / владельцу / ID…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPageNum(1); load(); } }} />
        <button className={btnPrimary} onClick={() => { setPageNum(1); load(); }}>Найти</button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {selected != null ? <ChartDetailPanel id={selected} canPii={canPii} canRecalc={canRecalc} onClose={() => setSelected(null)} /> : null}
      {rows ? (
        <>
          <div className={tableWrap}>
            <table className="w-full text-left text-sm">
              <thead><tr>{['Профиль', '☉/☽/ASC', 'Статус', 'Создан', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={trow}>
                    <td className={td}><div className="font-semibold text-slate-800">{c.name}</div><div className="text-[11px] text-slate-400">{c.ownerName || c.userId}{c.isPrimary ? ' · основная' : ''}</div></td>
                    <td className={`${td} text-xs`}>{c.sunSign || '—'} / {c.moonSign || '—'} / {c.ascendantSign || '—'}</td>
                    <td className={`${td} text-xs`}>{c.status === 'ok' ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600">ok</span> : <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600">error</span>}</td>
                    <td className={`${td} text-xs text-slate-400`}>{fmtDate(c.createdAt)}</td>
                    <td className={td}><button className={btnGhost} onClick={() => setSelected(c.id)}>Открыть</button></td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Карты не найдены</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Всего: {total}</span>
            <div className="flex items-center gap-2">
              <button className={btnGhost} disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>Назад</button>
              <span className="px-1">{pageNum} / {pages}</span>
              <button className={btnGhost} disabled={pageNum >= pages} onClick={() => setPageNum((p) => p + 1)}>Вперёд</button>
            </div>
          </div>
        </>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>}
    </div>
  );
}

// ────────────────────────────── Billing ──────────────────────────────
function BillingSection({ me }: { me: AdminMe }) {
  type Tab = 'revenue' | 'payments' | 'subs' | 'promo';
  const [tab, setTab] = useState<Tab>('revenue');
  const canRefund = me.permissions.includes('billing.refund'); const canPromo = me.permissions.includes('promo.manage');
  const [rev, setRev] = useState<AdminRevenue | null>(null); const [pays, setPays] = useState<AdminPaymentRow[] | null>(null);
  const [subs, setSubs] = useState<AdminSubscriptionRow[] | null>(null); const [promos, setPromos] = useState<AdminPromo[] | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
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
    try { await admin2.refund(id); const d = await admin2.payments(1); setPays(d.payments); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const tabs: Array<[Tab, string, boolean]> = [['revenue', 'Доход', true], ['payments', 'Платежи', true], ['subs', 'Подписки', true], ['promo', 'Промокоды', canPromo]];
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto">
        {tabs.filter((t) => t[2]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-[#8C57FF] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {tab === 'revenue' && (rev ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi color="rose" label="Звёзды всего" value={rev.totalStars} sub={`${rev.totalPayments} плат.`} />
          <Kpi color="amber" label="За 30 дней" value={rev.stars30d} sub={`${rev.payments30d} плат.`} />
          <Kpi color="violet" label="Активный премиум" value={rev.activePremium} />
          <Kpi color="sky" label="Триалы" value={rev.trials} />
          <Kpi color="emerald" label="Возвраты" value={rev.refunds} sub={`${rev.refundedStars}⭐`} />
        </div>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>)}
      {tab === 'payments' && (pays ? (
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead><tr>{['Юзер', 'Сумма', 'Провайдер', 'Статус', 'Когда', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {pays.map((p) => (
                <tr key={p.id} className={trow}>
                  <td className={td}><div className="text-slate-800">{p.ownerName || p.userId}</div><div className="text-[11px] text-slate-400">{p.userId}</div></td>
                  <td className={td}>{p.amount} {p.currency}</td>
                  <td className={`${td} text-xs`}>{p.provider} · {p.platform}</td>
                  <td className={`${td} text-xs`}>{p.status === 'refunded' ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-600">возврат</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600">{p.status}</span>}</td>
                  <td className={`${td} text-xs text-slate-400`}>{fmtDate(p.createdAt)}</td>
                  <td className={td}>{canRefund && p.status !== 'refunded' ? <button className={btnGhost} disabled={busy} onClick={() => refund(p.id)}>Вернуть</button> : null}</td>
                </tr>
              ))}
              {pays.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Платежей нет</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>)}
      {tab === 'subs' && (subs ? (
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead><tr>{['Юзер', 'Статус', 'Платформа', 'До'].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.userId} className={trow}>
                  <td className={td}><div className="text-slate-800">{s.name || s.userId}</div><div className="text-[11px] text-slate-400">{s.userId}</div></td>
                  <td className={`${td} text-xs`}>{s.status === 'active' ? <span className="rounded-full bg-[#8C57FF]/10 px-2 py-0.5 font-semibold text-[#8C57FF]">активна</span> : s.status === 'trial' ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-600">триал</span> : <span className="text-slate-400">истекла</span>}</td>
                  <td className={`${td} text-xs`}>{s.provider} · {s.platform}</td>
                  <td className={`${td} text-xs text-slate-400`}>{fmtDate(s.premiumUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-400">Загрузка…</p>)}
      {tab === 'promo' && canPromo && (
        <div className="space-y-4">
          <div className={`${card} flex flex-wrap items-end gap-2`}>
            <input className={`${inputCls} flex-1`} placeholder="КОД (A-Z 0-9)" value={pCode} onChange={(e) => setPCode(e.target.value.toUpperCase())} />
            <div><label className="block text-[11px] text-slate-400">дней премиум</label><input className={`${inputCls} mt-1 w-24`} type="number" value={pVal} onChange={(e) => setPVal(Number(e.target.value))} /></div>
            <button className={btnPrimary} disabled={busy || pCode.trim().length < 3} onClick={async () => {
              setBusy(true); setError(null);
              try { await admin2.createPromo({ code: pCode.trim(), value: pVal }); setPCode(''); const d = await admin2.listPromos(); setPromos(d.promos); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
            }}>Создать</button>
          </div>
          <div className={tableWrap}>
            <table className="w-full text-left text-sm">
              <thead><tr>{['Код', 'Награда', 'Исп.', 'Статус', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {(promos || []).map((p) => (
                  <tr key={p.code} className={trow}>
                    <td className={`${td} font-semibold text-slate-800`}>{p.code}</td>
                    <td className={`${td} text-xs`}>{p.value} дн. премиум</td>
                    <td className={`${td} text-xs`}>{p.usedCount}{p.maxUses ? `/${p.maxUses}` : ''}</td>
                    <td className={`${td} text-xs`}>{p.status === 'active' ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600">активен</span> : <span className="text-slate-400">{p.status}</span>}</td>
                    <td className={td}>{p.status === 'active' ? <button className={btnGhost} disabled={busy} onClick={async () => { setBusy(true); try { await admin2.disablePromo(p.code); const d = await admin2.listPromos(); setPromos(d.promos); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>Отключить</button> : null}</td>
                  </tr>
                ))}
                {promos && promos.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Промокодов нет</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── Roles ──────────────────────────────
function RolesSection() {
  const [admins, setAdmins] = useState<AdminEntry[]>([]); const [roles, setRoles] = useState<AdminRole[]>([]);
  const [error, setError] = useState<string | null>(null); const [newId, setNewId] = useState(''); const [newRole, setNewRole] = useState<AdminRole>('admin'); const [busy, setBusy] = useState(false);
  const load = () => admin2.listAdmins().then((d) => { setAdmins(d.admins); setRoles(d.roles); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const act = async (fn: () => Promise<any>) => { setBusy(true); setError(null); try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card title="Добавить / изменить админа">
        <div className="flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1`} placeholder="Telegram user ID" value={newId} onChange={(e) => setNewId(e.target.value)} />
          <select className={inputCls} value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <button className={btnPrimary} disabled={busy || !newId.trim()} onClick={() => act(() => admin2.setRole(newId.trim(), newRole))}>Сохранить</button>
        </div>
      </Card>
      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead><tr>{['Админ', 'Роль', 'Статус', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.userId} className={trow}>
                <td className={td}><div className="font-semibold text-slate-800">{a.name || a.userId}</div><div className="text-[11px] text-slate-400">{a.userId}</div></td>
                <td className={td}>{ROLE_LABEL[a.role]}{a.isOwner ? ' · owner' : ''}</td>
                <td className={`${td} text-xs`}>{a.status}</td>
                <td className={td}>{a.isOwner ? <span className="text-[11px] text-slate-400">защищён</span> : <button className={btnGhost} disabled={busy} onClick={() => act(() => admin2.removeAdmin(a.userId))}>Снять</button>}</td>
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
  const [rows, setRows] = useState<AdminAuditRow[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { admin2.audit({ page: 1 }).then((d) => setRows(d.entries)).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  return (
    <div className={tableWrap}>
      <table className="w-full text-left text-sm">
        <thead><tr>{['Когда', 'Кто', 'Действие', 'Объект', 'Итог'].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={trow}>
              <td className={`${td} text-xs text-slate-400`}>{fmtDate(r.createdAt)}</td>
              <td className={`${td} text-xs`}>{r.actorUserId || '—'}<div className="text-[11px] text-slate-400">{r.actorRole}</div></td>
              <td className={td}><span className="font-semibold text-slate-800">{r.action}</span></td>
              <td className={`${td} text-xs text-slate-400`}>{r.entityType ? `${r.entityType} ${r.entityId ?? ''}` : '—'}</td>
              <td className={`${td} text-xs`}>{r.result === 'ok' ? <span className="text-emerald-600">ok</span> : <span className="text-rose-600">{r.result}</span>}</td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Журнал пуст</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────── Shell ──────────────────────────────
export const AdminApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<SectionId>('dashboard');
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => { admin2.me().then(setMe).catch((e) => setError(e.message)); }, []);
  const visible = useMemo(() => (me ? NAV.filter((s) => me.permissions.includes(s.perm)) : []), [me]);
  useEffect(() => { if (visible.length && !visible.some((s) => s.id === active)) setActive(visible[0].id); }, [visible, active]);

  const go = (id: SectionId) => { setActive(id); setNavOpen(false); };
  const activeLabel = visible.find((s) => s.id === active)?.label || 'Админка';

  const Sidebar = (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-100 bg-white">
      <div className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8C57FF] text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 2c3 2 5 5 5 9a5 5 0 0 1-10 0c0-4 2-7 5-9Zm0 7a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM6 20l2-3m10 3-2-3" /></svg>
        </span>
        <div><p className="text-base font-bold text-[#312D4B]">Lumia</p><p className="-mt-0.5 text-[11px] text-slate-400">Admin</p></div>
      </div>
      <p className="px-6 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">Управление</p>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {visible.map((s) => (
          <button key={s.id} onClick={() => go(s.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active === s.id ? 'bg-gradient-to-r from-[#8C57FF] to-[#A379FF] text-white shadow-[0_2px_10px_rgba(140,87,255,0.45)]' : 'text-slate-500 hover:bg-slate-50'}`}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="currentColor"><path d={s.icon} /></svg>
            <span className="truncate">{s.label}</span>
          </button>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8C57FF] text-sm font-bold text-white">{me ? ROLE_LABEL[me.role].slice(0, 1) : 'A'}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{me ? ROLE_LABEL[me.role] : 'Админ'}</p><p className="truncate text-[11px] text-slate-400">{me?.userId}</p></div>
        <button onClick={onClose} aria-label="Выйти" className="text-slate-400 hover:text-slate-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M16 17l5-5-5-5M21 12H9M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" /></svg>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="fixed inset-0 z-[60] flex text-[#312D4B]" style={{ background: PAGE_BG, paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      <div className="hidden lg:block">{Sidebar}</div>
      {navOpen ? (
        <div className="fixed inset-0 z-[70] flex lg:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setNavOpen(false)} />
          <div className="relative shadow-2xl">{Sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <button className="rounded-xl border border-slate-200 p-2 text-slate-500 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Меню">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-[#312D4B]">{activeLabel}</h1>
          </div>
          <button className={btnGhost} onClick={onClose}>В приложение</button>
        </header>

        {error ? <div className="p-4"><ErrorNote>{error}</ErrorNote></div> : null}

        {me ? (
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {active === 'dashboard' && <DashboardSection />}
            {active === 'users' && <UsersSection me={me} />}
            {active === 'charts' && <ChartsSection me={me} />}
            {active === 'billing' && <BillingSection me={me} />}
            {active === 'roles' && <RolesSection />}
            {active === 'audit' && <AuditSection />}
          </main>
        ) : (!error ? <p className="p-6 text-sm text-slate-400">Загрузка…</p> : null)}
      </div>
    </div>
  );
};

export default AdminApp;
