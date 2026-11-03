import React, { useEffect, useMemo, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { loadExploreCharts } from '../../components/PersonalForecastFeed/exploreCharts';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { MyChartHeader, type MyChartSegment } from '../../components/nebo/MyChartHeader';
import { useTelemetrySection } from '../../services/useAppTelemetry';
import { hasActivePremium } from '../../lib/accessMatrix';
import { hasEsoAccess } from '../../lib/oneTimeProducts';
import { usePurchases } from '../../services/oneTimePurchaseService';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  LIFE_PATH,
  NAME_NUMBER_INTRO,
  PERSONAL_DAY,
  PERSONAL_MONTH,
  PERSONAL_YEAR,
  SQUARE_CELLS,
  lifePathNumber,
  nameNumberText,
  nameNumbers,
  parseBirthDate,
  personalDayNumber,
  personalMonthNumber,
  personalYearNumber,
  pythagorasSquare,
  reduceNumber,
  squareSummary,
  squareTier,
} from '../../lib/numerology';

type NumerologyRoomProps = {
  profile: UserProfile;
  onOpenSegment?: (segment: MyChartSegment) => void;
  onRequestPremium?: () => void;
};

const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** «6 + 3 + 9 = 18 → 9»: how the life path number came out, so it is not a black box. */
function lifePathFormula(day: number, month: number, year: number): string {
  const parts = [reduceNumber(day, true), reduceNumber(month, true), reduceNumber(year, true)];
  const total = parts.reduce((sum, value) => sum + value, 0);
  const result = reduceNumber(total, true);
  return `${parts.join(' + ')} = ${total}${total === result ? '' : ` → ${result}`}`;
}

const MONTH_SHORT: Record<number, string> = { 1: 'начала', 2: 'терпение', 3: 'общение', 4: 'работа', 5: 'перемены', 6: 'семья', 7: 'тишина', 8: 'результаты', 9: 'итоги' };
const numberFamily = (n: number) => ([1, 5, 7].includes(n) ? 0 : [2, 4, 8].includes(n) ? 1 : 2);

