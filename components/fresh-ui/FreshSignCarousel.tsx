import React, { useEffect, useRef } from 'react';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { getZodiacSign } from '../../constants';
import type { Language } from '../../types';

interface FreshSignCarouselProps {
  signs: readonly string[];
  active: string;
  language: Language;
  onPick: (sign: string) => void;
}

/**
 * Горизонтальная лента из 12 знаков (как в популярных приложениях):
 * активный подсвечен, лента автопрокручивается к нему. Смена знака —
 * мгновенная, без всплывающего экрана.
 */
export const FreshSignCarousel: React.FC<FreshSignCarouselProps> = ({
  signs,
  active,
  language,
  onPick,
}) => {
  const activeRef = useRef<HTMLButtonElement>(null);
  const lang = language === 'en' ? 'en' : 'ru';

  useEffect(() => {
    const el = activeRef.current;
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <div className="fresh-sign-rail scrollbar-hide">
      {signs.map((sign) => {
        const isActive = sign.toLowerCase() === active.toLowerCase();
        return (
          <button
            key={sign}
            ref={isActive ? activeRef : undefined}
            type="button"
            className={`fresh-sign-chip ${isActive ? 'active' : ''}`}
            onClick={() => onPick(sign)}
            aria-pressed={isActive}
          >
            <ZodiacIcon sign={sign} size={18} strokeWidth={1.6} />
            <span>{getZodiacSign(lang, sign)}</span>
          </button>
        );
      })}
    </div>
  );
};
