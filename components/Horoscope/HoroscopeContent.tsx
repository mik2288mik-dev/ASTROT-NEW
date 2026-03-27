import React, { memo } from 'react';
import { getText } from '../../constants';
import { Language } from '../../types';
import { FormattedAiText } from '../ui/FormattedAiText';

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
    <div className="space-y-5 sm:space-y-6">
      <div className="rounded-2xl border border-astro-border bg-gradient-to-b from-astro-card to-astro-card/65 p-5 shadow-sm sm:rounded-3xl sm:p-6 md:p-7">
        <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
          {getText(language, 'horoscope.reading_title')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
          {getText(language, 'horoscope.reading_body')}
        </p>

        <div className="mt-5 w-full max-w-none">
          <FormattedAiText text={content} variant="article" className="font-serif" />
        </div>
      </div>

      {(moonImpact || transitFocus) && (
        <div className="rounded-2xl border border-astro-border bg-astro-card/60 p-5 sm:rounded-3xl sm:p-6 md:p-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
            {getText(language, 'horoscope.context_title')}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
            {getText(language, 'horoscope.context_body')}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5">
            {moonImpact && (
              <div className="rounded-xl border border-astro-border/70 bg-astro-bg/25 p-4 sm:rounded-2xl sm:p-5">
                <h3 className="text-sm font-semibold text-astro-text sm:text-base">
                  {getText(language, 'horoscope.moon_impact_title')}
                </h3>
                <div className="mt-3 font-serif">
                  <FormattedAiText text={moonImpact} variant="article" />
                </div>
              </div>
            )}

            {transitFocus && (
              <div className="rounded-xl border border-astro-border/70 bg-astro-bg/25 p-4 sm:rounded-2xl sm:p-5">
                <h3 className="text-sm font-semibold text-astro-text sm:text-base">
                  {getText(language, 'horoscope.transit_focus_title')}
                </h3>
                <div className="mt-3 font-serif">
                  <FormattedAiText text={transitFocus} variant="article" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <div className="rounded-2xl border border-astro-border bg-astro-card/55 p-5 sm:rounded-3xl sm:p-6 md:p-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
            {getText(language, 'horoscope.advice_title')}
          </p>
          <ul className="mt-5 space-y-3 sm:space-y-4">
            {tips.map((line, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-xl border border-astro-border/60 bg-astro-bg/20 px-4 py-3.5 text-[15px] leading-relaxed text-astro-text sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base sm:leading-relaxed"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-astro-highlight/15 text-xs font-semibold text-astro-highlight sm:h-8 sm:w-8 sm:text-sm">
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
