import React, { memo } from 'react';
import { ForecastDailyReading, Language } from '../../types';
import { FormattedAiText } from '../ui/FormattedAiText';
import { READING_GLASS_SECTION_CLASS } from '../layout/ReadingLayout';

interface HoroscopeContentProps {
  reading: ForecastDailyReading;
  language: Language;
}

const COPY = {
  ru: {
    readingTitle: 'Прогноз по знаку',
    readingBody: 'Главный вывод для этого знака на выбранный период.',
    mattersTitle: 'Коротко по делу',
    mattersBody: 'Что может помочь, что может помешать и на чём лучше сосредоточиться.',
    chance: 'Что поможет',
    risk: 'Что помешает',
    focus: 'На чём сосредоточиться',
    contextTitle: 'Подробный разбор',
    contextBody: 'Ниже — объяснение без обещаний и выдуманных событий.',
    contextNote: 'Почему такой вывод',
    adviceTitle: 'Что сделать',
  },
  en: {
    readingTitle: 'Zodiac forecast',
    readingBody: 'The main conclusion for this sign and selected period.',
    mattersTitle: 'The practical part',
    mattersBody: 'What may help, what may get in the way, and where to focus.',
    chance: 'What may help',
    risk: 'What may get in the way',
    focus: 'Where to focus',
    contextTitle: 'Full explanation',
    contextBody: 'The reasoning below avoids guarantees and invented events.',
    contextNote: 'Why this conclusion',
    adviceTitle: 'What to do',
  },
} as const;

export const HoroscopeContent = memo<HoroscopeContentProps>(({ reading, language }) => {
  const copy = COPY[language === 'en' ? 'en' : 'ru'];
  const tips = (reading.advice || [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 3);

  const matters = [
    { label: copy.chance, value: reading.chance },
    { label: copy.risk, value: reading.risk },
    { label: copy.focus, value: reading.focus },
  ];

  return (
    <div className="space-y-0">
      <section className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{copy.readingTitle}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
          {copy.readingBody}
        </p>

        <div className="mt-4 border-b border-astro-border/10 pb-4 text-center">
          <h2 className="lumia-reading-section-title text-astro-text">{reading.headline}</h2>
          <p className="lumia-reading-intro lumia-muted mx-auto mt-3 max-w-reading-wide">{reading.summary}</p>
        </div>
      </section>

      <section className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{copy.mattersTitle}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
          {copy.mattersBody}
        </p>

        <div className="mt-4 space-y-3">
          {matters.map((item) => (
            <div key={item.label} className="border-b border-astro-border/10 pb-3 last:border-b-0 last:pb-0">
              <p className="lumia-label text-[10px] tracking-[0.16em]">{item.label}</p>
              <p className="lumia-reading-body mt-1.5 text-astro-text">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{copy.contextTitle}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
          {copy.contextBody}
        </p>

        <div className="mt-4 mx-auto w-full max-w-reading-wide">
          <FormattedAiText text={reading.reading} variant="article" className="lumia-prose" />
        </div>

        <div className="mt-4 border-t border-astro-border/10 pt-4">
          <p className="lumia-label text-[10px] tracking-[0.16em]">{copy.contextNote}</p>
          <p className="lumia-reading-body mt-1.5 text-astro-text">{reading.context}</p>
        </div>
      </section>

      {tips.length > 0 && (
        <section className={READING_GLASS_SECTION_CLASS}>
          <p className="lumia-label tracking-[0.2em]">{copy.adviceTitle}</p>
          <ul className="mt-3 space-y-3">
            {tips.map((line) => (
              <li
                key={line}
                className="border-b border-astro-border/10 pb-3 text-[15px] leading-relaxed text-astro-text last:border-b-0 last:pb-0 sm:text-base"
              >
                <span className="[text-wrap:pretty]">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});

HoroscopeContent.displayName = 'HoroscopeContent';
