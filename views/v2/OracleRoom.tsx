import React, { useCallback, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { MyChartHeader, type MyChartSegment } from '../../components/nebo/MyChartHeader';
import { useTelemetrySection } from '../../services/useAppTelemetry';
import { hasActivePremium } from '../../lib/accessMatrix';
import { hasEsoAccess } from '../../lib/oneTimeProducts';
import { buyOneTimeProduct, canBuyOneTimeProducts, spendSpreadCredit, usePurchases } from '../../services/oneTimePurchaseService';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  SPREAD_POSITIONS,
  TAROT_BACK,
  TAROT_QUESTIONS,
  cardImage,
  cardOfTheDay,
  drawSpread,
  weekKeyOf,
  type TarotCard,
} from '../../lib/tarot';
import { RUNE_QUESTIONS, drawRunes, runeOfTheDay, type Rune } from '../../lib/runes';

type Kind = 'tarot' | 'runes';
type Stage = 'home' | 'pick' | 'read' | 'day';

/** The common shape of a card and a rune: both name a theme and read it in three positions. */
type Omen = {
  key: string;
  name: string;
  keyword: string;
  day: string;
  past: string;
  now: string;
  next: string;
  advice: string;
  /** Tarot: roman numeral and optional painted face. Runes: the glyph. */
  mark: string;
  image: string | null;
};

const toOmen = (kind: Kind, item: TarotCard | Rune): Omen => (kind === 'tarot'
  ? { key: (item as TarotCard).slug, mark: (item as TarotCard).roman, image: cardImage(item as TarotCard), name: item.name, keyword: item.keyword, day: item.day, past: item.past, now: item.now, next: item.next, advice: item.advice }
  : { key: (item as Rune).slug, mark: (item as Rune).glyph, image: null, name: item.name, keyword: item.keyword, day: item.day, past: item.past, now: item.now, next: item.next, advice: item.advice });

const COPY = {
  tarot: {
    segment: 'tarot' as MyChartSegment,
    title: 'Таро',
    subtitle: 'Расклады на любой вопрос',
    heroTitle: 'Спроси о том, что важно',
    heroText: 'Три карты покажут, что было, что есть и к чему идёт.',
    dayTitle: 'Карта дня',
    dayText: 'Одна карта и совет на сегодня',
    pickTitle: 'Нажми на карты, которые тянут взгляд',
    pickText: 'Выбери три, и они откроются.',
    spreadName: 'Прошлое, сейчас, дальше',
    questions: TAROT_QUESTIONS,
    storage: 'nebo.tarot.week.v1',
  },
  runes: {
    segment: 'runes' as MyChartSegment,
    title: 'Руны',
    subtitle: 'Расклады на любой вопрос',
    heroTitle: 'Спроси руны',
    heroText: 'Три руны покажут, что было, что есть и к чему идёт.',
    dayTitle: 'Руна дня',
    dayText: 'Одна руна и совет на сегодня',
    pickTitle: 'Нажми на руны, которые тянут взгляд',
    pickText: 'Выбери три, и они откроются.',
    spreadName: 'Прошлое, сейчас, дальше',
    questions: RUNE_QUESTIONS,
    storage: 'nebo.runes.week.v1',
  },
} as const;

type WeekUse = { week: string; used: number };

function readWeekUse(storageKey: string, week: string): WeekUse {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null') as WeekUse | null;
    if (stored && stored.week === week && Number.isFinite(stored.used)) return stored;
  } catch { /* storage may be unavailable */ }
  return { week, used: 0 };
}

function writeWeekUse(storageKey: string, value: WeekUse) {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
}

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function Face({ kind, omen, size = 'm' }: { kind: Kind; omen: Omen; size?: 's' | 'm' | 'l' }) {
  if (kind === 'runes') {
    return (
      <span className={`nebo-oracle-stone is-${size}`} aria-hidden="true">
        <b>{omen.mark}</b>
      </span>
    );
  }
  return omen.image ? (
    <span className={`nebo-oracle-card is-${size}`}>
      <img src={omen.image} alt={`Карта «${omen.name}»`} loading="lazy" />
    </span>
  ) : (
    <span className={`nebo-oracle-card is-drawn is-${size}`} role="img" aria-label={`Карта «${omen.name}»`}>
      <i>{omen.mark}</i>
      <b>{omen.name}</b>
    </span>
  );
}

