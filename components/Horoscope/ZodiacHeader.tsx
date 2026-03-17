import React, { memo } from 'react';
import { Language } from '../../types';
import { getZodiacSign } from '../../constants';

interface ZodiacHeaderProps {
  sunSign: string;
  language: Language;
}

// Символы знаков зодиака
const ZODIAC_SYMBOLS: Record<string, string> = {
  'Aries': '♈',
  'Taurus': '♉',
  'Gemini': '♊',
  'Cancer': '♋',
  'Leo': '♌',
  'Virgo': '♍',
  'Libra': '♎',
  'Scorpio': '♏',
  'Sagittarius': '♐',
  'Capricorn': '♑',
  'Aquarius': '♒',
  'Pisces': '♓'
};

// Даты знаков зодиака
const ZODIAC_DATES: Record<string, string> = {
  'Aries': '21.03 - 19.04',
  'Taurus': '20.04 - 20.05',
  'Gemini': '21.05 - 20.06',
  'Cancer': '21.06 - 22.07',
  'Leo': '23.07 - 22.08',
  'Virgo': '23.08 - 22.09',
  'Libra': '23.09 - 22.10',
  'Scorpio': '23.10 - 21.11',
  'Sagittarius': '22.11 - 21.12',
  'Capricorn': '22.12 - 19.01',
  'Aquarius': '20.01 - 18.02',
  'Pisces': '19.02 - 20.03'
};

export const ZodiacHeader = memo<ZodiacHeaderProps>(({ sunSign, language }) => {
  const zodiacSymbol = ZODIAC_SYMBOLS[sunSign] || '♈';
  const zodiacDates = ZODIAC_DATES[sunSign] || '';
  const zodiacName = getZodiacSign(language, sunSign);

  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-astro-card to-astro-bg border border-astro-border flex items-center justify-center shadow-lg">
        <span className="text-5xl md:text-6xl text-astro-highlight opacity-90" style={{ 
          filter: 'drop-shadow(0 3px 8px rgba(191, 161, 255, 0.4))'
        }}>
          {zodiacSymbol}
        </span>
      </div>

      <div className="flex-1 pt-1 md:pt-2">
        <h2 className="text-xl md:text-2xl font-semibold text-astro-text mb-1">
          {zodiacName}
        </h2>
        <p className="text-sm md:text-base text-astro-subtext tracking-wide">
          {zodiacDates}
        </p>
      </div>
    </div>
  );
});

ZodiacHeader.displayName = 'ZodiacHeader';
