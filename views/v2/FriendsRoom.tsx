import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Copy, MessageSquare, Plus, Send, Share2 } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate, getCompatScore } from '../../lib/synastry/compatScore';
import { ZODIAC_KEYS } from '../../lib/zodiacKeys';
import { buildLunarDays, type LunarDay } from '../../lib/lunarCalendar';
import { cardOfTheDay } from '../../lib/tarot';
import {
  addFriend, deleteFriend, friendErrorText, inviteLink, loadFriends, loadMessages, postMessage, setNotifyMessages,
  type Friend, type FriendMessage, type FriendsState,
} from '../../services/friendsService';

let engineModule: Promise<typeof import('astronomy-engine')> | null = null;
const TINTS = ['#ffd9c2', '#cdeee0', '#dcdcff', '#ffe9b8', '#d6ecff', '#f4d8ff'];
const tint = (id: string) => TINTS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];

/** A friend's day in one line: the Moon today against their Sun sign. Calculated on the device. */
function dayLine(friendSign: string | null, moon: LunarDay | null): string | null {
  if (!friendSign || !moon) return null;
  const sun = ZODIAC_KEYS.findIndex((key) => key.toLowerCase() === friendSign);
  if (sun < 0) return null;
  const diff = (moon.sign - sun + 12) % 12;
  if (moon.sign % 4 === sun % 4) return 'Хороший день, с ним легко договориться';
  if (diff === 3 || diff === 9) return 'Мало сил, лучше не нагружать делами';
  if (diff === 6) return 'День острый, лучше без споров';
  return 'Обычный день, без резких поворотов';
}

type Stage = { kind: 'list' } | { kind: 'add' } | { kind: 'profile'; friend: Friend } | { kind: 'chat'; friend: Friend };

