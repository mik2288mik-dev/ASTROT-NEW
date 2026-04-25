import React from 'react';
import type { SerializedChartForPrompt } from '../../lib/natalReading/chartSerializer';
import { Divider, SectionLabel } from './SectionLabel';
import {
  PLANET_COLOR,
  PLANET_DESCRIPTION,
  PLANET_GLYPH,
  SIGN_GLYPH,
} from './constants';

type Props = { chart: SerializedChartForPrompt };

function PlanetRow({
  name,
  sign,
  house,
  deg,
  retro,
}: {
  name: string;
  sign: string;
  house: number | null;
  deg: string;
  retro?: boolean;
}) {
  const bg = PLANET_COLOR[name] || '#f3f3f3';
  const glyph = PLANET_GLYPH[name] || '·';
  const desc = PLANET_DESCRIPTION[name] || '';
  return (
    <li className="flex items-start gap-3.5 py-3.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: bg }}
      >
        <span className="font-astro-symbols text-[15px] leading-none text-[#3a3a3a]">
          {glyph}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-[#1f1f1f]">
          <span>{name}</span>
          <span className="text-[#9a9a9a]"> · </span>
          <span>{sign}</span>
          {house != null ? (
            <>
              <span className="text-[#9a9a9a]"> · </span>
              <span>{house}-й дом</span>
            </>
          ) : null}
          <span className="text-[#9a9a9a]"> · </span>
          <span className="font-mono text-[12.5px] tracking-tight">{deg}</span>
          {retro ? <span className="ml-1 text-[#c97c7c]">℞</span> : null}
        </p>
        <p className="mt-0.5 font-lora text-[13.5px] leading-[1.6] text-[#5e5e5e]">
          {desc}
        </p>
      </div>
      <span className="ml-1 mt-2 font-astro-symbols text-[14px] leading-none text-[#bdbdbd]">
        {SIGN_GLYPH[sign] || ''}
      </span>
    </li>
  );
}

export const Planets: React.FC<Props> = ({ chart }) => {
  return (
    <section className="px-5 pt-7 pb-7">
      <SectionLabel tier="free">Положение планет</SectionLabel>

      <ul className="mt-3 divide-y divide-[#f2f2f2]">
        {chart.planets.filter(Boolean).map((p) => (
          <PlanetRow
            key={p!.name}
            name={p!.name}
            sign={p!.sign}
            house={p!.house}
            deg={p!.deg}
            retro={p!.retro}
          />
        ))}
      </ul>

      <div className="mt-3">
        <Divider />
      </div>
    </section>
  );
};
