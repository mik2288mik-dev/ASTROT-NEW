import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import {
  admin2,
  type AdminMe,
  type AdminPeopleSegment,
  type AdminPersonStory,
  type AdminStoryStep,
} from '../../../services/admin2Service';
import { ago, Card, dateTime, duration, Empty, ErrorBox, fmt, Loading, useLoad } from '../ui';

const SEGMENTS: Array<{ value: AdminPeopleSegment; label: string; hint: string }> = [
  { value: 'all', label: 'Все', hint: 'Все аккаунты' },
  { value: 'active', label: 'Заходили за неделю', hint: 'Любая активность за 7 дней' },
  { value: 'new', label: 'Новые', hint: 'Первый запуск за 7 дней' },
  { value: 'stuck', label: 'Без карты', hint: 'Пришли больше 2 часов назад и не получили карту' },
  { value: 'premium', label: 'Premium', hint: 'Premium действует сейчас' },
  { value: 'paying', label: 'Платили', hint: 'Хотя бы одна оплата' },
  { value: 'guests', label: 'Гости', hint: 'Не зарегистрировались' },
];

const TICKET_STATUS: Record<string, string> = { open: 'открыто', new: 'новое', in_progress: 'в работе', pending: 'ждёт ответа', resolved: 'решено', closed: 'закрыто' };

const KIND_LABEL: Record<AdminStoryStep['kind'], string> = {
  screen: 'Экран', action: 'Действие', wait: 'Ожидание', money: 'Деньги', error: 'Ошибка', reading: 'Карта', system: 'Приложение', onboarding: 'Знакомство',
};

