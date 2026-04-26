import React from 'react';
import type { NatalReadingPortrait } from '../../lib/natalReading/types';
import { Divider, SectionLabel } from './SectionLabel';
import { READING_INSIGHT_BG } from './constants';
import { SkeletonParagraph } from './Skeleton';

type Props = { data: NatalReadingPortrait | null; loading: boolean };

const ENERGY_DOT_COLORS = ['#c9a55a', '#9b87c4', '#3f8a6c'];

export const Portrait: React.FC<Props> = ({ data, loading }) => {
  return (
    <section className="px-5 pt-7 pb-7">
      <SectionLabel>Психологический портрет</SectionLabel>

      <div className="mt-5">
        {loading || !data ? (
          <SkeletonParagraph lines={6} />
        ) : (
          <p className="font-lora text-[15px] leading-[1.85] text-[#2d2d2d] whitespace-pre-line">
            {data.portrait}
          </p>
        )}
      </div>

      {data && data.insight ? (
        <div
          className="mt-6 px-5 py-4"
          style={{ background: READING_INSIGHT_BG }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
            Ключевой инсайт
          </p>
          <p className="mt-2 font-lora italic text-[14.5px] leading-[1.75] text-[#3a3a3a]">
            {data.insight}
          </p>
        </div>
      ) : null}

      {data && (data.energyA?.title || data.energyB?.title) ? (
        <div className="mt-7">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
            Главное противоречие
          </p>
          <ul className="mt-4 space-y-5">
            {[
              { ...data.energyA, dot: ENERGY_DOT_COLORS[0] },
              { ...data.energyB, dot: ENERGY_DOT_COLORS[1] },
              {
                title: 'И когда они вместе',
                body: data.synthesis,
                dot: ENERGY_DOT_COLORS[2],
              },
            ]
              .filter((row) => row.title || row.body)
              .map((row, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full"
                    style={{ background: row.dot }}
                  />
                  <div>
                    <p className="font-lora text-[15px] font-medium leading-[1.45] text-[#1f1f1f]">
                      {row.title}
                    </p>
                    <p className="mt-1.5 font-lora text-[14.5px] leading-[1.8] text-[#3a3a3a]">
                      {row.body}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-7">
        <Divider />
      </div>
    </section>
  );
};
