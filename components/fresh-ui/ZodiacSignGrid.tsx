import React from 'react';
import { getZodiacSign } from '../../constants';
import type { Language } from '../../types';
import { ZodiacSymbol } from '../icons/ZodiacArt';

interface ZodiacSignGridProps {
  signs: readonly string[];
  active: string;
  ownSign?: string;
  language: Language;
  onPick: (sign: string) => void;
}

/** Persistent sign grid: every sign remains visible and one tap away. */
export const ZodiacSignGrid: React.FC<ZodiacSignGridProps> = ({
  signs,
  active,
  ownSign,
  language,
  onPick,
}) => {
  const lang = language === 'en' ? 'en' : 'ru';
  return (
    <section
      className="zodiac-sign-picker zodiac-sign-picker--persistent"
      aria-label={lang === 'ru' ? 'Выбор знака зодиака' : 'Choose a zodiac sign'}
    >
      <div className="zodiac-sign-grid zodiac-sign-grid--compact">
        {signs.map((sign) => {
          const label = getZodiacSign(lang, sign);
          const isActive = sign.toLowerCase() === active.toLowerCase();
          const isOwnSign = sign.toLowerCase() === ownSign?.toLowerCase();
          return (
            <button
              key={sign}
              type="button"
              className="zodiac-sign-compact-option"
              data-active={isActive}
              data-own={isOwnSign}
              aria-label={isOwnSign
                ? `${label}. ${lang === 'ru' ? 'Твой знак' : 'Your sign'}`
                : label}
              aria-pressed={isActive}
              onClick={() => onPick(sign)}
            >
              <ZodiacSymbol sign={sign} size={30} />
              <span>{label}</span>
              {isOwnSign ? <i aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
};
