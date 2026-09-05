import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import {
  buildNatalModelContext,
  getPermanentNatalReliability,
  type NatalEvidenceFact,
} from '../../lib/natalReading/permanentReport';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';

export type NatalExplanationMode = 'meaning' | 'why' | 'accuracy';

export type NatalExplanationTarget = {
  mode: NatalExplanationMode;
  title: string;
  text?: string;
  evidenceIds?: string[];
};

type Props = {
  target: NatalExplanationTarget | null;
  profile: UserProfile;
  chartData: NatalChartData;
  onClose: () => void;
  onShowWhy?: (target: NatalExplanationTarget) => void;
};

const SIGN_RU: Record<string, string> = {
  Aries: 'Овен',
  Taurus: 'Телец',
  Gemini: 'Близнецы',
  Cancer: 'Рак',
  Leo: 'Лев',
  Virgo: 'Дева',
  Libra: 'Весы',
  Scorpio: 'Скорпион',
  Sagittarius: 'Стрелец',
  Capricorn: 'Козерог',
  Aquarius: 'Водолей',
  Pisces: 'Рыбы',
};
const SIGN_IN_RU: Record<string, string> = {
  Aries: 'Овне', Taurus: 'Тельце', Gemini: 'Близнецах', Cancer: 'Раке',
  Leo: 'Льве', Virgo: 'Деве', Libra: 'Весах', Scorpio: 'Скорпионе',
  Sagittarius: 'Стрельце', Capricorn: 'Козероге', Aquarius: 'Водолее', Pisces: 'Рыбах',
};

const OBJECT_LABELS: Record<string, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  chiron: { ru: 'Хирон', en: 'Chiron' },
  northnode: { ru: 'Северный узел', en: 'North Node' },
  southnode: { ru: 'Южный узел', en: 'South Node' },
  ascendant: { ru: 'Асцендент', en: 'Ascendant' },
  rising: { ru: 'Асцендент', en: 'Ascendant' },
  mc: { ru: 'MC', en: 'MC' },
  descendant: { ru: 'Десцендент', en: 'Descendant' },
  ic: { ru: 'IC', en: 'IC' },
};

const ASPECT_LABELS: Record<string, { ru: string; en: string }> = {
  conjunction: { ru: 'соединение', en: 'conjunction' },
  sextile: { ru: 'секстиль', en: 'sextile' },
  square: { ru: 'квадрат', en: 'square' },
  trine: { ru: 'трин', en: 'trine' },
  opposition: { ru: 'оппозиция', en: 'opposition' },
};

function normalizedObjectKey(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLocaleLowerCase('en-US');
}

function objectLabel(value: unknown, language: 'ru' | 'en'): string {
  const raw = String(value || '').trim();
  const known = OBJECT_LABELS[normalizedObjectKey(raw)];
  return known?.[language] || raw;
}

function signLabel(value: unknown, language: 'ru' | 'en'): string {
  const raw = String(value || '').trim();
  if (!raw || language === 'en') return raw;
  const key = Object.keys(SIGN_RU).find(
    (candidate) => candidate.toLocaleLowerCase('en-US') === raw.toLocaleLowerCase('en-US'),
  );
  return key ? SIGN_RU[key] : raw;
}

