import React from 'react';
import type { NatalReadingAspects } from '../../lib/natalReading/types';
import { Divider, SectionLabel } from './SectionLabel';
import { READING_INSIGHT_BG } from './constants';
import { SkeletonParagraph } from './Skeleton';

type Props = { data: NatalReadingAspects | null; loading: boolean };

function isLightHex(hex: string): boolean {
  const m = hex.replace('#', '');
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62;
}

function Badge({ label, color }: { label: string; color: string }) {
  const text = isLightHex(color) ? '#3a3a3a' : '#ffffff';
  return (
    <span
      className="inline-flex items-center rounded-[20px] px-2.5 py-[3px] text-[11px] font-medium leading-none"
      style={{ background: color, color: text }}
    >
      {label}
    </span>
  );
}

export const Aspects: React.FC<Props> = ({ data, loading }) => {
  return (
    <section className="px-5 pt-7 pb-7">
      <SectionLabel>Ключевые аспекты</SectionLabel>

      <ul className="mt-5 space-y-5">
        {loading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i}>
                <SkeletonParagraph lines={3} />
              </li>
            ))
          : data.aspects.map((a, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={a.badge} color={a.color} />
                  <span className="text-[12.5px] text-[#5e5e5e]">{a.pl}</span>
                </div>
                <p className="mt-2 font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">
                  {a.text}
                </p>
              </li>
            ))}
      </ul>

      {data && data.resume ? (
        <div
          className="mt-7 px-5 py-4"
          style={{ background: READING_INSIGHT_BG }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
            Краткий портрет
          </p>
          <p className="mt-2 font-lora italic text-[14.5px] leading-[1.8] text-[#3a3a3a]">
            {data.resume}
          </p>
        </div>
      ) : null}

      <div className="mt-7">
        <Divider />
      </div>
    </section>
  );
};
