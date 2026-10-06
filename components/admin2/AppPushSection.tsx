import React, { useEffect, useState } from 'react';
import {
  admin2,
  type AdminAppPushDraft,
  type AdminAppPushMessage,
  type AdminAppPushOverview,
  type AdminAppPushRoute,
} from '../../services/admin2Service';
import { ADMIN_PUSH_PRESETS, SIGN_FORMS_RU } from '../../lib/nativePushCopy';
import { APP_PUSH_BODY_MAX, APP_PUSH_TITLE_MAX } from '../../lib/appPushLimits';
import {
  APP_ENTRY_ANNOUNCEMENT_FLAG,
  APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH,
  APP_ENTRY_ANNOUNCEMENT_MAX_TITLE_LENGTH,
  readAppEntryAnnouncement,
} from '../../lib/appEntryAnnouncement';
import { ZODIAC_SIGNS } from '../../lib/zodiac-utils';

const card = 'admin2-card';
const btnPrimary = 'admin2-button admin2-button--primary';
const btnGhost = 'admin2-button admin2-button--secondary';
const inputCls = 'admin2-input';

const ROUTES: Array<[AdminAppPushRoute, string]> = [
  ['today', 'Сегодня (личный прогноз)'],
  ['horoscope', 'Гороскоп по знакам'],
  ['compatibility', 'Совместимость'],
  ['natal', 'Натальная карта'],
];
const AUDIENCE_LABEL: Record<AdminAppPushMessage['audience'], string> = { all: 'Всем', user: 'Пользователю', sign: 'Знаку' };

function fmt(value: string | null): string {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); } catch { return value; }
}
function status(message: AdminAppPushMessage): string {
  if (message.cancelledAt) return 'отменено';
  const now = Date.now();
  if (message.sendAt && Date.parse(message.sendAt) > now) return 'запланировано';
  if (message.expiresAt && Date.parse(message.expiresAt) <= now) return 'завершено';
  return 'рассылается';
}

