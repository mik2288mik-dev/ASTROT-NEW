import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

type InboxMessage = { id: number; title: string; body: string; route: string; sentAt: string };

const seenKey = (userId: string) => `nebo.inbox.seen.v1:${userId || 'guest'}`;
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function whenLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (days <= 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

let cache: { key: string; messages: InboxMessage[] } | null = null;

/** The bell in the top bar and «Входящие»: messages from NEBO (sent from the admin panel) for this person. */
export function InboxButton({ userId, sign }: { userId: string; sign: string | null }) {
  const key = `${userId}:${sign || ''}`;
  const [messages, setMessages] = useState<InboxMessage[]>(() => (cache?.key === key ? cache.messages : []));
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    try { setSeen(Number(window.localStorage.getItem(seenKey(userId)) || 0)); } catch { /* storage may be unavailable */ }
    if (cache?.key === key) return;
    let active = true;
    void apiFetch(`/api/me/inbox${sign ? `?sign=${encodeURIComponent(sign)}` : ''}`, { method: 'GET' }, 10_000)
      .then((response) => (response.ok ? response.json() : { messages: [] }))
      .then((body) => {
        const list = Array.isArray(body?.messages) ? body.messages as InboxMessage[] : [];
        cache = { key, messages: list };
        if (active) setMessages(list);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [key, sign, userId]);

  const newest = messages[0]?.id ?? 0;
  const unread = newest > seen;
  const openInbox = () => {
    setOpen(true);
    setAll(false);
    if (newest) {
      try { window.localStorage.setItem(seenKey(userId), String(newest)); } catch { /* storage may be unavailable */ }
      setSeen(newest);
    }
  };
  const shown = all ? messages : messages.slice(0, 4);

  return (
    <>
      <button type="button" className="nebo-bell" onClick={openInbox} aria-label={unread ? 'Входящие, есть новые' : 'Входящие'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4zM10 20h4" /></svg>
        {unread ? <i className="nebo-bell-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="nebo-sheet-scrim" role="presentation" onClick={() => setOpen(false)}>
          <div className="nebo-inbox" role="dialog" aria-modal="true" aria-label="Входящие" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nebo-day-pop-close" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
            <img src="/assets/auth/mail.svg" alt="" width={80} height={80} className="nebo-inbox-art" />
            <h2>Входящие</h2>
            <p className="nebo-inbox-sub">Здесь сообщения от NEBO: важные даты, ответы на вопросы и новости.</p>
            {shown.length ? (
              <div className="nebo-inbox-list">
                {shown.map((message) => (
                  <div key={message.id} className="nebo-inbox-row">
                    <span>{whenLabel(message.sentAt)}</span>
                    <p><b>{message.title}</b>{message.body ? ` ${message.body}` : ''}</p>
                  </div>
                ))}
              </div>
            ) : <p className="nebo-inbox-empty">Пока сообщений нет. Когда NEBO напишет тебе о важной дате или новости, оно появится здесь.</p>}
            {messages.length > 4 && !all ? <button type="button" className="nebo-period-cta" onClick={() => setAll(true)}>Все сообщения</button> : null}
            <button type="button" className="nebo-inbox-close" onClick={() => setOpen(false)}>Закрыть</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