export function PeopleSection({ me, source, query, onQueryConsumed }: {
  me: AdminMe; source: string; query: string | null; onQueryConsumed: () => void;
}) {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [segment, setSegment] = useState<AdminPeopleSegment>('active');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (query == null) return;
    setQ(query); setSubmitted(query); setSegment('all'); setOffset(0);
    if (/^-?\d{3,20}$/.test(query)) setSelected(query);
    onQueryConsumed();
  }, [query, onQueryConsumed]);

  const list = useLoad(() => admin2.people({ q: submitted, segment, offset, limit: 50 }), [submitted, segment, offset, source]);

  return (
    <div className={`adm-people ${selected ? 'has-selection' : ''}`}>
      <div className="adm-people-list">
        <form className="adm-search" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); setOffset(0); }}>
          <Search aria-hidden="true" />
          <label htmlFor="adm-people-q" className="sr-only">Найти по ID или имени</label>
          <input id="adm-people-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID или имя" />
          <button type="submit" className="adm-btn">Найти</button>
        </form>
        <div className="adm-chips adm-chips--scroll" role="group" aria-label="Кого показать">
          {SEGMENTS.map((s) => (
            <button key={s.value} type="button" title={s.hint} aria-pressed={segment === s.value} onClick={() => { setSegment(s.value); setOffset(0); }}>{s.label}</button>
          ))}
        </div>
        {list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : null}
        {!list.data && list.busy ? <Loading /> : null}
        {list.data ? (
          <>
            <p className="adm-muted">Найдено: {fmt(list.data.total)}</p>
            {list.data.rows.length ? (
              <ul className="adm-person-rows">
                {list.data.rows.map((row) => (
                  <li key={row.id}>
                    <button type="button" aria-current={selected === row.id ? 'true' : undefined} onClick={() => setSelected(row.id)}>
                      <span className="adm-person-main">
                        <strong>{row.name || (row.isGuest ? 'Гость' : 'Без имени')}</strong>
                        <small>ID {row.id} · {row.signIn}</small>
                      </span>
                      <span className="adm-person-badges">
                        {row.premiumUntil && new Date(row.premiumUntil) > new Date() ? <span className="adm-badge adm-badge--premium">Premium</span> : null}
                        {row.payments ? <span className="adm-badge">оплат {row.payments}</span> : null}
                        {!row.hasChart ? <span className="adm-badge adm-badge--warn">без карты</span> : null}
                      </span>
                      <span className="adm-person-meta"><span>{row.source}</span><span>{ago(row.lastSeenAt)}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Empty text="Никого не нашлось. Попробуй другой фильтр или запрос." />}
            <div className="adm-pager">
              <button type="button" className="adm-btn adm-btn--ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Назад</button>
              <span>{list.data.total ? `${offset + 1}–${Math.min(offset + 50, list.data.total)}` : ''}</span>
              <button type="button" className="adm-btn adm-btn--ghost" disabled={offset + 50 >= list.data.total} onClick={() => setOffset(offset + 50)}>Дальше</button>
            </div>
          </>
        ) : null}
      </div>
      <div className="adm-people-detail">
        {selected ? <PersonPanel key={`${selected}:${source}`} id={selected} me={me} readOnly={source === 'telegram'} onClose={() => setSelected(null)} />
          : <Empty text="Выбери человека слева: здесь появится вся его история по шагам." />}
      </div>
    </div>
  );
}

function PersonPanel({ id, me, readOnly, onClose }: { id: string; me: AdminMe; readOnly: boolean; onClose: () => void }) {
  const [pii, setPii] = useState(false);
  const [days, setDays] = useState(30);
  const story = useLoad(() => admin2.person(id, { days, pii }), [id, days, pii]);
  const can = (perm: string) => me.permissions.includes(perm);

  if (!story.data && story.busy) return <Loading text="Собираю историю…" />;
  if (!story.data) return <ErrorBox error={story.error} onRetry={story.reload} />;
  const { person, visits, money, account } = story.data;
  const premiumActive = !!person.premiumUntil && new Date(person.premiumUntil) > new Date();

  const act = async (run: () => Promise<unknown>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    try { await run(); story.reload(); } catch (error: any) { window.alert(error?.message || 'Не получилось'); }
  };

  return (
    <div className="adm-person" aria-busy={story.busy}>
      <button type="button" className="adm-btn adm-btn--ghost adm-person-back" onClick={onClose}><ArrowLeft aria-hidden="true" />К списку</button>
      <header className="adm-person-head">
        <div>
          <h2>{person.name || (person.isGuest ? 'Гость' : 'Без имени')}</h2>
          <p>ID {person.id}{person.isGuest ? ' · гость, не зарегистрирован' : ''}</p>
        </div>
        <div className="adm-person-badges">
          {premiumActive ? <span className="adm-badge adm-badge--premium">Premium до {dateTime(person.premiumUntil, true).split(',')[0]}</span> : <span className="adm-badge">бесплатный доступ</span>}
          {account?.isBlocked ? <span className="adm-badge adm-badge--bad">заблокирован</span> : null}
        </div>
      </header>

      <dl className="adm-facts">
        <div><dt>Откуда пришёл</dt><dd>{person.source}</dd></div>
        <div><dt>Как входит</dt><dd>{person.signInMethods.length ? person.signInMethods.join(', ') : person.signIn}</dd></div>
        <div><dt>Телефон</dt><dd>{person.device || 'не известно'}</dd></div>
        <div><dt>Версия приложения</dt><dd>{person.appVersion || 'не известно'}</dd></div>
        <div><dt>Первый запуск</dt><dd>{dateTime(person.createdAt, true)}</dd></div>
        <div><dt>Последний раз</dt><dd>{ago(person.lastSeenAt)}</dd></div>
        <div><dt>Натальных карт</dt><dd>{person.charts || 'нет'}</dd></div>
        <div><dt>Оплат</dt><dd>{person.payments || 'нет'}</dd></div>
        {person.city ? <div><dt>Город рождения</dt><dd>{person.city}</dd></div> : null}
      </dl>

      {!readOnly ? (
        <div className="adm-actions">
          {can('users.edit') ? (premiumActive
            ? <button type="button" className="adm-btn adm-btn--ghost" onClick={() => act(() => admin2.setPremium(id, 'revoke'), 'Забрать Premium у этого человека?')}>Забрать Premium</button>
            : <button type="button" className="adm-btn adm-btn--ghost" onClick={() => act(() => admin2.setPremium(id, 'grant', 30), 'Подарить Premium на 30 дней?')}>Подарить Premium на 30 дней</button>) : null}
          {can('users.block') && account ? (
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => act(() => admin2.patchUser(id, { isBlocked: !account.isBlocked }), account.isBlocked ? 'Разблокировать?' : 'Заблокировать? Человек не сможет войти.')}>
              {account.isBlocked ? 'Разблокировать' : 'Заблокировать'}
            </button>
          ) : null}
          {can('user.pii.view') && !pii ? <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setPii(true)}>Показать город и тексты вопросов</button> : null}
        </div>
      ) : <p className="adm-muted">Telegram-версия открыта только для просмотра.</p>}

      {money.length ? (
        <Card title="Покупки и подписка">
          <ul className="adm-plain-list">{money.map((item) => <li key={item.at + item.text}><time>{dateTime(item.at, true)}</time>{item.text}</li>)}</ul>
        </Card>
      ) : null}
      {person.supportTickets.length ? (
        <Card title="Обращения в поддержку">
          <ul className="adm-plain-list">{person.supportTickets.map((t) => <li key={t.id}><time>{dateTime(t.at, true)}</time>{t.subject} · {TICKET_STATUS[t.status] || t.status}</li>)}</ul>
        </Card>
      ) : null}

      <Card title="История по шагам" hint={`Каждый заход отдельно, самые новые сверху. Период: ${days} дней.`}
        action={<select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Период истории">
          <option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option><option value={180}>180 дней</option>
        </select>}>
        {visits.length ? (
          <ol className="adm-visits">
            {visits.map((visit, index) => <Visit key={visit.start} visit={visit} open={index === 0} />)}
          </ol>
        ) : <Empty text="За этот период ничего не записано." />}
      </Card>
    </div>
  );
}

function Visit({ visit, open }: { visit: AdminPersonStory['visits'][number]; open: boolean }) {
  const slow = visit.steps.filter((s) => s.slow).length;
  const errors = visit.steps.filter((s) => s.kind === 'error').length;
  return (
    <li>
      <details open={open}>
        <summary>
          <span className="adm-visit-time">{dateTime(visit.start)}</span>
          <span className="adm-visit-meta">{visit.seconds >= 60 ? duration(visit.seconds) : 'меньше минуты'} · шагов {visit.steps.length}
            {slow ? <em className="adm-visit-flag"> · долгих ожиданий {slow}</em> : null}
            {errors ? <em className="adm-visit-flag adm-visit-flag--bad"> · ошибок {errors}</em> : null}
          </span>
        </summary>
        <ol className="adm-steps">
          {visit.steps.map((step, i) => (
            <li key={`${step.at}:${i}`} data-kind={step.kind} data-slow={step.slow ? 'true' : undefined}>
              <time>{new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(step.at))}</time>
              <span className="adm-step-kind">{KIND_LABEL[step.kind]}</span>
              <span className="adm-step-text">{step.text}{step.note ? <small>{step.note}</small> : null}</span>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