/** Ручные уведомления в Android-приложение + сообщение при входе. */
export function AppPushSection() {
  const [overview, setOverview] = useState<AdminAppPushOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState<AdminAppPushRoute>('today');
  const [audience, setAudience] = useState<AdminAppPushDraft['audience']>('me');
  const [target, setTarget] = useState('');
  const [sign, setSign] = useState<string>(ZODIAC_SIGNS[0]);
  const [sendAt, setSendAt] = useState('');
  const [ttlHours, setTtlHours] = useState(48);

  const load = () => admin2.appPush().then(setOverview).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);

  const send = async () => {
    setError(null); setNotice(null);
    if (audience === 'all' && !window.confirm('Отправить уведомление ВСЕМ пользователям Android?')) return;
    setBusy(true);
    try {
      await admin2.sendAppPush({
        title, body, route, audience, ttlHours,
        target: audience === 'user' ? target : audience === 'sign' ? sign : undefined,
        sendAt: sendAt ? new Date(sendAt).toISOString() : null,
      });
      setNotice(sendAt
        ? 'Запланировано. Телефоны заберут сообщение после указанного времени.'
        : 'Отправлено. Телефоны заберут его в течение пары часов (Android опрашивает сервер в фоне, вне тихих часов).');
      setTitle(''); setBody(''); setSendAt('');
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const cancel = async (id: number) => {
    if (!window.confirm('Отменить эту рассылку? Те, кто уже получил, её не потеряют.')) return;
    setBusy(true); setError(null);
    try { await admin2.cancelAppPush(id); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {error ? <div className="admin2-error" role="alert">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid grid-cols-3 gap-4">
        <div className={card}><p className="text-[26px] font-bold">{overview?.devices.total ?? '—'}</p><p className="text-[13px] text-slate-400">Устройств подключено</p></div>
        <div className={card}><p className="text-[26px] font-bold">{overview?.devices.active7d ?? '—'}</p><p className="text-[13px] text-slate-400">На связи за 7 дней</p></div>
        <div className={card}><p className="text-[26px] font-bold">{overview?.devices.users ?? '—'}</p><p className="text-[13px] text-slate-400">Пользователей</p></div>
      </div>

      <div className={card}>
        <p className="mb-1 text-base font-bold text-slate-800">Новое уведомление</p>
        <p className="mb-4 text-sm text-slate-500">
          Приходит на Android как обычный пуш. Автоматические (утренний гороскоп, «давно не заходил», праздники, ДР)
          работают сами, здесь только ручные.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ADMIN_PUSH_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className={btnGhost}
              onClick={() => { setTitle(preset.title); setBody(preset.body); setRoute(preset.route); }}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span>Заголовок <span className="text-slate-400">{title.length}/{APP_PUSH_TITLE_MAX}</span></span>
            <input className={inputCls} value={title} maxLength={APP_PUSH_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Доброе утро!" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Текст <span className="text-slate-400">{body.length}/{APP_PUSH_BODY_MAX}</span></span>
            <textarea className={inputCls} rows={3} value={body} maxLength={APP_PUSH_BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="Гороскоп на сегодня уже готов. Глянь, пока пьёшь кофе" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>Что откроется по нажатию</span>
              <select className={inputCls} value={route} onChange={(e) => setRoute(e.target.value as AdminAppPushRoute)}>
                {ROUTES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Кому</span>
              <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value as AdminAppPushDraft['audience'])}>
                <option value="me">Себе (тест)</option>
                <option value="user">Одному пользователю</option>
                <option value="sign">Всем одного знака</option>
                <option value="all">Всем</option>
              </select>
            </label>
            {audience === 'user' ? (
              <label className="grid gap-1 text-sm">
                <span>ID пользователя</span>
                <input className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" />
              </label>
            ) : null}
            {audience === 'sign' ? (
              <label className="grid gap-1 text-sm">
                <span>Знак</span>
                <select className={inputCls} value={sign} onChange={(e) => setSign(e.target.value)}>
                  {ZODIAC_SIGNS.map((item) => <option key={item} value={item}>{SIGN_FORMS_RU[item].pl}</option>)}
                </select>
              </label>
            ) : null}
            <label className="grid gap-1 text-sm">
              <span>Когда (пусто, сейчас)</span>
              <input className={inputCls} type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Актуально, часов</span>
              <input className={inputCls} type="number" min={1} max={168} value={ttlHours} onChange={(e) => setTtlHours(Number(e.target.value) || 48)} />
            </label>
          </div>
          <div>
            <button type="button" className={btnPrimary} disabled={busy || !title.trim() || !body.trim()} onClick={send}>
              {busy ? 'Минуту…' : sendAt ? 'Запланировать' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-bold text-slate-800">Отправленные</p>
          <button type="button" className={btnGhost} disabled={busy} onClick={() => void load()}>Обновить</button>
        </div>
        {!overview?.messages.length ? <p className="text-sm text-slate-400">Пока ничего не отправляли.</p> : (
          <div className="admin2-table-wrap">
            <table className="w-full text-sm">
              <thead><tr>
                <th className="admin2-table-heading">Сообщение</th>
                <th className="admin2-table-heading">Кому</th>
                <th className="admin2-table-heading">Когда</th>
                <th className="admin2-table-heading">Доставлено</th>
                <th className="admin2-table-heading">Статус</th>
                <th className="admin2-table-heading" />
              </tr></thead>
              <tbody>
                {overview.messages.map((m) => (
                  <tr key={m.id} className="border-t border-slate-50">
                    <td className="admin2-table-cell"><b>{m.title}</b><br /><span className="text-slate-500">{m.body}</span></td>
                    <td className="admin2-table-cell">{AUDIENCE_LABEL[m.audience]}{m.target ? ` · ${m.audience === 'sign' && m.target in SIGN_FORMS_RU ? SIGN_FORMS_RU[m.target as keyof typeof SIGN_FORMS_RU].pl : m.target}` : ''}</td>
                    <td className="admin2-table-cell">{fmt(m.sendAt)}</td>
                    <td className="admin2-table-cell">{m.delivered}</td>
                    <td className="admin2-table-cell">{status(m)}</td>
                    <td className="admin2-table-cell">{!m.cancelledAt && status(m) !== 'завершено'
                      ? <button type="button" className={btnGhost} disabled={busy} onClick={() => void cancel(m.id)}>Отменить</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntryAnnouncementCard />
    </div>
  );
}

/** Сервисное сообщение, которое показывается один раз при входе в приложение (флаг app_entry_announcement). */
function EntryAnnouncementCard() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [id, setId] = useState('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    admin2.listFlags().then(({ flags }) => {
      const value = flags.find((flag) => flag.key === APP_ENTRY_ANNOUNCEMENT_FLAG)?.value;
      if (!value || typeof value !== 'object') return;
      setTitle(typeof value.title === 'string' ? value.title : '');
      setMessage(typeof value.message === 'string' ? value.message : '');
      setId(typeof value.id === 'string' ? value.id : '');
      setLive(readAppEntryAnnouncement(value) !== null);
    }).catch(() => setNote('Нет доступа к настройкам (нужна роль Super Admin).'));
  }, []);

  const save = async (enabled: boolean) => {
    if (enabled && (!title.trim() || !message.trim())) { setNote('Заполни заголовок и текст.'); return; }
    setBusy(true); setNote(null);
    try {
      // Новый id при публикации — сообщение увидят и те, кто закрыл прошлое.
      const nextId = enabled ? `entry-${Date.now().toString(36)}` : id || `entry-${Date.now().toString(36)}`;
      await admin2.setFlag(APP_ENTRY_ANNOUNCEMENT_FLAG, { enabled, id: nextId, title: title.trim(), message: message.trim() },
        'Сообщение при входе в приложение');
      setId(nextId); setLive(enabled);
      setNote(enabled ? 'Опубликовано. Каждый увидит его один раз при следующем входе (до 30 сек на обновление).' : 'Снято с показа.');
    } catch (e: any) { setNote(e.message); } finally { setBusy(false); }
  };

  return (
    <div className={card}>
      <p className="mb-1 text-base font-bold text-slate-800">Сообщение при входе в приложение</p>
      <p className="mb-4 text-sm text-slate-500">
        Окно поверх приложения, показывается один раз каждому пользователю. Для тех.работ, важных новостей и т.п.
        Сейчас: <b>{live ? 'показывается' : 'выключено'}</b>.
      </p>
      <div className="grid gap-3">
        <input className={inputCls} value={title} maxLength={APP_ENTRY_ANNOUNCEMENT_MAX_TITLE_LENGTH} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" />
        <textarea className={inputCls} rows={4} value={message} maxLength={APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH} onChange={(e) => setMessage(e.target.value)} placeholder="Текст сообщения" />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save(true)}>Опубликовать</button>
          <button type="button" className={btnGhost} disabled={busy || !live} onClick={() => void save(false)}>Снять</button>
        </div>
        {note ? <p className="text-sm text-slate-500">{note}</p> : null}
      </div>
    </div>
  );
}

export default AppPushSection;