function degreeLabel(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? `${Number(number.toFixed(2))}°` : '';
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function factData(fact: NatalEvidenceFact): Record<string, unknown> {
  return (fact.data || {}) as Record<string, unknown>;
}

export function formatNatalEvidenceLabel(
  fact: NatalEvidenceFact,
  language: 'ru' | 'en',
): string {
  const data = factData(fact);

  if (fact.kind === 'quality') {
    const quality = String(data.birthTimeQuality || 'unknown');
    if (language === 'ru') {
      if (quality === 'exact') return 'Время рождения указано точно';
      if (quality === 'approximate') return 'Время рождения указано приблизительно';
      return 'Время рождения неизвестно';
    }
    if (quality === 'exact') return 'Exact birth time';
    if (quality === 'approximate') return 'Approximate birth time';
    return 'Unknown birth time';
  }

  if (fact.kind === 'placement' || fact.kind === 'angle') {
    const object = objectLabel(data.key || data.object || fact.object, language);
    const signKey = Object.keys(SIGN_IN_RU).find((key) => key.toLowerCase() === String(data.sign || '').toLowerCase());
    const sign = language === 'ru' && signKey ? SIGN_IN_RU[signKey] : signLabel(data.sign, language);
    const degree = degreeLabel(data.degree);
    const house = positiveInteger(data.house);
    return [
      `${object}${sign ? ` ${language === 'ru' ? 'в' : 'in'} ${sign}` : ''}${degree ? `, ${degree}` : ''}`,
      house != null ? `${house} ${language === 'ru' ? 'дом' : 'house'}` : '',
      data.retrograde === true ? (language === 'ru' ? 'ретроградный' : 'retrograde') : '',
    ].filter(Boolean).join(' · ');
  }

  if (fact.kind === 'aspect') {
    const from = objectLabel(data.fromKey || data.from, language);
    const to = objectLabel(data.toKey || data.to, language);
    const aspectKey = String(data.type || '').toLocaleLowerCase('en-US');
    const aspect = ASPECT_LABELS[aspectKey]?.[language] || String(data.type || '').trim();
    const orb = degreeLabel(data.orb);
    return [
      [from, aspect, to].filter(Boolean).join(' '),
      orb ? `${language === 'ru' ? 'орб' : 'orb'} ${orb}` : '',
    ].filter(Boolean).join(' · ');
  }

  if (fact.kind === 'house') {
    const house = positiveInteger(data.house);
    const sign = signLabel(data.sign, language);
    const degree = degreeLabel(data.degree);
    return [
      house != null ? `${house} ${language === 'ru' ? 'дом' : 'house'}` : '',
      sign,
      degree,
    ].filter(Boolean).join(' · ');
  }

  return objectLabel(fact.object, language);
}

function aspectUsesAngle(fact: NatalEvidenceFact): boolean {
  if (fact.kind !== 'aspect') return false;
  const data = factData(fact);
  const values = [data.fromKey, data.from, data.toKey, data.to]
    .map(normalizedObjectKey);
  return values.some((value) => (
    value === 'ascendant'
    || value === 'rising'
    || value === 'mc'
    || value === 'descendant'
    || value === 'ic'
  ));
}

function isTimeDependentFact(fact: NatalEvidenceFact): boolean {
  if (fact.kind === 'angle' || fact.kind === 'house') return true;
  if (fact.kind === 'aspect') return aspectUsesAngle(fact);
  if (fact.kind === 'placement') return positiveInteger(factData(fact).house) != null;
  return false;
}

function reliabilityCopy(
  quality: 'exact' | 'approximate' | 'unknown',
  timeDependent: boolean,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (quality === 'exact') {
      return timeDependent
        ? 'Birth time is recorded as exact. Houses and angles are sensitive to its accuracy.'
        : 'Small differences in birth time do not change these facts.';
    }
    if (quality === 'approximate') {
      return 'Birth time is approximate. Only facts stable across that range are shown.';
    }
    return 'Birth time is unknown. Houses, Ascendant and MC are excluded.';
  }

  if (quality === 'exact') {
    return timeDependent
      ? 'Время указано точно. Дома и углы чувствительны к его погрешности.'
      : 'Небольшая погрешность времени рождения не меняет эти данные.';
  }
  if (quality === 'approximate') {
    return 'Время приблизительное. Показаны только данные, устойчивые в этом диапазоне.';
  }
  return 'Время рождения неизвестно. Дома, Асцендент и MC не используются.';
}

function accuracyDescription(
  quality: 'exact' | 'approximate' | 'unknown',
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (quality === 'exact') {
      return 'The saved birth time is used as entered. A difference of a few minutes mainly affects houses, Ascendant and MC.';
    }
    if (quality === 'approximate') {
      return 'Birth time is approximate. The reading uses details that remain stable across the entered time range.';
    }
    return 'Birth time is unknown. The reading leaves out houses, Ascendant, MC and other details that require a known time.';
  }

  if (quality === 'exact') {
    return 'Используется сохранённое время рождения. Погрешность в несколько минут влияет прежде всего на дома, Асцендент и MC.';
  }
  if (quality === 'approximate') {
    return 'Время приблизительное. Разбор использует только детали, устойчивые в указанном диапазоне времени.';
  }
  return 'Время рождения неизвестно. Дома, Асцендент, MC и другие детали, которым нужен точный час, в разбор не попадают.';
}

