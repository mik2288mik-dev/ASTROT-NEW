import React, { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { CityAutocomplete } from '../components/ui/CityAutocomplete';
import { MeouLogo } from '../components/onboarding/MeouLogo';
import {
  BirthOrbitArtwork,
  ChoiceOrbitArtwork,
  DayClockArtwork,
  MeouSpark,
  NatalWheelArtwork,
  PeopleArtwork,
} from '../components/onboarding/OnboardingArtwork';
import type { BirthTimeMode, BirthTimeUncertaintyMinutes } from '../lib/birthTime';

type OnboardingStart = 'stories' | 'birth';
type OnboardingScreen = 'day' | 'self' | 'people' | 'choice' | 'birth' | 'calculating';
type FieldKey = 'name' | 'date' | 'time' | 'place';
type ErrorField = FieldKey | null;

interface OnboardingProps {
  onComplete: (profile: UserProfile) => Promise<void>;
  initialStep?: OnboardingStart;
  initialProfile?: UserProfile;
  onSkip: () => void;
  onSignIn: () => void;
}

const introScreens: OnboardingScreen[] = ['day', 'self', 'people'];
const welcomeScreens: OnboardingScreen[] = [...introScreens, 'choice'];
const welcomeScreenCount = welcomeScreens.length;
const initialTimeMode = (profile?: UserProfile): Exclude<BirthTimeMode, 'range'> => {
  if (!profile) return 'exact';
  if (profile?.birthTimeMode === 'unknown' || !profile?.birthTime) return 'unknown';
  return profile?.birthTimeMode === 'approximate' ? 'approximate' : 'exact';
};
const initialUncertainty = (profile?: UserProfile): BirthTimeUncertaintyMinutes | null => {
  const value = profile?.birthTimeUncertaintyMinutes;
  return value === 15 || value === 30 || value === 60 ? value : null;
};
const initialCoordinates = (profile?: UserProfile) => (
  typeof profile?.birthLatitude === 'number' && typeof profile?.birthLongitude === 'number'
    ? { lat: profile.birthLatitude, lon: profile.birthLongitude, timezone: profile.birthTimezone || undefined }
    : null
);
const OnboardingProgress = ({ current, count, labelled = true }: { current: number; count: number; labelled?: boolean }) => (
  <div className="meou-progress" aria-label={`${current} из ${count}`}>
    <div className="meou-progress-lines" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className={index < current ? 'is-active' : ''} />
      ))}
    </div>
    {labelled ? <span className="meou-progress-copy">{current} из {count}</span> : null}
  </div>
);