export function FriendsRoom({ profile, onBack, onRequestPremium, onOpenCompatibility }: {
  profile: UserProfile; onBack: () => void; onRequestPremium: () => void; onOpenCompatibility: () => void;
}) {
  const [state, setState] = useState<FriendsState | null>(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'list' });
  const [moon, setMoon] = useState<LunarDay | null>(null);
  const plus = hasActivePremium(profile);
  const mySign = sunSignFromDate(profile.birthDate);

  const refresh = useCallback(() => {
    loadFriends().then((next) => { setState(next); setError(''); }).catch((reason) => setError(friendErrorText(String(reason?.message))));
  }, []);

  useEffect(() => {
    refresh();
    engineModule ??= import('astronomy-engine');
    engineModule.then((engine) => {
      const now = new Date();
      setMoon(buildLunarDays(engine, new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())), 1)[0] ?? null);
    }).catch(() => undefined);
  }, [refresh]);

  const unreadTotal = state?.friends.reduce((sum, friend) => sum + friend.unread, 0) ?? 0;
  const back = () => {
    if (stage.kind === 'chat') setStage({ kind: 'profile', friend: stage.friend });
    else if (stage.kind !== 'list') { setStage({ kind: 'list' }); refresh(); }
    else onBack();
  };

  if (stage.kind === 'add') return <AddFriend code={state?.code ?? null} onBack={back} onAdded={(next) => { setState(next); setStage({ kind: 'list' }); }} />;
  if (stage.kind === 'chat') return <Chat friend={stage.friend} profile={profile} onBack={back} />;
  if (stage.kind === 'profile') {
    const friend = state?.friends.find((item) => item.id === stage.friend.id) ?? stage.friend;
    const friendSign = sunSignFromDate(friend.birthDate);
    const compat = mySign && friendSign ? getCompatScore(mySign, friendSign).overall : null;
    const line = plus ? dayLine(friendSign, moon) : null;
    const first = friend.name.split(/\s+/)[0];
    return (
      <div className="fresh-page nebo-friends">
        <AppTopBar title={first} onBack={back} />
        <section className="nebo-friend-head">
          <span className="nebo-friend-avatar is-big" style={{ background: tint(friend.id) }}>{first.charAt(0).toUpperCase()}</span>
          <span><strong>{friend.name}</strong><small>{friendSign ? getZodiacSign('ru', friendSign) : 'Знак неизвестен'}</small></span>
        </section>
        <div className="nebo-friend-chips">
          {line ? <span className="is-day">{line}</span> : <button type="button" className="is-day is-locked" onClick={onRequestPremium}>Какой у {first} сегодня день, видно в Plus</button>}
          {compat !== null ? <span className="is-compat">Вместе: {compat}%</span> : null}
        </div>
        {compat !== null ? <p className="nebo-friend-note">{getCompatScore(mySign!, friendSign!).verdictNote}</p> : null}
        <button type="button" className="nebo-period-cta nebo-friend-write" onClick={() => setStage({ kind: 'chat', friend })}>
          <MessageSquare size={18} aria-hidden /> Написать {first}
        </button>
        <div className="nebo-friend-actions">
          <button type="button" onClick={onOpenCompatibility}>Совместимость</button>
          <button type="button" onClick={() => { if (window.confirm(`Убрать ${first} из твоих людей?`)) { void deleteFriend(friend.id).then((next) => { setState(next); setStage({ kind: 'list' }); }); } }}>Убрать из списка</button>
        </div>
        <section className="nebo-notif-list nebo-friend-prefs">
          <h2 className="nebo-notif-head">Уведомления про {first}</h2>
          <div className="nebo-notif-row">
            <span><strong>Новые сообщения</strong><small>Когда {first} напишет тебе</small></span>
            <button
              type="button"
              role="switch"
              aria-checked={friend.notifyMessages}
              aria-label="Новые сообщения"
              className={'settings-switch' + (friend.notifyMessages ? ' settings-switch--on' : '')}
              onClick={() => {
                const next = !friend.notifyMessages;
                setState((current) => current ? { ...current, friends: current.friends.map((item) => item.id === friend.id ? { ...item, notifyMessages: next } : item) } : current);
                void setNotifyMessages(friend.id, next).catch(() => refresh());
              }}
            >
              <span aria-hidden />
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fresh-page nebo-friends">
      <AppTopBar title="Мои люди" onBack={back} />
      <div className="nebo-friends-top">
        <button type="button" className="nebo-friends-invite" onClick={() => setStage({ kind: 'add' })}><Plus size={18} aria-hidden /> Позвать друга</button>
        <span className="nebo-friends-unread"><MessageSquare size={16} aria-hidden /> Сообщения {unreadTotal ? <b>{unreadTotal}</b> : null}</span>
      </div>
      {error ? <p className="nebo-shop-note is-alert" role="alert">{error}</p> : null}
      {!state && !error ? <p className="nebo-period-loading" role="status">Загружаем твоих людей…</p> : null}
      {state && !state.friends.length ? (
        <div className="nebo-friends-empty">
          <img src="/assets/rest/friends_hero.webp" alt="" width={140} height={140} />
          <strong>Здесь будут твои люди</strong>
          <p>Позови друга по коду или ссылке. Вы сможете переписываться, делиться картой дня и видеть, насколько вы совпадаете.</p>
        </div>
      ) : null}
      {state?.friends.length ? (
        <div className="nebo-friends-list">
          {state.friends.map((friend) => {
            const sign = sunSignFromDate(friend.birthDate);
            const line = plus ? dayLine(sign, moon) : null;
            const first = friend.name.split(/\s+/)[0];
            return (
              <button key={friend.id} type="button" className="nebo-friends-row" onClick={() => setStage({ kind: 'profile', friend })}>
                <span className="nebo-friend-avatar" style={{ background: tint(friend.id) }}>{first.charAt(0).toUpperCase()}</span>
                <span className="nebo-friends-copy">
                  <strong>{first} <small>{sign ? getZodiacSign('ru', sign) : ''}</small></strong>
                  <em>{friend.lastMessage ? `${friend.lastMessage.mine ? 'Ты: ' : ''}${friend.lastMessage.body}` : line || 'Напиши первым'}</em>
                </span>
                {friend.unread ? <b className="nebo-friends-badge">{friend.unread}</b> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {!plus && state?.friends.length ? (
        <button type="button" className="nebo-friends-plus" onClick={onRequestPremium}><span>Plus</span> С Plus видно, какой сегодня день у каждого друга</button>
      ) : null}
    </div>
  );
}

function AddFriend({ code, onBack, onAdded }: { code: string | null; onBack: () => void; onAdded: (state: FriendsState) => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const link = code ? inviteLink(code) : '';
  const share = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setNote('Скопировано'); }
    } catch { /* the person closed the share sheet */ }
  };
  const submit = async () => {
    if (busy || !value.trim()) return;
    setBusy(true);
    setNote('');
    try { onAdded(await addFriend(value)); } catch (reason) { setNote(friendErrorText(String((reason as Error)?.message))); } finally { setBusy(false); }
  };
  return (
    <div className="fresh-page nebo-friends">
      <AppTopBar title="Добавить друга" onBack={onBack} />
      <section className="nebo-friend-code">
        <small>Твой код</small>
        <strong>{code || '…'}</strong>
        <p>Назови код другу. Он введёт его у себя в NEBO и сразу появится в твоих людях.</p>
        <button type="button" onClick={() => { if (code) void share(code); }} disabled={!code}><Copy size={15} aria-hidden /> Скопировать код</button>
      </section>
      <section className="nebo-friend-box">
        <h2 className="nebo-notif-head">Позвать по ссылке</h2>
        <div className="nebo-friend-link"><span>{link || '…'}</span></div>
        <button type="button" className="nebo-period-cta" disabled={!code} onClick={() => void share(`Добавляйся ко мне в NEBO, будем смотреть, какой у нас день и насколько мы совпадаем: ${link}`)}>
          <Share2 size={17} aria-hidden /> Отправить ссылку
        </button>
      </section>
      <section className="nebo-friend-box">
        <h2 className="nebo-notif-head">Добавить по коду друга</h2>
        <div className="nebo-friend-add">
          <input value={value} onChange={(event) => setValue(event.target.value.toUpperCase())} placeholder="Например, NEBO-7316" aria-label="Код друга" autoCapitalize="characters" />
          <button type="button" onClick={() => void submit()} disabled={busy || !value.trim()}>{busy ? '…' : 'Добавить'}</button>
        </div>
        {note ? <p className="nebo-shop-note" role="status">{note}</p> : null}
      </section>
    </div>
  );
}

function Chat({ friend, profile, onBack }: { friend: Friend; profile: UserProfile; onBack: () => void }) {
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const lastId = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const first = friend.name.split(/\s+/)[0];
  const todayKey = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, []);

  useEffect(() => {
    let active = true;
    const pull = () => loadMessages(friend.id, lastId.current).then(({ messages: fresh }) => {
      if (!active || !fresh.length) return;
      lastId.current = fresh[fresh.length - 1].id;
      setMessages((current) => [...current, ...fresh.filter((item) => !current.some((other) => other.id === item.id))]);
    }).catch((reason) => { if (active) setError(friendErrorText(String(reason?.message))); });
    void pull();
    const timer = window.setInterval(() => { void pull(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [friend.id]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length]);

  const send = async (card?: { kicker: string; title: string }) => {
    const body = card ? card.title : text.trim();
    if (!body) return;
    setError('');
    try {
      const { message } = await postMessage(friend.id, body, card);
      lastId.current = Math.max(lastId.current, message.id);
      setMessages((current) => [...current, message]);
      if (!card) setText('');
    } catch (reason) {
      setError(friendErrorText(String((reason as Error)?.message)));
    }
  };
  const card = cardOfTheDay(String(profile.id || 'guest'), todayKey);

  return (
    <div className="nebo-chat">
      <header className="nebo-chat-bar">
        <button type="button" onClick={onBack} aria-label="Назад"><ChevronLeft size={22} aria-hidden /></button>
        <span className="nebo-friend-avatar is-small" style={{ background: tint(friend.id) }}>{first.charAt(0).toUpperCase()}</span>
        <strong>{first}</strong>
      </header>
      <div className="nebo-chat-list" ref={listRef}>
        {!messages.length ? <p className="nebo-chat-empty">Напиши {first} первым. Можно поделиться своей картой дня.</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={`nebo-chat-msg${message.mine ? ' is-mine' : ''}`}>
            {message.kind === 'card' ? (
              <span className="nebo-chat-card"><small>{message.payload?.kicker || 'Карта дня'}</small><b>{message.payload?.title || message.body}</b></span>
            ) : <p>{message.body}</p>}
            <time>{new Date(message.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        ))}
      </div>
      {error ? <p className="nebo-shop-note is-alert" role="alert">{error}</p> : null}
      <button type="button" className="nebo-chat-share" onClick={() => void send({ kicker: 'Моя карта дня', title: `${card.name}: ${card.keyword.toLowerCase()}` })}>Поделиться картой дня</button>
      <form className="nebo-chat-input" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <input value={text} onChange={(event) => setText(event.target.value.slice(0, 1000))} placeholder="Сообщение" aria-label="Сообщение" />
        <button type="submit" disabled={!text.trim()} aria-label="Отправить"><Send size={18} aria-hidden /></button>
      </form>
    </div>
  );
}
