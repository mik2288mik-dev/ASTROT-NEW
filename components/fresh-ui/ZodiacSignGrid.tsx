import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getZodiacSign } from '../../constants';
import type { Language } from '../../types';
import { ZodiacSymbol } from '../icons/ZodiacArt';

interface ZodiacSignGridProps {
  signs: readonly string[];
  active: string;
  language: Language;
  onPick: (sign: string) => void;
}

export const ZodiacSignGrid: React.FC<ZodiacSignGridProps> = ({
  signs,
  active,
  language,
  onPick,
}) => {
  const [expanded, setExpanded] = useState(true);
  const reduceMotion = useReducedMotion();
  const lang = language === 'en' ? 'en' : 'ru';
  const activeLabel = getZodiacSign(lang, active);
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.17, ease: 'easeOut' as const };

  const pick = (sign: string) => {
    setExpanded(false);
    onPick(sign);
  };

  return (
    <motion.section
      layout={!reduceMotion}
      className="zodiac-sign-picker"
      aria-label={lang === 'ru' ? 'Выбор знака зодиака' : 'Choose a zodiac sign'}
      transition={transition}
    >
      <AnimatePresence initial={false} mode="wait">
        {expanded ? (
          <motion.div
            key="grid"
            className="zodiac-sign-grid"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={transition}
          >
            {signs.map((sign) => {
              const isActive = sign.toLowerCase() === active.toLowerCase();
              const label = getZodiacSign(lang, sign);
              return (
                <button
                  key={sign}
                  type="button"
                  className="zodiac-sign-option"
                  data-active={isActive}
                  aria-label={label}
                  aria-pressed={isActive}
                  onClick={() => pick(sign)}
                >
                  <ZodiacSymbol sign={sign} size={25} />
                  <span>{label}</span>
                </button>
              );
            })}
          </motion.div>
        ) : (
          <motion.button
            key="summary"
            layout={!reduceMotion}
            type="button"
            className="zodiac-sign-summary"
            aria-expanded={false}
            aria-label={lang === 'ru' ? `${activeLabel}. Сменить знак` : `${activeLabel}. Change sign`}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={transition}
            onClick={() => setExpanded(true)}
          >
            <span className="zodiac-sign-summary-symbol" aria-hidden>
              <ZodiacSymbol sign={active} size={27} />
            </span>
            <span className="zodiac-sign-summary-copy">
              <strong>{activeLabel}</strong>
              <small>{lang === 'ru' ? 'Сменить знак' : 'Change sign'}</small>
            </span>
            <span className="zodiac-sign-summary-chevron" aria-hidden>⌄</span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.section>
  );
};
