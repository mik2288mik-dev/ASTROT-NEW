import React, { useEffect, useMemo, useState } from 'react';
import type { ForecastSection } from '../../lib/personalForecastContract';
import { buildLunarDays, phaseName, SIGNS_IN, type LunarDay } from '../../lib/lunarCalendar';
import { cardImage, cardOfTheDay } from '../../lib/tarot';
import { runeOfTheDay } from '../../lib/runes';
import { parseBirthDate, personalDayNumber } from '../../lib/numerology';

const DAY_TITLES: Record<number, string> = {
  1: 'День начал', 2: 'День договорённостей', 3: 'День общения', 4: 'День порядка', 5: 'День перемен',
  6: 'День близких', 7: 'День тишины', 8: 'День результатов', 9: 'День итогов', 11: 'День озарений', 22: 'День больших дел',
};
import { chineseAdjective, chineseSign } from '../../lib/chineseZodiac';
import { CardOfDayOverlay } from './CardOfDayOverlay';

let engineModule: Promise<typeof import('astronomy-engine')> | null = null;

const firstSentence = (text: string) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  const match = /^(.+?[.!?])(\s|$)/.exec(clean);
  return (match ? match[1] : clean).replace(/[.!?]$/, '');
};

/** «Сегодня да / Не стоит» from the forecast itself: what each open section says to do or to avoid. */
export function TodayYesNo({ sections, lockedIds }: { sections: ForecastSection[]; lockedIds: Set<string> }) {
  const { yes, no } = useMemo(() => {
    const open = sections.filter((section) => section.status === 'ready' && !lockedIds.has(section.id));
    const yesList: string[] = [];
    const noList: string[] = [];
    for (const section of open) {
      const action = section.actionText?.trim();
      if (action) (section.actionType === 'stop' ? noList : yesList).push(firstSentence(action));
      for (const block of section.contentBlocks || []) {
        const text = (block as { text?: string }).text?.trim();
        if (block.role === 'risk' && text) noList.push(firstSentence(text));
      }
    }
    const unique = (list: string[]) => [...new Set(list)].filter((item) => item.length > 3 && item.length < 90).slice(0, 4);
    return { yes: unique(yesList), no: unique(noList) };
  }, [sections, lockedIds]);
  if (!yes.length && !no.length) return null;
  return (
    <section className="nebo-yn" aria-label="Что делать сегодня">
      <div className="nebo-yn-col">
        <span className="nebo-tile-kicker"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>Сегодня да</span>
        {yes.map((item) => <span key={item} className="nebo-yn-item is-yes">{item}</span>)}
        {!yes.length ? <span className="nebo-yn-item is-empty">Обычный день, без особых советов</span> : null}
      </div>
      <div className="nebo-yn-col is-no">
        <span className="nebo-tile-kicker"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>Не стоит</span>
        {no.map((item) => <span key={item} className="nebo-yn-item is-no">{item}</span>)}
        {!no.length ? <span className="nebo-yn-item is-empty">Особых запретов сегодня нет</span> : null}
      </div>
    </section>
  );
}

