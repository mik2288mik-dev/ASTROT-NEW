import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getZodiacSign } from '../../constants';
import type { Language } from '../../types';
import { ZodiacIllustration, ZodiacSymbol } from '../icons/ZodiacArt';
import { ChevronDownIcon } from '../icons/UiIcons';

interface ZodiacSignGridProps {
  signs: readonly string[];
  active: string;
  ownSign?: string;
  language: Language;
  onPick: (sign: string) => void;
}

export const ZodiacSignGrid: React.FC<ZodiacSignGridProps> = ({
  signs,
  active,
  ownSign,
  language,
  onPick,
}) => {
  const [expanded, setExpanded] = useState(true);
  const reduceMotion = useReducedMotion();
  const lang = language === 'en' ? 'en' : 'ru';
  const activeLabel = getZodiacSign(lang, active);
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.17, ease: 'easeOut' as const };

  const pick = (sign: string) => {
    onPick(sign);
    setExpanded(false);
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
            className="zodiac-sign-selection"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={transition}
          >
            <div className="zodiac-sign-picker-intro">
              <strong>{lang === 'ru' ? 'Выбери знак' : 'Choose a sign'}</strong>
              <span>
                {lang === 'ru'
                  ? 'Нажми — гороскоп на сегодня откроется сразу'
                  : 'Tap once to open today’s horoscope'}
              </span>
            </div>

            <div className="zodiac-sign-grid">
              {signs.map((sign) => {
                const isActive = sign.toLowerCase() === active.toLowerCase();
                const isOwnSign = sign.toLowerCase() === ownSign?.toLowerCase();
                const label = getZodiacSign(lang, sign);
                return (
                  <button
                    key={sign}
                    type="button"
                    className="zodiac-sign-option"
                    data-active={isActive}
                    data-own={isOwnSign}
                    aria-label={isOwnSign
                      ? `${label}. ${lang === 'ru' ? 'Твой знак' : 'Your sign'}`
                      : label}
                    aria-pressed={isActive}
                    onClick={() => pick(sign)}
                  >
                    {isOwnSign ? (
                      <span className="zodiac-sign-own-badge">
                        {lang === 'ru' ? 'Твой' : 'Yours'}
                      </span>
                    ) : null}
                    <span className="zodiac-sign-option-art" aria-hidden>
                      <ZodiacIllustration sign={sign} />
                    </span>
                    <span className="zodiac-sign-option-meta">
                      <span>{label}</span>
                      <ZodiacSymbol sign={sign} size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
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
            <span className="zodiac-sign-summary-art" aria-hidden>
              <ZodiacIllustration sign={active} />
              <span className="zodiac-sign-summary-symbol">
                <ZodiacSymbol sign={active} size={19} />
              </span>
            </span>
            <span className="zodiac-sign-summary-copy">
              <strong>{activeLabel}</strong>
              <small>
                {lang === 'ru'
                  ? `${active.toLowerCase() === ownSign?.toLowerCase() ? 'Твой знак · ' : ''}Сменить знак`
                  : `${active.toLowerCase() === ownSign?.toLowerCase() ? 'Your sign · ' : ''}Change sign`}
              </small>
            </span>
            <span className="zodiac-sign-summary-chevron" aria-hidden>
              <ChevronDownIcon size={19} />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.section>
  );
};
