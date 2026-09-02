import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
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
    const sign = signLabel(data.sign, language);
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

function basisSummary(facts: readonly NatalEvidenceFact[], language: 'ru' | 'en'): string {
  const placements = facts.filter((fact) => fact.kind === 'placement').length;
  const aspects = facts.filter((fact) => fact.kind === 'aspect').length;
  const timeDependent = facts.some(isTimeDependentFact);

  if (language === 'en') {
    if (placements && aspects) {
      return 'This conclusion is not based on one label. NEBO combines several calculated placements with the links between them, then keeps only the facts allowed for this question.';
    }
    if (aspects) {
      return 'The conclusion comes from how several calculated parts of the chart interact, rather than from one isolated placement.';
    }
    if (placements) {
      return 'The conclusion uses several calculated placements that point in the same direction, rather than a generic sign description.';
    }
    if (timeDependent) {
      return 'This conclusion uses a reliable time-dependent part of the chart. Its dependence on birth time is explained below.';
    }
    return 'The conclusion is linked to calculated facts stored with this birth chart. Only facts allowed by the chart-quality check are used.';
  }

  if (placements && aspects) {
    return 'Этот вывод сделан не по одному признаку. NEBO сопоставляет несколько рассчитанных положений и связи между ними, а затем оставляет только то, что подходит к конкретному вопросу.';
  }
  if (aspects) {
    return 'Здесь важен не один показатель, а то, как несколько частей карты связаны между собой.';
  }
  if (placements) {
    return 'Вывод опирается на несколько рассчитанных положений, которые показывают одну и ту же особенность. Это не общий текст только по знаку зодиака.';
  }
  if (timeDependent) {
    return 'В выводе используется надёжная часть карты, которая зависит от времени рождения. Ниже указано, насколько сильно.';
  }
  return 'Вывод связан с рассчитанными данными этой карты. Всё, что не прошло проверку точности, в текст не попало.';
}

function reliabilityCopy(
  quality: 'exact' | 'approximate' | 'unknown',
  timeDependent: boolean,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (quality === 'exact') {
      return timeDependent
        ? 'The recorded birth time is treated as exact, so reliable houses and chart angles can be used. These are the parts most sensitive to a difference of several minutes.'
        : 'This conclusion mostly uses facts that do not change with a small difference of several minutes in birth time.';
    }
    if (quality === 'approximate') {
      return timeDependent
        ? 'Only houses and angles that remain stable across the entered time range are used here.'
        : 'This conclusion uses only facts that remain stable across the entered time range.';
    }
    return 'Birth time is unknown, so houses and chart angles are excluded. This conclusion uses only time-stable facts.';
  }

  if (quality === 'exact') {
    return timeDependent
      ? 'Время рождения отмечено как точное, поэтому здесь можно использовать надёжные дома и углы карты. Именно они сильнее всего меняются при разнице в несколько минут.'
      : 'Этот вывод в основном опирается на данные, которые не меняются из-за небольшой разницы во времени рождения.';
  }
  if (quality === 'approximate') {
    return timeDependent
      ? 'Здесь использованы только те дома и углы, которые не меняются во всём указанном диапазоне времени.'
      : 'Этот вывод использует только данные, которые остаются одинаковыми во всём указанном диапазоне времени.';
  }
  return 'Время рождения неизвестно, поэтому дома и углы карты исключены. Вывод построен только по данным, которые от времени не зависят.';
}

function accuracyDescription(
  quality: 'exact' | 'approximate' | 'unknown',
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (quality === 'exact') {
      return 'The date, place, and recorded time are used as entered. Planet positions are calculated first; houses and angles are added because an exact time is available. A difference of several minutes affects houses and angles much more than most planet positions.';
    }
    if (quality === 'approximate') {
      return 'NEBO recalculates the chart across the entered uncertainty range. A fact is used in the reading only when it stays the same throughout that range.';
    }
    return 'NEBO does not invent a noon birth time. It calculates the time-stable part of the chart and leaves out houses, Ascendant, MC, and other details that require a known time.';
  }

  if (quality === 'exact') {
    return 'Дата, место и сохранённое время используются как введены. Сначала рассчитываются положения планет, затем дома и углы карты. Разница в несколько минут сильнее влияет именно на дома и углы, а не на большинство положений планет.';
  }
  if (quality === 'approximate') {
    return 'NEBO пересчитывает карту во всём указанном диапазоне времени. В разбор попадает только то, что остаётся одинаковым во всех проверенных точках.';
  }
  return 'NEBO не подставляет выдуманные 12:00. Рассчитывается только часть карты, которая не зависит от точного часа, а дома, Асцендент, MC и другие чувствительные детали исключаются.';
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

  useEffect(() => {
    if (!target) return;
    headingRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleNativeBack = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail.handled) return;
      detail.handled = true;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack, true);
    };
  }, [onClose, target]);

  if (!target) return null;

  const quality = reliability.quality;
  const whyTarget: NatalExplanationTarget = {
    mode: 'why',
    title: target.title,
    text: target.text,
    evidenceIds: target.evidenceIds,
  };

  return (
    <div
      className="natal-v3-sheet-layer natal-v3-evidence-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
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
            <div className="natal-v3-explanation-section">
              <h3>{language === 'ru' ? 'Что проверяет система' : 'What the system checks'}</h3>
              <ul>
                <li>{language === 'ru' ? 'дата, место, координаты и исторический часовой пояс' : 'date, place, coordinates, and historical time zone'}</li>
                <li>{language === 'ru' ? 'какие положения и связи рассчитаны без ошибки' : 'which placements and links were calculated successfully'}</li>
                <li>{language === 'ru' ? 'какие детали меняются при погрешности времени' : 'which details change within the birth-time uncertainty'}</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="natal-v3-explanation-body">
            {target.text ? (
              <div className="natal-v3-explanation-claim">
                <p>{language === 'ru' ? 'Вывод' : 'Conclusion'}</p>
                <blockquote>{target.text}</blockquote>
              </div>
            ) : null}

            <div className="natal-v3-explanation-section">
              <h3>{language === 'ru' ? 'Простыми словами' : 'In plain language'}</h3>
              <p>{basisSummary(facts, language)}</p>
            </div>

            {labels.length > 0 ? (
              <div className="natal-v3-explanation-section">
                <h3>{language === 'ru' ? 'Что именно использовано' : 'What was used'}</h3>
                <ul className="natal-v3-evidence-summary-list">
                  {facts.slice(0, 4).map((fact) => (
                    <li key={fact.id}>
                      {fact.kind === 'aspect'
                        ? (language === 'ru' ? 'связь между частями карты' : 'a link between chart factors')
                        : fact.kind === 'house'
                          ? (language === 'ru' ? 'часть карты, связанная с жизненной областью' : 'a chart area tied to a life domain')
                          : fact.kind === 'angle'
                            ? (language === 'ru' ? 'чувствительная к времени точка карты' : 'a time-sensitive chart point')
                            : (language === 'ru' ? 'рассчитанное положение' : 'a calculated placement')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="natal-v3-accuracy-note">
              <h3>{language === 'ru' ? 'Насколько это зависит от времени рождения' : 'How much this depends on birth time'}</h3>
              <p>{reliabilityCopy(quality, timeDependent, language)}</p>
            </div>

            {labels.length > 0 ? (
              <details className="natal-v3-technical-disclosure">
                <summary>
                  <span>{language === 'ru' ? 'Показать данные карты' : 'Show chart data'}</span>
                  <ChevronDown aria-hidden="true" />
                </summary>
                <ul>
                  {labels.map((label) => <li key={label}>{label}</li>)}
                </ul>
              </details>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
};
