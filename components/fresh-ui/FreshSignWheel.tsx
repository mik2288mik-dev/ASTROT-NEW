import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { ChevronRightIcon } from '../icons/UiIcons';
import { getZodiacSign } from '../../constants';
import { APPROXIMATE_SUN_SIGN_DATES } from '../../lib/zodiac-utils';
import type { Language } from '../../types';

/**
 * Крупная карусель выбора знака для Совместимости: активный знак показан большим
 * (иконка + название + ДИАПАЗОН ДАТ + стихия), меняется свайпом/стрелками с
 * анимацией framer-motion. Снизу — лента из 12 для прямого выбора.
 * Отдельный компонент, чтобы не трогать тонкую ленту гороскопа (FreshSignCarousel).
 */

interface Props {
  signs: readonly string[];
  active: string;
  language: Language;
  onPick: (sign: string) => void;
}

const SIGN_BG: Record<string, string> = {
  aries: 'var(--fresh-coral)', leo: 'var(--fresh-coral)', sagittarius: 'var(--fresh-coral)',
  taurus: 'var(--fresh-mint)', virgo: 'var(--fresh-mint)', capricorn: 'var(--fresh-mint)',
  gemini: 'var(--fresh-sky)', libra: 'var(--fresh-sky)', aquarius: 'var(--fresh-sky)',
  cancer: 'var(--fresh-lavender)', scorpio: 'var(--fresh-lavender)', pisces: 'var(--fresh-lavender)',
};

const SIGN_ELEMENT: Record<string, { ru: string; en: string }> = {
  aries: { ru: 'Огонь', en: 'Fire' }, leo: { ru: 'Огонь', en: 'Fire' }, sagittarius: { ru: 'Огонь', en: 'Fire' },
  taurus: { ru: 'Земля', en: 'Earth' }, virgo: { ru: 'Земля', en: 'Earth' }, capricorn: { ru: 'Земля', en: 'Earth' },
  gemini: { ru: 'Воздух', en: 'Air' }, libra: { ru: 'Воздух', en: 'Air' }, aquarius: { ru: 'Воздух', en: 'Air' },
  cancer: { ru: 'Вода', en: 'Water' }, scorpio: { ru: 'Вода', en: 'Water' }, pisces: { ru: 'Вода', en: 'Water' },
};

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateRange(sign: string, ru: boolean): string {
  const key = sign.charAt(0).toUpperCase() + sign.slice(1).toLowerCase();
  const d = (APPROXIMATE_SUN_SIGN_DATES as Record<string, { startMonth: number; startDay: number; endMonth: number; endDay: number }>)[key];
  if (!d) return '';
  const M = ru ? MONTHS_RU : MONTHS_EN;
  return `${d.startDay} ${M[d.startMonth - 1]} – ${d.endDay} ${M[d.endMonth - 1]}`;
}

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 130 : -130, opacity: 0, scale: 0.92 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -130 : 130, opacity: 0, scale: 0.92 }),
};

export const FreshSignWheel: React.FC<Props> = ({ signs, active, language, onPick }) => {
  const ru = language !== 'en';
  const reduce = useReducedMotion();
  const [dir, setDir] = useState(0);

  const n = signs.length;
  const idx = Math.max(0, signs.findIndex((s) => s.toLowerCase() === active.toLowerCase()));
  const lowerActive = active.toLowerCase();

  const step = (delta: number) => {
    setDir(delta);
    onPick(signs[(idx + delta + n) % n]);
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.2;
    if (power < -70) step(1);
    else if (power > 70) step(-1);
  };

  return (
    <div className="signwheel">
      <div className="signwheel-stage">
        <button type="button" className="signwheel-nav" onClick={() => step(-1)} aria-label={ru ? 'Предыдущий знак' : 'Previous sign'}>
          <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><ChevronRightIcon size={18} /></span>
        </button>

        <div className="signwheel-card-wrap">
          <AnimatePresence custom={dir} initial={false} mode="popLayout">
            <motion.div
              key={lowerActive}
              className="signwheel-card"
              style={{ background: SIGN_BG[lowerActive] || 'var(--fresh-sky)' }}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 32 }}
              drag={reduce ? false : 'x'}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={onDragEnd}
            >
              <div className="signwheel-el">{SIGN_ELEMENT[lowerActive] ? (ru ? SIGN_ELEMENT[lowerActive].ru : SIGN_ELEMENT[lowerActive].en) : ''}</div>
              <div className="signwheel-ico" aria-hidden><ZodiacIcon sign={active} size={56} strokeWidth={1.2} stroke="#1f1f1f" /></div>
              <div className="signwheel-name">{getZodiacSign(ru ? 'ru' : 'en', active)}</div>
              <div className="signwheel-range">{dateRange(active, ru)}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <button type="button" className="signwheel-nav" onClick={() => step(1)} aria-label={ru ? 'Следующий знак' : 'Next sign'}>
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <div className="signwheel-rail scrollbar-hide">
        {signs.map((s) => {
          const a = s.toLowerCase() === lowerActive;
          return (
            <button
              key={s}
              type="button"
              className={`signwheel-dot${a ? ' active' : ''}`}
              style={a ? { background: SIGN_BG[s.toLowerCase()] || 'var(--fresh-sky)' } : undefined}
              onClick={() => { setDir(0); onPick(s); }}
              aria-pressed={a}
              aria-label={getZodiacSign(ru ? 'ru' : 'en', s)}
            >
              <ZodiacIcon sign={s} size={18} strokeWidth={1.6} stroke={a ? '#1f1f1f' : 'currentColor'} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
