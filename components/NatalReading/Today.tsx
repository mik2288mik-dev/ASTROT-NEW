import React, { useState } from 'react';
import { Briefcase, Heart, Lock, Zap, type LucideIcon } from 'lucide-react';
import type { NatalReadingToday } from '../../lib/natalReading/types';
import { SectionLabel } from './SectionLabel';
import { SkeletonParagraph } from './Skeleton';

type Lens = 'love' | 'work' | 'energy';

type Props = {
  isPremium: boolean;
  data: NatalReadingToday | null;
  loading: boolean;
  error: string | null;
  onUnlockPremium: () => void;
  onUnlockReading: () => void;
};

function dateLabel(): string {
  return new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

const LENS: Record<Lens, { Icon: LucideIcon; label: string }> = {
  love: { Icon: Heart, label: 'В любви' },
  work: { Icon: Briefcase, label: 'В работе' },
  energy: { Icon: Zap, label: 'Энергия' },
};

const Pill: React.FC<{
  active: boolean;
  Icon: LucideIcon;
  label: string;
  onClick: () => void;
}> = ({ active, Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-[12.5px] transition ${
      active
        ? 'bg-[#1f1f1f] text-white'
        : 'border border-[#ececec] bg-white text-[#3a3a3a] hover:border-[#d8d8d8]'
    }`}
  >
    <Icon size={14} strokeWidth={1.7} />
    <span>{label}</span>
  </button>
);

export const Today: React.FC<Props> = ({
  isPremium,
  data,
  loading,
  error,
  onUnlockPremium,
  onUnlockReading,
}) => {
  const [lens, setLens] = useState<Lens | null>(null);

  return (
    <section className="px-5 pt-7 pb-7">
      <SectionLabel tier="premium" hint="обновляется каждый день">
        Сегодня · {dateLabel()}
      </SectionLabel>

      {!isPremium ? (
        <div className="mt-5">
          <div className="relative overflow-hidden rounded-[12px] border border-[#f0f0f0] px-5 py-7">
            <div
              className="select-none blur-[5px]"
              style={{ filter: 'blur(5px)' }}
              aria-hidden
            >
              <p className="font-lora text-[18px] leading-[1.3] text-[#1f1f1f]">
                Тихий разворот внутри
              </p>
              <p className="mt-3 font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">
                Сегодня день, в который тебе будет легче слышать, что говорят люди
                между строк. Это редкий ресурс — используй его на разговор, который
                откладывал.
              </p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={onUnlockPremium}
                className="flex items-center gap-2 rounded-[20px] bg-[#1f1f1f] px-4 py-2 text-[13px] text-white transition hover:bg-[#000]"
              >
                <Lock size={14} strokeWidth={1.6} />
                <span>Открыть</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {loading ? (
            <SkeletonParagraph lines={5} />
          ) : data ? (
            <>
              <h3 className="font-lora text-[19px] leading-[1.3] text-[#1f1f1f]">
                {data.title}
              </h3>
              <p className="mt-3 font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">
                {data.main}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {(Object.keys(LENS) as Lens[]).map((k) => (
                  <Pill
                    key={k}
                    active={lens === k}
                    Icon={LENS[k].Icon}
                    label={LENS[k].label}
                    onClick={() => setLens(lens === k ? null : k)}
                  />
                ))}
              </div>

              {lens ? (
                <p className="mt-4 font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">
                  {data[lens]}
                </p>
              ) : null}
            </>
          ) : (
            <div className="rounded-[12px] border border-[#f0f0f0] px-5 py-5">
              <p className="font-lora text-[14px] leading-[1.65] text-[#5e5e5e]">
                Прогноз на сегодня ещё не подготовлен.
              </p>
              <button
                type="button"
                onClick={onUnlockReading}
                className="mt-3 rounded-[20px] bg-[#1f1f1f] px-4 py-2 text-[13px] text-white"
              >
                Подготовить
              </button>
            </div>
          )}
          {error ? (
            <p className="mt-3 text-[12.5px] text-[#c97c7c]">{error}</p>
          ) : null}
        </div>
      )}
    </section>
  );
};
