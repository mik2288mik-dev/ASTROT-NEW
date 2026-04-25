import React, { useEffect, useMemo, useState } from 'react';
import type { NatalReadingArchetype } from '../../lib/natalReading/types';
import { ARCHETYPE_FADE_MS, ARCHETYPE_ROTATION_MS, SIGN_GLYPH } from './constants';

type HeroProps = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  signature: { sun: string; moon: string; rising: string; mc?: string };
  archetypes: NatalReadingArchetype[] | null;
  loadingArchetypes?: boolean;
};

function metaLine(date: string, time: string, place: string): string {
  const parts = [date, time, place].filter(Boolean);
  return parts.join(' · ');
}

function Chip({ glyph, label }: { glyph: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-[#ececec] bg-white px-3 py-1 text-[12px] text-[#3a3a3a]">
      <span className="font-astro-symbols text-[13px] leading-none">{glyph}</span>
      <span className="leading-none">{label}</span>
    </span>
  );
}

/** A safe default archetype that always renders even before the API returns. */
function defaultArchetype(sun: string, moon: string): NatalReadingArchetype {
  return {
    title: `${sun} и ${moon}`,
    subtitle: 'Твоя натальная карта собрана и готова — читай дальше',
  };
}

export const Hero: React.FC<HeroProps> = ({
  name,
  birthDate,
  birthTime,
  birthPlace,
  signature,
  archetypes,
  loadingArchetypes = false,
}) => {
  const fallback = useMemo(
    () => defaultArchetype(signature.sun, signature.moon),
    [signature.sun, signature.moon]
  );

  const list = archetypes && archetypes.length ? archetypes : [fallback];
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (list.length < 2) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % list.length);
        setVisible(true);
      }, ARCHETYPE_FADE_MS);
    }, ARCHETYPE_ROTATION_MS);
    return () => clearInterval(interval);
  }, [list.length]);

  const current = list[Math.min(idx, list.length - 1)];

  return (
    <section className="px-5 pt-7 pb-8">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#9a9a9a]">
        {metaLine(birthDate, birthTime, birthPlace)}
      </p>

      <h1
        className="mt-3 font-lora text-[27px] leading-[1.2] tracking-[-0.005em] text-[#1f1f1f]"
        style={{
          opacity: loadingArchetypes && !archetypes ? 0.4 : visible ? 1 : 0,
          transition: `opacity ${ARCHETYPE_FADE_MS}ms ease`,
        }}
      >
        {current.title}
      </h1>

      <p
        className="mt-2 font-lora italic text-[15px] leading-[1.55] text-[#5e5e5e]"
        style={{
          opacity: loadingArchetypes && !archetypes ? 0.4 : visible ? 1 : 0,
          transition: `opacity ${ARCHETYPE_FADE_MS}ms ease`,
        }}
      >
        {current.subtitle}
      </p>

      <p className="mt-3 text-[13px] text-[#9a9a9a]">{name}</p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        <Chip glyph={SIGN_GLYPH[signature.sun] || '☉'} label={`Солнце · ${signature.sun}`} />
        <Chip glyph={SIGN_GLYPH[signature.moon] || '☽'} label={`Луна · ${signature.moon}`} />
        <Chip glyph={SIGN_GLYPH[signature.rising] || '↑'} label={`Асц · ${signature.rising}`} />
        {signature.mc ? (
          <Chip glyph={SIGN_GLYPH[signature.mc] || 'MC'} label={`MC · ${signature.mc}`} />
        ) : null}
      </div>
    </section>
  );
};
