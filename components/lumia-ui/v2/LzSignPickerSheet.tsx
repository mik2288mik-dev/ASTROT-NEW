import React from 'react';
import { getZodiacSign } from '../../../constants';
import type { Language } from '../../../types';
import { ZodiacIcon } from '../../icons/ZodiacIcon';
import { ZODIAC_KEYS } from '../../../lib/zodiacKeys';
import { CosmicSheet } from '../CosmicSheet';

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

  return (
    <CosmicSheet
      open={open}
      title={title || (lang === 'ru' ? 'Выбери знак' : 'Pick a sign')}
      subtitle={subtitle}
      closeLabel={lang === 'ru' ? 'Закрыть' : 'Close'}
      className="lz-sheet-panel"
      contentClassName="lz-sheet-scroll"
      onClose={onClose}
    >
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
                          stroke={active ? '#ffffff' : 'rgba(241,245,249,0.82)'}
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
    </CosmicSheet>
  );
}

function cnSignCell(active: boolean) {
  return [
    'flex min-h-[108px] flex-col items-center justify-center gap-2.5 rounded-[20px] border px-2 py-3',
    'transition-transform active:scale-[0.97]',
    active
      ? 'border-white/70 bg-white/15 text-white shadow-none'
      : 'border-white/15 bg-black/25 text-white shadow-none',
  ].join(' ');
}
