import React, { memo } from 'react';
import { Language } from '../../types';
import { getText, getZodiacSign } from '../../constants';

interface ZodiacHeaderProps {
  sunSign: string;
  language: Language;
}

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

const ZODIAC_DATES: Record<string, string> = {
  Aries: '21.03 - 19.04',
  Taurus: '20.04 - 20.05',
  Gemini: '21.05 - 20.06',
  Cancer: '21.06 - 22.07',
  Leo: '23.07 - 22.08',
  Virgo: '23.08 - 22.09',
  Libra: '23.09 - 22.10',
  Scorpio: '23.10 - 21.11',
  Sagittarius: '22.11 - 21.12',
  Capricorn: '22.12 - 19.01',
  Aquarius: '20.01 - 18.02',
  Pisces: '19.02 - 20.03',
};

/**
 * Sun sign row: typography leads; glyph is a quiet accent (not a hero mark).
 */
export const ZodiacHeader = memo<ZodiacHeaderProps>(({ sunSign, language }) => {
  const zodiacSymbol = ZODIAC_SYMBOLS[sunSign] || '♈';
  const zodiacDates = ZODIAC_DATES[sunSign] || '';
  const zodiacName = getZodiacSign(language, sunSign);

  return (
    <div className="flex items-center gap-4 border-b border-astro-border/40 pb-5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-astro-border/50 bg-astro-bg/30 text-[22px] leading-none text-astro-highlight/75 sm:h-12 sm:w-12 sm:text-[24px]"
        aria-hidden
      >
        {zodiacSymbol}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-astro-subtext">
          {getText(language, 'planets.sun')}
        </p>
        <h2 className="mt-0.5 font-serif text-lg font-semibold tracking-tight text-astro-text sm:text-xl">
          {zodiacName}
        </h2>
        <p className="mt-0.5 text-xs text-astro-subtext/90 sm:text-sm">{zodiacDates}</p>
      </div>
    </div>
  );
});

ZodiacHeader.displayName = 'ZodiacHeader';
