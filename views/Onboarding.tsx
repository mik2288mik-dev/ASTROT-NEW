import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

type FieldKey = 'name' | 'date' | 'time' | 'place';

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState('');

  const nameRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const placeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      setName(tg.initDataUnsafe.user.first_name || '');
    }
    ensureTelegramFullscreen();
  }, []);

  const canSubmit = useMemo(
    () => Boolean(name.trim() && date && time && place.trim()),
    [date, name, place, time]
  );

  const focusField = (field: FieldKey) => {
    const refMap: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
      name: nameRef,
      date: dateRef,
      time: timeRef,
      place: placeRef,
    };
    refMap[field].current?.focus();
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Добавь имя, чтобы Lumia могла обращаться к тебе лично.');
      focusField('name');
      return;
    }
    if (!date) {
      setError('Укажи дату рождения.');
      focusField('date');
      return;
    }
    if (!time) {
      setError('Укажи время рождения.');
      focusField('time');
      return;
    }
    if (!place.trim()) {
      setError('Укажи место рождения.');
      focusField('place');
      return;
    }

    setError('');

    const profile: UserProfile = {
      name: name.trim(),
      birthDate: date,
      birthTime: time,
      birthPlace: place.trim(),
      isSetup: true,
      language: 'ru',
      theme: 'light',
      isPremium: false,
    };

    onComplete(profile);
  };

  const inputClassName =
    'h-12 w-full rounded-[18px] border border-black/8 bg-white/88 px-4 text-[15px] leading-tight text-[#1f1f1f] outline-none transition-colors placeholder:text-black/24 focus:border-black/18 focus:bg-white';

  const shellStyle = {
    paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + 0.75rem)',
    paddingBottom:
      'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 0.75rem)',
    paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px), var(--tg-content-safe-area-inset-left, 0px))',
    paddingRight: 'max(1rem, env(safe-area-inset-right, 0px), var(--tg-content-safe-area-inset-right, 0px))',
  } as const;

  return (
    <div
      className="h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(228,218,203,0.55),transparent_38%),linear-gradient(180deg,#fffdfa_0%,#f4efe6_100%)] text-[#1f1f1f]"
      style={shellStyle}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/76 px-5 pb-5 pt-4 shadow-[0_24px_70px_rgba(43,32,18,0.08)] backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-0 font-serif text-[2.5rem] font-semibold leading-none tracking-[-0.06em] text-[#1f1f1f]">
              LUMIA
            </p>
            <p className="mb-0 mt-2 text-[9px] uppercase tracking-[0.3em] text-[#8b8479]">Твой путь к себе</p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3eee4] text-[11px] font-medium uppercase tracking-[0.18em] text-[#7c7264]">
            01
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-0 text-[10px] uppercase tracking-[0.22em] text-[#a1988d]">Первый шаг</p>
          <h1 className="mb-0 mt-3 max-w-[15rem] font-serif text-[2.15rem] leading-[0.98] tracking-[-0.045em] text-[#1f1f1f]">
            Соберем твою карту
          </h1>
          <p className="mb-0 mt-4 max-w-[20.5rem] text-[14px] leading-[1.6] text-[#514b44]">
            Нужны имя, дата, время и место рождения. По ним Lumia рассчитает карту точно, без общих шаблонов.
          </p>
        </div>

        <div className="mt-5 rounded-[26px] border border-black/6 bg-[#faf6ee]/92 px-4 py-4 shadow-[0_12px_32px_rgba(34,26,18,0.05)]">
          <div className="space-y-3.5">
            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8e877d]">Имя</span>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                className={inputClassName}
                placeholder="Как к тебе обращаться"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8e877d]">Дата</span>
                <input
                  ref={dateRef}
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (error) setError('');
                  }}
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8e877d]">Время</span>
                <input
                  ref={timeRef}
                  type="time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    if (error) setError('');
                  }}
                  className={inputClassName}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8e877d]">Место рождения</span>
              <input
                ref={placeRef}
                type="text"
                value={place}
                onChange={(e) => {
                  setPlace(e.target.value);
                  if (error) setError('');
                }}
                className={inputClassName}
                placeholder="Москва, Россия"
              />
            </label>
          </div>

          <div className="mt-3.5 rounded-[18px] bg-white/78 px-3 py-2.5">
            <p className="mb-0 text-[11px] leading-[1.5] text-[#6b6459]">Расчет на базе Swiss Ephemeris.</p>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <div className="min-h-[2.75rem]">
            {error ? (
              <p className="mb-0 text-[12px] leading-[1.45] text-[#9a4b45]">{error}</p>
            ) : (
              <p className="mb-0 text-[12px] leading-[1.45] text-[#756d63]">
                Когда все заполнено, откроется твой первый личный слой.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Открыть карту"
            className={[
              'mt-3 flex h-14 w-full items-center justify-between rounded-full px-5 text-left transition-all duration-300',
              canSubmit
                ? 'bg-[#232323] text-white shadow-[0_16px_32px_rgba(0,0,0,0.14)] active:scale-[0.985]'
                : 'bg-[#ebe5da] text-[#b7afa1]',
            ].join(' ')}
          >
            <span className="text-[12px] uppercase tracking-[0.2em]">Открыть карту</span>
            <span
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full text-[1.15rem] leading-none transition-colors',
                canSubmit ? 'bg-white/12 text-white' : 'bg-white/55 text-[#b7afa1]',
              ].join(' ')}
            >
              →
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
