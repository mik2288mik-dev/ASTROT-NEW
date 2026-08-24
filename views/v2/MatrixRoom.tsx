import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { UserProfile } from '../../types';
import { computeMatrix } from '../../lib/matrixOfDestiny';
import { getArcana, MATRIX_TITLE, MATRIX_SUBTITLE } from '../../lib/matrixArcana';
import { toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { shareToTelegram } from '../../lib/botLink';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { EditorialProfileButton } from '../../components/editorial/EditorialScreenChrome';
import {
  EditorialEvidence,
  EditorialProse,
  EditorialSectionHeading,
  EditorialSummary,
} from '../../components/EditorialReading';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type Props = {
  profile: UserProfile;
  onBack: () => void;
  onOpenProfile?: () => void;
  embedded?: boolean;
};

export function MatrixRoom({ profile, onBack, onOpenProfile, embedded = false }: Props) {
  void onBack;
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

  const selfAlsoLabels = useMemo(
    () => (selfGroup && self ? selfGroup.labels.filter((l) => l !== self.label) : []),
    [selfGroup, self],
  );

  const share = () => {
    if (!result || !selfArcana) return;
    const text = ru
      ? `Моя матрица судьбы: суть — «${selfArcana.keyword}». Рассчитай свою бесплатно по дате рождения в «Твой Гороскоп».`
      : `My Destiny Matrix: core — "${selfArcana.keywordEn}". Get yours free by birth date in Your Horoscope.`;
    shareToTelegram(text);
  };

  return (
    <div className={embedded ? 'matrix-editorial-page' : 'fresh-page matrix-editorial-page'}>
      {!embedded ? (
        <AppTopBar
          title={ru ? MATRIX_TITLE.ru : MATRIX_TITLE.en}
          rightAction={(
            <EditorialProfileButton
              label={ru ? 'Открыть профиль' : 'Open profile'}
              onClick={onOpenProfile}
            />
          )}
        />
      ) : null}

      <section className="product-screen-cover product-screen-cover--matrix" aria-label={ru ? MATRIX_TITLE.ru : MATRIX_TITLE.en}>
        <div className="product-screen-cover-copy">
          <div className="product-screen-cover-title">{ru ? MATRIX_TITLE.ru : MATRIX_TITLE.en}</div>
          <div className="product-screen-cover-text">
            {ru
              ? 'Сильные стороны, привычные сценарии и точки роста — через числа рождения.'
              : 'Strengths, recurring patterns, and growth points through birth numbers.'}
          </div>
        </div>
      </section>

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
            <motion.div className="mtx-hero-shell" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <EditorialSummary
                label={ru ? 'Главный вывод' : 'Main takeaway'}
                title={cap(ru ? selfArcana.keyword : selfArcana.keywordEn)}
                className="mtx-hero"
              >
                <EditorialProse text={ru ? selfArcana.essence : selfArcana.essenceEn} className="mtx-hero-essence" />
                <p className="mtx-hero-kicker"><strong>{cap(self.label)}</strong></p>
                {selfAlsoLabels.length ? (
                  <p className="mtx-hero-also"><strong>{ru ? 'Также проявляется:' : 'Also shows in:'}</strong> {selfAlsoLabels.map(cap).join(' · ')}</p>
                ) : null}
              </EditorialSummary>
            </motion.div>
          ) : null}

          <div className="mtx-grid mtx-editorial-sections">
            {themeGroups.map((g, i) => (
              <motion.section
                key={`${g.arcana.n}-${i}`}
                className="mtx-card editorial-reading-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
              >
                <EditorialSectionHeading
                  title={cap(ru ? g.arcana.keyword : g.arcana.keywordEn)}
                  subtitle={g.labels.map(cap).join(' · ')}
                  className="mtx-card-heading"
                />
                <EditorialProse text={ru ? g.arcana.essence : g.arcana.essenceEn} className="mtx-card-essence" />
              </motion.section>
            ))}
          </div>

          {result.lifeAreas?.length ? (
            <>
              <h2 className="mtx-life-head">{ru ? 'Сферы жизни' : 'Life areas'}</h2>
              <div className="mtx-grid mtx-editorial-sections mtx-life-sections">
                {result.lifeAreas.map((la, i) => {
                  const a = getArcana(la.arcana);
                  return (
                    <motion.section
                      key={la.key}
                      className="mtx-card editorial-reading-section"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.04 * i }}
                    >
                      <EditorialSectionHeading
                        title={cap(la.label)}
                        subtitle={cap(ru ? a.keyword : a.keywordEn)}
                        className="mtx-card-heading"
                      />
                      <EditorialProse text={ru ? a.essence : a.essenceEn} className="mtx-card-essence" />
                    </motion.section>
                  );
                })}
              </div>
            </>
          ) : null}

          <button type="button" className="mtx-note-toggle" onClick={() => { lumiaSelectionHaptic(); setNoteOpen((v) => !v); }} aria-expanded={noteOpen}>
            {ru ? 'Что это значит?' : 'What does this mean?'}
          </button>
          {noteOpen ? (
            <EditorialEvidence label={ru ? 'Основа расчёта' : 'Basis of the calculation'} className="mtx-note">
              <EditorialProse
                text={ru
                  ? 'Матрица судьбы — это расклад из чисел твоей даты рождения. Каждое число описывает одну тему характера: сильные стороны, зону роста, отношения, цели. Это про самопонимание, а не предсказание. Если одна тема выпадает на нескольких позициях — она у тебя выражена сильнее.'
                  : 'The Destiny Matrix is a layout of numbers from your birth date. Each number describes one theme of character — strengths, growth, relationships, goals. It is for self-understanding, not prediction. If one theme appears in several positions, it is stronger for you.'}
              />
            </EditorialEvidence>
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

      {!embedded ? <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }} /> : null}
    </div>
  );
}
