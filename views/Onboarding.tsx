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
    'min-h-[2.9rem] w-full border-b border-black/10 bg-transparent pb-2 pt-1 text-[1.05rem] leading-tight text-[#1f1f1f] outline-none transition-colors placeholder:text-black/20 focus:border-black/40';

  const shellStyle = {
    paddingTop:
      'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 0.25rem)',
    paddingBottom:
      'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 0.85rem)',
    paddingLeft: 'max(1.15rem, env(safe-area-inset-left, 0px), var(--tg-content-safe-area-inset-left, 0px))',
    paddingRight: 'max(1.15rem, env(safe-area-inset-right, 0px), var(--tg-content-safe-area-inset-right, 0px))',
  } as const;

  return (
    <div className="h-full overflow-hidden bg-white text-[#1f1f1f]" style={shellStyle}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex h-full w-full max-w-md flex-col"
      >
        <div>
          <p className="mb-0 font-serif text-[2.9rem] font-semibold leading-none tracking-[-0.065em] text-[#1f1f1f]">
            LUMIA
          </p>
          <p className="mb-0 mt-2 text-[9px] uppercase tracking-[0.32em] text-[#8a857d]">Твой путь к себе</p>
        </div>

        <div className="mt-10">
          <h1 className="mb-0 max-w-[16rem] font-serif text-[2.45rem] leading-[0.97] tracking-[-0.05em] text-[#1f1f1f]">
            Соберем твою карту
          </h1>
          <p className="mb-0 mt-5 max-w-[19rem] text-[15px] leading-[1.65] text-[#4f4b45]">
            Нужны имя, дата, время и место рождения. По ним Lumia рассчитает карту точно, без общих шаблонов.
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">Имя</span>
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

          <div className="grid grid-cols-2 gap-6">
            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">Дата</span>
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
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">Время</span>
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
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">Место рождения</span>
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

        <div className="mt-auto pt-8">
          {error ? <p className="mb-3 text-[12px] leading-[1.45] text-[#9a4b45]">{error}</p> : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Открыть карту"
            className={[
              'flex w-full items-center justify-between border-t border-black/8 py-4 text-left transition-colors duration-300',
              canSubmit ? 'text-[#1f1f1f]' : 'text-[#bcb5aa]',
            ].join(' ')}
          >
            <span className="text-[12px] uppercase tracking-[0.2em]">Открыть карту</span>
            <span
              className={[
                'flex h-10 w-10 items-center justify-center rounded-full text-[1.1rem] leading-none transition-colors',
                canSubmit ? 'bg-[#1f1f1f] text-white' : 'bg-[#efebe4] text-[#bcb5aa]',
              ].join(' ')}
            >
              →
            </span>
          </button>

          <p className="mb-0 mt-3 max-w-[20rem] text-[10px] leading-[1.45] text-[#8c867d]">
            Все расчеты Lumia строятся на точных астрономических данных, координатах рождения и Swiss Ephemeris, чтобы карта опиралась на реальные данные, а не на общий шаблон.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
