import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getDayFavorability, getLuckyElements } from '../../../lib/horoscope/dayFavorability';
import { RadialGauge } from './gauges';

const EASE = [0.22, 1, 0.36, 1] as const;

/** #6 Moon phase + #9 Lucky elements — a vivid two-up row for today. */
export function MoonLuckyRow({
  sign,
  todayKey,
  language,
}: {
  sign: string;
  todayKey: string;
  language: 'ru' | 'en';
}) {
  const safeSign = sign || 'Aries';
  const fav = useMemo(() => getDayFavorability(safeSign, todayKey), [safeSign, todayKey]);
  const lucky = useMemo(() => getLuckyElements(safeSign, todayKey, language), [safeSign, todayKey, language]);

  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {/* Moon */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="flex items-center gap-3 rounded-[20px] bg-[#EEE9FB] p-4"
      >
        <RadialGauge value={fav.illumination} size={62} stroke={7} color="#7B5CF6" track="#DCD3F2">
          <span className="text-[18px] leading-none">🌙</span>
        </RadialGauge>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
            {language === 'ru' ? 'Луна' : 'Moon'}
          </p>
          <p className="font-lumiaHomeDisplay text-[15px] font-bold leading-tight text-[#1E1230]">{fav.moonShort}</p>
          <p className="text-[11px] font-semibold text-[#7B5CF6]">{fav.illumination}%</p>
        </div>
      </motion.div>

      {/* Lucky elements */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06, ease: EASE }}
        className="rounded-[20px] border border-[#EAE3F1] bg-white p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
          {language === 'ru' ? 'Талисманы дня' : 'Lucky today'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-[#1E1230]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F3FB] py-1 pl-1.5 pr-2.5">
            <span className="h-4 w-4 rounded-full" style={{ background: lucky.color.hex }} />
            {lucky.color.name}
          </span>
          <span className="rounded-full bg-[#F6F3FB] px-2.5 py-1">№ {lucky.number}</span>
          <span className="rounded-full bg-[#F6F3FB] px-2.5 py-1">{lucky.time}</span>
        </div>
      </motion.div>
    </div>
  );
}
