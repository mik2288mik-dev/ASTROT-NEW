import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { MonoButton, MonoIllustWelcome } from '../components/mono-ui';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

type FieldKey = 'name' | 'date' | 'time' | 'place';

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'welcome' | 'birth'>('welcome');
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
    'min-h-[2.9rem] w-full border-b border-mono-line bg-transparent pb-2 pt-1 text-[1.05rem] leading-tight text-mono-ink outline-none transition-colors placeholder:text-mono-muted/40 focus:border-mono-ink';

  const shellStyle = {
    paddingTop:
      'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 0.85rem)',
    paddingBottom:
      'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 1rem)',
    paddingLeft: 'max(1.15rem, env(safe-area-inset-left, 0px), var(--tg-content-safe-area-inset-left, 0px))',
    paddingRight: 'max(1.15rem, env(safe-area-inset-right, 0px), var(--tg-content-safe-area-inset-right, 0px))',
  } as const;

  return (
    <div className="mono-page h-[100dvh] min-h-[100dvh] overflow-hidden text-mono-ink" style={shellStyle}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex h-full w-full max-w-md flex-col"
      >
        <div>
          <p className="lumia-brand-wordmark">LUMIA</p>
          <p className="lumia-brand-tagline">ТВОЙ ПУТЬ К СЕБЕ</p>
        </div>

        <div className="mt-8 flex justify-center rounded-mono-card bg-mono-plate py-8">
          <MonoIllustWelcome size={120} />
        </div>

        {step === 'welcome' ? (
          <>
            <div className="mt-8">
              <h1 className="mb-0 max-w-[16rem] font-lora text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-mono-ink">
                Твой личный астролог
              </h1>
              <p className="mb-0 mt-4 max-w-[19rem] text-[15px] leading-[1.65] text-mono-muted">
                Коротко о дне, карте и отношениях — без лишней эзотерики.
              </p>
            </div>
            <div className="mt-auto pt-8">
              <MonoButton fullWidth onClick={() => setStep('birth')}>
                Начать
              </MonoButton>
            </div>
          </>
        ) : (
          <>
        <div className="mt-8">
          <h1 className="mb-0 max-w-[16rem] text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-mono-ink">
            Данные для твоей карты
          </h1>
          <p className="mb-0 mt-4 max-w-[19rem] text-[15px] leading-[1.65] text-mono-muted">
            Имя, дата, время и место рождения помогают рассчитать карту точнее.
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-mono-muted">Имя</span>
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
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-mono-muted">Дата</span>
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
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-mono-muted">Время</span>
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
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-mono-muted">Место рождения</span>
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
          {error ? <p className="mb-3 text-[12px] leading-[1.45] text-mono-accent">{error}</p> : null}

          <MonoButton fullWidth disabled={!canSubmit} onClick={handleSubmit}>
            Открыть карту
          </MonoButton>

          <p className="mb-0 mt-3 max-w-[20rem] text-[10px] leading-[1.45] text-mono-muted">
            Все расчеты Lumia строятся на точных астрономических данных, координатах рождения и Swiss Ephemeris, чтобы карта опиралась на реальные данные, а не на общий шаблон.
          </p>
        </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
