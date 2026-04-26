import React, { memo } from 'react';
import { Language } from '../../types';
import { getText, getZodiacSign } from '../../constants';
import { ZodiacIcon } from '../icons/ZodiacIcon';

interface ZodiacHeaderProps {
  sunSign: string;
  language: Language;
}

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
  const zodiacDates = ZODIAC_DATES[sunSign] || '';
  const zodiacName = getZodiacSign(language, sunSign);

  return (
    <div className="border-b border-astro-border/25 pb-3.5">
      <p className="lumia-label tracking-[0.16em]">{getText(language, 'planets.sun')}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-astro-text sm:text-2xl">
          {zodiacName}
        </h2>
        <ZodiacIcon sign={sunSign} size={16} stroke="currentColor" className="text-astro-subtext/60" />
      </div>
      <p className="lumia-muted mt-1 text-sm sm:text-[15px]">{zodiacDates}</p>
    </div>
  );
});

ZodiacHeader.displayName = 'ZodiacHeader';
