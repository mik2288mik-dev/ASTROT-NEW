import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { NatalChartIcon, HeartIcon } from '../components/icons/UiIcons';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { getZodiacSign } from '../constants';
import { CityAutocomplete } from '../components/ui/CityAutocomplete';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

type FieldKey = 'name' | 'date' | 'time' | 'place';

const SparkIcon = ({ size = 52 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" fill="currentColor" /><circle cx="18.5" cy="5.5" r="1.4" fill="currentColor" /></svg>
);

type Story = { color: string; icon: React.ReactNode; title: string; text: string };

const STORIES: Story[] = [
  { color: '#1478FF', icon: <NatalChartIcon size={52} />, title: 'Натальная карта', text: 'Узнай, кто ты на самом деле — характер, сильные стороны и зоны роста по дате рождения.' },
  { color: '#2563EB', icon: <ZodiacIcon sign="leo" size={56} strokeWidth={1.2} />, title: 'Гороскоп каждый день', text: 'Твой день наперёд — на сегодня, завтра и неделю. Коротко и по делу, без эзотерики.' },
  { color: '#38BDF8', icon: <HeartIcon size={52} />, title: 'Совместимость и матрица', text: 'Проверь совместимость с любым человеком и рассчитай матрицу судьбы — бесплатно, по дате рождения.' },
  { color: '#64748B', icon: <SparkIcon size={52} />, title: 'Личный гороскоп · Premium', text: 'Твой день по твоей карте: лучшие окна для действий, любовь, деньги и работа — глубоко и точно.' },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'stories' | 'birth'>('stories');
  const [storyIndex, setStoryIndex] = useState(0);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>('unspecified');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  // Координаты, разрешённые автокомплитом при выборе города. Если юзер выбрал город
  // из подсказок — отдаём их серверу, и он не геокодит место заново (надёжнее).
  const [placeCoords, setPlaceCoords] = useState<{ lat: number; lon: number; timezone?: string } | null>(null);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');

  const nameRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const placeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) setName(tg.initDataUnsafe.user.first_name || '');
    ensureTelegramFullscreen();
  }, []);

  const canSubmit = useMemo(() => Boolean(name.trim() && date && time && place.trim()), [date, name, place, time]);
  const signHint = useMemo(() => {
    const s = sunSignFromDate(date);
    return s ? getZodiacSign('ru', s) : '';
  }, [date]);

  const focusField = (field: FieldKey) => {
    const refMap: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = { name: nameRef, date: dateRef, time: timeRef, place: placeRef };
    refMap[field].current?.focus();
  };

  const nextStory = () => {
    if (storyIndex < STORIES.length - 1) setStoryIndex((i) => i + 1);
    else setStep('birth');
  };

  const handleSubmit = () => {
    if (!name.trim()) { setError('Добавь имя, чтобы астролог обращался к тебе лично.'); focusField('name'); return; }
    if (!date) { setError('Укажи дату рождения.'); focusField('date'); return; }
    if (!time) { setError('Укажи время рождения.'); focusField('time'); return; }
    if (!place.trim()) { setError('Укажи место рождения.'); focusField('place'); return; }
    setError('');
    onComplete({
      name: name.trim(),
      gender,
      birthDate: date,
      birthTime: time,
      birthPlace: place.trim(),
      birthLatitude: placeCoords?.lat ?? null,
      birthLongitude: placeCoords?.lon ?? null,
      birthTimezone: placeCoords?.timezone ?? null,
      isSetup: true,
      language: 'ru',
      theme: 'light',
      isPremium: false,
      notificationFrequency: notify ? 'daily' : 'important',
    });
  };

  return (
    <div
      className="fresh-page lumia-main-scroll"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 16px)' }}
    >
      <div style={{ padding: '4px 20px 0' }}>
        <p className="lumia-brand-wordmark">LUMIA</p>
      </div>

      {step === 'stories' ? (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', maxWidth: '28rem', width: '100%', margin: '0 auto' }}>
          <div className="onb-dots">
            {STORIES.map((_, i) => <span key={i} className={`onb-dot ${i === storyIndex ? 'is-on' : ''}`} />)}
          </div>

          <div className="onb-stage" onClick={nextStory}>
            <AnimatePresence mode="wait">
              <motion.div
                key={storyIndex}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="onb-card"
              >
                <div className="onb-hero" style={{ background: STORIES[storyIndex].color }}>
                  <span className="onb-hero-ico">{STORIES[storyIndex].icon}</span>
                </div>
                <h1 className="onb-title">{STORIES[storyIndex].title}</h1>
                <p className="onb-text">{STORIES[storyIndex].text}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div style={{ padding: '0 20px' }}>
            <button type="button" className="fresh-btn-primary" style={{ width: '100%', margin: 0 }} onClick={nextStory}>
              {storyIndex < STORIES.length - 1 ? 'Дальше' : 'Создать мою карту'}
            </button>
            <button type="button" className="onb-skip" onClick={() => setStep('birth')}>Пропустить</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', maxWidth: '28rem', width: '100%', margin: '0 auto' }}>
          <div style={{ padding: '8px 20px 0' }}>
            <h1 className="fresh-page-title" style={{ maxWidth: '16rem' }}>Данные для твоей карты</h1>
            <p style={{ marginTop: 12, maxWidth: '20rem', fontSize: 14.5, lineHeight: 1.55, color: 'var(--fresh-muted)' }}>
              Имя, дата, время и место рождения нужны, чтобы рассчитать карту точно.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 20px 0' }}>
            <label>
              <span className="fresh-field-label">Имя</span>
              <input ref={nameRef} type="text" value={name} onChange={(e) => { setName(e.target.value); if (error) setError(''); }} className="fresh-input" placeholder="Как к тебе обращаться" />
            </label>

            <div>
              <span className="fresh-field-label">Пол</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {([['male', 'Мужской'], ['female', 'Женский'], ['unspecified', 'Не указывать']] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setGender(val)} className={`onb-gender ${gender === val ? 'is-on' : ''}`}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label>
                <span className="fresh-field-label">Дата</span>
                <input ref={dateRef} type="date" value={date} onChange={(e) => { setDate(e.target.value); if (error) setError(''); }} className="fresh-input" />
              </label>
              <label>
                <span className="fresh-field-label">Время</span>
                <input ref={timeRef} type="time" value={time} onChange={(e) => { setTime(e.target.value); if (error) setError(''); }} className="fresh-input" />
              </label>
            </div>
            {signHint ? <p style={{ margin: '-6px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--fresh-link)' }}>Твой знак — {signHint}</p> : null}

            <label>
              <span className="fresh-field-label">Место рождения</span>
              <CityAutocomplete
                value={place}
                inputRef={placeRef}
                placeholder="Начни вводить город…"
                onChange={(v, coords) => {
                  setPlace(v);
                  // coords приходят только при выборе города из подсказок; при ручном
                  // вводе их нет — тогда сбрасываем, чтобы не отправить устаревшие.
                  setPlaceCoords(coords ?? null);
                  if (error) setError('');
                }}
              />
            </label>

            <button type="button" className="onb-notify" onClick={() => setNotify((v) => !v)}>
              <span className={`onb-check ${notify ? 'is-on' : ''}`} aria-hidden>{notify ? '✓' : ''}</span>
              <span className="onb-notify-text">Присылать полезные напоминания о дне и карте</span>
            </button>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 22 }}>
            {error ? <p style={{ margin: '0 20px 12px', fontSize: 12.5, lineHeight: 1.45, color: '#B91C1C' }}>{error}</p> : null}
            <button type="button" className="fresh-btn-primary" disabled={!canSubmit} onClick={handleSubmit}>Открыть карту</button>
            <p style={{ margin: '12px 20px 0', maxWidth: '20rem', fontSize: 10.5, lineHeight: 1.45, color: 'var(--fresh-muted)' }}>
              Расчёты «Твой Гороскоп» опираются на точные астрономические данные и Swiss Ephemeris — это реальная карта, а не общий шаблон.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
