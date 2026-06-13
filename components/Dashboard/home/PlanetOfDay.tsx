import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { NatalChartData, PlanetInsight, UserProfile } from '../../../types';
import type { NatalPlanetKey } from '../../../lib/natalPlanetMeta';
import { hasActivePremium } from '../../../lib/accessMatrix';
import { getCachedPlanetInsight, getPlanetInsight } from '../../../services/astrologyService';

const DAY_PLANETS: NatalPlanetKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];

const PLANET_LABEL: Record<string, { ru: string; en: string; emoji: string }> = {
  sun: { ru: 'Солнце', en: 'Sun', emoji: '☀️' },
  moon: { ru: 'Луна', en: 'Moon', emoji: '🌙' },
  mercury: { ru: 'Меркурий', en: 'Mercury', emoji: '☿️' },
  venus: { ru: 'Венера', en: 'Venus', emoji: '♀️' },
  mars: { ru: 'Марс', en: 'Mars', emoji: '♂️' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter', emoji: '🪐' },
  saturn: { ru: 'Сатурн', en: 'Saturn', emoji: '🪐' },
};

function planetOfDay(todayKey: string): NatalPlanetKey {
  const [y, m, d] = todayKey.split('-').map(Number);
  const doy = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  return DAY_PLANETS[((doy % DAY_PLANETS.length) + DAY_PLANETS.length) % DAY_PLANETS.length];
}

/** #7 — a rotating "planet of the day" reading from the user's chart. Pro + chart. */
export function PlanetOfDay({
  profile,
  chartData,
  chartId,
  todayKey,
  language,
  onNeedChart,
  onRequestPremium,
}: {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  todayKey: string;
  language: 'ru' | 'en';
  onNeedChart?: () => void;
  onRequestPremium?: () => void;
}) {
  const planet = planetOfDay(todayKey);
  const label = PLANET_LABEL[planet];
  const premium = hasActivePremium(profile);
  const allowed = !!chartData && premium;

  const [insight, setInsight] = useState<PlanetInsight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!allowed || !chartData) return;
    let alive = true;
    setInsight(null);
    setLoading(true);
    void getCachedPlanetInsight(String(profile.id), planet, language, chartId ?? null)
      .then((c) => c || getPlanetInsight(profile, chartData, planet, chartId ?? null))
      .then((r) => { if (alive) setInsight(r); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [allowed, chartData, planet, language, profile, chartId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 rounded-[24px] border border-[#EAE3F1] bg-white p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
          {language === 'ru' ? 'Планета дня' : 'Planet of the day'}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F3FB] px-2.5 py-1 text-[12px] font-bold text-[#1E1230]">
          <span>{label.emoji}</span>
          {language === 'ru' ? label.ru : label.en}
        </span>
      </div>

      {!allowed ? (
        <div className="mt-3">
          <p className="text-[13px] leading-relaxed text-[#50465E]">
            {!chartData
              ? (language === 'ru' ? 'Создай карту, чтобы читать свои планеты.' : 'Create a chart to read your planets.')
              : (language === 'ru' ? 'Разбор планеты по карте — в Premium.' : 'Personal planet reading is in Premium.')}
          </p>
          <button
            type="button"
            onClick={!chartData ? onNeedChart : onRequestPremium}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#7B5CF6] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            <Sparkles size={15} />
            {!chartData
              ? (language === 'ru' ? 'Создать карту' : 'Create chart')
              : (language === 'ru' ? 'Открыть Premium' : 'Unlock Premium')}
          </button>
        </div>
      ) : loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-[16px] bg-black/[0.05]" aria-busy="true" />
      ) : insight ? (
        <div className="mt-3">
          <h3 className="font-lumiaHomeDisplay text-[18px] font-bold leading-tight text-[#1E1230]">{insight.title}</h3>
          {insight.sign || insight.house != null ? (
            <p className="mt-1 text-[12px] font-semibold text-[#7B5CF6]">
              {[insight.sign, insight.house != null ? (language === 'ru' ? `${insight.house} дом` : `house ${insight.house}`) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-[#50465E]">{insight.body}</p>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[#9A93A3]">{language === 'ru' ? 'Скоро будет готово.' : 'Coming soon.'}</p>
      )}
    </motion.div>
  );
}
