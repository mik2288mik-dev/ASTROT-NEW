import React, { useEffect, useMemo, useState } from 'react';
import {
  admin2,
  admin2Auth,
  Admin2Error,
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
  type AdminPremiumPlan,
  type AdminPromptRow,
  type AdminPromptDetail,
  type AdminCmsRow,
  type AdminCmsDetail,
  type AdminTicketRow,
  type AdminTicketDetail,
  type AdminSendResult,
  type AdminFlag,
  type AdminNotificationsOverview,
  type AdminNotificationScenario,
  type AdminNotificationTemplate,
  type AdminNotificationDiagnostics,
} from '../../services/admin2Service';

/**
 * Admin v2 — светлый дашборд в стиле Spike Admin: белый сайдбар с группами, белые
 * карточки с мягкими тенями и крупными скруглениями, воздушные отступы, синий акцент.
 * Меню и действия гейтятся по правам из /api/admin/v2/me (сервер — источник правды).
 */

type SectionId = 'dashboard' | 'users' | 'charts' | 'billing' | 'cms' | 'ai' | 'comms' | 'support' | 'roles' | 'audit' | 'settings';

const NAV: Array<{ id: SectionId; label: string; perm: string; icon: string }> = [
  { id: 'dashboard', label: 'Дашборд', perm: 'analytics.view', icon: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7V11h-7v9Zm0-16v5h7V4h-7Z' },
  { id: 'users', label: 'Пользователи', perm: 'users.view', icon: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-8 1.3-8 4v2h9v-2c0-1 .4-1.9 1-2.6A14 14 0 0 0 8 14Zm8 0c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5Z' },
  { id: 'charts', label: 'Натальные профили', perm: 'charts.view', icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-13h-2v6l5 3 1-1.7-4-2.3Z' },
  { id: 'billing', label: 'Монетизация', perm: 'billing.view', icon: 'M3 6h18v12H3V6Zm2 2v2h14V8H5Zm0 4v4h8v-4H5Z' },
  { id: 'cms', label: 'Контент', perm: 'content.view', icon: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4v2h10V7H7Zm0 4v2h10v-2H7Zm0 4v2h7v-2H7Z' },
  { id: 'ai', label: 'AI-промпты', perm: 'ai.view', icon: 'M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v3h1a2 2 0 0 1 0 4h-1v3a2 2 0 0 1-2 2h-3v-2a2 2 0 0 0-4 0v2H7a2 2 0 0 1-2-2v-3H4a2 2 0 0 1 0-4h1V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2Z' },
  { id: 'comms', label: 'Рассылки', perm: 'push.send', icon: 'M2 4l20 8-20 8 4-8-4-8Zm4 8H2' },
  { id: 'support', label: 'Поддержка', perm: 'support.view', icon: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM7 9h10v2H7V9Zm0 4h7v2H7v-2Z' },
  { id: 'roles', label: 'Роли и доступы', perm: 'roles.manage', icon: 'M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4Zm0 10.9h7c-.5 4.1-3.3 7.8-7 8.9V12H5V6.3l7-3.1v8.7Z' },
  { id: 'audit', label: 'Журнал действий', perm: 'audit.view', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm2 16H8v-2h8v2Zm0-4H8v-2h8v2Zm-3-5V3.5L18.5 9H13Z' },
  { id: 'settings', label: 'Настройки', perm: 'settings.manage', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4-2 1.5.3 2.5-2.4 1-1.6 2-2.4-.6L11 22l-1.9-1.6-2.4.6-1.6-2-2.4-1 .3-2.5L1 12l2-1.5-.3-2.5 2.4-1 1.6-2 2.4.6L11 2l1.9 1.6 2.4-.6 1.6 2 2.4 1-.3 2.5L21 12Z' },
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

function AdminAccessScreen({
  error,
  busy,
  onRetry,
  onClose,
}: {
  error: Admin2Error | Error | null;
  busy: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const storedAuth = admin2Auth.getStoredDevAuth();
  const [userId, setUserId] = useState(storedAuth?.userId || '');
  const [secret, setSecret] = useState(storedAuth?.secret || '');
  const [formError, setFormError] = useState<string | null>(null);
  const code = error instanceof Admin2Error ? error.code : null;
  const hasTelegramAuth = admin2Auth.hasTelegramAuth();

  const saveAndRetry = () => {
    setFormError(null);
    if (!userId.trim() || !secret) {
      setFormError('Укажите admin user ID и secret.');
      return;
    }
    admin2Auth.saveDevAuth(userId, secret);
    onRetry();
  };

  const clearAndRetry = () => {
    admin2Auth.clearDevAuth();
    setSecret('');
    onRetry();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 text-[#312D4B]" style={{ background: PAGE_BG }}>
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(20,30,60,0.14)]">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[#312D4B] p-8 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4Zm0 3.2 6 2.7V11c0 4-2.5 7.6-6 8.8C8.5 18.6 6 15 6 11V6.9l6-2.7Zm-1 10.6 6-6-1.4-1.4L11 12l-2.1-2.1-1.4 1.4 3.5 3.5Z" /></svg>
            </div>
            <h1 className="mt-6 text-3xl font-bold leading-tight">Админ-доступ Lumia</h1>
            <p className="mt-3 text-sm leading-6 text-white/70">В Telegram Mini App вход происходит автоматически. В локальном браузере нужен включенный browser-dev доступ.</p>
            <div className="mt-8 space-y-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-white/50">Режим</p>
                <p className="mt-1 font-semibold">{hasTelegramAuth ? 'Telegram initData' : storedAuth ? 'Browser-dev credentials' : 'Ожидает доступа'}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-white/50">Ответ API</p>
                <p className="mt-1 font-semibold">{code || '—'}</p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-[#312D4B]">Подключить админку</p>
                <p className="mt-1 text-sm text-slate-400">Для browser-dev: `ADMIN_WEB_DEV_AUTH_ENABLED=1` и `ADMIN_WEB_DEV_SECRET` на сервере.</p>
              </div>
              <button className={btnGhost} onClick={onClose}>В приложение</button>
            </div>

            {error ? <div className="mt-5"><ErrorNote>{error.message}</ErrorNote></div> : null}
            {formError ? <div className="mt-3"><ErrorNote>{formError}</ErrorNote></div> : null}

            <div className="mt-6 space-y-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Admin user ID
                <input className={`${inputCls} mt-1 w-full`} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Telegram ID администратора" />
              </label>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Browser-dev secret
                <input className={`${inputCls} mt-1 w-full`} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ADMIN_WEB_DEV_SECRET" />
              </label>
              <div className="flex flex-wrap gap-2 pt-2">
                <button className={btnPrimary} disabled={busy} onClick={saveAndRetry}>{busy ? 'Проверяю…' : 'Подключить доступ'}</button>
                <button className={btnGhost} disabled={busy} onClick={onRetry}>Повторить Telegram</button>
                {storedAuth ? <button className={btnGhost} disabled={busy} onClick={clearAndRetry}>Сбросить browser-dev</button> : null}
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              <b className="text-slate-700">Production:</b> откройте админку внутри Telegram Mini App. <b className="text-slate-700">Local:</b> включите browser-dev env и введите ID администратора, который уже имеет роль или совпадает с OWNER_ID.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
function UserDetailPanel({
  id,
  canPii,
  canEdit,
  canBlock,
  onClose,
  onChanged,
}: {
  id: string;
  canPii: boolean;
  canEdit: boolean;
  canBlock: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [user, setUser] = useState<AdminUserDetailV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [slotsDraft, setSlotsDraft] = useState(1);
  const [premiumDays, setPremiumDays] = useState(30);
  const load = (pii = false) => admin2.getUser(id, pii).then(setUser).catch((e) => setError(e.message));
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    if (!user) return;
    setNameDraft(user.name || '');
    setSlotsDraft(user.chartSlots || 1);
  }, [user?.id, user?.name, user?.chartSlots]);
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
        <div>Регистрация: <b className="text-slate-800">{fmtDate(user.createdAt)}</b></div>
        <div>Стрик входов: <b className="text-slate-800">{user.loginStreak ?? 0} дн.</b></div>
        <div>Устройство: <b className="text-slate-800">{user.currentDevice || '—'}</b></div>
      </div>
      {user.recentSessions?.length ? (
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Последние входы</p>
          <div className="mt-2 space-y-1">
            {user.recentSessions.slice(0, 5).map((s: any, i: number) => (
              <div key={s.session_id || i} className="flex justify-between gap-2 text-xs">
                <span className="text-slate-600">{s.device_label || s.telegram_platform || 'устройство'}</span>
                <span className="text-slate-400">{fmtDate(s.last_seen_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
      <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 sm:grid-cols-[1fr_120px_auto]">
        <input className={inputCls} disabled={!canEdit} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Имя" />
        <input className={inputCls} disabled={!canEdit} type="number" min={1} max={50} value={slotsDraft} onChange={(e) => setSlotsDraft(Number(e.target.value))} />
        <button className={btnGhost} disabled={!canEdit || busy || (!nameDraft.trim() && slotsDraft === user.chartSlots)} onClick={() => act(() => admin2.patchUser(id, { name: nameDraft.trim(), chartSlots: Math.max(1, Math.min(50, Math.round(slotsDraft || 1))) }))}>Сохранить профиль</button>
      </div>
      {!canEdit ? <p className="text-xs text-slate-400">У вашей роли нет права users.edit, поэтому изменения профиля и Premium недоступны.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className={btnGhost} disabled={!canBlock || busy} onClick={() => act(() => admin2.patchUser(id, { isBlocked: !user.isBlocked }))}>{user.isBlocked ? 'Разблокировать' : 'Заблокировать'}</button>
        <input className={`${inputCls} w-28`} disabled={!canEdit} type="number" min={1} max={3650} value={premiumDays} onChange={(e) => setPremiumDays(Number(e.target.value))} />
        <button className={btnPrimary} disabled={!canEdit || busy} onClick={() => act(() => admin2.setPremium(id, 'grant', Math.max(1, Math.min(3650, Math.round(premiumDays || 30)))))}>Выдать Premium</button>
        <button className={btnGhost} disabled={!canEdit || busy} onClick={() => act(() => admin2.setPremium(id, 'revoke'))}>Снять Premium</button>
      </div>
    </div>
  );
}

function UsersSection({ me }: { me: AdminMe }) {
  const [page, setPage] = useState<AdminUsersPage | null>(null);
  const [q, setQ] = useState('');
  const [premium, setPremium] = useState('all');
  const [segment, setSegment] = useState('all');
  const [sortBy, setSortBy] = useState('last_seen');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [pageNum, setPageNum] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkDays, setBulkDays] = useState(7);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canPii = me.permissions.includes('user.pii.view');
  const canEdit = me.permissions.includes('users.edit');
  const canBlock = me.permissions.includes('users.block');
  const load = () => {
    setError(null);
    return admin2.listUsers({ q, premium, segment, sortBy, sortOrder, page: pageNum, pageSize })
      .then((next) => {
        setPage(next);
        setCheckedIds((ids) => ids.filter((id) => next.users.some((u) => u.id === id)));
      })
      .catch((e) => setError(e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [pageNum, premium, segment, sortBy, sortOrder, pageSize]);
  const resetAndLoad = () => { if (pageNum === 1) void load(); else setPageNum(1); };
  const visibleIds = page?.users.map((u) => u.id) || [];
  const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => checkedIds.includes(id));
  const toggleAllVisible = () => {
    setCheckedIds((ids) => allVisibleChecked
      ? ids.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...ids, ...visibleIds])));
  };
  const toggleOne = (id: string) => {
    setCheckedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };
  const bulkAct = async (label: string, fn: (id: string) => Promise<any>) => {
    if (!checkedIds.length) return;
    const ids = [...checkedIds];
    let failed = 0;
    let lastError = '';
    setBulkBusy(true);
    setError(null);
    setNote(null);
    for (const id of ids) {
      try {
        await fn(id);
      } catch (e: any) {
        failed += 1;
        lastError = e.message || String(e);
      }
    }
    await load();
    setCheckedIds([]);
    setBulkBusy(false);
    const done = ids.length - failed;
    if (done > 0) setNote(`${label}: выполнено ${done} из ${ids.length}.`);
    if (failed > 0) setError(`${label}: не удалось ${failed} из ${ids.length}${lastError ? ` (${lastError})` : ''}`);
  };
  return (
    <div className="space-y-4">
      {page ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi color="blue" label="Всего" value={page.overview.totalUsers} />
          <Kpi color="violet" label="Premium" value={page.overview.activePremiumUsers} />
          <Kpi color="emerald" label="Активны 7д" value={page.overview.activeUsers7d} />
          <Kpi color="amber" label="Требуют внимания" value={page.overview.needAttentionUsers} />
          <Kpi color="rose" label="Без даты рождения" value={page.overview.usersWithoutBirthData} />
        </div>
      ) : null}
      <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
        <input className={`${inputCls} flex-1`} placeholder="Поиск по имени или ID…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') resetAndLoad(); }} />
        <button className={btnPrimary} onClick={resetAndLoad}>Найти</button>
      </div>
      <div className={`${card} grid gap-2 md:grid-cols-5`}>
        <select className={inputCls} value={premium} onChange={(e) => { setPremium(e.target.value); setPageNum(1); }}>
          <option value="all">Все тарифы</option>
          <option value="premium">Только Premium</option>
          <option value="free">Только free</option>
        </select>
        <select className={inputCls} value={segment} onChange={(e) => { setSegment(e.target.value); setPageNum(1); }}>
          <option value="all">Все сегменты</option>
          <option value="active_7d">Активные 7д</option>
          <option value="inactive_7d">Неактивные 7д</option>
          <option value="inactive_30d">Неактивные 30д</option>
          <option value="need_attention">Требуют внимания</option>
          <option value="new_user_no_birth_data">Без даты рождения</option>
          <option value="high_intent_premium">High intent Premium</option>
        </select>
        <select className={inputCls} value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPageNum(1); }}>
          <option value="last_seen">Сорт: онлайн</option>
          <option value="created_at">Сорт: регистрация</option>
          <option value="premium_until">Сорт: Premium до</option>
          <option value="saved_charts_count">Сорт: карты</option>
          <option value="name">Сорт: имя</option>
        </select>
        <select className={inputCls} value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setPageNum(1); }}>
          <option value="desc">По убыванию</option>
          <option value="asc">По возрастанию</option>
        </select>
        <select className={inputCls} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPageNum(1); }}>
          <option value={25}>25 строк</option>
          <option value={50}>50 строк</option>
          <option value={100}>100 строк</option>
        </select>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {note ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{note}</div> : null}
      {checkedIds.length > 0 ? (
        <div className={`${card} flex flex-wrap items-center gap-2`}>
          <div className="mr-auto">
            <p className="text-sm font-bold text-[#312D4B]">Выбрано: {checkedIds.length}</p>
            <p className="text-xs text-slate-400">Массовые действия выполняются последовательно и пишутся в audit.</p>
          </div>
          <input className={`${inputCls} w-24`} disabled={!canEdit || bulkBusy} type="number" min={1} max={3650} value={bulkDays} onChange={(e) => setBulkDays(Number(e.target.value))} />
          <button className={btnPrimary} disabled={!canEdit || bulkBusy} onClick={() => bulkAct('Premium выдан', (id) => admin2.setPremium(id, 'grant', Math.max(1, Math.min(3650, Math.round(bulkDays || 7)))))}>Premium +дни</button>
          <button className={btnGhost} disabled={!canEdit || bulkBusy} onClick={() => bulkAct('Premium снят', (id) => admin2.setPremium(id, 'revoke'))}>Снять Premium</button>
          <button className={btnGhost} disabled={!canBlock || bulkBusy} onClick={() => bulkAct('Пользователи заблокированы', (id) => admin2.patchUser(id, { isBlocked: true }))}>Заблокировать</button>
          <button className={btnGhost} disabled={!canBlock || bulkBusy} onClick={() => bulkAct('Пользователи разблокированы', (id) => admin2.patchUser(id, { isBlocked: false }))}>Разблокировать</button>
          <button className={btnGhost} disabled={bulkBusy} onClick={() => setCheckedIds([])}>Снять выбор</button>
        </div>
      ) : null}
      {selected ? <UserDetailPanel id={selected} canPii={canPii} canEdit={canEdit} canBlock={canBlock} onClose={() => setSelected(null)} onChanged={load} /> : null}
      {page ? (
        <>
          <div className={tableWrap}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className={th}>
                    <input type="checkbox" aria-label="Выбрать всех на странице" checked={allVisibleChecked} onChange={toggleAllVisible} />
                  </th>
                  {['Имя', 'Статус', 'Премиум', 'Карты', 'Онлайн', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {page.users.map((u: AdminUserRow) => (
                  <tr key={u.id} className={trow}>
                    <td className={td}><input type="checkbox" aria-label={`Выбрать ${u.name || u.id}`} checked={checkedIds.includes(u.id)} onChange={() => toggleOne(u.id)} /></td>
                    <td className={td}><div className="font-semibold text-slate-800">{u.name}</div><div className="text-[11px] text-slate-400">{u.id}</div></td>
                    <td className={td}>{u.isBlocked ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">blocked</span> : u.isAdmin ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-600">admin</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">active</span>}</td>
                    <td className={td}>{u.isPremium ? <span className="rounded-full bg-[#8C57FF]/10 px-2 py-0.5 text-xs font-semibold text-[#8C57FF]">Premium</span> : '—'}</td>
                    <td className={td}>{u.savedCharts}</td>
                    <td className={`${td} text-xs text-slate-400`}>{fmtDate(u.lastSeenAt)}</td>
                    <td className={td}><button className={btnGhost} onClick={() => setSelected(u.id)}>Открыть</button></td>
                  </tr>
                ))}
                {page.users.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Ничего не найдено</td></tr> : null}
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
  type Tab = 'revenue' | 'plans' | 'payments' | 'subs' | 'promo';
  const [tab, setTab] = useState<Tab>('revenue');
  const canRefund = me.permissions.includes('billing.refund'); const canPromo = me.permissions.includes('promo.manage'); const canPlans = me.permissions.includes('paywall.manage');
  const [rev, setRev] = useState<AdminRevenue | null>(null); const [pays, setPays] = useState<AdminPaymentRow[] | null>(null);
  const [subs, setSubs] = useState<AdminSubscriptionRow[] | null>(null); const [promos, setPromos] = useState<AdminPromo[] | null>(null);
  const [plans, setPlans] = useState<AdminPremiumPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [pCode, setPCode] = useState(''); const [pVal, setPVal] = useState(30);
  useEffect(() => {
    setError(null);
    if (tab === 'revenue') admin2.revenue().then(setRev).catch((e) => setError(e.message));
    if (tab === 'plans') admin2.premiumPlans().then((d) => setPlans(d.plans)).catch((e) => setError(e.message));
    if (tab === 'payments') admin2.payments(1).then((d) => setPays(d.payments)).catch((e) => setError(e.message));
    if (tab === 'subs') admin2.subscriptions(1).then((d) => setSubs(d.subscriptions)).catch((e) => setError(e.message));
    if (tab === 'promo' && canPromo) admin2.listPromos().then((d) => setPromos(d.promos)).catch((e) => setError(e.message));
  }, [tab, canPromo]);
  const refund = async (id: number) => {
    if (!window.confirm('Точно вернуть платёж? Это необратимо.')) return;
    setBusy(true); setError(null);
    try { await admin2.refund(id); const d = await admin2.payments(1); setPays(d.payments); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const updatePlan = (id: string, patch: Partial<AdminPremiumPlan>) => setPlans((items) => (items || []).map((plan) => plan.id === id ? { ...plan, ...patch } : plan));
  const savePlans = async () => {
    if (!plans) return;
    setBusy(true); setError(null);
    try { const d = await admin2.savePremiumPlans(plans); setPlans(d.plans); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const tabs: Array<[Tab, string, boolean]> = [['revenue', 'Доход', true], ['plans', 'Тарифы', true], ['payments', 'Платежи', true], ['subs', 'Подписки', true], ['promo', 'Промокоды', canPromo]];
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
      {tab === 'plans' && (plans ? (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className={`${card} grid gap-3 lg:grid-cols-[1.2fr_90px_100px_110px_110px_1fr_90px]`}>
              <div>
                <p className="text-sm font-bold text-[#312D4B]">{plan.id}</p>
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <input type="checkbox" checked={plan.isActive} disabled={!canPlans || busy} onChange={(e) => updatePlan(plan.id, { isActive: e.target.checked })} />
                  активен в оплате
                </label>
              </div>
              <label className="text-[11px] font-semibold text-slate-400">Дней<input className={`${inputCls} mt-1 w-full`} type="number" min={1} value={plan.days} disabled={!canPlans} onChange={(e) => updatePlan(plan.id, { days: Number(e.target.value) })} /></label>
              <label className="text-[11px] font-semibold text-slate-400">Stars<input className={`${inputCls} mt-1 w-full`} type="number" min={1} value={plan.stars} disabled={!canPlans} onChange={(e) => updatePlan(plan.id, { stars: Number(e.target.value) })} /></label>
              <label className="text-[11px] font-semibold text-slate-400">Рубли<input className={`${inputCls} mt-1 w-full`} type="number" min={0} value={plan.priceRub} disabled={!canPlans} onChange={(e) => updatePlan(plan.id, { priceRub: Number(e.target.value) })} /></label>
              <label className="text-[11px] font-semibold text-slate-400">USD<input className={`${inputCls} mt-1 w-full`} type="number" min={0} step="0.01" value={plan.priceUsd} disabled={!canPlans} onChange={(e) => updatePlan(plan.id, { priceUsd: Number(e.target.value) })} /></label>
              <label className="text-[11px] font-semibold text-slate-400">Label<input className={`${inputCls} mt-1 w-full`} value={plan.label} disabled={!canPlans} onChange={(e) => updatePlan(plan.id, { label: e.target.value })} /></label>
              <label className="text-[11px] font-semibold text-slate-400">Порядок<input className={`${inputCls} mt-1 w-full`} type="number" value={plan.sortOrder} disabled={!canPlans} onChange={(e) => updatePlan(plan.id, { sortOrder: Number(e.target.value) })} /></label>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">Эти значения используются при создании Telegram Stars invoice и на paywall.</p>
            {canPlans ? <button className={btnPrimary} disabled={busy} onClick={savePlans}>{busy ? 'Сохраняю…' : 'Сохранить тарифы'}</button> : <span className="text-xs text-slate-400">Нет права paywall.manage</span>}
          </div>
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

// ────────────────────────────── status badge ──────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-[#56CA00]/12 text-[#56CA00]', published: 'bg-[#56CA00]/12 text-[#56CA00]',
    draft: 'bg-[#FFB400]/15 text-[#E6A200]', scheduled: 'bg-[#16B1FF]/12 text-[#16B1FF]',
    archived: 'bg-slate-100 text-slate-400',
  };
  const ru: Record<string, string> = { active: 'активен', published: 'опубликован', draft: 'черновик', scheduled: 'запланирован', archived: 'архив' };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status] || 'bg-slate-100 text-slate-500'}`}>{ru[status] || status}</span>;
}

// ────────────────────────────── AI prompts ──────────────────────────────
function PromptsSection({ me }: { me: AdminMe }) {
  const [rows, setRows] = useState<AdminPromptRow[] | null>(null);
  const [sel, setSel] = useState<AdminPromptDetail | null>(null);
  const [body, setBody] = useState(''); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [nkey, setNkey] = useState(''); const [nbody, setNbody] = useState('');
  const canEdit = me.permissions.includes('ai.edit'); const canPublish = me.permissions.includes('ai.publish');
  const load = () => admin2.listPrompts().then((d) => setRows(d.prompts)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const open = async (id: number) => { setError(null); try { const p = await admin2.getPrompt(id); setSel(p); setBody(p.body); } catch (e: any) { setError(e.message); } };
  const act = async (fn: () => Promise<any>) => { setBusy(true); setError(null); try { await fn(); await load(); if (sel) await open(sel.id); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <p className="text-[13px] text-slate-500">Активный промпт по ключу переопределяет код-дефолт в живой генерации. Уже подключён ключ <b className="text-slate-700">chat_system</b> (чат «Спросить Lumia»).</p>
      {canEdit ? (
        <Card title="Новый промпт">
          <div className="space-y-2">
            <input className={`${inputCls} w-full`} placeholder="ключ (напр. chat_system)" value={nkey} onChange={(e) => setNkey(e.target.value)} />
            <textarea className={`${inputCls} h-28 w-full font-mono text-xs`} placeholder="текст промпта…" value={nbody} onChange={(e) => setNbody(e.target.value)} />
            <button className={btnPrimary} disabled={busy || nkey.trim().length < 3 || !nbody.trim()} onClick={() => act(async () => { await admin2.createPrompt({ key: nkey.trim(), body: nbody.trim() }); setNkey(''); setNbody(''); })}>Создать черновик</button>
          </div>
        </Card>
      ) : null}
      {sel ? (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between">
            <div><p className="font-bold text-[#312D4B]">{sel.key} <span className="text-xs text-slate-400">v{sel.version} · {sel.locale}</span></p></div>
            <div className="flex items-center gap-2"><StatusBadge status={sel.status} /><button className={btnGhost} onClick={() => setSel(null)}>Закрыть</button></div>
          </div>
          <textarea className={`${inputCls} h-48 w-full font-mono text-xs`} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canEdit} />
          <div className="flex flex-wrap gap-2">
            {canEdit ? <button className={btnGhost} disabled={busy || body === sel.body} onClick={() => act(() => admin2.updatePrompt(sel.id, body))}>Сохранить (новая версия)</button> : null}
            {canPublish ? <button className={btnPrimary} disabled={busy || sel.status === 'active'} onClick={() => act(() => admin2.publishPrompt(sel.id))}>Опубликовать</button> : null}
            {canEdit ? <button className={btnGhost} disabled={busy || sel.status === 'archived'} onClick={() => act(() => admin2.archivePrompt(sel.id))}>В архив</button> : null}
          </div>
          {!canPublish ? <p className="text-[11px] text-slate-400">Публикация промпта — только у super_admin (ai.publish).</p> : null}
        </div>
      ) : null}
      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead><tr>{['Ключ', 'Тип', 'Версия', 'Статус', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(rows || []).map((p) => (
              <tr key={p.id} className={trow}>
                <td className={`${td} font-semibold text-[#312D4B]`}>{p.key}</td>
                <td className={`${td} text-xs`}>{p.type} · {p.locale}</td>
                <td className={`${td} text-xs`}>v{p.version}</td>
                <td className={td}><StatusBadge status={p.status} /></td>
                <td className={td}><button className={btnGhost} onClick={() => open(p.id)}>Открыть</button></td>
              </tr>
            ))}
            {rows && rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Промптов нет</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────── CMS ──────────────────────────────
function ContentSection({ me }: { me: AdminMe }) {
  const [rows, setRows] = useState<AdminCmsRow[] | null>(null);
  const [sel, setSel] = useState<AdminCmsDetail | null>(null);
  const [body, setBody] = useState(''); const [title, setTitle] = useState(''); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [nt, setNt] = useState(''); const [ntitle, setNtitle] = useState(''); const [nbody, setNbody] = useState('');
  const canEdit = me.permissions.includes('content.edit'); const canPublish = me.permissions.includes('content.publish');
  const load = () => admin2.listCms().then((d) => setRows(d.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const open = async (id: number) => { setError(null); try { const c = await admin2.getCms(id); setSel(c); setBody(c.body); setTitle(c.title || ''); } catch (e: any) { setError(e.message); } };
  const act = async (fn: () => Promise<any>) => { setBusy(true); setError(null); try { await fn(); await load(); if (sel) await open(sel.id); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <p className="text-[13px] text-slate-500">Авторский контент: онбординг, paywall, FAQ, тексты пушей и т.п. — со статусами черновик → опубликован → архив и версиями.</p>
      {canEdit ? (
        <Card title="Новый материал">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className={`${inputCls} w-40`} placeholder="тип (faq, paywall…)" value={nt} onChange={(e) => setNt(e.target.value)} />
              <input className={`${inputCls} flex-1`} placeholder="заголовок" value={ntitle} onChange={(e) => setNtitle(e.target.value)} />
            </div>
            <textarea className={`${inputCls} h-24 w-full`} placeholder="текст…" value={nbody} onChange={(e) => setNbody(e.target.value)} />
            <button className={btnPrimary} disabled={busy || nt.trim().length < 2 || !nbody.trim()} onClick={() => act(async () => { await admin2.createCms({ type: nt.trim(), title: ntitle.trim(), body: nbody.trim() }); setNt(''); setNtitle(''); setNbody(''); })}>Создать черновик</button>
          </div>
        </Card>
      ) : null}
      {sel ? (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between">
            <p className="font-bold text-[#312D4B]">{sel.type} <span className="text-xs text-slate-400">v{sel.version} · {sel.locale}</span></p>
            <div className="flex items-center gap-2"><StatusBadge status={sel.status} /><button className={btnGhost} onClick={() => setSel(null)}>Закрыть</button></div>
          </div>
          <input className={`${inputCls} w-full`} placeholder="заголовок" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          <textarea className={`${inputCls} h-40 w-full`} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canEdit} />
          <div className="flex flex-wrap gap-2">
            {canEdit ? <button className={btnGhost} disabled={busy || (body === sel.body && title === (sel.title || ''))} onClick={() => act(() => admin2.updateCms(sel.id, body, title))}>Сохранить (новая версия)</button> : null}
            {canPublish ? <button className={btnPrimary} disabled={busy || sel.status === 'published'} onClick={() => act(() => admin2.publishCms(sel.id))}>Опубликовать</button> : null}
            {canEdit ? <button className={btnGhost} disabled={busy || sel.status === 'archived'} onClick={() => act(() => admin2.archiveCms(sel.id))}>В архив</button> : null}
          </div>
        </div>
      ) : null}
      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead><tr>{['Тип', 'Заголовок', 'Версия', 'Статус', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(rows || []).map((c) => (
              <tr key={c.id} className={trow}>
                <td className={`${td} font-semibold text-[#312D4B]`}>{c.type}</td>
                <td className={`${td} text-xs`}>{c.title || '—'}</td>
                <td className={`${td} text-xs`}>v{c.version}</td>
                <td className={td}><StatusBadge status={c.status} /></td>
                <td className={td}><button className={btnGhost} onClick={() => open(c.id)}>Открыть</button></td>
              </tr>
            ))}
            {rows && rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Контента нет</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────── Communications ──────────────────────────────
function CommsSection() {
  type CommsTab = 'health' | 'manual' | 'stats' | 'scenarios' | 'templates';
  const [tab, setTab] = useState<CommsTab>('health');
  const [mode, setMode] = useState<'segment' | 'user'>('segment');
  const [segment, setSegment] = useState('all');
  const [userId, setUserId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<AdminSendResult | null>(null);
  const [overview, setOverview] = useState<AdminNotificationsOverview | null>(null);
  const [scenarioDraft, setScenarioDraft] = useState<AdminNotificationScenario | null>(null);
  const [audienceRaw, setAudienceRaw] = useState('{}');
  const [templateDraft, setTemplateDraft] = useState<Partial<AdminNotificationTemplate> | null>(null);
  const segments = [['all', 'Все'], ['premium', 'Премиум'], ['free', 'Бесплатные'], ['active_7d', 'Активные 7д'], ['inactive_7d', 'Неактивные 7д'], ['inactive_30d', 'Неактивные 30д'], ['need_attention', 'Требуют внимания'], ['high_intent_premium', 'High intent Premium']];
  const [diag, setDiag] = useState<AdminNotificationDiagnostics | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [runOut, setRunOut] = useState<{ ok: boolean; msg: string } | null>(null);
  const loadNotifications = () => admin2.notifications().then(setOverview).catch((e) => setError(e.message));
  const loadDiagnostics = () => admin2.notificationsDiagnostics().then(setDiag).catch((e) => setError(e.message));
  useEffect(() => { loadNotifications(); loadDiagnostics(); }, []);
  const runSelfTest = async () => {
    setDiagBusy(true); setError(null); setRunOut(null);
    try {
      const r = await admin2.runNotifications({ action: 'selftest' });
      const res = r.result || {};
      setRunOut(res.ok
        ? { ok: true, msg: `Тест отправлен (${res.type || 'push'}) — проверь Telegram` }
        : { ok: false, msg: res.error || 'Не удалось отправить тест' });
      await loadDiagnostics();
    } catch (e: any) { setError(e.message); } finally { setDiagBusy(false); }
  };
  const runDispatch = async () => {
    setDiagBusy(true); setError(null); setRunOut(null);
    try {
      const r = await admin2.runNotifications({ action: 'dispatch' });
      const res = r.result || {};
      setRunOut({ ok: (res.failureCount ?? 0) === 0, msg: `Очередь разослана: отправлено ${res.successCount ?? 0}, ошибок ${res.failureCount ?? 0}` });
      await loadDiagnostics();
    } catch (e: any) { setError(e.message); } finally { setDiagBusy(false); }
  };
  const send = async () => {
    const isBroadcast = mode === 'segment';
    if (isBroadcast && !window.confirm(`Отправить пуш сегменту «${segment}»? Это массовая рассылка.`)) return;
    setBusy(true); setError(null); setOut(null);
    try { setOut(await admin2.sendPush({ mode, segment, userId, text })); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const openScenario = (scenario: AdminNotificationScenario) => {
    setScenarioDraft(scenario);
    setAudienceRaw(JSON.stringify(scenario.audienceRuleJson || {}, null, 2));
  };
  const saveScenario = async () => {
    if (!scenarioDraft) return;
    let audienceRuleJson: Record<string, any>;
    try { audienceRuleJson = JSON.parse(audienceRaw || '{}'); } catch { setError('Некорректный JSON аудитории'); return; }
    setBusy(true); setError(null);
    try {
      await admin2.updateNotificationScenario(scenarioDraft.id, { ...scenarioDraft, audienceRuleJson });
      setScenarioDraft(null);
      await loadNotifications();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const newTemplate = () => setTemplateDraft({
    scenarioId: overview?.scenarios[0]?.id ?? null,
    name: '',
    slot: 'custom',
    targetSegment: 'all',
    title: '',
    body: '',
    text: '',
    buttonText: 'Открыть',
    deepLink: 'today',
    isActive: true,
    weight: 100,
    notes: null,
  });
  const saveTemplate = async () => {
    if (!templateDraft) return;
    setBusy(true); setError(null);
    try {
      await admin2.saveNotificationTemplate({ ...templateDraft, text: templateDraft.body || templateDraft.text || '' });
      setTemplateDraft(null);
      await loadNotifications();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto">
        {([['health', 'Состояние'], ['manual', 'Ручная отправка'], ['stats', 'Статистика'], ['scenarios', 'Сценарии'], ['templates', 'Шаблоны']] as Array<[CommsTab, string]>).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-[#8C57FF] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {tab === 'health' ? (
        <div className="space-y-4">
          {diag ? (
            <>
              <div className={`rounded-2xl border p-4 ${diag.healthy ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-bold ${diag.healthy ? 'text-emerald-700' : 'text-amber-700'}`}>{diag.healthy ? 'Уведомления работают' : 'Есть проблемы с доставкой'}</p>
                  <button className={btnGhost} disabled={diagBusy} onClick={loadDiagnostics}>Обновить</button>
                </div>
                {diag.problems.length
                  ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{diag.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  : <p className="mt-1 text-sm text-emerald-700">Все проверки пройдены — пуши доставляются.</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={btnPrimary} disabled={diagBusy} onClick={runSelfTest}>{diagBusy ? 'Минуту…' : 'Отправить себе тест'}</button>
                <button className={btnGhost} disabled={diagBusy} onClick={runDispatch}>Разослать очередь сейчас</button>
              </div>
              {runOut ? <div className={`rounded-2xl border p-3 text-sm ${runOut.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>{runOut.msg}</div> : null}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Kpi color={!diag.env.dryRun ? 'emerald' : 'rose'} label="Отправка в Telegram" value={diag.env.dryRun ? 'выкл' : 'вкл'} sub={diag.env.botUsername ? `@${diag.env.botUsername}${diag.env.botTokenEnvKey ? ` · ${diag.env.botTokenEnvKey}` : ''}` : (diag.env.botTokenEnvKey || 'нет BOT_TOKEN')} />
                <Kpi color={diag.scheduler.started ? 'emerald' : 'rose'} label="Планировщик" value={diag.scheduler.started ? 'жив' : 'стоп'} sub={diag.scheduler.lastDispatchAt ? `флаш ${fmtDate(diag.scheduler.lastDispatchAt)}` : 'нет флашей'} />
                <Kpi color={diag.health.scenarios.enabled > 0 ? 'blue' : 'rose'} label="Сценарии вкл." value={`${diag.health.scenarios.enabled}/${diag.health.scenarios.total}`} sub={`${diag.health.templates.active} шаблонов`} />
                <Kpi color="sky" label="Очередь" value={diag.health.queue.scheduled} sub={`созрело ${diag.health.queue.dueNow}`} />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Kpi color="emerald" label="Отправлено 24ч" value={diag.health.queue.sentLast24h} sub={diag.health.lastSentAt ? fmtDate(diag.health.lastSentAt) : '—'} />
                <Kpi color="rose" label="Ошибок 24ч" value={diag.health.queue.failedLast24h} />
                <Kpi color="blue" label="С натальной картой" value={diag.health.recipients.withChart} />
                <Kpi color="sky" label="Со знаком (есть дата)" value={diag.health.recipients.withBirthDate} />
              </div>
              {diag.health.lastError.message ? (
                <Card title="Последняя ошибка отправки">
                  <p className="text-sm text-rose-600">{diag.health.lastError.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{fmtDate(diag.health.lastError.at)}</p>
                </Card>
              ) : null}
              {diag.ownerProbe ? (
                <Card title="Диагностика для тебя (почему приходит / не приходит)">
                  <div className={`rounded-xl border p-2.5 text-sm ${diag.ownerProbe.candidateNow ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
                    {diag.ownerProbe.candidateNow
                      ? `Прямо сейчас планировщик подобрал бы тебе: ${diag.ownerProbe.candidateNow.type} (${diag.ownerProbe.candidateNow.job})`
                      : 'Прямо сейчас ни один сценарий не подходит тебе (окно времени/лимит/тихие часы). Планировщик наполнит очередь в своё время по Москве.'}
                  </div>
                  <div className="mt-2 space-y-1">
                    {diag.ownerProbe.jobs.map((j) => (
                      <div key={j.job} className="flex justify-between gap-2 text-xs">
                        <span className="text-slate-500">{j.job}</span>
                        <span className={`font-semibold ${j.result.startsWith('кандидат') ? 'text-emerald-600' : 'text-slate-400'}`}>{j.result}</span>
                      </div>
                    ))}
                  </div>
                  {diag.ownerProbe.recentQueue.length ? (
                    <>
                      <div className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Твоя очередь (последние)</div>
                      <div className="space-y-1">
                        {diag.ownerProbe.recentQueue.map((r) => (
                          <div key={r.id} className="flex justify-between gap-2 text-xs">
                            <span className="text-slate-600">{r.type}</span>
                            <span className="text-slate-400">{r.status}{r.sentAt ? ` · ${fmtDate(r.sentAt)}` : r.scheduledAt ? ` · ${fmtDate(r.scheduledAt)}` : ''}{r.error ? ` · ${r.error}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="mt-2 text-xs text-slate-400">Очередь по тебе пуста — планировщик ещё не создавал тебе пушей.</p>}
                </Card>
              ) : null}
            </>
          ) : <p className="text-sm text-slate-400">Загрузка диагностики…</p>}
        </div>
      ) : null}
      {tab === 'manual' ? <Card title="Ручная рассылка">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'segment' ? 'bg-[#8C57FF] text-white' : 'bg-white text-slate-500 border border-slate-200'}`} onClick={() => setMode('segment')}>Сегмент</button>
            <button className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'user' ? 'bg-[#8C57FF] text-white' : 'bg-white text-slate-500 border border-slate-200'}`} onClick={() => setMode('user')}>Один юзер</button>
          </div>
          {mode === 'segment'
            ? <select className={`${inputCls} w-full`} value={segment} onChange={(e) => setSegment(e.target.value)}>{segments.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            : <input className={`${inputCls} w-full`} placeholder="Telegram user ID" value={userId} onChange={(e) => setUserId(e.target.value)} />}
          <textarea className={`${inputCls} h-32 w-full`} placeholder="Текст пуша…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={btnPrimary} disabled={busy || text.trim().length < 3 || (mode === 'user' && !userId.trim())} onClick={send}>{busy ? 'Отправляю…' : 'Отправить'}</button>
          {out ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">Отправлено: <b>{out.sent}</b> · ошибок: {out.failed} · всего {out.total}{out.capped ? ' (лимит 300 — для больших запусков используйте сценарии)' : ''}</div> : null}
        </div>
      </Card> : null}
      {tab === 'stats' && overview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi color="blue" label="Отправлено 30д" value={overview.stats.sent} />
            <Kpi color="emerald" label="Клики" value={overview.stats.clicked} sub={`${Math.round(overview.stats.ctr * 100)}% CTR`} />
            <Kpi color="sky" label="Открытия app" value={overview.stats.openedApp} />
            <Kpi color="rose" label="Ошибки" value={overview.stats.errors} />
          </div>
          <Card title="Лучшие шаблоны">
            <div className="space-y-2">
              {overview.stats.bestTemplates.map((t) => <div key={t.templateId} className="flex justify-between text-sm"><span className="truncate text-slate-600">{t.title || `#${t.templateId}`}</span><span className="font-semibold text-slate-400">{t.clicked}/{t.sent}</span></div>)}
              {overview.stats.bestTemplates.length === 0 ? <p className="text-xs text-slate-400">Пока нет данных</p> : null}
            </div>
          </Card>
        </div>
      ) : null}
      {tab === 'scenarios' && overview ? (
        <div className="space-y-4">
          {scenarioDraft ? (
            <div className={`${card} space-y-3`}>
              <div className="flex items-center justify-between"><p className="font-bold text-[#312D4B]">{scenarioDraft.key}</p><button className={btnGhost} onClick={() => setScenarioDraft(null)}>Закрыть</button></div>
              <div className="grid gap-2 md:grid-cols-4">
                <label className="text-[11px] font-semibold text-slate-400">Название<input className={`${inputCls} mt-1 w-full`} value={scenarioDraft.name} onChange={(e) => setScenarioDraft({ ...scenarioDraft, name: e.target.value })} /></label>
                <label className="text-[11px] font-semibold text-slate-400">Старт<input className={`${inputCls} mt-1 w-full`} type="time" value={scenarioDraft.timeWindowStart} onChange={(e) => setScenarioDraft({ ...scenarioDraft, timeWindowStart: e.target.value })} /></label>
                <label className="text-[11px] font-semibold text-slate-400">Финиш<input className={`${inputCls} mt-1 w-full`} type="time" value={scenarioDraft.timeWindowEnd} onChange={(e) => setScenarioDraft({ ...scenarioDraft, timeWindowEnd: e.target.value })} /></label>
                <label className="text-[11px] font-semibold text-slate-400">Приоритет<input className={`${inputCls} mt-1 w-full`} type="number" value={scenarioDraft.priority} onChange={(e) => setScenarioDraft({ ...scenarioDraft, priority: Number(e.target.value) })} /></label>
              </div>
              <textarea className={`${inputCls} h-24 w-full`} value={scenarioDraft.description} onChange={(e) => setScenarioDraft({ ...scenarioDraft, description: e.target.value })} />
              <textarea className={`${inputCls} h-32 w-full font-mono text-xs`} value={audienceRaw} onChange={(e) => setAudienceRaw(e.target.value)} />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500"><input type="checkbox" checked={scenarioDraft.enabled} onChange={(e) => setScenarioDraft({ ...scenarioDraft, enabled: e.target.checked })} /> сценарий включен</label>
                <button className={btnPrimary} disabled={busy} onClick={saveScenario}>Сохранить сценарий</button>
              </div>
            </div>
          ) : null}
          <div className={tableWrap}>
            <table className="w-full text-left text-sm">
              <thead><tr>{['Сценарий', 'Окно', 'Шаблоны', 'Метрики', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {overview.scenarios.map((s) => (
                  <tr key={s.id} className={trow}>
                    <td className={td}><div className="font-semibold text-slate-800">{s.name}</div><div className="text-[11px] text-slate-400">{s.key}</div></td>
                    <td className={`${td} text-xs`}>{s.dayPart} · {s.timeWindowStart}-{s.timeWindowEnd}</td>
                    <td className={`${td} text-xs`}>{s.activeTemplatesCount}/{s.templatesCount}</td>
                    <td className={`${td} text-xs`}>{s.clickedCount}/{s.sentCount} · {Math.round(s.ctr * 100)}%</td>
                    <td className={`${td} space-x-2`}><button className={btnGhost} disabled={busy} onClick={() => admin2.updateNotificationScenario(s.id, { enabled: !s.enabled }).then(loadNotifications).catch((e) => setError(e.message))}>{s.enabled ? 'Выключить' : 'Включить'}</button><button className={btnGhost} onClick={() => openScenario(s)}>Открыть</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {tab === 'templates' && overview ? (
        <div className="space-y-4">
          <button className={btnPrimary} onClick={newTemplate}>Новый шаблон</button>
          {templateDraft ? (
            <div className={`${card} space-y-3`}>
              <div className="flex items-center justify-between"><p className="font-bold text-[#312D4B]">{templateDraft.id ? `Шаблон #${templateDraft.id}` : 'Новый шаблон'}</p><button className={btnGhost} onClick={() => setTemplateDraft(null)}>Закрыть</button></div>
              <div className="grid gap-2 md:grid-cols-3">
                <select className={inputCls} value={templateDraft.scenarioId ?? ''} onChange={(e) => setTemplateDraft({ ...templateDraft, scenarioId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Без сценария</option>
                  {overview.scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className={inputCls} placeholder="Название" value={templateDraft.name || ''} onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })} />
                <select className={inputCls} value={templateDraft.targetSegment || 'all'} onChange={(e) => setTemplateDraft({ ...templateDraft, targetSegment: e.target.value })}>{segments.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
              <input className={`${inputCls} w-full`} placeholder="Заголовок" value={templateDraft.title || ''} onChange={(e) => setTemplateDraft({ ...templateDraft, title: e.target.value })} />
              <textarea className={`${inputCls} h-28 w-full`} placeholder="Текст" value={templateDraft.body || templateDraft.text || ''} onChange={(e) => setTemplateDraft({ ...templateDraft, body: e.target.value, text: e.target.value })} />
              <div className="grid gap-2 md:grid-cols-3">
                <input className={inputCls} placeholder="Кнопка" value={templateDraft.buttonText || ''} onChange={(e) => setTemplateDraft({ ...templateDraft, buttonText: e.target.value })} />
                <input className={inputCls} placeholder="Deep link" value={templateDraft.deepLink || ''} onChange={(e) => setTemplateDraft({ ...templateDraft, deepLink: e.target.value })} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500"><input type="checkbox" checked={templateDraft.isActive !== false} onChange={(e) => setTemplateDraft({ ...templateDraft, isActive: e.target.checked })} /> активен</label>
              </div>
              <button className={btnPrimary} disabled={busy || !(templateDraft.body || templateDraft.text)} onClick={saveTemplate}>Сохранить шаблон</button>
            </div>
          ) : null}
          <div className={tableWrap}>
            <table className="w-full text-left text-sm">
              <thead><tr>{['Шаблон', 'Сценарий', 'Сегмент', 'Статус', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {overview.templates.map((t) => (
                  <tr key={t.id} className={trow}>
                    <td className={td}><div className="font-semibold text-slate-800">{t.name}</div><div className="max-w-md truncate text-[11px] text-slate-400">{t.body || t.text}</div></td>
                    <td className={`${td} text-xs`}>{t.scenarioKey || '—'}</td>
                    <td className={`${td} text-xs`}>{t.targetSegment || 'all'}</td>
                    <td className={td}><StatusBadge status={t.isActive ? 'active' : 'archived'} /></td>
                    <td className={`${td} space-x-2`}><button className={btnGhost} onClick={() => setTemplateDraft(t)}>Открыть</button><button className={btnGhost} disabled={busy} onClick={async () => { if (!window.confirm('Удалить шаблон?')) return; setBusy(true); try { await admin2.deleteNotificationTemplate(t.id); await loadNotifications(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>Удалить</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────── Support ──────────────────────────────
function SupportSection({ me }: { me: AdminMe }) {
  const [rows, setRows] = useState<AdminTicketRow[] | null>(null);
  const [filter, setFilter] = useState('open');
  const [sel, setSel] = useState<AdminTicketDetail | null>(null);
  const [reply, setReply] = useState(''); const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const canAct = me.permissions.includes('support.act');
  const load = () => admin2.listTickets(filter).then((d) => setRows(d.tickets)).catch((e) => setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  const open = async (id: number) => { setError(null); try { setSel(await admin2.getTicket(id)); } catch (e: any) { setError(e.message); } };
  const act = async (fn: () => Promise<any>) => { setBusy(true); setError(null); try { await fn(); await load(); if (sel) await open(sel.ticket.id); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-1.5">
        {[['open', 'Открытые'], ['pending', 'В ожидании'], ['closed', 'Закрытые'], ['all', 'Все']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === v ? 'bg-[#8C57FF] text-white' : 'bg-white text-slate-500'}`}>{l}</button>
        ))}
      </div>
      {sel ? (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between">
            <div><p className="font-bold text-[#312D4B]">{sel.ticket.subject}</p><p className="text-xs text-slate-400">#{sel.ticket.id} · {sel.ticket.userName || sel.ticket.userId || 'гость'}</p></div>
            <div className="flex items-center gap-2"><StatusBadge status={sel.ticket.status} /><button className={btnGhost} onClick={() => setSel(null)}>Закрыть</button></div>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
            {sel.messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.authorType === 'admin' ? 'ml-auto bg-[#8C57FF] text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
                {m.internal ? <span className="mr-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">внутр.</span> : null}{m.body}
              </div>
            ))}
            {sel.messages.length === 0 ? <p className="text-xs text-slate-400">Нет сообщений</p> : null}
          </div>
          {canAct ? (
            <div className="space-y-2">
              <textarea className={`${inputCls} h-20 w-full`} placeholder="Ответ пользователю…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> внутренняя заметка</label>
                <button className={btnPrimary} disabled={busy || reply.trim().length < 1} onClick={() => act(async () => { await admin2.replyTicket(sel.ticket.id, reply.trim(), internal); setReply(''); })}>Ответить</button>
                <button className={btnGhost} disabled={busy} onClick={() => act(() => admin2.setTicketStatus(sel.ticket.id, 'closed'))}>Закрыть тикет</button>
                <button className={btnGhost} disabled={busy} onClick={() => act(() => admin2.setTicketStatus(sel.ticket.id, 'open'))}>Открыть</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead><tr>{['Тема', 'Юзер', 'Сообщ.', 'Статус', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(rows || []).map((t) => (
              <tr key={t.id} className={trow}>
                <td className={`${td} font-semibold text-[#312D4B]`}>{t.subject}</td>
                <td className={`${td} text-xs`}>{t.userName || t.userId || 'гость'}</td>
                <td className={`${td} text-xs`}>{t.messages}</td>
                <td className={td}><StatusBadge status={t.status} /></td>
                <td className={td}><button className={btnGhost} onClick={() => open(t.id)}>Открыть</button></td>
              </tr>
            ))}
            {rows && rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Тикетов нет</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────── Settings (feature flags) ──────────────────────────────
function SettingsSection() {
  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [nk, setNk] = useState(''); const [nv, setNv] = useState('false'); const [nd, setNd] = useState('');
  const load = () => admin2.listFlags().then((d) => { setFlags(d.flags); setDrafts(Object.fromEntries(d.flags.map((f) => [f.key, JSON.stringify(f.value)]))); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const save = async (key: string, raw: string, description?: string) => {
    let value: any;
    try { value = JSON.parse(raw); } catch { setError(`Некорректный JSON для ${key} (примеры: true, false, 30, "текст")`); return; }
    setBusy(true); setError(null);
    try { await admin2.setFlag(key, value, description); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <p className="text-[13px] text-slate-500">Feature flags управляют поведением приложения в рантайме. Уже работает <b className="text-slate-700">ai_generation_enabled</b> — глобальный рубильник AI-чата (off → честный нон-AI ответ). Значение — JSON (<code>true</code>, <code>false</code>, число, строка).</p>
      <Card title="Новый флаг">
        <div className="flex flex-wrap items-end gap-2">
          <input className={`${inputCls} w-44`} placeholder="ключ (a-z 0-9 _)" value={nk} onChange={(e) => setNk(e.target.value)} />
          <input className={`${inputCls} w-28`} placeholder="JSON" value={nv} onChange={(e) => setNv(e.target.value)} />
          <input className={`${inputCls} flex-1`} placeholder="описание" value={nd} onChange={(e) => setNd(e.target.value)} />
          <button className={btnPrimary} disabled={busy || nk.trim().length < 2} onClick={async () => { await save(nk.trim(), nv, nd); setNk(''); setNv('false'); setNd(''); }}>Добавить</button>
        </div>
      </Card>
      <div className="space-y-2">
        {(flags || []).map((f) => (
          <div key={f.key} className={`${card} flex flex-wrap items-center gap-2`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#312D4B]">{f.key}</p>
              {f.description ? <p className="text-[12px] text-slate-400">{f.description}</p> : null}
            </div>
            <input className={`${inputCls} w-40 font-mono text-xs`} value={drafts[f.key] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))} />
            <button className={btnPrimary} disabled={busy} onClick={() => save(f.key, drafts[f.key] ?? '', f.description || undefined)}>Сохранить</button>
            <button className={btnGhost} disabled={busy} onClick={async () => { if (window.confirm(`Удалить флаг ${f.key}?`)) { setBusy(true); try { await admin2.deleteFlag(f.key); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } } }}>Удалить</button>
          </div>
        ))}
        {flags && flags.length === 0 ? <Card><p className="text-center text-sm text-slate-400">Флагов нет</p></Card> : null}
      </div>
    </div>
  );
}

// ────────────────────────────── Shell ──────────────────────────────
export const AdminApp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<Admin2Error | Error | null>(null);
  const [booting, setBooting] = useState(true);
  const [active, setActive] = useState<SectionId>('dashboard');
  const [navOpen, setNavOpen] = useState(false);

  const loadMe = () => {
    setBooting(true);
    setError(null);
    admin2.me()
      .then(setMe)
      .catch((e) => {
        setMe(null);
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => setBooting(false));
  };

  useEffect(() => { loadMe(); }, []);
  const visible = useMemo(() => (me ? NAV.filter((s) => me.permissions.includes(s.perm)) : []), [me]);
  useEffect(() => { if (visible.length && !visible.some((s) => s.id === active)) setActive(visible[0].id); }, [visible, active]);

  const go = (id: SectionId) => { setActive(id); setNavOpen(false); };
  const activeLabel = visible.find((s) => s.id === active)?.label || 'Админка';
  const authMode = admin2Auth.hasTelegramAuth() ? 'Telegram' : admin2Auth.getStoredDevAuth() ? 'Browser-dev' : 'Нет доступа';

  if (!me && !booting) {
    return <AdminAccessScreen error={error} busy={booting} onRetry={loadMe} onClose={onClose} />;
  }

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
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 sm:inline-flex">{authMode}</span>
            <button className={btnGhost} disabled={booting} onClick={loadMe}>{booting ? 'Проверяю…' : 'Проверить доступ'}</button>
            <button className={btnGhost} onClick={onClose}>В приложение</button>
          </div>
        </header>

        {error ? <div className="p-4"><ErrorNote>{error.message}</ErrorNote></div> : null}

        {me ? (
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {active === 'dashboard' && <DashboardSection />}
            {active === 'users' && <UsersSection me={me} />}
            {active === 'charts' && <ChartsSection me={me} />}
            {active === 'billing' && <BillingSection me={me} />}
            {active === 'cms' && <ContentSection me={me} />}
            {active === 'ai' && <PromptsSection me={me} />}
            {active === 'comms' && <CommsSection />}
            {active === 'support' && <SupportSection me={me} />}
            {active === 'roles' && <RolesSection />}
            {active === 'audit' && <AuditSection />}
            {active === 'settings' && <SettingsSection />}
          </main>
        ) : <p className="p-6 text-sm text-slate-400">Загрузка…</p>}
      </div>
    </div>
  );
};

export default AdminApp;
