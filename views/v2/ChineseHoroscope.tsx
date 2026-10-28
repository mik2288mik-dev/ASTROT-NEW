import React, { useMemo, useState } from 'react';
import {
  CHINESE_ANIMALS,
  CHINESE_ELEMENTS,
  CHINESE_GENITIVE,
  CHINESE_RELATIONS,
  chineseAdjective,
  chineseRelation,
  chineseSign,
  chineseSignOfYear,
  chineseYears,
  type ChineseRelation,
} from '../../lib/chineseZodiac';

const image = (animal: number) => `/assets/chinese/${String(animal).padStart(2, '0')}.webp`;

/** Китайский гороскоп: свой знак, характер и год, кто ладит, все 12 знаков и пара по году рождения. */
export function ChineseHoroscope({ birthDate }: { birthDate: string }) {
  const mine = useMemo(() => chineseSign(birthDate), [birthDate]);
  const [picked, setPicked] = useState<number>(mine?.animal ?? 6);
  const [otherYear, setOtherYear] = useState('');
  const animal = CHINESE_ANIMALS[picked];
  const isMine = mine?.animal === picked;
  const element = mine && isMine ? CHINESE_ELEMENTS[mine.element] : null;

  const relations = CHINESE_ANIMALS.map((_, i) => [i, chineseRelation(picked, i)] as const).filter(([i]) => i !== picked);
  const good = relations.filter(([, r]) => r === 'trine' || r === 'friend');
  const hard = relations.filter(([, r]) => r === 'clash' || r === 'harm');

  const otherYearNumber = Number(otherYear);
  const otherValid = /^\d{4}$/.test(otherYear) && otherYearNumber >= 1930 && otherYearNumber <= 2026;
  const other = otherValid ? chineseSignOfYear(otherYearNumber) : null;
  const pairRelation: ChineseRelation | null = mine && other ? chineseRelation(mine.animal, other.animal) : null;

  const chips = (list: ReadonlyArray<readonly [number, ChineseRelation]>) => list.map(([i]) => (
    <button key={i} type="button" className="nebo-cn-chip" onClick={() => setPicked(i)}>
      <span className="nebo-cn-chip-char" aria-hidden>{CHINESE_ANIMALS[i].hieroglyph}</span>
      {CHINESE_ANIMALS[i].name}
    </button>
  ));

  return (
    <div className="nebo-cn">
      <div className="nebo-cn-hero">
        <img src={image(picked)} alt={animal.name} width={220} height={220} />
        <h2>{animal.name}</h2>
        <span className="nebo-cn-char" aria-hidden>{animal.hieroglyph}</span>
        {isMine && mine ? <span className="nebo-cn-mine">Твой знак · {chineseAdjective(mine)}, {mine.year}</span> : null}
        <p className="nebo-cn-years">Годы {CHINESE_GENITIVE[picked]}: {chineseYears(picked).join(' · ')}</p>
      </div>

      <section className="nebo-cn-card">
        <h3>Характер</h3>
        <p>{animal.character}</p>
        {element && mine ? <p className="nebo-cn-element" style={{ borderLeftColor: element.color }}>{element.text}</p> : null}
      </section>

      <section className="nebo-cn-card">
        <h3>2026 год: что ждать</h3>
        <p>{animal.year2026}</p>
      </section>

      <section className="nebo-cn-card">
        <h3>С кем легко</h3>
        <div className="nebo-cn-chips">{chips(good)}</div>
        <h3 className="nebo-cn-second">С кем сложнее</h3>
        <div className="nebo-cn-chips">{chips(hard)}</div>
      </section>

      <section className="nebo-cn-all">
        <h3>Все 12 знаков</h3>
        <div className="nebo-cn-grid">
          {CHINESE_ANIMALS.map((item, i) => (
            <button key={item.name} type="button" className={i === picked ? 'is-picked' : ''} onClick={() => setPicked(i)}>
              <span className="nebo-cn-chip-char" aria-hidden>{item.hieroglyph}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="nebo-cn-card">
        <h3>Пара по году рождения</h3>
        {mine ? (
          <>
            <p>Ты {chineseAdjective(mine)} ({mine.year}). Введи год рождения другого человека, и мы сравним знаки.</p>
            <input
              className="nebo-cn-year-input"
              inputMode="numeric"
              maxLength={4}
              placeholder="Например, 1992"
              value={otherYear}
              onChange={(event) => setOtherYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
              aria-label="Год рождения другого человека"
            />
            {otherYear.length === 4 && !otherValid ? <p className="nebo-cn-hint">Год должен быть от 1930 до 2026.</p> : null}
            {pairRelation && other ? (
              <div className="nebo-cn-pair">
                <div className="nebo-cn-pair-signs">
                  <span><img src={image(mine.animal)} alt="" width={64} height={64} />{CHINESE_ANIMALS[mine.animal].name}</span>
                  <span className="nebo-cn-pair-and">и</span>
                  <span><img src={image(other.animal)} alt="" width={64} height={64} />{CHINESE_ANIMALS[other.animal].name}</span>
                </div>
                <strong>{CHINESE_RELATIONS[pairRelation].title}</strong>
                <p>{CHINESE_RELATIONS[pairRelation].text}</p>
              </div>
            ) : null}
          </>
        ) : <p>Чтобы сравнить пару, укажи свою дату рождения в профиле.</p>}
      </section>

      <p className="nebo-cn-note">Год по китайскому календарю начинается в конце января или в феврале. Если день рождения в январе или начале февраля, животное считается по прошлому году. Это для интереса, а не для важных решений.</p>
    </div>
  );
}
