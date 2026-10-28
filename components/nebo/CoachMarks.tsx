import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { ViewState } from '../../types';

type Step = { selector: string | null; title: string; text: string; round?: boolean };

/** First-visit hints for each main screen, as on the canvas. A step without a selector is a centered note. */
const COACH_SETS: Partial<Record<ViewState, Step[]>> = {
  dashboard: [
    { selector: '.nebo-today-hero', title: 'Это твой день', text: 'Каждое утро новый и только твой: считаем по твоей дате рождения.' },
    { selector: '.nebo-today-cta-row', title: 'Прогноз на день', text: 'Нажми кнопку, чтобы прочитать личный прогноз на сегодня.' },
    { selector: '.nebo-period-switch', title: 'День, неделя, месяц, даты', text: 'Листай вперёд или найди хороший день для своего дела.', round: true },
    { selector: '.nebo-account-chip', title: 'Это ты в NEBO', text: 'Тут вход, настройки, тема и язык. Нажми, чтобы открыть профиль.', round: true },
    { selector: '.nebo-tabbar', title: 'Разделы внизу', text: 'Знаки для всех. В «Моей карте» карта, матрица, числа и таро. В «Совместимости» твои люди.', round: true },
    { selector: null, title: 'Здесь всё по-взрослому', text: 'Расчёт профессиональный, методики классические. Любую карту можно сверить с другими сервисами.' },
  ],
  horoscope: [
    { selector: '.horo-reader-article', title: 'Листай знаки', text: 'Нажми на знак, чтобы выбрать другой. Гороскоп по знакам открыт для всех.' },
    { selector: '.horo-period-tabs', title: 'Сегодня, завтра, неделя', text: 'Переключи период, и текст обновится сразу.', round: true },
    { selector: '.nebo-cn-modes', title: 'Зодиак и китайский', text: 'Рядом с зодиаком есть китайский гороскоп: твоё животное, годы и пара по году рождения.', round: true },
  ],
  chart: [
    { selector: '.nebo-mychart-whose', title: 'Своя карта или чужая', text: 'Читай свою карту или карту любого человека, как будто о нём рассказывает друг.' },
    { selector: '.nebo-mychart-switch', title: 'Карта, матрица, числа, таро, руны', text: 'Карта, матрица и числа считаются по дате рождения. Таро и руны ответят на любой вопрос.', round: true },
    { selector: null, title: 'Нажми на любую планету', text: 'Каждая точка на колесе открывается: что это и что значит для тебя.' },
  ],
  synastry: [
    { selector: null, title: 'Любые два человека', text: 'Ты и кто-то, или двое других. Сохранять никого не обязательно.' },
    { selector: null, title: 'Кто вы друг другу', text: 'Выбери тему: пара, друзья, родня, коллега или бизнес. От неё зависят вопросы в разборе.' },
  ],
  services: [
    { selector: '.nebo-rest-hero', title: 'Звуки для сна', text: 'Море, дождь, лес и музыка для сна. Нажми, и звук пойдёт сразу.' },
    { selector: '.nebo-shelf', title: 'Рассказы, тесты и дыхание', text: 'Без рекламы. Внизу ещё лунные календари для сада, стрижки и дел.' },
  ],
  moon: [
    { selector: '.nebo-moon-hero', title: 'Луна сегодня', text: 'Фаза и знак Луны. От них зависят правила в лунных календарях.' },
    { selector: '.nebo-moon-cats', title: 'Пять календарей', text: 'Сад и огород, стрижка, здоровье, дела и дом. Правила как в бумажных календарях.', round: true },
    { selector: '.nebo-moon-grid-wrap', title: 'Месяц вперёд', text: 'Хорошие дни подсвечены. Нажми на любой, чтобы увидеть подробности.' },
  ],
  tarot: [
    { selector: '.nebo-oracle-ask', title: 'Задай вопрос картам', text: 'Напиши, что тебя волнует, или выбери готовый вопрос.' },
    { selector: '.nebo-oracle-pick', title: 'Выбери расклад', text: 'Одна карта для быстрого ответа, три для ситуации.' },
  ],
};

const storageKey = (view: string) => `nebo.coach.v1:${view}`;

function wasSeen(view: string): boolean {
  try { return window.localStorage.getItem(storageKey(view)) === '1'; } catch { return true; }
}

function markSeen(view: string) {
  try { window.localStorage.setItem(storageKey(view), '1'); } catch { /* storage may be unavailable */ }
}

type Rect = { x: number; y: number; w: number; h: number };

/** One-time hints with a spotlight on the real element of the screen. */
export function CoachMarks({ view, enabled }: { view: ViewState; enabled: boolean }) {
  const steps = COACH_SETS[view] ?? null;
  const [active, setActive] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Start after the screen has settled, once per screen and device.
  useEffect(() => {
    setActive(null);
    setIndex(0);
    if (!enabled || !steps || wasSeen(view)) return undefined;
    const timer = window.setTimeout(() => { if (!wasSeen(view)) setActive(view); }, 1200);
    return () => window.clearTimeout(timer);
  }, [view, enabled, steps]);

  const step = active && steps ? steps[index] : null;

  const measure = useCallback(() => {
    if (!step?.selector) { setRect(null); return; }
    const element = document.querySelector<HTMLElement>(step.selector);
    if (!element) { setRect(null); return; }
    const box = element.getBoundingClientRect();
    setRect({ x: box.left, y: box.top, w: box.width, h: box.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return undefined;
    if (step.selector) document.querySelector<HTMLElement>(step.selector)?.scrollIntoView({ block: 'center', behavior: 'auto' });
    measure();
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', measure); };
  }, [step, measure]);

  if (!active || !steps || !step) return null;

  const close = () => { markSeen(active); setActive(null); };
  const next = () => { if (index < steps.length - 1) setIndex(index + 1); else close(); };
  const pad = 6;
  const below = rect ? rect.y + rect.h / 2 < window.innerHeight / 2 : false;
  const cardStyle: React.CSSProperties = rect
    ? (below ? { top: rect.y + rect.h + pad + 14 } : { bottom: window.innerHeight - rect.y + pad + 14 })
    : { top: '50%', transform: 'translateY(-50%)' };

  return (
    <div className="nebo-coach" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <span
          className="nebo-coach-spot"
          style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2, borderRadius: step.round ? 999 : 24 }}
        />
      ) : <span className="nebo-coach-dim" />}
      <div className="nebo-coach-card" style={cardStyle}>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
        <div className="nebo-coach-foot">
          <button type="button" className="nebo-coach-skip" onClick={close}>Пропустить</button>
          <span className="nebo-coach-dots" aria-hidden>
            {steps.map((_, i) => <i key={i} className={i === index ? 'is-on' : ''} />)}
          </span>
          <button type="button" className="nebo-coach-next" onClick={next}>{index === steps.length - 1 ? 'Понятно' : 'Дальше'}</button>
        </div>
      </div>
    </div>
  );
}
