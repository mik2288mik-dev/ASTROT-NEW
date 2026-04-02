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
  const tips = (reading.advice || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 3);
  const matters = [
    { label: getText(language, 'horoscope.chance_title'), value: reading.chance },
    { label: getText(language, 'horoscope.risk_title'), value: reading.risk },
    { label: getText(language, 'horoscope.focus_title'), value: reading.focus },
  ];

  return (
    <div className="space-y-air">
      <div className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.reading_title')}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.reading_body')}</p>

        <div className="mt-4 space-y-3.5">
          <div className="border-b border-astro-border/20 pb-3.5">
            <h2 className="font-serif text-xl text-astro-text sm:text-2xl">{reading.headline}</h2>
            <p className="lumia-reading-body lumia-muted mt-2">{reading.summary}</p>
          </div>

          <div className="mx-auto w-full max-w-reading">
            <div className="lumia-reading-inner-card">
              <FormattedAiText text={reading.reading} variant="article" className="lumia-prose" />
            </div>
          </div>
        </div>
      </div>

      <div className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.what_matters_title')}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.what_matters_body')}</p>

        <div className="mt-4 space-y-3">
          {matters.map((item) => (
            <div key={item.label} className="border-b border-astro-border/15 pb-3 last:border-b-0 last:pb-0">
              <p className="lumia-label text-[10px] tracking-[0.16em]">{item.label}</p>
              <p className="lumia-reading-body mt-1.5 text-astro-text">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={READING_GLASS_SECTION_CLASS}>
        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.context_title')}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.context_body')}</p>

        <div className="mt-4 mx-auto w-full max-w-reading">
          <div className="lumia-reading-inner-card">
            <FormattedAiText text={reading.context} variant="article" className="lumia-prose" />
          </div>
        </div>
      </div>

      {tips.length > 0 && (
        <div className={READING_GLASS_SECTION_CLASS}>
          <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.advice_title')}</p>
          <ul className="mt-3 space-y-2 sm:space-y-2.5">
            {tips.map((line, index) => (
              <li
                key={index}
                className="lumia-glass-inset flex gap-3 px-3.5 py-3 text-[15px] leading-relaxed text-astro-text sm:text-base sm:leading-relaxed"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-astro-highlight/14 text-xs font-semibold text-astro-highlight ring-1 ring-astro-highlight/18 sm:h-8 sm:w-8 sm:text-sm">
                  {index + 1}
                </span>
                <span className="min-w-0 pt-0.5 [text-wrap:pretty]">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

HoroscopeContent.displayName = 'HoroscopeContent';
