import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getZodiacSign } from '../../../constants';
import type { Language } from '../../../types';
import { ZodiacIcon } from '../../icons/ZodiacIcon';
import { ZODIAC_KEYS } from '../../../lib/horoscope/signDaily';

type LzSignPickerSheetProps = {
  open: boolean;
  language: Language;
  current: string | null;
  onPick: (sign: string) => void;
  onClose: () => void;
};

export function LzSignPickerSheet({ open, language, current, onPick, onClose }: LzSignPickerSheetProps) {
  const lang = language === 'en' ? 'en' : 'ru';

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[80] bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-[81] max-h-[78vh] overflow-y-auto rounded-t-[24px] bg-mono-white px-4 pb-8 pt-5 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-mono-line" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mono-muted">
              {lang === 'ru' ? 'Гороскоп' : 'Horoscope'}
            </p>
            <h2 className="mt-2 text-[22px] font-bold text-mono-ink">
              {lang === 'ru' ? 'Выбери знак' : 'Pick a sign'}
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {ZODIAC_KEYS.map((sign) => {
                const active = !!current && sign.toLowerCase() === current.toLowerCase();
                return (
                  <button
                    key={sign}
                    type="button"
                    onClick={() => {
                      onPick(sign);
                      onClose();
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-[18px] px-2 py-3.5 active:scale-95 ${
                      active ? 'bg-mono-black text-white' : 'border border-mono-line bg-mono-white'
                    }`}
                  >
                    <ZodiacIcon sign={sign} size={28} stroke={active ? '#ffffff' : '#111111'} strokeWidth={1.6} />
                    <span className={`text-[12px] font-semibold leading-none ${active ? 'text-white' : 'text-mono-ink'}`}>
                      {getZodiacSign(lang, sign)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