export const Onboarding: React.FC<OnboardingProps> = ({
  onComplete,
  initialStep = 'stories',
  initialProfile,
  onSkip,
  onSignIn,
}) => {
  const [screen, setScreen] = useState<OnboardingScreen>(initialStep === 'birth' ? 'birth' : 'day');
  const [name, setName] = useState(initialProfile?.name || '');
  const [gender] = useState<'male' | 'female' | 'unspecified'>(initialProfile?.gender || 'unspecified');
  const [date, setDate] = useState(initialProfile?.birthDate || '');
  const [time, setTime] = useState(initialProfile?.birthTime || '');
  const [timeMode, setTimeMode] = useState<Exclude<BirthTimeMode, 'range'>>(() => initialTimeMode(initialProfile));
  const [uncertainty, setUncertainty] = useState<BirthTimeUncertaintyMinutes | null>(() => initialUncertainty(initialProfile));
  const [place, setPlace] = useState(initialProfile?.birthPlace || '');
  const [placeCoords, setPlaceCoords] = useState<{ lat: number; lon: number; timezone?: string } | null>(() => initialCoordinates(initialProfile));
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const suppressTapUntilRef = useRef(0);
  const pageRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const placeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      setName((current) => current.trim() ? current : tg.initDataUnsafe.user.first_name || '');
    }
    ensureTelegramFullscreen();
  }, []);

  useEffect(() => {
    const resetScroll = () => {
      pageRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    const timer = window.setTimeout(resetScroll, 0);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [screen]);

  const clearError = () => {
    setError('');
    setErrorField(null);
  };

  const focusField = (field: FieldKey) => {
    const refs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
      name: nameRef,
      date: dateRef,
      time: timeRef,
      place: placeRef,
    };
    refs[field].current?.focus();
  };

  const moveWelcome = (direction: -1 | 1) => {
    const currentIndex = welcomeScreens.indexOf(screen);
    if (currentIndex < 0) return;
    const nextScreen = welcomeScreens[currentIndex + direction];
    if (nextScreen) setScreen(nextScreen);
  };

  const advanceStory = () => moveWelcome(1);
  const retreatStory = () => moveWelcome(-1);

  const handleWelcomeTap = (
    event: React.MouseEvent<HTMLElement>,
    allowForward = true,
  ) => {
    if (Date.now() < suppressTapUntilRef.current) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, a, input, select, textarea, label, [contenteditable="true"]')) return;
    if (event.detail === 0) {
      if (allowForward) advanceStory();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const tappedLeftHalf = event.clientX < bounds.left + bounds.width / 2;
    if (tappedLeftHalf) retreatStory();
    else if (allowForward) advanceStory();
  };

  const chooseTimeMode = (mode: Exclude<BirthTimeMode, 'range'>) => {
    setTimeMode(mode);
    clearError();
    if (mode === 'unknown') {
      setTime('');
      setUncertainty(null);
    } else if (mode === 'approximate') {
      // The existing profile requires an uncertainty value. The compact approved
      // control maps "Примерно" to the established 30-minute mode.
      setUncertainty(30);
    } else {
      setUncertainty(null);
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!name.trim()) {
      setError('Укажи имя.');
      setErrorField('name');
      focusField('name');
      return;
    }
    if (!date) {
      setError('Укажи дату рождения.');
      setErrorField('date');
      focusField('date');
      return;
    }
    if (timeMode !== 'unknown' && !time) {
      setError('Укажи время рождения.');
      setErrorField('time');
      focusField('time');
      return;
    }
    if (!place.trim()) {
      setError('Укажи место рождения.');
      setErrorField('place');
      focusField('place');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setScreen('calculating');
    clearError();
    try {
      await onComplete({
        name: name.trim(),
        gender,
        birthDate: date,
        birthTime: timeMode === 'unknown' ? '' : time,
        birthTimeMode: timeMode,
        birthTimeUncertaintyMinutes: timeMode === 'approximate' ? uncertainty : null,
        birthTimeRangeStart: null,
        birthTimeRangeEnd: null,
        birthPlace: place.trim(),
        birthLatitude: placeCoords?.lat ?? null,
        birthLongitude: placeCoords?.lon ?? null,
        birthTimezone: placeCoords?.timezone ?? null,
        isSetup: false,
        language: 'ru',
        theme: 'light',
        isPremium: false,
        notificationFrequency: 'quiet',
      });
    } catch (submitError: any) {
      setScreen('birth');
      setErrorField(null);
      setError(submitError?.message || 'Не удалось сохранить данные и рассчитать карту. Попробуй ещё раз.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const introIndex = introScreens.indexOf(screen) + 1;
  const isIntro = introIndex > 0;
  const welcomeIndex = welcomeScreens.indexOf(screen) + 1;
  const isWelcome = welcomeIndex > 0;

  return (
    <main
      ref={pageRef}
      className="meou-onboarding fresh-page lumia-main-scroll antialiased"
      data-onboarding-phase={isWelcome ? 'welcome' : 'setup'}
    >
      <div
        className="meou-onboarding-shell"
        onClick={isIntro
          ? (event) => handleWelcomeTap(event)
          : screen === 'choice'
            ? (event) => handleWelcomeTap(event, false)
            : undefined}
      >
        <header className="meou-onboarding-header">
          <MeouLogo className="meou-onboarding-logo" fullCloud />
          {isWelcome ? <OnboardingProgress current={welcomeIndex} count={welcomeScreenCount} labelled={false} /> : null}
          {screen === 'birth' ? <OnboardingProgress current={1} count={2} /> : null}
          {screen === 'calculating' ? <OnboardingProgress current={2} count={2} /> : null}
        </header>

        {isIntro ? (
          <section
            className={`meou-story meou-story--${screen}`}
            role="button"
            tabIndex={0}
            aria-label="Тап слева — назад, справа — вперёд"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                retreatStory();
              } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                advanceStory();
              }
            }}
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              const start = touchStartX.current;
              const end = event.changedTouches[0]?.clientX;
              touchStartX.current = null;
              if (start == null || end == null) return;
              const delta = start - end;
              if (Math.abs(delta) <= 36) return;
              suppressTapUntilRef.current = Date.now() + 450;
              if (delta > 0) advanceStory();
              else retreatStory();
            }}
          >
            <div className="meou-story-copy">
              {screen === 'day' ? <h1>Твой день.<br />Без воды<span>.</span></h1> : null}
              {screen === 'self' ? <h1>Разберём,<br />как ты устроен<span>.</span></h1> : null}
              {screen === 'people' ? <h1>Сравниваем<br />людей,<br />не картинки<span>.</span></h1> : null}
            </div>

            {screen === 'day' ? (
              <>
                <DayClockArtwork />
                <p className="meou-story-description">Сегодня, неделя и месяц —<br />персонально по твоим данным.</p>
                <div className="meou-swipe-hint" aria-hidden="true"><span />Свайп, чтобы продолжить</div>
              </>
            ) : null}

            {screen === 'self' ? (
              <>
                <NatalWheelArtwork />
                <p className="meou-story-description">Сильные стороны, привычные<br />реакции и важные детали<br />расчёта — простыми словами.</p>
              </>
            ) : null}

            {screen === 'people' ? (
              <>
                <PeopleArtwork />
                <p className="meou-story-description">Партнёр, друг или новый<br />знакомый — по данным<br />рождения или быстро по знакам.</p>
              </>
            ) : null}
          </section>
        ) : null}

        {screen === 'choice' ? (
          <section className="meou-choice">
            <ChoiceOrbitArtwork />
            <h1>Как начнём?</h1>
            <div className="meou-choice-actions">
              <button type="button" className="meou-button meou-button--primary" onClick={() => setScreen('birth')}>
                Создать личный прогноз
              </button>
              <p>Имя, дата, место и время —<br />если знаешь</p>
              <button type="button" className="meou-button meou-button--secondary" onClick={onSkip}>
                Смотреть без данных
              </button>
              <button type="button" className="meou-sign-in" onClick={onSignIn}>
                Уже есть аккаунт — <span>войти</span>
              </button>
            </div>
          </section>
        ) : null}

        {screen === 'birth' ? (
          <section className="meou-birth">
            <div className="meou-birth-heading">
              <h1>Немного данных —<br />и карта готова<span>.</span></h1>
              <p>Нам нужны ваши дата, время<br />и место рождения. Без точного времени<br />тоже можно — мы всё учтём.</p>
              <BirthOrbitArtwork />
            </div>

            <form className="meou-birth-form" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
              <label className="meou-field" htmlFor="onboarding-name">
                <span>Имя</span>
                <input id="onboarding-name" ref={nameRef} name="name" type="text" value={name} placeholder="Ваше имя" onChange={(event) => { setName(event.target.value); clearError(); }} aria-invalid={errorField === 'name' || undefined} />
              </label>
              <label className="meou-field" htmlFor="onboarding-birth-date">
                <span>Дата рождения</span>
                <input id="onboarding-birth-date" ref={dateRef} name="birth-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); clearError(); }} aria-invalid={errorField === 'date' || undefined} />
              </label>
              <label className={`meou-field meou-time-field${time ? '' : ' is-empty'}`} htmlFor="onboarding-birth-time">
                <span>Время рождения</span>
                <input id="onboarding-birth-time" ref={timeRef} name="birth-time" type="time" step={60} value={time} disabled={timeMode === 'unknown'} onChange={(event) => { setTime(event.target.value); clearError(); }} aria-invalid={errorField === 'time' || undefined} />
                <span className="meou-time-placeholder" aria-hidden="true">чч:мм</span>
              </label>
              <fieldset className="meou-time-mode">
                <legend>Насколько точно вы знаете время?</legend>
                <div>
                  {([
                    ['exact', 'Знаю'],
                    ['approximate', 'Примерно'],
                    ['unknown', 'Не знаю'],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" className={timeMode === value ? 'is-active' : ''} aria-pressed={timeMode === value} onClick={() => chooseTimeMode(value)}>{label}</button>
                  ))}
                </div>
              </fieldset>
              <div className="meou-field meou-city-field">
                <label htmlFor="onboarding-birth-place">Место рождения</label>
                <CityAutocomplete id="onboarding-birth-place" value={place} inputRef={placeRef} placeholder="Город, страна" ariaInvalid={errorField === 'place'} onChange={(value, coords) => { setPlace(value); setPlaceCoords(coords ?? null); clearError(); }} />
              </div>
              {error ? <p id="onboarding-error" className="meou-form-error" role="alert">{error}</p> : null}
              <button type="submit" className="meou-button meou-button--primary meou-calculate-button" disabled={isSubmitting}>Рассчитать вашу карту</button>
              <p className="meou-privacy">
                <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5" /><path d="M7 8.5V6.5a3 3 0 0 1 6 0v2" /></svg>
                Ваши данные защищены
              </p>
            </form>
          </section>
        ) : null}

        {screen === 'calculating' ? (
          <section className="meou-calculating" aria-live="polite">
            <div>
              <h1>Считаем вашу<br />натальную карту<span>.</span></h1>
              <p>Определяем положение Солнца, Луны<br />и планет на момент вашего рождения.</p>
            </div>
            <NatalWheelArtwork compact />
            <div className="meou-calculating-footer"><MeouSpark /><p>Обычно это занимает<br />до 10 секунд</p></div>
          </section>
        ) : null}
      </div>
    </main>
  );
};
