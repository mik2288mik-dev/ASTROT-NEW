import React from 'react';
import type { SerializedChartForPrompt } from '../../lib/natalReading/chartSerializer';
import { Divider, SectionLabel } from './SectionLabel';
import { HOUSE_TOPICS } from './constants';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { PlanetIcon } from '../icons/PlanetIcon';

type Props = { chart: SerializedChartForPrompt };

export const Houses: React.FC<Props> = ({ chart }) => {
  const planetsByHouse = new Map<number, string[]>();
  for (const p of chart.planets) {
    if (!p || p.house == null) continue;
    const arr = planetsByHouse.get(p.house) || [];
    arr.push(p.name);
    planetsByHouse.set(p.house, arr);
  }

  return (
    <section className="px-5 pt-7 pb-7">
      <SectionLabel>Асцендент и дома</SectionLabel>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
            Асцендент
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <PlanetIcon planet="asc" size={15} stroke="#5e5e5e" />
            <span className="font-lora text-[15px] leading-[1.7] text-[#2d2d2d]">
              {chart.asc.sign}
            </span>
            <span className="font-mono text-[12.5px] text-[#9a9a9a]">{chart.asc.deg}</span>
          </div>
          <p className="mt-1.5 font-lora text-[13.5px] leading-[1.65] text-[#5e5e5e]">
            Твоя «маска» во внешнем мире — то, как тебя считывают при первой встрече.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
            Середина Неба (MC)
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <PlanetIcon planet="mc" size={15} stroke="#5e5e5e" />
            <span className="font-lora text-[15px] leading-[1.7] text-[#2d2d2d]">
              {chart.mc.sign}
            </span>
            {chart.mc.deg ? (
              <span className="font-mono text-[12.5px] text-[#9a9a9a]">{chart.mc.deg}</span>
            ) : null}
          </div>
          <p className="mt-1.5 font-lora text-[13.5px] leading-[1.65] text-[#5e5e5e]">
            Карьерные устремления и общественный образ.
          </p>
        </div>
      </div>

      <ul className="mt-7 divide-y divide-[#f2f2f2]">
        {chart.houses.map((h) => {
          const planets = planetsByHouse.get(h.num) || [];
          return (
            <li key={h.num} className="flex items-baseline gap-3 py-3">
              <span className="w-7 shrink-0 font-mono text-[12px] text-[#9a9a9a]">
                {h.num}
              </span>
              <span className="flex w-24 shrink-0 items-center gap-1.5">
                <ZodiacIcon sign={h.sign} size={13} stroke="#bdbdbd" />
                <span className="font-lora text-[14px] text-[#1f1f1f]">{h.sign}</span>
              </span>
              <span className="flex-1 font-lora text-[13.5px] text-[#5e5e5e]">
                {HOUSE_TOPICS[h.num] || ''}
              </span>
              {planets.length ? (
                <span className="text-[12px] text-[#6f4ea8]">
                  {planets.join(', ')}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        <Divider />
      </div>
    </section>
  );
};
