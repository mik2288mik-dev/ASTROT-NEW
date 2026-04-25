import React from 'react';
import type { NatalReadingWeek } from '../../lib/natalReading/types';
import { SectionLabel } from './SectionLabel';
import { SkeletonParagraph } from './Skeleton';

type Props = { data: NatalReadingWeek | null; loading: boolean };

function weekRangeLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

export const Week: React.FC<Props> = ({ data, loading }) => {
  return (
    <section className="px-5 pt-7 pb-7">
      <SectionLabel tier="free" hint="на этой неделе">
        Прогноз на неделю
      </SectionLabel>

      <div className="mt-4 rounded-[12px] border border-[#f0f0f0] px-5 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a9a9a]">
          {weekRangeLabel()}
        </p>
        {loading || !data ? (
          <div className="mt-3">
            <SkeletonParagraph lines={4} />
          </div>
        ) : (
          <>
            <h3 className="mt-2 font-lora text-[19px] leading-[1.3] text-[#1f1f1f]">
              {data.title}
            </h3>
            <p className="mt-3 font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">
              {data.body}
            </p>
          </>
        )}
      </div>
    </section>
  );
};