export function NumerologyRoom({ profile, onOpenSegment, onRequestPremium }: NumerologyRoomProps) {
  useTelemetrySection('numbers', 'overview');
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [popup, setPopup] = useState<null | 'year' | 'pairs'>(null);
  const [people, setPeople] = useState<Array<{ name: string; n: number }>>([]);
  useEffect(() => {
    void loadExploreCharts(String(profile.id || 'guest')).then((charts) => setPeople(charts
      .filter((chart) => !chart.is_primary && !chart.archived_at && chart.birth_date)
      .map((chart) => { const parts = parseBirthDate(String(chart.birth_date)); return parts ? { name: String(chart.name || 'Без имени'), n: reduceNumber(lifePathNumber(parts), false) } : null; })
      .filter((item): item is { name: string; n: number } => item !== null)
      .slice(0, 8))).catch(() => undefined);
  }, [profile.id]);
  const birth = useMemo(() => parseBirthDate(profile.birthDate), [profile.birthDate]);
  const [purchases] = usePurchases(profile.id ? String(profile.id) : undefined);
  const plus = hasActivePremium(profile) || hasEsoAccess(purchases);
  const sign = sunSignFromDate(profile.birthDate);
  const subtitle = [profile.name?.trim(), sign ? getZodiacSign('ru', sign) : ''].filter(Boolean).join(' · ');
  const now = new Date();
  const numbers = useMemo(() => {
    if (!birth) return null;
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return {
      life: lifePathNumber(birth),
      year: personalYearNumber(birth, year),
      month: personalMonthNumber(birth, year, month),
      day: personalDayNumber(birth, year, month, day),
      square: pythagorasSquare(birth),
      yearLabel: year,
      monthLabel: MONTHS_RU[month - 1],
    };
    // The numbers change at midnight, so the current day is part of the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birth, now.toDateString()]);
  const names = useMemo(() => nameNumbers(profile.name || ''), [profile.name]);

  const header = (
    <>
      <AppTopBar title="Числа" main />
      <MyChartHeader
        title="Квадрат Пифагора"
        subtitle={subtitle}
        active="numbers"
        onOpen={(segment) => onOpenSegment?.(segment)}
      />
    </>
  );

  if (!birth || !numbers) {
    return (
      <div className="fresh-page nebo-numbers">
        {header}
        <section className="nebo-numbers-empty">
          <h2>Добавь дату рождения</h2>
          <p>Числа считаются по дате рождения и по имени. Без даты считать нечего.</p>
        </section>
      </div>
    );
  }

  const life = LIFE_PATH[numbers.life] ?? LIFE_PATH[reduceNumber(numbers.life)];
  const current = [
    { id: 'year', n: numbers.year, caption: 'год', label: `Твой ${numbers.yearLabel} · личный год`, title: PERSONAL_YEAR[numbers.year].split('. ')[0], text: PERSONAL_YEAR[numbers.year] },
    { id: 'month', n: numbers.month, caption: 'месяц', label: `Твой ${numbers.monthLabel} · личный месяц`, title: PERSONAL_MONTH[numbers.month], text: PERSONAL_MONTH[numbers.month] },
    { id: 'day', n: numbers.day, caption: 'день', label: 'Сегодня · личный день', title: PERSONAL_DAY[numbers.day], text: PERSONAL_DAY[numbers.day] },
  ];

  return (
    <div className="fresh-page nebo-numbers">
      {header}

      <section className="nebo-numbers-life" aria-labelledby="nebo-life-title">
        <span className="nebo-numbers-bignum" aria-hidden="true">{numbers.life}</span>
        <div className="nebo-numbers-life-copy">
          <p className="nebo-kicker">Число судьбы</p>
          <h2 id="nebo-life-title">{life.title}</h2>
          <p className="nebo-numbers-formula">{lifePathFormula(birth.day, birth.month, birth.year)}</p>
        </div>
        <p className="nebo-numbers-life-text">{life.text}</p>
      </section>

      <section className="nebo-numbers-now" aria-labelledby="nebo-now-title">
        <h2 id="nebo-now-title">Твои числа на сейчас</h2>
        <p className="nebo-numbers-intro">
          Это три твоих личных числа: года, месяца и дня. Их считают по дате рождения и сегодняшней дате, поэтому они меняются.
          Каждое подсказывает, на что сейчас лучше потратить силы.
        </p>
        <div className="nebo-numbers-now-list">
          {current.map((item) => (
            <div key={item.id} className="nebo-numbers-now-row">
              <span className="nebo-numbers-tile" aria-hidden="true">
                <b>{item.n}</b>
                <small>{item.caption}</small>
              </span>
              <span className="nebo-numbers-now-copy">
                <span className="nebo-kicker">{item.label}</span>
                <strong>{item.title}</strong>
                {item.id === 'year' ? <span>{item.text.split('. ').slice(1).join('. ')}</span> : null}
              </span>
            </div>
          ))}
        </div>
        <div className="nebo-numbers-more">
          <button type="button" onClick={() => (plus ? setPopup('year') : onRequestPremium?.())}>
            <span><strong>Твой {numbers.yearLabel} по месяцам</strong><small>Какое число у каждого месяца года</small></span>
            {plus ? null : <em>Plus</em>}
          </button>
          <button type="button" onClick={() => setPopup('pairs')}>
            <span><strong>Пары по числам</strong><small>Как твоё число сочетается с близкими</small></span>
          </button>
        </div>
      </section>

      {popup ? (
        <div className="nebo-sheet-scrim" role="presentation" onClick={() => setPopup(null)}>
          <div className="nebo-why" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nebo-day-pop-close" onClick={() => setPopup(null)} aria-label="Закрыть"><X size={18} aria-hidden /></button>
            {popup === 'year' ? (
              <>
                <p className="nebo-why-kicker">Твой {numbers.yearLabel} по месяцам</p>
                <h2>{PERSONAL_YEAR[numbers.year].split('. ')[0]}</h2>
                <p className="nebo-numbers-pop-text">{PERSONAL_YEAR[numbers.year].split('. ').slice(1).join('. ')} Внутри года у каждого месяца своё число:</p>
                <div className="nebo-numbers-months">
                  {MONTHS_RU.map((name, index) => {
                    const n = personalMonthNumber(birth, numbers.yearLabel, index + 1);
                    return (
                      <div key={name} className={index === now.getMonth() ? 'is-now' : ''}>
                        <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                        <b>{n} · {MONTH_SHORT[n] ?? ''}</b>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="nebo-why-kicker">Пары по числам</p>
                <h2>Твоё число судьбы {numbers.life}</h2>
                <p className="nebo-numbers-pop-text">Числа делятся на три семьи: 1, 5, 7 про свободу и ум, 2, 4, 8 про дело и порядок, 3, 6, 9 про чувства и заботу. Внутри семьи легко, а между семьями люди дополняют друг друга.</p>
                {people.length ? (
                  <div className="nebo-numbers-months">
                    {people.map((person) => (
                      <div key={person.name + person.n}>
                        <span>{person.name.split(/\s+/)[0]} · {person.n}</span>
                        <b>{numberFamily(reduceNumber(numbers.life, false)) === numberFamily(person.n) ? 'Легко вместе' : 'Дополняют друг друга'}</b>
                      </div>
                    ))}
                  </div>
                ) : <p className="nebo-numbers-pop-text">Добавь карты близких в «Мои карты», и здесь появятся ваши пары.</p>}
              </>
            )}
            <button type="button" className="nebo-period-cta" onClick={() => setPopup(null)}>Понятно</button>
          </div>
        </div>
      ) : null}

      <section className="nebo-numbers-square" aria-labelledby="nebo-square-title">
        <h2 id="nebo-square-title">Квадрат Пифагора</h2>
        <p className="nebo-numbers-intro">
          Цифры твоей даты рождения разложены по клеткам. Чем больше одинаковых цифр, тем ярче эта черта.
          «Нет» значит, что здесь полагаться лучше на план, а не на удачу.
        </p>
        <div className="nebo-square-grid" role="group" aria-label="Квадрат Пифагора">
          {numbers.square.cells.map((cell) => {
            const info = SQUARE_CELLS[cell.n];
            const active = openCell === cell.n;
            return (
              <button
                key={cell.n}
                type="button"
                className={`nebo-square-cell${cell.count === 0 ? ' is-empty' : ''}${active ? ' is-open' : ''}`}
                aria-expanded={active}
                onClick={() => { lumiaSelectionHaptic(); setOpenCell(active ? null : cell.n); }}
              >
                <span className="nebo-square-digits">{cell.count ? cell.digits : 'нет'}</span>
                <span className="nebo-square-label">{info.title}</span>
              </button>
            );
          })}
        </div>
        {openCell ? (
          <div className="nebo-square-detail" role="status">
            <strong>{SQUARE_CELLS[openCell].title}</strong>
            <p>{SQUARE_CELLS[openCell][squareTier(numbers.square.cells[openCell - 1].count)]}</p>
          </div>
        ) : (
          <p className="nebo-square-summary">{squareSummary(numbers.square)}</p>
        )}
      </section>

      <section className="nebo-numbers-names" aria-labelledby="nebo-names-title">
        <h2 id="nebo-names-title">Числа твоего имени</h2>
        {names && plus ? (
          <div className="nebo-numbers-now-list">
            {([
              ['soul', 'Число души', names.soul],
              ['outer', 'Число образа', names.outer],
              ['talent', 'Число таланта', names.talent],
            ] as const).map(([kind, label, value]) => (
              <div key={kind} className="nebo-numbers-now-row">
                <span className="nebo-numbers-tile is-blue" aria-hidden="true"><b>{value}</b></span>
                <span className="nebo-numbers-now-copy">
                  <span className="nebo-kicker">{label}</span>
                  <strong>{nameNumberText(kind, value)}</strong>
                  <span>{NAME_NUMBER_INTRO[kind]}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="nebo-numbers-lock">
            <Lock aria-hidden="true" size={18} />
            <p>
              По буквам имени считаются число души, образа и таланта. Это открывается с NEBO Plus или с «Эзотерикой на год».
            </p>
            <button type="button" onClick={() => onRequestPremium?.()}>Открыть с Plus</button>
          </div>
        )}
      </section>
    </div>
  );
}
