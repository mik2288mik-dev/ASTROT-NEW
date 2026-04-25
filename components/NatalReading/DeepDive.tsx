import React, { useState } from 'react';
import type {
  NatalReadingDeepDive,
  NatalReadingDeepDiveKey,
} from '../../lib/natalReading/types';
import { SectionLabel, Divider } from './SectionLabel';
import { SkeletonParagraph } from './Skeleton';

type DiveTopic = {
  key: NatalReadingDeepDiveKey;
  icon: string;
  title: string;
  subtitle: string;
  preview: string; // shown as blurred preview text
};

const DIVE_TOPICS: DiveTopic[] = [
  {
    key: 'love',
    icon: '❤',
    title: 'Любовь и отношения',
    subtitle: 'Венера · VII дом · паттерны',
    preview:
      'Ты ищешь не страсть, а человека с которым можно выдохнуть. И при этом твоя глубина пугает большинство — они видят в тебе глубину раньше, чем ты успеваешь её показать.',
  },
  {
    key: 'career',
    icon: '💼',
    title: 'Карьера и деньги',
    subtitle: 'Солнце X · Марс XI · Сатурн VIII',
    preview:
      'Ты не из тех, кто бежит за быстрыми деньгами. Тебя двигает смысл — и именно поэтому твой финансовый путь выглядит странно по обычным меркам, но работает.',
  },
  {
    key: 'health',
    icon: '🌙',
    title: 'Здоровье и энергия',
    subtitle: 'Луна VI · Плутон · тело',
    preview:
      'Твоё тело — это датчик. Оно начинает говорить раньше, чем ты успеваешь подумать. Когда ты не слышишь — оно повышает голос, и тогда ты замечаешь поздно.',
  },
  {
    key: 'karma',
    icon: '☊',
    title: 'Кармическая задача',
    subtitle: 'Северный Узел · VIII дом · миссия',
    preview:
      'Ты пришёл сюда не чтобы быть удобным. У тебя есть конкретная задача, и пока ты от неё уходишь — внутри будет постоянное ощущение, что ты не на своём месте.',
  },
  {
    key: 'strengths',
    icon: '⭐',
    title: 'Сильные стороны и зоны роста',
    subtitle: 'Полный психологический разбор',
    preview:
      'Тебя ценят за то, чего ты сам в себе не замечаешь. И страдаешь от того, чего другие в тебе не видят. Здесь — обе стороны, без сглаживаний.',
  },
];

const LockIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="3" y="7" width="10" height="6" rx="1.5" stroke="#6f4ea8" strokeWidth="1.2" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="#6f4ea8" strokeWidth="1.2" />
  </svg>
);

type Props = {
  isPremium: boolean;
  loaded: Partial<Record<NatalReadingDeepDiveKey, NatalReadingDeepDive>>;
  loading: NatalReadingDeepDiveKey | null;
  onOpen: (topic: NatalReadingDeepDiveKey) => void;
  onUnlockPremium: () => void;
};

const Card: React.FC<{
  topic: DiveTopic;
  state: 'locked' | 'closed' | 'loading' | 'open';
  data?: NatalReadingDeepDive;
  onClick: () => void;
}> = ({ topic, state, data, onClick }) => {
  const isLocked = state === 'locked';

  return (
    <div className="border-t border-[#f2f2f2] py-6 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-lora text-[17px] leading-[1.3] text-[#1f1f1f]">
            <span className="mr-1.5">{topic.icon}</span>
            {topic.title}
          </p>
          <p className="mt-1 text-[12px] uppercase tracking-[0.16em] text-[#9a9a9a]">
            {topic.subtitle}
          </p>
        </div>
        <span className="mt-1 shrink-0 text-[13px] text-[#6f4ea8]">
          {state === 'open' ? '↑ Скрыть' : isLocked ? <LockIcon /> : 'Открыть →'}
        </span>
      </button>

      {state === 'open' && data ? (
        <div className="mt-4">
          <div className="font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d] whitespace-pre-line">
            {data.body}
          </div>
          {data.highlights && data.highlights.length ? (
            <ul className="mt-5 space-y-2.5">
              {data.highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 font-lora text-[13.5px] leading-[1.7] text-[#3a3a3a]"
                >
                  <span className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#9b87c4]" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : state === 'loading' ? (
        <div className="mt-4">
          <SkeletonParagraph lines={5} />
        </div>
      ) : (
        <div className="mt-3 relative">
          <p
            className="font-lora text-[14px] leading-[1.7] text-[#3a3a3a] select-none"
            style={{ filter: isLocked ? 'blur(4.5px)' : 'blur(3px)' }}
            aria-hidden
          >
            {topic.preview}
          </p>
        </div>
      )}
    </div>
  );
};

export const DeepDive: React.FC<Props> = ({
  isPremium,
  loaded,
  loading,
  onOpen,
  onUnlockPremium,
}) => {
  const [openKey, setOpenKey] = useState<NatalReadingDeepDiveKey | null>(null);

  const handleClick = (key: NatalReadingDeepDiveKey) => {
    if (!isPremium) {
      onUnlockPremium();
      return;
    }
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
    if (!loaded[key]) onOpen(key);
  };

  return (
    <section className="px-5 pt-7 pb-10">
      <SectionLabel tier="premium">Глубокий разбор</SectionLabel>

      <div className="mt-5">
        {DIVE_TOPICS.map((t) => {
          let state: 'locked' | 'closed' | 'loading' | 'open' = isPremium ? 'closed' : 'locked';
          if (isPremium && openKey === t.key) {
            state = loaded[t.key] ? 'open' : loading === t.key ? 'loading' : 'closed';
          }
          return (
            <Card
              key={t.key}
              topic={t}
              state={state}
              data={loaded[t.key]}
              onClick={() => handleClick(t.key)}
            />
          );
        })}
      </div>

      {!isPremium ? (
        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={onUnlockPremium}
            className="rounded-[20px] bg-[#1f1f1f] px-5 py-2.5 text-[13px] text-white"
          >
            Открыть все разделы
          </button>
        </div>
      ) : null}

      <div className="mt-8">
        <Divider />
      </div>
    </section>
  );
};