/** Native, non-passive move handling lets iOS keep normal body scrolling. */
export function bindNatalEvidenceSwipe(
  panel: HTMLElement,
  scrollBody: HTMLElement,
  onClose: () => void,
  reducedMotion: boolean,
): () => void {
  let gesture: { id: number; x: number; y: number; startedAt: number; distance: number; dragging: boolean } | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    gesture = null;
    panel.style.transition = reducedMotion ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
    panel.style.transform = '';
    panel.style.willChange = '';
  };
  const start = (event: TouchEvent) => {
    if (closeTimer) return;
    if (event.touches.length !== 1) { reset(); return; }
    const target = event.target as Element | null;
    if (target?.closest('button, a, input, textarea, select, summary')) return;
    if (scrollBody.contains(target) && scrollBody.scrollTop > 0) return;
    const touch = event.touches[0];
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, startedAt: event.timeStamp, distance: 0, dragging: false };
  };
  const move = (event: TouchEvent) => {
    if (!gesture) return;
    if (event.touches.length !== 1) { reset(); return; }
    const touch = Array.from(event.touches).find((item) => item.identifier === gesture?.id);
    if (!touch) { reset(); return; }
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (dy <= 0 || Math.abs(dx) >= dy || !event.cancelable) { reset(); return; }
      gesture.dragging = true;
      panel.style.transition = 'none';
      panel.style.willChange = 'transform';
    }
    if (event.cancelable) event.preventDefault();
    gesture.distance = Math.max(0, dy);
    panel.style.transform = `translateY(${gesture.distance}px)`;
  };
  const end = (event: TouchEvent) => {
    if (!gesture) return;
    const { distance, startedAt, dragging } = gesture;
    const velocity = distance / Math.max(1, event.timeStamp - startedAt);
    if (!dragging || (distance < 88 && !(distance >= 32 && velocity > 0.45))) { reset(); return; }
    gesture = null;
    if (reducedMotion) { onClose(); return; }
    panel.style.transition = 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)';
    panel.style.transform = `translateY(${panel.getBoundingClientRect().height + 24}px)`;
    closeTimer = setTimeout(onClose, 160);
  };
  panel.addEventListener('touchstart', start, { passive: true });
  panel.addEventListener('touchmove', move, { passive: false });
  panel.addEventListener('touchend', end, { passive: true });
  panel.addEventListener('touchcancel', reset, { passive: true });
  return () => {
    clearTimeout(closeTimer);
    panel.removeEventListener('touchstart', start);
    panel.removeEventListener('touchmove', move);
    panel.removeEventListener('touchend', end);
    panel.removeEventListener('touchcancel', reset);
    reset();
  };
}

