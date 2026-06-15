import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { MonoIllustWelcome } from '../components/mono-ui';

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

  return (
    <div
      className="fresh-page lumia-main-scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 16px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto"
        style={{ display: 'flex', flex: 1, width: '100%', maxWidth: '28rem', flexDirection: 'column' }}
      >
        <div style={{ padding: '0 20px' }}>
          <p className="lumia-brand-wordmark">LUMIA</p>
          <p className="lumia-brand-tagline">ТВОЙ ПУТЬ К СЕБЕ</p>
        </div>

        <div className="fresh-onboarding-hero">
          <span className="fresh-onboarding-symbol">✦</span>
          <div className="fresh-onboarding-content">
            <MonoIllustWelcome size={120} />
          </div>
        </div>

        {step === 'welcome' ? (
          <>
            <div style={{ padding: '8px 20px 0' }}>
              <h1 className="fresh-page-title" style={{ maxWidth: '16rem' }}>
                Твой личный астролог
              </h1>
              <p style={{ marginTop: 14, maxWidth: '19rem', fontSize: 15, lineHeight: 1.6, color: 'var(--fresh-muted)' }}>
                Коротко о дне, карте и отношениях — без лишней эзотерики.
              </p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 24 }}>
              <button type="button" className="fresh-btn-primary" onClick={() => setStep('birth')}>
                Начать
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '8px 20px 0' }}>
              <h1 className="fresh-page-title" style={{ maxWidth: '16rem' }}>
                Данные для твоей карты
              </h1>
              <p style={{ marginTop: 14, maxWidth: '19rem', fontSize: 15, lineHeight: 1.6, color: 'var(--fresh-muted)' }}>
                Имя, дата, время и место рождения помогают рассчитать карту точнее.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '28px 20px 0' }}>
              <label>
                <span className="fresh-field-label">Имя</span>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  className="fresh-input"
                  placeholder="Как к тебе обращаться"
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label>
                  <span className="fresh-field-label">Дата</span>
                  <input
                    ref={dateRef}
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (error) setError('');
                    }}
                    className="fresh-input"
                  />
                </label>

                <label>
                  <span className="fresh-field-label">Время</span>
                  <input
                    ref={timeRef}
                    type="time"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      if (error) setError('');
                    }}
                    className="fresh-input"
                  />
                </label>
              </div>

              <label>
                <span className="fresh-field-label">Место рождения</span>
                <input
                  ref={placeRef}
                  type="text"
                  value={place}
                  onChange={(e) => {
                    setPlace(e.target.value);
                    if (error) setError('');
                  }}
                  className="fresh-input"
                  placeholder="Москва, Россия"
                />
              </label>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 24 }}>
              {error ? (
                <p style={{ margin: '0 20px 12px', fontSize: 12, lineHeight: 1.45, color: 'var(--fresh-red)' }}>{error}</p>
              ) : null}

              <button type="button" className="fresh-btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
                Открыть карту
              </button>

              <p style={{ margin: '12px 20px 0', maxWidth: '20rem', fontSize: 10, lineHeight: 1.45, color: 'var(--fresh-muted)' }}>
                Все расчеты Lumia строятся на точных астрономических данных, координатах рождения и Swiss Ephemeris, чтобы карта опиралась на реальные данные, а не на общий шаблон.
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
