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
      setError('Добавь имя, чтобы Lumia обращалась к тебе лично.');
      focusField('name');
      return;
    }
    if (!date) {
      setError('Укажи дату рождения — без неё карта не соберётся точно.');
      focusField('date');
      return;
    }
    if (!time) {
      setError('Добавь время рождения — оно влияет на точность карты.');
      focusField('time');
      return;
    }
    if (!place.trim()) {
      setError('Укажи место рождения, чтобы завершить расчёт карты.');
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
    'w-full border-b border-black/12 bg-transparent pb-3 pt-2 text-[1.1rem] leading-tight text-[#1f1f1f] outline-none transition-colors placeholder:text-black/22 focus:border-black/45';

  const headerStyle = {
    paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + 1rem)',
    paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 1.25rem)',
  } as const;

  return (
    <div className="min-h-screen bg-white px-6 text-[#1f1f1f]" style={headerStyle}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col"
      >
        <div className="pt-4">
          <h1 className="font-serif text-[3.2rem] font-semibold leading-none tracking-[-0.05em] text-[#1f1f1f]">
            LUMIA
          </h1>
          <p className="mt-2 text-[10px] uppercase tracking-[0.34em] text-[#8a857d]">
            Твой путь к себе
          </p>
        </div>

        <div className="pt-16">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#a0988d]">Первый шаг</p>
          <h2 className="mt-4 max-w-[18rem] font-serif text-[2.35rem] leading-[1.04] text-[#1f1f1f]">
            Твоя карта начинается здесь
          </h2>
          <p className="mt-6 max-w-[21.5rem] text-[15px] leading-[1.85] text-[#4f4b45]">
            Имя, дата, время и место рождения помогут Lumia собрать твой личный астрологический
            рисунок — точно, бережно и без общих формулировок.
          </p>
        </div>

        <div className="mt-14 flex-1">
          <div className="space-y-8">
            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">
                Имя
              </span>
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

            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">
                Дата рождения
              </span>
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
              <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">
                Время рождения
              </span>
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

            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-[#8d877e]">
                Место рождения
              </span>
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

          <p className="mt-8 text-[12px] leading-[1.7] text-[#8a857d]">
            Мы считаем карту профессионально: используем точные астрономические данные и расчёты
            Swiss Ephemeris, чтобы интерпретация строилась не на общих шаблонах, а на твоих
            реальных координатах рождения.
          </p>

          {error ? (
            <p className="mt-5 text-[13px] leading-relaxed text-[#8d4a45]">{error}</p>
          ) : (
            <p className="mt-5 text-[13px] leading-relaxed text-[#6f6a63]">
              Когда всё заполнено, откроется твой первый личный слой.
            </p>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between gap-4 pb-2">
          <p className="max-w-[12rem] text-[12px] uppercase tracking-[0.16em] text-[#9a9387]">
            Открыть карту
          </p>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Открыть карту"
            className={[
              'inline-flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full transition-all duration-300',
              canSubmit
                ? 'bg-[#232323] text-white shadow-[0_16px_28px_rgba(0,0,0,0.14)] active:scale-[0.97]'
                : 'bg-[#efebe4] text-[#c0b7aa]',
            ].join(' ')}
          >
            <span className="text-[1.45rem] leading-none">→</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
