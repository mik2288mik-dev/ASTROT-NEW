import React, { memo } from 'react';
import { ForecastDailyReading, Language } from '../../types';
import { getText } from '../../constants';
import { FormattedAiText } from '../ui/FormattedAiText';
import { READING_GLASS_SECTION_CLASS } from '../layout/ReadingLayout';

interface HoroscopeContentProps {
  reading: ForecastDailyReading;
  language: Language;
}

export const HoroscopeContent = memo<HoroscopeContentProps>(({ reading, language }) => {
  const tips = (reading.advice || [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 3);

  const matters = [
    { label: getText(language, 'horoscope.chance_title'), value: reading.chance },
    { label: getText(language, 'horoscope.risk_title'), value: reading.risk },
    { label: getText(language, 'horoscope.focus_title'), value: reading.focus },
  ];

  return (
    <div className="space-y-0">
      <section className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.reading_title')}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
          {getText(language, 'horoscope.reading_body')}
        </p>

        <div className="mt-4 border-b border-astro-border/10 pb-4 text-center">
          <h2 className="lumia-reading-section-title text-astro-text">{reading.headline}</h2>
          <p className="lumia-reading-intro lumia-muted mx-auto mt-3 max-w-reading-wide">{reading.summary}</p>
        </div>
      </section>

      <section className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.what_matters_title')}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
          {getText(language, 'horoscope.what_matters_body')}
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
        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.context_title')}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
          {getText(language, 'horoscope.context_body')}
        </p>

        <div className="mt-4 mx-auto w-full max-w-reading-wide">
          <FormattedAiText text={reading.reading} variant="article" className="lumia-prose" />
        </div>

        <div className="mt-4 border-t border-astro-border/10 pt-4">
          <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.context_note_title')}</p>
          <p className="lumia-reading-body mt-1.5 text-astro-text">{reading.context}</p>
        </div>
      </section>

      {tips.length > 0 && (
        <section className={READING_GLASS_SECTION_CLASS}>
          <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.advice_title')}</p>
          <ol className="mt-3 space-y-3">
            {tips.map((line, index) => (
              <li
                key={index}
                className="flex gap-3 border-b border-astro-border/10 pb-3 text-[15px] leading-relaxed text-astro-text last:border-b-0 last:pb-0 sm:text-base"
              >
                <span className="shrink-0 text-[12px] font-semibold text-astro-highlight/80">
                  {index + 1}.
                </span>
                <span className="min-w-0 [text-wrap:pretty]">{line}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
});

HoroscopeContent.displayName = 'HoroscopeContent';
