import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { UserProfile } from '../../types';
import { computeMatrix } from '../../lib/matrixOfDestiny';
import { getArcana, MATRIX_TITLE, MATRIX_SUBTITLE } from '../../lib/matrixArcana';
import { toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { shareToTelegram } from '../../lib/botLink';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { FreshInnerHeader } from '../../components/fresh-ui/FreshHeaders';

// Единый регистр: каждый лейбл/ключевое слово начинается с заглавной (keyword в данных — строчными).
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type Props = {
  profile: UserProfile;
  onBack: () => void;
};

export function MatrixRoom({ profile, onBack }: Props) {
  const ru = profile.language !== 'en';
  const lang: 'ru' | 'en' = ru ? 'ru' : 'en';

  const initial = toDateInputValue(profile.birthDate || '');
  const [date, setDate] = useState(initial);
  const [computedDate, setComputedDate] = useState<string | null>(initial || null);
  const [noteOpen, setNoteOpen] = useState(false);

  const result = useMemo(() => (computedDate ? computeMatrix(computedDate, lang) : null), [computedDate, lang]);
  const calc = () => { lumiaSelectionHaptic(); setComputedDate(date); };

  const self = result?.positions.find((p) => p.key === 'self');
  const selfArcana = self ? getArcana(self.arcana) : null;

  // Группируем позиции по теме (по аркану), чтобы один и тот же смысл не повторялся
  // на нескольких карточках. Каждая тема показывается ОДИН раз + перечень её областей.
  const { selfGroup, themeGroups } = useMemo(() => {
    const map = new Map<number, { arcana: ReturnType<typeof getArcana>; labels: string[]; hasSelf: boolean }>();
    (result?.positions || []).forEach((p) => {
      const g = map.get(p.arcana) || { arcana: getArcana(p.arcana), labels: [], hasSelf: false };
      g.labels.push(p.label);
      if (p.key === 'self') g.hasSelf = true;
      map.set(p.arcana, g);
    });
    const all = [...map.values()];
    return { selfGroup: all.find((g) => g.hasSelf) || null, themeGroups: all.filter((g) => !g.hasSelf) };
  }, [result]);

  // Другие области, где «звучит» тема сути (без слова «усилена» — просто перечень).
  const selfAlsoLabels = useMemo(
    () => (selfGroup && self ? selfGroup.labels.filter((l) => l !== self.label) : []),
    [selfGroup, self],
  );

  const share = () => {
    if (!result || !selfArcana) return;
    const text = ru
      ? `Моя матрица судьбы: суть — «${selfArcana.keyword}». Рассчитай свою бесплатно по дате рождения в Lumia.`
      : `My Destiny Matrix: core — "${selfArcana.keywordEn}". Get yours free by birth date in Lumia.`;
    shareToTelegram(text);
  };

  return (
    <div className="fresh-page">
      <FreshInnerHeader
        title={ru ? MATRIX_TITLE.ru : MATRIX_TITLE.en}
        onBack={() => { lumiaSelectionHaptic(); onBack(); }}
      />

      <p style={{ padding: '0 20px 8px', margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fresh-muted)' }}>
        {ru ? MATRIX_SUBTITLE.ru : MATRIX_SUBTITLE.en}
      </p>

      <div className="mtx-form">
        <label className="fresh-field-label">{ru ? 'Дата рождения' : 'Birth date'}</label>
        <div className="mtx-form-row">
          <input className="fresh-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="fresh-btn-primary" style={{ width: 'auto', margin: 0, paddingLeft: 20, paddingRight: 20 }} onClick={calc} disabled={!date}>
            {ru ? 'Рассчитать' : 'Calculate'}
          </button>
        </div>
      </div>

      {!result ? (
        <p className="mtx-empty">{ru ? 'Введи дату рождения — покажу расчёт сразу.' : 'Enter a birth date — instant result.'}</p>
      ) : (
        <div className="mtx-result">
          {self && selfArcana ? (
            <motion.div className="mtx-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div className="mtx-hero-kicker">{cap(self.label)}</div>
              <div className="mtx-hero-key">{cap(ru ? selfArcana.keyword : selfArcana.keywordEn)}</div>
              <p className="mtx-hero-essence">{ru ? selfArcana.essence : selfArcana.essenceEn}</p>
              {selfAlsoLabels.length ? (
                <div className="mtx-hero-also">{ru ? 'Также проявляется: ' : 'Also shows in: '}{selfAlsoLabels.map(cap).join(' · ')}</div>
              ) : null}
            </motion.div>
          ) : null}

          <div className="mtx-grid">
            {themeGroups.map((g, i) => (
              <motion.div
                key={`${g.arcana.n}-${i}`}
                className="mtx-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
              >
                <div className="mtx-card-label">{cap(ru ? g.arcana.keyword : g.arcana.keywordEn)}</div>
                <div className="mtx-areas">{g.labels.map(cap).join(' · ')}</div>
                <p className="mtx-card-essence">{ru ? g.arcana.essence : g.arcana.essenceEn}</p>
              </motion.div>
            ))}
          </div>

          {result.lifeAreas?.length ? (
            <>
              <div className="mtx-life-head">{ru ? 'Сферы жизни' : 'Life areas'}</div>
              <div className="mtx-grid">
                {result.lifeAreas.map((la, i) => {
                  const a = getArcana(la.arcana);
                  return (
                    <motion.div
                      key={la.key}
                      className="mtx-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.04 * i }}
                    >
                      <div className="mtx-card-label">{cap(la.label)}</div>
                      <div className="mtx-areas">{cap(ru ? a.keyword : a.keywordEn)}</div>
                      <p className="mtx-card-essence">{ru ? a.essence : a.essenceEn}</p>
                    </motion.div>
                  );
                })}
              </div>
            </>
          ) : null}

          <button type="button" className="mtx-note-toggle" onClick={() => { lumiaSelectionHaptic(); setNoteOpen((v) => !v); }} aria-expanded={noteOpen}>
            {ru ? 'Что это значит?' : 'What does this mean?'}
          </button>
          {noteOpen ? (
            <p className="mtx-note">
              {ru
                ? 'Матрица судьбы — это расклад из чисел твоей даты рождения. Каждое число описывает одну тему характера: сильные стороны, зону роста, отношения, цели. Это про самопонимание, а не предсказание. Если одна тема выпадает на нескольких позициях — она у тебя выражена сильнее.'
                : 'The Destiny Matrix is a layout of numbers from your birth date. Each number describes one theme of character — strengths, growth, relationships, goals. It is for self-understanding, not prediction. If one theme appears in several positions, it is stronger for you.'}
            </p>
          ) : null}

          <p className="mtx-share-hook">{ru ? 'Поделись матрицей — покажи, кто ты.' : 'Share your matrix — show who you are.'}</p>
          {self ? (
            <HoroscopeActivityBar
              userId={profile.id ? String(profile.id) : undefined}
              sign={`arcana_${self.arcana}`}
              date="2000-01-01"
              language={lang}
              onShare={share}
            />
          ) : null}
        </div>
      )}

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }} />
    </div>
  );
}
