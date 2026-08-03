import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { NatalChartIcon, HeartIcon } from '../components/icons/UiIcons';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { getZodiacSign } from '../constants';
import { CityAutocomplete } from '../components/ui/CityAutocomplete';
import { EditorialSticker } from '../components/EditorialSticker';
import { selectMainEditorialSticker } from '../lib/personalForecastVisuals';
import type { EditorialMedium, EditorialTopic } from '../lib/personalForecastVisuals/editorialTypes';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => Promise<void>;
}

type FieldKey = 'name' | 'date' | 'time' | 'place';

const SparkIcon = ({ size = 52 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" fill="currentColor" /><circle cx="18.5" cy="5.5" r="1.4" fill="currentColor" /></svg>
);

type Story = { color: string; icon: React.ReactNode; title: string; text: string };

const STORIES: Story[] = [
  {
    color: '#1478FF',
    icon: <NatalChartIcon size={52} />,
    title: 'Разбор натальной карты',
    text: 'Характер, привычные реакции, сильные и слабые места — по дате, времени и месту рождения.',
  },
  {
    color: '#2563EB',
    icon: <ZodiacIcon sign="leo" size={56} strokeWidth={1.2} />,
    title: 'Личный гороскоп',
    text: 'Прогнозы на сегодня, неделю и месяц рассчитываются по твоей натальной карте.',
  },
  {
    color: '#38BDF8',
    icon: <HeartIcon size={52} />,
    title: 'Совместимость',
    text: 'Сравни две карты: что помогает договориться, где чаще начинаются проблемы и что каждый понимает по-своему.',
  },
  {
    color: '#64748B',
    icon: <SparkIcon size={52} />,
    title: 'Больше в Premium',
    text: 'Подробные разборы отношений, денег и работы, все периоды прогноза и ответы на личные вопросы.',
  },
];

const STORY_VISUALS: readonly {
  topics: readonly EditorialTopic[];
  media: readonly EditorialMedium[];
}[] = [
  { topics: ['general', 'home_family'], media: ['photo', 'associative'] },
  { topics: ['opportunities', 'decisions'], media: ['associative', 'psychedelic-humor'] },
  { topics: ['communication', 'friends'], media: ['photo', 'associative'] },
  { topics: ['work_money', 'opportunities'], media: ['graphic', 'psychedelic-humor'] },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const nameRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const placeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) setName(tg.initDataUnsafe.user.first_name || '');
    ensureTelegramFullscreen();
  }, []);

  const canSubmit = useMemo(() => Boolean(name.trim() && date && place.trim()), [date, name, place]);
  const signHint = useMemo(() => {
    const s = sunSignFromDate(date);
    return s ? getZodiacSign('ru', s) : '';
  }, [date]);
  const storyVisual = STORY_VISUALS[storyIndex] || STORY_VISUALS[0];
  const storySticker = selectMainEditorialSticker({
    screenKey: 'onboarding-story',
    contentKey: `story-${storyIndex}`,
    slot: storyIndex,
    topics: storyVisual.topics,
    allowedMedia: storyVisual.media,
  });

  const focusField = (field: FieldKey) => {
    const refMap: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = { name: nameRef, date: dateRef, time: timeRef, place: placeRef };
    refMap[field].current?.focus();
  };

  const nextStory = () => {
    if (storyIndex < STORIES.length - 1) setStoryIndex((i) => i + 1);
    else setStep('birth');
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!name.trim()) { setError('Укажи имя.'); focusField('name'); return; }
    if (!date) { setError('Укажи дату рождения.'); focusField('date'); return; }
    if (!place.trim()) { setError('Укажи место рождения.'); focusField('place'); return; }
    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await onComplete({
        name: name.trim(),
        gender,
        birthDate: date,
        birthTime: time,
        birthPlace: place.trim(),
        birthLatitude: placeCoords?.lat ?? null,
        birthLongitude: placeCoords?.lon ?? null,
        birthTimezone: placeCoords?.timezone ?? null,
        isSetup: false,
        language: 'ru',
        theme: 'light',
        isPremium: false,
        notificationFrequency: notify ? 'daily' : 'important',
      });
    } catch (submitError: any) {
      setError(submitError?.message || 'Не удалось сохранить данные и рассчитать карту. Попробуй ещё раз.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fresh-page lumia-main-scroll onboarding-editorial-page"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 16px)' }}
    >
      <div style={{ padding: '4px 20px 0' }}>
        <p className="lumia-brand-wordmark">Твой Гороскоп</p>
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
                <div className="onb-hero">
                  {storySticker ? (
                    <EditorialSticker
                      asset={storySticker}
                      className="onb-story-sticker"
                      priority
                    />
                  ) : (
                    <span className="onb-hero-ico">{STORIES[storyIndex].icon}</span>
                  )}
                </div>
                <h1 className="onb-title">{STORIES[storyIndex].title}</h1>
                <p className="onb-text">{STORIES[storyIndex].text}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div style={{ padding: '0 20px' }}>
            <button type="button" className="fresh-btn-primary" style={{ width: '100%', margin: 0 }} onClick={nextStory}>
              {storyIndex < STORIES.length - 1 ? 'Дальше' : 'Ввести данные рождения'}
            </button>
            <button type="button" className="onb-skip" onClick={() => setStep('birth')}>Перейти к данным</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', maxWidth: '28rem', width: '100%', margin: '0 auto' }}>
          <div style={{ padding: '8px 20px 0' }}>
            <h1 className="fresh-page-title" style={{ maxWidth: '18rem' }}>Данные для расчёта</h1>
            <p style={{ marginTop: 12, maxWidth: '21rem', fontSize: 14.5, lineHeight: 1.55, color: 'var(--fresh-muted)' }}>
              Дата, время и место рождения нужны для натальной карты и личных прогнозов. Часовой пояс для этой даты определим сами.
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
                <span className="fresh-field-label">Дата рождения</span>
                <input ref={dateRef} type="date" value={date} onChange={(e) => { setDate(e.target.value); if (error) setError(''); }} className="fresh-input" />
              </label>
              <label>
                <span className="fresh-field-label">Время рождения — если знаешь</span>
                <input ref={timeRef} type="time" value={time} onChange={(e) => { setTime(e.target.value); if (error) setError(''); }} className="fresh-input" />
              </label>
            </div>
            {!time ? (
              <p style={{ margin: '-6px 0 0', fontSize: 13, lineHeight: 1.45, color: 'var(--fresh-muted)' }}>
                Без точного времени Асцендент и дома не используются. Планеты и аспекты всё равно рассчитываются.
              </p>
            ) : null}
            {signHint ? <p style={{ margin: '-6px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--fresh-link)' }}>Знак зодиака: {signHint}</p> : null}

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
              <span className="onb-notify-text">Присылать уведомления о новых прогнозах</span>
            </button>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 22 }}>
            {error ? <p style={{ margin: '0 20px 12px', fontSize: 12.5, lineHeight: 1.45, color: '#B91C1C' }}>{error}</p> : null}
            <button type="button" className="fresh-btn-primary" disabled={!canSubmit || isSubmitting} onClick={() => void handleSubmit()}>
              {isSubmitting ? 'Рассчитываем…' : 'Рассчитать карту'}
            </button>
            <p style={{ margin: '12px 20px 0', maxWidth: '21rem', fontSize: 10.5, lineHeight: 1.45, color: 'var(--fresh-muted)' }}>
              Положения планет, дома и аспекты рассчитываются по Swiss Ephemeris. Текст готовится по результатам расчёта.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
