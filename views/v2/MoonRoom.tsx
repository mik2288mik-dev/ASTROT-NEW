import React, { useEffect, useMemo, useState } from 'react';
import {
  LUNAR_CATEGORIES,
  SIGNS_IN,
  VERDICT_LABEL,
  bestDays,
  buildLunarDays,
  operationsFor,
  phaseName,
  type LunarCategoryKey,
  type LunarDay,
} from '../../lib/lunarCalendar';
import { hasActivePremium } from '../../lib/accessMatrix';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';

let engineModule: Promise<typeof import('astronomy-engine')> | null = null;

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const VERDICT_CLASS = ['is-bad', 'is-ok', 'is-good'] as const;

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** Лунные календари: сегодня по делам, месяц по выбранному делу, лучшие дни. */
export function MoonRoom({ profile, onBack, onRequestPremium }: { profile: UserProfile; onBack: () => void; onRequestPremium: () => void }) {
  const [days, setDays] = useState<LunarDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<LunarCategoryKey>('garden');
  const [operationId, setOperationId] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const plus = hasActivePremium(profile);
  const today = todayKey();

  useEffect(() => {
    let active = true;
    engineModule ??= import('astronomy-engine');
    engineModule.then((engine) => {
      if (!active) return;
      const now = new Date();
      // Two full months: this one and the next, so the switch works without waiting.
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 2, 1));
      setDays(buildLunarDays(engine, start, Math.round((end.getTime() - start.getTime()) / 86_400_000)));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const todayDay = days?.find((day) => day.dayKey === today) ?? null;
  const current = LUNAR_CATEGORIES.find((item) => item.key === category) ?? LUNAR_CATEGORIES[0];
  const locked = category !== 'garden' && !plus;
  const shownMonth = todayDay ? ((todayDay.month - 1 + monthOffset) % 12) + 1 : new Date().getMonth() + 1;
  const operations = operationsFor(category, todayDay?.month ?? new Date().getMonth() + 1);
  const operation = operations.find((item) => item.id === operationId) ?? operations[0] ?? null;
  const monthDays = useMemo(() => (days ?? []).filter((day) => day.month === shownMonth), [days, shownMonth]);
  const nextBest = useMemo(
    () => (operation && days ? bestDays(operation, days.filter((day) => day.dayKey >= today), 5) : []),
    [operation, days, today],
  );
  const picked = monthDays.find((day) => day.dayKey === pickedKey) ?? null;

  const todayRows = todayDay ? operations.map((op) => ({ op, verdict: op.evaluate(todayDay) })) : [];
  const visibleRows = showAll ? todayRows : todayRows.slice(0, 4);

  const chooseCategory = (key: LunarCategoryKey) => {
    setCategory(key);
    setOperationId('');
    setPickedKey(null);
    setShowAll(false);
  };

  const dayLabel = (day: LunarDay) => `${day.day} ${MONTHS_GENITIVE[day.month - 1]}`;

  return (
    <div className="fresh-page nebo-moon">
      <AppTopBar title="Лунные календари" onBack={onBack} />
      <div className="nebo-page-title">
        <h1>Лунные календари</h1>
        <p>Сад, стрижка, здоровье, дела и дом по фазам Луны</p>
      </div>

      {failed ? <p className="nebo-moon-note" role="alert">Не получилось посчитать Луну. Открой экран ещё раз.</p> : null}
      {!days && !failed ? <p className="nebo-moon-note" role="status">Считаем Луну…</p> : null}

      {todayDay ? (
        <div className="nebo-moon-hero">
          <strong>{phaseName(todayDay.phase)}</strong>
          <span>Луна {SIGNS_IN[todayDay.sign]}, {todayDay.waxing ? 'растёт' : 'убывает'}</span>
          {todayDay.mercuryRetrograde ? <span className="nebo-moon-retro">Меркурий ретроградный: договоры лучше перечитывать дважды</span> : null}
        </div>
      ) : null}

      <div className="nebo-moon-cats" role="tablist">
        {LUNAR_CATEGORIES.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={item.key === category} className={item.key === category ? 'is-active' : ''} onClick={() => chooseCategory(item.key)}>
            {item.name}
            {item.key !== 'garden' && !plus ? <small>Plus</small> : null}
          </button>
        ))}
      </div>
      <p className="nebo-moon-sub">{current.text}</p>

      {todayDay ? (
        <section className="nebo-moon-card">
          <h2>Сегодня, {dayLabel(todayDay)}</h2>
          {visibleRows.length ? visibleRows.map(({ op, verdict }) => (
            <button key={op.id} type="button" className="nebo-moon-row" onClick={() => { setOperationId(op.id); setPickedKey(null); }}>
              <span className="nebo-moon-row-copy">
                <strong>{op.name}</strong>
                <small>{op.hint}</small>
                <em>{verdict[1]}</em>
              </span>
              <span className={`nebo-moon-pill ${VERDICT_CLASS[verdict[0]]}`}>{VERDICT_LABEL[verdict[0]]}</span>
            </button>
          )) : <p className="nebo-moon-note">В этом месяце для этого раздела дел нет.</p>}
          {todayRows.length > 4 ? (
            <button type="button" className="nebo-moon-more" onClick={() => setShowAll((value) => !value)}>
              {showAll ? 'Свернуть' : `Ещё ${todayRows.length - 4}`}
            </button>
          ) : null}
        </section>
      ) : null}

      {operation && days ? (
        <section className="nebo-moon-card">
          <h2>{operation.name}</h2>
          <div className="nebo-moon-chips">
            {operations.map((op) => (
              <button key={op.id} type="button" className={op.id === operation.id ? 'is-active' : ''} onClick={() => { setOperationId(op.id); setPickedKey(null); }}>{op.name}</button>
            ))}
          </div>

          <div className="nebo-moon-months">
            {[0, 1].map((offset) => {
              const month = ((todayDay ? todayDay.month - 1 : new Date().getMonth()) + offset) % 12;
              return <button key={offset} type="button" className={monthOffset === offset ? 'is-active' : ''} onClick={() => { setMonthOffset(offset); setPickedKey(null); }}>{MONTHS[month]}</button>;
            })}
          </div>

          <div className={locked ? 'nebo-moon-grid-wrap is-locked' : 'nebo-moon-grid-wrap'}>
            <div className="nebo-moon-weekdays" aria-hidden>{WEEKDAYS.map((name) => <span key={name}>{name}</span>)}</div>
            <div className="nebo-moon-grid">
              {monthDays.length ? Array.from({ length: monthDays[0].weekday }, (_, i) => <span key={`gap-${i}`} />) : null}
              {monthDays.map((day) => {
                const verdict = operation.evaluate(day);
                const cls = `nebo-moon-cell ${VERDICT_CLASS[verdict[0]]}${day.dayKey === today ? ' is-today' : ''}${day.dayKey === pickedKey ? ' is-picked' : ''}`;
                return (
                  <button key={day.dayKey} type="button" className={cls} disabled={locked} onClick={() => setPickedKey(day.dayKey)} aria-label={`${dayLabel(day)}: ${VERDICT_LABEL[verdict[0]]}`}>
                    {day.day}
                  </button>
                );
              })}
            </div>
            {locked ? (
              <button type="button" className="nebo-moon-unlock" onClick={onRequestPremium}>Открыть месяц с NEBO Plus</button>
            ) : null}
          </div>

          <div className="nebo-moon-legend" aria-hidden>
            <span className="is-good">Хорошо</span><span className="is-ok">Можно</span><span className="is-bad">Не стоит</span>
          </div>

          {picked && !locked ? (
            <div className="nebo-moon-pick">
              <strong>{dayLabel(picked)}: {VERDICT_LABEL[operation.evaluate(picked)[0]]}</strong>
              <p>{operation.evaluate(picked)[1]}.</p>
              <small>Луна {SIGNS_IN[picked.sign]}, {phaseName(picked.phase).toLowerCase()}.</small>
            </div>
          ) : null}

          {!locked && nextBest.length ? (
            <div className="nebo-moon-best">
              <h3>Ближайшие хорошие дни</h3>
              <div className="nebo-moon-best-list">
                {nextBest.map((day) => (
                  <button key={day.dayKey} type="button" onClick={() => { setMonthOffset(day.month === shownMonth ? monthOffset : 1 - monthOffset); setPickedKey(day.dayKey); }}>
                    {dayLabel(day)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <p className="nebo-moon-foot">Это народные лунные традиции, а не наука. Для интереса и в помощь выбору, но не вместо врача, садовода или здравого смысла.</p>
    </div>
  );
}
