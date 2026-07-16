import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * FAQ на самом низу главной — отвечает на «наболевшие» вопросы:
 * на чём основаны расчёты, что они настоящие, что это не медицина.
 * Контент честный (Swiss Ephemeris + личная карта), без эмодзи и мистики.
 * Нативный аккордеон в стиле FRESH — без новых зависимостей.
 */

type Localized = { ru: string; en: string };
type FaqItem = { q: Localized; a: Localized };

const FAQ_ITEMS: FaqItem[] = [
  {
    q: { ru: 'На чём основаны расчёты?', en: 'What are the calculations based on?' },
    a: {
      ru: 'На реальной астрономии. Положения Солнца, Луны и планет мы считаем по эфемеридам Swiss Ephemeris — том же стандарте точности, что используют профессиональные астрологи и обсерватории. Это настоящие данные неба на момент твоего рождения, а не случайные числа.',
      en: 'On real astronomy. Positions of the Sun, Moon and planets are computed with the Swiss Ephemeris — the same precision standard professional astrologers and observatories use. These are the actual sky positions at your birth moment, not random numbers.',
    },
  },
  {
    q: { ru: 'Это правда про меня, а не общий гороскоп?', en: 'Is this really about me, not a generic horoscope?' },
    a: {
      ru: 'Натальная карта строится индивидуально по твоим дате, времени и месту рождения, а личный гороскоп опирается именно на твои положения планет и домов. Гороскоп по знаку — общий для всех с этим знаком, и мы честно держим его отдельно.',
      en: 'Your natal chart is built individually from your birth date, time and place, and your personal horoscope relies on your own planets and houses. The sign horoscope is general for everyone with that sign, and we keep it honestly separate.',
    },
  },
  {
    q: { ru: 'Зачем точное время рождения?', en: 'Why is the exact birth time needed?' },
    a: {
      ru: 'От времени зависят Асцендент и дома — то, что делает карту по-настоящему твоей. Если точное время неизвестно, Солнце, Луна и общий портрет всё равно работают, но дома и Асцендент могут отличаться — в таких местах мы тебя честно предупреждаем.',
      en: 'Your Ascendant and houses depend on the exact time — the part that makes a chart truly yours. If the exact time is unknown, the Sun, Moon and overall portrait still work, but houses and the Ascendant may differ — and we tell you honestly where that applies.',
    },
  },
  {
    q: { ru: 'Откуда берутся тексты разборов?', en: 'Where do the reading texts come from?' },
    a: {
      ru: 'Сначала идёт точный астрономический расчёт твоей карты. Поверх него формулировки помогает собрать ИИ — строго по твоим положениям, без мистики, фатализма и запугивания. Никаких «звёзды велят» — только понятные наблюдения о тебе.',
      en: 'First comes the precise astronomical calculation of your chart. On top of it, an AI helps phrase the readings — strictly from your placements, with no mysticism, fatalism or scare tactics. No “the stars command you” — just clear observations about you.',
    },
  },
  {
    q: { ru: 'Это не медицина и не диагноз?', en: 'Is this not medicine or a diagnosis?' },
    a: {
      ru: 'Нет. «Твой Гороскоп» — для самопонимания и интереса к себе. Это не медицинские, психологические, юридические или финансовые рекомендации и не замена консультации специалиста. Все решения всегда остаются за тобой.',
      en: 'No. Your Horoscope is for self-understanding and curiosity. It is not medical, psychological, legal or financial advice, and not a substitute for a professional. All decisions always remain yours.',
    },
  },
  {
    q: { ru: 'Что происходит с моими данными?', en: 'What happens to my data?' },
    a: {
      ru: 'Дата, время и место рождения нужны только для одного — построить твою карту и личный гороскоп. Больше эти данные ни для чего не используются.',
      en: 'Your birth date, time and place are used for one thing only — to build your chart and personal horoscope. They are not used for anything else.',
    },
  },
];

export const HomeFaq: React.FC<{ language: 'ru' | 'en' }> = ({ language }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section style={{ padding: '8px 16px 28px' }}>
      <div className="fresh-section-row">
        <div className="fresh-section-title">{language === 'ru' ? 'Вопросы и ответы' : 'FAQ'}</div>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--fresh-muted)' }}>
        {language === 'ru'
          ? 'Коротко о том, как это работает и на чём всё основано.'
          : 'A short take on how it works and what it is based on.'}
      </p>

      <div
        style={{
          background: 'var(--fresh-surface)',
          borderRadius: 'var(--fresh-radius-item)',
          overflow: 'hidden',
        }}
      >
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q.ru} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--fresh-border)' }}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'var(--fresh-text)' }}>
                  {item.q[language]}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    opacity: 0.5,
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <path d="M4 6L8 10L12 6" stroke="var(--fresh-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{ margin: 0, padding: '0 14px 14px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--fresh-muted)' }}>
                      {item.a[language]}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <p style={{ margin: '12px 4px 0', fontSize: 11.5, lineHeight: 1.55, color: 'var(--fresh-muted)' }}>
        {language === 'ru'
          ? '«Твой Гороскоп» создан для самопонимания и интереса к себе — это не медицинские, юридические или финансовые рекомендации.'
          : 'Your Horoscope is made for self-reflection and curiosity — not medical, legal or financial advice.'}
      </p>
    </section>
  );
};