/** «Настроение сейчас»: the mood section of today's forecast, opens to the full text. */
export function TodayMood({ sections, lockedIds }: { sections: ForecastSection[]; lockedIds: Set<string> }) {
  const [open, setOpen] = useState(false);
  const mood = sections.find((section) => section.fixedKey === 'mood' && section.status === 'ready' && !lockedIds.has(section.id) && section.text.trim());
  if (!mood) return null;
  return (
    <button type="button" className="nebo-mood" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span className="nebo-mood-face" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round"><circle cx="16" cy="16" r="13" /><path d="M11 13h.01M21 13h.01M11 21.5c2.8-2 7.2-2 10 0" /></svg>
      </span>
      <span className="nebo-mood-copy">
        <span className="nebo-tile-kicker">Настроение сейчас</span>
        <strong>{open ? mood.text : firstSentence(mood.text)}</strong>
      </span>
      <svg className={open ? 'nebo-mood-chev is-open' : 'nebo-mood-chev'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

const dayKeyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Moon calendars, card of the day, number of the day and rune of the day, as on the canvas. */
export function TodayTiles({ userId, birthDate, onOpenMoon, onOpenTarot, onOpenNumbers, onOpenRunes }: {
  userId: string;
  birthDate: string;
  onOpenMoon?: () => void;
  onOpenTarot?: () => void;
  onOpenNumbers?: () => void;
  onOpenRunes?: () => void;
}) {
  const [moon, setMoon] = useState<LunarDay | null>(null);
  const today = useMemo(() => new Date(), []);
  const dayKey = dayKeyOf(today);
  const card = useMemo(() => cardOfTheDay(userId, dayKey), [userId, dayKey]);
  const rune = useMemo(() => runeOfTheDay(userId, dayKey), [userId, dayKey]);
  const birth = useMemo(() => parseBirthDate(birthDate), [birthDate]);
  const dayNumber = birth ? personalDayNumber(birth, today.getFullYear(), today.getMonth() + 1, today.getDate()) : null;
  const cardSeenKey = `nebo.today.card.v1:${userId}:${dayKey}`;
  const [cardSeen, setCardSeen] = useState(false);

  useEffect(() => {
    try { setCardSeen(window.localStorage.getItem(cardSeenKey) === '1'); } catch { /* storage may be unavailable */ }
  }, [cardSeenKey]);

  useEffect(() => {
    let active = true;
    engineModule ??= import('astronomy-engine');
    engineModule.then((engine) => {
      const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      if (active) setMoon(buildLunarDays(engine, start, 1)[0] ?? null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [today]);

  const illumination = moon ? Math.round(((1 - Math.cos((moon.phase * Math.PI) / 180)) / 2) * 100) : null;
  const [cardOpen, setCardOpen] = useState(false);
  const openCard = () => setCardOpen(true);
  const closeCard = (opened: boolean) => {
    setCardOpen(false);
    if (!opened) return;
    try { window.localStorage.setItem(cardSeenKey, '1'); } catch { /* storage may be unavailable */ }
    setCardSeen(true);
  };

  return (
    <div className="nebo-tiles">
      <button type="button" className="nebo-tile is-tall" onClick={onOpenMoon} disabled={!onOpenMoon}>
        <span className="nebo-tile-kicker"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>Лунные календари</span>
        <span className="nebo-tile-moon"><img src="/assets/auth/moon.webp" alt="" width={44} height={44} /><strong>{moon ? phaseName(moon.phase) : 'Луна'}</strong></span>
        <span className="nebo-tile-note">{moon ? `Луна ${SIGNS_IN[moon.sign]}` : 'Считаем Луну…'}</span>
        <span className="nebo-tile-foot">{illumination !== null ? `Освещена на ${illumination}%` : ''}</span>
        <TileChevron />
      </button>
      {cardOpen ? <CardOfDayOverlay card={card} onClose={closeCard} onOpenTarot={onOpenTarot ? () => { closeCard(true); onOpenTarot(); } : undefined} /> : null}
      <button type="button" className="nebo-tile is-tall is-card" onClick={openCard}>
        <span className="nebo-tile-kicker"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z" /></svg>Карта дня</span>
        {cardSeen ? (
          <>
            <span className="nebo-tile-card-face" style={{ backgroundImage: `url(${cardImage(card)})` }} aria-hidden="true" />
            <span className="nebo-tile-card-name">{card.name}</span>
            <span className="nebo-tile-foot is-strong">{card.keyword}</span>
          </>
        ) : (
          <>
            <span className="nebo-tile-tarot-word" aria-hidden="true">ТАРО</span>
            <span className="nebo-tile-card-back is-a" aria-hidden="true" />
            <span className="nebo-tile-card-back is-b" aria-hidden="true" />
            <span className="nebo-tile-foot is-accent">Открой карту дня сейчас!</span>
          </>
        )}
      </button>
      <button type="button" className="nebo-tile" onClick={onOpenNumbers} disabled={!onOpenNumbers || dayNumber === null}>
        <span className="nebo-tile-kicker"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h15M3.5 15h15" /></svg>Число дня</span>
        <span className="nebo-tile-number" aria-hidden="true">{dayNumber ?? '·'}</span>
        <span className="nebo-tile-foot is-strong">{dayNumber !== null ? DAY_TITLES[dayNumber] ?? '' : 'Нужна дата рождения'}</span>
      </button>
      <button type="button" className="nebo-tile" onClick={onOpenRunes} disabled={!onOpenRunes}>
        <span className="nebo-tile-kicker"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3.5v17M8 5l7 4.5L8 14" /></svg>Руна дня</span>
        <span className="nebo-tile-stone" aria-hidden="true"><b>{rune.glyph}</b></span>
        <span className="nebo-tile-foot is-strong">{rune.name} · {rune.keyword.toLowerCase()}</span>
      </button>
    </div>
  );
}

function TileChevron() {
  return <svg className="nebo-tile-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;
}

export type TodayPromo = { id: string; kicker: string; title: string; text: string; glyph: string; onOpen: () => void };

/** The rotating «Новое в NEBO» card with dots. */
export function TodayPromoCarousel({ birthDate, items }: { birthDate: string; items: TodayPromo[] }) {
  const [index, setIndex] = useState(0);
  const sign = chineseSign(birthDate);
  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 6500);
    return () => window.clearInterval(timer);
  }, [items.length]);
  if (!items.length) return null;
  const item = items[index % items.length];
  const text = item.id === 'chinese' && sign ? `Ты ${chineseAdjective(sign)} по году рождения: что это значит и чего ждать от 2026` : item.text;
  return (
    <section className="nebo-promo" aria-roledescription="carousel" aria-label="Новое в NEBO">
      <button type="button" className="nebo-promo-card" onClick={item.onOpen} key={item.id}>
        <span className="nebo-promo-glyph" aria-hidden="true">{item.glyph}</span>
        <span className="nebo-promo-copy">
          <span className="nebo-tile-kicker">{item.kicker}</span>
          <strong>{item.title}</strong>
          <small>{text}</small>
        </span>
        <TileChevron />
      </button>
      <span className="nebo-promo-dots" aria-hidden="true">
        {items.map((other, i) => <i key={other.id} className={i === index % items.length ? 'is-on' : ''} />)}
      </span>
    </section>
  );
}

/** «Добавь время и город»: shown while the birth time is unknown. */
export function TodayNatalInvite({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="nebo-natal-invite">
      <span className="nebo-natal-invite-art" aria-hidden="true"><svg width="54" height="54" viewBox="0 0 54 54" fill="none" stroke="#0b0d12" strokeWidth="1.4"><circle cx="27" cy="27" r="24" /><circle cx="27" cy="27" r="15" /><path d="M27 3v48M3 27h48M10 10l34 34M44 10L10 44" opacity=".35" /></svg></span>
      <span className="nebo-natal-invite-copy">
        <span className="nebo-tile-kicker">Натальная карта</span>
        <strong>Добавь время и город</strong>
        <small>Посчитаем профессионально за пару секунд</small>
      </span>
      <button type="button" onClick={onAdd}>Добавить</button>
    </section>
  );
}

export function TodayTomorrowNote() {
  return (
    <p className="nebo-tomorrow">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4zM10 20h4" /></svg>
      Завтра в 7:00 откроется новый день
    </p>
  );
}