type OracleRoomProps = {
  kind: Kind;
  profile: UserProfile;
  onOpenSegment?: (segment: MyChartSegment) => void;
  onRequestPremium?: () => void;
};

export function OracleRoom({ kind, profile, onOpenSegment, onRequestPremium }: OracleRoomProps) {
  const copy = COPY[kind];
  const [stage, setStage] = useState<Stage>(() => {
    // The «Карта дня» tile on Today opens the card of the day directly.
    try {
      if (kind === 'tarot' && window.sessionStorage.getItem('nebo.open.tarot') === 'day') {
        window.sessionStorage.removeItem('nebo.open.tarot');
        return 'day';
      }
    } catch { /* storage may be unavailable */ }
    return 'home';
  });
  useTelemetrySection(kind, stage);
  const [question, setQuestion] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [spread, setSpread] = useState<Omen[]>([]);
  const [askedQuestion, setAskedQuestion] = useState('');
  const [locked, setLocked] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyNote, setBuyNote] = useState('');
  const [purchases] = usePurchases(profile.id ? String(profile.id) : undefined);
  const plus = hasActivePremium(profile) || hasEsoAccess(purchases);
  const now = useMemo(() => new Date(), []);
  const week = weekKeyOf(now);
  const userId = String(profile.id || 'guest');
  const todayOmen = useMemo(
    () => toOmen(kind, kind === 'tarot' ? cardOfTheDay(userId, dayKeyOf(now)) : runeOfTheDay(userId, dayKeyOf(now))),
    [kind, userId, now],
  );

  const goHome = useCallback(() => { setStage('home'); setPicked([]); setLocked(false); setBuyNote(''); }, []);

  const openPick = () => {
    setLocked(false);
    setBuyNote('');
    setPicked([]);
    setStage('pick');
  };

  // A bought spread: spend it on the server first, so it is never used twice.
  const openBoughtSpread = async () => {
    if (buying) return;
    setBuying(true);
    const ok = await spendSpreadCredit(userId).catch(() => false);
    setBuying(false);
    if (ok) openPick();
    else setBuyNote('Не получилось открыть купленный расклад. Проверь интернет и попробуй ещё раз.');
  };

  const buySpread = async () => {
    if (buying) return;
    setBuying(true);
    setBuyNote('');
    const result = await buyOneTimeProduct(userId, 'spread_one');
    setBuying(false);
    if (result.status === 'completed') { await openBoughtSpread(); return; }
    if (result.status === 'pending') setBuyNote('Оплата ещё проверяется. Расклад появится здесь, как только RuStore её подтвердит.');
    else if (result.status === 'failed' || result.status === 'unavailable') {
      setBuyNote(result.reason === 'RECOVERY_IDENTITY_REQUIRED'
        ? 'Чтобы покупка не потерялась, сначала привяжи вход через Яндекс, VK или почту в профиле.'
        : 'Покупка сейчас недоступна. Попробуй позже.');
    }
  };

  const startPick = () => {
    lumiaSelectionHaptic();
    const use = readWeekUse(copy.storage, week);
    // One spread a week is free; more come with NEBO Plus.
    if (use.used >= 1 && !plus) { setLocked(true); return; }
    openPick();
  };

  const pickSlot = (index: number) => {
    if (picked.includes(index) || picked.length >= 3) return;
    lumiaSelectionHaptic();
    const next = [...picked, index];
    setPicked(next);
    if (next.length === 3) {
      const drawn = kind === 'tarot' ? drawSpread() : drawRunes();
      setSpread(drawn.map((item) => toOmen(kind, item)));
      setAskedQuestion(question.trim());
      const use = readWeekUse(copy.storage, week);
      writeWeekUse(copy.storage, { week, used: use.used + 1 });
      window.setTimeout(() => setStage('read'), 650);
    }
  };

  const slots = Array.from({ length: kind === 'tarot' ? 11 : 12 }, (_, index) => index);

  const header = (
    <>
      <AppTopBar title={copy.title} />
      <MyChartHeader title={copy.title} subtitle={copy.subtitle} active={copy.segment} onOpen={(segment) => onOpenSegment?.(segment)} />
    </>
  );

  if (stage === 'day') {
    return (
      <div className={`fresh-page nebo-oracle is-${kind}`}>
        {header}
        <section className="nebo-oracle-day" aria-labelledby="nebo-oracle-day-title">
          <Face kind={kind} omen={todayOmen} size="l" />
          <p className="nebo-kicker">{copy.dayTitle}</p>
          <h2 id="nebo-oracle-day-title">{todayOmen.name}</h2>
          <p className="nebo-oracle-keyword">{todayOmen.keyword}</p>
          <p className="nebo-oracle-text">{todayOmen.day}</p>
          <p className="nebo-oracle-advice"><b>Совет на день.</b> {todayOmen.advice}</p>
          <button type="button" className="nebo-oracle-secondary" onClick={goHome}>Назад</button>
        </section>
      </div>
    );
  }

  if (stage === 'pick') {
    const left = 3 - picked.length;
    return (
      <div className={`nebo-oracle-night is-${kind}`}>
        <header className="nebo-oracle-night-bar">
          <button type="button" onClick={goHome} aria-label="Назад">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <strong>{kind === 'tarot' ? 'Расклад таро' : 'Расклад рун'}</strong>
          <span />
        </header>
        <section className="nebo-oracle-night-body" aria-labelledby="nebo-oracle-pick-title">
          <p className="nebo-oracle-night-kicker">{copy.spreadName}</p>
          <h2 id="nebo-oracle-pick-title">{left > 0 ? `Выбери ${left} ${kind === 'tarot' ? (left === 1 ? 'карту' : 'карты') : (left === 1 ? 'руну' : 'руны')}` : 'Открываем…'}</h2>
          {question.trim() ? <p className="nebo-oracle-night-question">«{question.trim()}»</p> : <p className="nebo-oracle-night-question">{copy.pickText}</p>}
          <div className="nebo-oracle-night-deck" role="group" aria-label="Колода">
            {slots.map((index) => {
              const chosen = picked.indexOf(index);
              return (
                <button
                  key={index}
                  type="button"
                  className={`nebo-oracle-night-card${chosen >= 0 ? ' is-chosen' : ''}`}
                  style={{ '--i': index, '--n': slots.length } as React.CSSProperties}
                  aria-pressed={chosen >= 0}
                  aria-label={chosen >= 0 ? `Выбрано: ${SPREAD_POSITIONS[chosen].label}` : 'Выбрать'}
                  onClick={() => pickSlot(index)}
                >
                  {kind === 'tarot' ? <img src={TAROT_BACK} alt="" loading="lazy" /> : <span className="nebo-oracle-stone is-m"><b>?</b></span>}
                </button>
              );
            })}
          </div>
          <div className="nebo-oracle-night-slots">
            {SPREAD_POSITIONS.map((position, index) => (
              <span key={position.id} className={index < picked.length ? 'is-filled' : ''}>
                <i>{index < picked.length ? (kind === 'tarot' ? <img src={TAROT_BACK} alt="" /> : <span className="nebo-oracle-stone is-s"><b>?</b></span>) : null}</i>
                <b>{position.label}</b>
              </span>
            ))}
          </div>
          <p className="nebo-oracle-night-left">{left > 0 ? `Ещё ${left}` : ''}</p>
        </section>
      </div>
    );
  }

  if (stage === 'read') {
    const last = spread[2];
    return (
      <div className={`fresh-page nebo-oracle is-${kind}`}>
        {header}
        <section className="nebo-oracle-read" aria-labelledby="nebo-oracle-read-title">
          <p className="nebo-kicker">{copy.spreadName}</p>
          <h2 id="nebo-oracle-read-title">{askedQuestion ? `«${askedQuestion}»` : 'Твой расклад'}</h2>
          <div className="nebo-oracle-row">
            {spread.map((omen, index) => (
              <div key={omen.key} className="nebo-oracle-pos">
                <span className="nebo-kicker">{SPREAD_POSITIONS[index].label}</span>
                <Face kind={kind} omen={omen} size="m" />
                <strong>{omen.name}</strong>
              </div>
            ))}
          </div>
          <div className="nebo-oracle-texts">
            {spread.map((omen, index) => {
              const id = SPREAD_POSITIONS[index].id;
              return (
                <article key={omen.key}>
                  <p className="nebo-kicker">{SPREAD_POSITIONS[index].label} · {omen.mark} · {omen.name}</p>
                  <p>{omen[id]}</p>
                </article>
              );
            })}
            {last ? <article className="is-advice"><p className="nebo-kicker">Что с этим делать</p><p>{last.advice}</p></article> : null}
          </div>
          <p className="nebo-oracle-note">Расклад показывает общий ход событий. Он не даёт ответа «да» или «нет» и не заменяет твоё решение.</p>
          <button type="button" className="nebo-oracle-primary" onClick={goHome}>Новый расклад</button>
        </section>
      </div>
    );
  }

  return (
    <div className={`fresh-page nebo-oracle is-${kind}`}>
      {header}

      <section className="nebo-oracle-hero">
        <div className="nebo-oracle-hero-copy">
          <p className="nebo-kicker">{copy.spreadName}</p>
          <h2>{copy.heroTitle}</h2>
          <p>{copy.heroText}</p>
        </div>
        <div className="nebo-oracle-hero-art" aria-hidden="true">
          {kind === 'tarot'
            ? (<><img src={TAROT_BACK} alt="" /><img src={TAROT_BACK} alt="" /></>)
            : (<><span className="nebo-oracle-stone is-m"><b>ᚨ</b></span><span className="nebo-oracle-stone is-m"><b>ᚱ</b></span></>)}
        </div>
      </section>

      <button type="button" className="nebo-oracle-day-row" onClick={() => { lumiaSelectionHaptic(); setStage('day'); }}>
        <Face kind={kind} omen={todayOmen} size="s" />
        <span>
          <strong>{copy.dayTitle}</strong>
          <small>{copy.dayText}</small>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>

      <section className="nebo-oracle-ask" aria-labelledby="nebo-oracle-ask-title">
        <h2 id="nebo-oracle-ask-title" className="nebo-kicker">Твой вопрос</h2>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, 200))}
          rows={3}
          placeholder="Напиши, что тебя волнует, или выбери готовый вопрос"
        />
        <div className="nebo-oracle-chips">
          {copy.questions.map((text) => (
            <button key={text} type="button" onClick={() => { lumiaSelectionHaptic(); setQuestion(text); }}>{text}</button>
          ))}
        </div>
      </section>

      {locked ? (
        <div className="nebo-oracle-lock" role="status">
          <Lock aria-hidden="true" size={18} />
          <p>Один расклад в неделю бесплатный, и на этой неделе он уже твой. Можно открыть ещё один расклад или все сразу с NEBO Plus.</p>
          {purchases.spreadCredits > 0 ? (
            <button type="button" onClick={() => { void openBoughtSpread(); }} disabled={buying}>
              Открыть купленный расклад (осталось {purchases.spreadCredits})
            </button>
          ) : canBuyOneTimeProducts() ? (
            <button type="button" onClick={() => { void buySpread(); }} disabled={buying}>{buying ? 'Открываем оплату…' : 'Один расклад за 99 ₽'}</button>
          ) : null}
          <button type="button" onClick={() => onRequestPremium?.()}>Открыть всё с Plus</button>
          {buyNote ? <p role="alert">{buyNote}</p> : null}
        </div>
      ) : null}

      <button type="button" className="nebo-oracle-primary" onClick={startPick}>
        Расклад «{copy.spreadName}»
      </button>
      <p className="nebo-oracle-note">{plus ? 'У тебя расклады без ограничений.' : 'Один расклад в неделю бесплатно. В Plus расклады без ограничений.'}</p>
    </div>
  );
}

export const TarotRoom = (props: Omit<OracleRoomProps, 'kind'>) => <OracleRoom kind="tarot" {...props} />;
export const RunesRoom = (props: Omit<OracleRoomProps, 'kind'>) => <OracleRoom kind="runes" {...props} />;
