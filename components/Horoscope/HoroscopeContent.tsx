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
    <div className="space-y-5">
      <div className="rounded-[24px] border border-astro-border bg-gradient-to-b from-astro-card to-astro-card/65 p-6 shadow-sm">
        <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
          {getText(language, 'horoscope.reading_title')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
          {getText(language, 'horoscope.reading_body')}
        </p>

        <div className="mt-5">
          <FormattedAiText
            text={content}
            paragraphClassName="font-serif text-base md:text-lg text-astro-text leading-[1.75] max-w-[70ch]"
          />
        </div>
      </div>

      {(moonImpact || transitFocus) && (
        <div className="rounded-[24px] border border-astro-border bg-astro-card/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
            {getText(language, 'horoscope.context_title')}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
            {getText(language, 'horoscope.context_body')}
          </p>

          <div className="mt-4 space-y-3">
            {moonImpact && (
              <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4">
                <h3 className="text-sm font-semibold text-astro-text">
                  {getText(language, 'horoscope.moon_impact_title')}
                </h3>
                <div className="mt-2 font-serif">
                  <FormattedAiText text={moonImpact} paragraphClassName="text-[15px] leading-relaxed text-astro-text/90" />
                </div>
              </div>
            )}

            {transitFocus && (
              <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4">
                <h3 className="text-sm font-semibold text-astro-text">
                  {getText(language, 'horoscope.transit_focus_title')}
                </h3>
                <div className="mt-2 font-serif">
                  <FormattedAiText text={transitFocus} paragraphClassName="text-[15px] leading-relaxed text-astro-text/90" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <div className="rounded-[24px] border border-astro-border bg-astro-card/55 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
            {getText(language, 'horoscope.advice_title')}
          </p>
          <ul className="mt-4 space-y-3">
            {tips.map((line, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-2xl border border-astro-border/60 bg-astro-bg/20 px-4 py-3 text-sm leading-relaxed text-astro-text"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-astro-highlight/15 text-xs font-semibold text-astro-highlight">
                  {i + 1}
                </span>
                <span className="min-w-0 pt-0.5">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

HoroscopeContent.displayName = 'HoroscopeContent';