export const NatalEvidenceSheet: React.FC<Props> = ({
  target,
  profile,
  chartData,
  onClose,
  onShowWhy,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const built = useMemo(
    () => buildNatalModelContext(profile, chartData),
    [chartData, profile],
  );
  const evidenceById = useMemo(
    () => new Map(built.context.evidence.map((fact) => [fact.id, fact])),
    [built],
  );
  const facts = useMemo(() => {
    const seen = new Set<string>();
    return (target?.evidenceIds || [])
      .map((id) => evidenceById.get(id))
      .filter((fact): fact is NatalEvidenceFact => {
        if (!fact || seen.has(fact.id)) return false;
        seen.add(fact.id);
        return true;
      });
  }, [evidenceById, target?.evidenceIds]);
  const labels = useMemo(
    () => [...new Set(facts.map((fact) => formatNatalEvidenceLabel(fact, language)).filter(Boolean))],
    [facts, language],
  );
  const reliability = getPermanentNatalReliability(chartData);
  const timeDependent = facts.some(isTimeDependentFact);
  const isOpen = target !== null;

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    if (!isOpen || !portalHost || !layerRef.current) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = Array.from(portalHost.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layerRef.current
        && !['SCRIPT', 'STYLE', 'LINK', 'META'].includes(element.tagName))
      .map((element) => ({ element, inert: element.getAttribute('inert'), ariaHidden: element.getAttribute('aria-hidden') }));
    headingRef.current?.focus({ preventScroll: true });
    for (const { element } of background) {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const dialog = panelRef.current;
        const controls = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]');
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (first && last && (document.activeElement === headingRef.current || !dialog?.contains(document.activeElement)
          || (event.shiftKey ? document.activeElement === first : document.activeElement === last))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    const handleNativeBack = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const { element, inert, ariaHidden } of background) {
        if (inert === null) element.removeAttribute('inert');
        else element.setAttribute('inert', inert);
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack, true);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [portalHost, isOpen]);

  useEffect(() => {
    if (!target || !portalHost || !panelRef.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
    return bindNatalEvidenceSwipe(panelRef.current, scrollRef.current, () => onCloseRef.current(),
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }, [portalHost, target]);

  if (!target) return null;

  const quality = reliability.quality;
  const whyTarget: NatalExplanationTarget = {
    mode: 'why',
    title: target.title,
    text: target.text,
    evidenceIds: target.evidenceIds,
  };

  const sheet = (
    <div
      ref={layerRef}
      className="natal-v3-sheet-layer natal-v3-evidence-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="natal-v3-sheet natal-v3-evidence-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="natal-v3-evidence-title"
      >
        <div className="natal-v3-sheet-handle" aria-hidden="true" />
        <button
          type="button"
          className="natal-v3-sheet-close"
          aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>

        <header className="natal-v3-sheet-heading">
          <p>
            {target.mode === 'meaning'
              ? (language === 'ru' ? 'Как это выглядит в жизни' : 'How this looks in life')
              : target.mode === 'accuracy'
                ? (language === 'ru' ? 'Точность карты' : 'Chart accuracy')
                : (language === 'ru' ? 'Почему так?' : 'Why this conclusion?')}
          </p>
          <h2 id="natal-v3-evidence-title" ref={headingRef} tabIndex={-1}>
            {target.title}
          </h2>
        </header>

        <div className="natal-v3-evidence-scroll" ref={scrollRef}>
        {target.mode === 'meaning' ? (
          <div className="natal-v3-explanation-body">
            <p className="natal-v3-explanation-lead">
              {target.text || (language === 'ru'
                ? 'Этот вывод описывает обычный способ действовать, а не одно обязательное событие.'
                : 'This conclusion describes a usual way of acting, not one guaranteed event.')}
            </p>
            {onShowWhy && (target.evidenceIds?.length || 0) > 0 ? (
              <button
                type="button"
                className="natal-v3-text-action"
                onClick={() => onShowWhy(whyTarget)}
              >
                {language === 'ru' ? 'Почему получился такой вывод' : 'Why this conclusion was made'}
              </button>
            ) : null}
          </div>
        ) : target.mode === 'accuracy' ? (
          <div className="natal-v3-explanation-body">
            <p className="natal-v3-explanation-lead">{accuracyDescription(quality, language)}</p>
          </div>
        ) : (
          <div className="natal-v3-explanation-body">
            {labels.length > 0 ? (
              <div className="natal-v3-explanation-section">
                <h3>{language === 'ru' ? 'Данные твоей карты' : 'Your chart data'}</h3>
                <ul className="natal-v3-evidence-summary-list">
                  {labels.map((label) => <li key={label}>{label}</li>)}
                </ul>
              </div>
            ) : <p className="natal-v3-explanation-lead">{language === 'ru'
              ? 'Для этого наблюдения не сохранилась ссылка на данные карты.'
              : 'The chart references for this observation are unavailable.'}</p>}

            <p className="natal-v3-accuracy-note">{reliabilityCopy(quality, timeDependent, language)}</p>

          </div>
        )}
        </div>
      </section>
    </div>
  );
  return portalHost ? createPortal(sheet, portalHost) : sheet;
};
