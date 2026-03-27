import React, { memo } from 'react';
import { getText } from '../../constants';
import { Language } from '../../types';
import { FormattedAiText } from '../ui/FormattedAiText';
import { READING_SECTION_PAD } from '../layout/ReadingLayout';

interface HoroscopeContentProps {
  content: string;
  moonImpact?: string;
  transitFocus?: string;
  advice?: string[];
  language: Language;
}

export const HoroscopeContent = memo<HoroscopeContentProps>(({ 
  content, 
  moonImpact, 
  transitFocus,
  advice,
  language 
}) => {
  const tips = (advice || []).map((s) => String(s).trim()).filter(Boolean);

  return (
    <div className="space-y-3 sm:space-y-3.5">
      <div className={`lumia-glass rounded-2xl ${READING_SECTION_PAD}`}>
        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.reading_title')}</p>
        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.reading_body')}</p>

        <div className="mx-auto mt-4 w-full max-w-reading">
          <FormattedAiText text={content} variant="article" className="lumia-prose" />
        </div>
      </div>

      {(moonImpact || transitFocus) && (
        <div className={`lumia-glass rounded-2xl ${READING_SECTION_PAD}`}>
          <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.context_title')}</p>
          <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.context_body')}</p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
            {moonImpact && (
              <div className="lumia-glass-inset p-3.5 sm:p-4">
                <h3 className="text-sm font-semibold text-astro-text sm:text-[15px]">
                  {getText(language, 'horoscope.moon_impact_title')}
                </h3>
                <div className="mt-2">
                  <FormattedAiText text={moonImpact} variant="article" className="lumia-prose" />
                </div>
              </div>
            )}

            {transitFocus && (
              <div className="lumia-glass-inset p-3.5 sm:p-4">
                <h3 className="text-sm font-semibold text-astro-text sm:text-[15px]">
                  {getText(language, 'horoscope.transit_focus_title')}
                </h3>
                <div className="mt-2">
                  <FormattedAiText text={transitFocus} variant="article" className="lumia-prose" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <div className={`lumia-glass rounded-2xl ${READING_SECTION_PAD}`}>
          <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.advice_title')}</p>
          <ul className="mt-3 space-y-2 sm:space-y-2.5">
            {tips.map((line, i) => (
              <li
                key={i}
                className="lumia-glass-inset flex gap-3 px-3.5 py-3 text-[15px] leading-relaxed text-astro-text sm:text-base sm:leading-relaxed"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-astro-highlight/14 text-xs font-semibold text-astro-highlight ring-1 ring-astro-highlight/18 sm:h-8 sm:w-8 sm:text-sm">
                  {i + 1}
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
