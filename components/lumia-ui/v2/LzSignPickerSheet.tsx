import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getZodiacSign } from '../../../constants';
import type { Language } from '../../../types';
import { ZodiacIcon } from '../../icons/ZodiacIcon';
import { ZODIAC_KEYS } from '../../../lib/horoscope/signDaily';

type LzSignPickerSheetProps = {
  open: boolean;
  language: Language;
  current: string | null;
  title?: string;
  subtitle?: string;
  onPick: (sign: string) => void;
  onClose: () => void;
};

export function LzSignPickerSheet({
  open,
  language,
  current,
  title,
  subtitle,
  onPick,
  onClose,
}: LzSignPickerSheetProps) {
  const lang = language === 'en' ? 'en' : 'ru';

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="lz-sheet-backdrop fixed inset-0 z-[130]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="lz-sheet-panel fixed inset-x-0 bottom-0 z-[131] flex max-h-[min(90dvh,720px)] flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          >
            <div className="mx-auto mb-3 mt-2 h-1 w-11 shrink-0 rounded-full bg-mono-line" />
            <div className="shrink-0 px-5 pb-3">
              <p className="lz-kicker">{lang === 'ru' ? 'Гороскоп' : 'Horoscope'}</p>
              <h2 className="mt-1 font-lumiaHome text-[26px] font-bold leading-tight text-mono-ink">
                {title || (lang === 'ru' ? 'Выбери знак' : 'Pick a sign')}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-[14px] leading-snug text-mono-muted">{subtitle}</p>
              ) : null}
            </div>

            <div className="lz-sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
              <div className="grid grid-cols-3 gap-3 pb-[calc(var(--lumia-bottom-tab-clearance)+1.25rem)]">
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
                      className={cnSignCell(active)}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                        <ZodiacIcon
                          sign={sign}
                          size={30}
                          stroke={active ? '#ffffff' : '#111111'}
                          strokeWidth={1.5}
                        />
                      </span>
                      <span className={`text-[12px] font-bold leading-tight ${active ? 'text-white' : 'text-mono-ink'}`}>
                        {getZodiacSign(lang, sign)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function cnSignCell(active: boolean) {
  return [
    'flex min-h-[108px] flex-col items-center justify-center gap-2.5 rounded-[20px] border px-2 py-3',
    'transition-transform active:scale-[0.97]',
    active
      ? 'border-mono-black bg-mono-black text-white shadow-[0_12px_28px_rgba(17,17,17,0.22)]'
      : 'border-mono-line bg-mono-white text-mono-ink shadow-[0_4px_16px_rgba(17,17,17,0.05)]',
  ].join(' ');
}
