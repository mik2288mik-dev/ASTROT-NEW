import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { UserProfile } from '../../types';
import { computeMatrix } from '../../lib/matrixOfDestiny';
import { getArcana, MATRIX_TITLE, MATRIX_SUBTITLE } from '../../lib/matrixArcana';
import { toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { shareToTelegram } from '../../lib/botLink';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';

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
  const rest = useMemo(() => result?.positions.filter((p) => p.key !== 'self') || [], [result]);
  const selfArcana = self ? getArcana(self.arcana) : null;

  // Дедуп: текст аркана показываем ОДИН раз. Повтор — компактно, со ссылкой куда смотреть.
  const positionsView = useMemo(() => {
    const firstLabel = new Map<number, string>();
    if (self) firstLabel.set(self.arcana, self.label);
    return rest.map((pos) => {
      const ref = firstLabel.get(pos.arcana) || '';
      const isRepeat = firstLabel.has(pos.arcana);
      if (!isRepeat) firstLabel.set(pos.arcana, pos.label);
      return { pos, isRepeat, ref, arcana: getArcana(pos.arcana) };
    });
  }, [rest, self]);

  const share = () => {
    if (!result || !selfArcana) return;
    const text = ru
      ? `Моя матрица судьбы: суть — «${selfArcana.keyword}». Рассчитай свою бесплатно по дате рождения в Lumia.`
      : `My Destiny Matrix: core — "${selfArcana.keywordEn}". Get yours free by birth date in Lumia.`;
    shareToTelegram(text);
  };

  return (
    <div className="fresh-page">
      <div className="fresh-inner-header">
        <button className="fresh-back-btn" type="button" aria-label={ru ? 'Назад' : 'Back'} onClick={() => { lumiaSelectionHaptic(); onBack(); }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="fresh-inner-title" style={{ flex: 1, textAlign: 'center' }}>{ru ? MATRIX_TITLE.ru : MATRIX_TITLE.en}</div>
        <div style={{ width: 34 }} />
      </div>

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
              <div className="mtx-hero-kicker">{self.label}</div>
              <div className="mtx-hero-key">{ru ? selfArcana.keyword : selfArcana.keywordEn}</div>
              <p className="mtx-hero-essence">{ru ? selfArcana.essence : selfArcana.essenceEn}</p>
              <div className="mtx-hero-arcana">{ru ? 'Аркан' : 'Arcana'} {self.arcana} · {ru ? selfArcana.name : selfArcana.nameEn}</div>
            </motion.div>
          ) : null}

          <div className="mtx-grid">
            {positionsView.map(({ pos, isRepeat, ref, arcana: a }, i) => (
              <motion.div
                key={pos.key}
                className="mtx-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
              >
                <div className="mtx-card-label">{pos.label}</div>
                <div className="mtx-card-key">{ru ? a.keyword : a.keywordEn}</div>
                {isRepeat ? (
                  <p className="mtx-card-essence mtx-card-rep">
                    {ru ? `Та же тема, что в «${ref}» — здесь она усилена.` : `Same theme as "${ref}" — amplified here.`}
                  </p>
                ) : (
                  <p className="mtx-card-essence">{ru ? a.essence : a.essenceEn}</p>
                )}
                <div className="mtx-card-arc">{ru ? 'Аркан' : 'Arcana'} {pos.arcana} · {ru ? a.name : a.nameEn}</div>
              </motion.div>
            ))}
          </div>

          <button type="button" className="mtx-note-toggle" onClick={() => { lumiaSelectionHaptic(); setNoteOpen((v) => !v); }} aria-expanded={noteOpen}>
            {ru ? 'Что такое аркан?' : 'What is an arcana?'}
          </button>
          {noteOpen ? (
            <p className="mtx-note">
              {ru
                ? 'Аркан — образ-архетип; число 1–22 выводится из твоей даты рождения. Это про самопонимание, а не предсказание. Повтор аркана на нескольких позициях = тема усилена.'
                : 'An arcana is an archetype; the 1–22 number comes from your birth date. It is for self-understanding, not prediction. A repeated arcana = an amplified theme.'}
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
