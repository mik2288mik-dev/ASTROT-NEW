import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import type { UserProfile } from '../types';
import { getZodiacSign } from '../constants';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { normalizeZodiacKey } from '../lib/zodiacKeys';
import { ZodiacIllustration, ZodiacSymbol } from '../components/icons/ZodiacArt';
import { DateWheel } from '../components/nebo/DateWheel';
import { HoroscopeReader } from './v2/HoroscopeReader';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { CityAutocomplete } from '../components/ui/CityAutocomplete';
import { MeouLogo } from '../components/onboarding/MeouLogo';
import { OnboardingReady, OnboardingShowcase, type ShowcaseSlide } from '../components/onboarding/OnboardingShowcase';
import { VideoBackground } from '../components/lumia-ui/VideoBackground';
import type { VideoBackgroundId } from '../lib/videoBackgrounds';
import {
  BirthOrbitArtwork,
} from '../components/onboarding/OnboardingArtwork';
import type { BirthTimeMode, BirthTimeUncertaintyMinutes } from '../lib/birthTime';
import { validateDate, validateName } from '../lib/validation';
import { onboardingCalculationStatus } from '../lib/onboardingCalculationStatus';
import { ACTION_FEEDBACK, showActionFeedback } from '../components/lumia-ui/ActionFeedback';
import { useOnboardingTelemetry } from '../services/useOnboardingTelemetry';

type OnboardingStart = 'stories' | 'birth';
type OnboardingScreen = 'hello' | 'natal' | 'future' | 'compat' | 'calm' | 'more' | 'choice' | 'birth' | 'calculating' | 'waiting' | 'horoscope';
type FieldKey = 'name' | 'date' | 'time' | 'place';
type ErrorField = FieldKey | null;

interface OnboardingProps {
  onComplete: (profile: UserProfile, onPhaseChange: (phase: 'chart' | 'reading') => void) => Promise<boolean>;
  onOpenPrepared: () => void;
  accountProfile: UserProfile;
  initialStep?: OnboardingStart;
  initialProfile?: UserProfile;
  onSkip: () => void;
  onSignIn: () => void;
}

const introScreens: OnboardingScreen[] = ['hello', 'natal', 'future', 'compat', 'calm', 'more'];
const welcomeScreens: OnboardingScreen[] = [...introScreens, 'choice'];
const welcomeScreenCount = welcomeScreens.length;
// One calm looping clip behind every welcome screen; the poster shows first and when the clip cannot play.
const SCREEN_VIDEOS: Partial<Record<OnboardingScreen, VideoBackgroundId>> = {
  hello: 'onboarding-day',
  natal: 'onboarding-self',
  future: 'onboarding-future',
  compat: 'onboarding-people',
  calm: 'breathing',
  more: 'onboarding-more',
  choice: 'onboarding-choice',
};
const initialTimeMode = (profile?: UserProfile): Exclude<BirthTimeMode, 'range'> => {
  if (!profile) return 'exact';
  if (profile?.birthTimeMode === 'unknown' || !profile?.birthTime) return 'unknown';
  return profile?.birthTimeMode === 'approximate' ? 'approximate' : 'exact';
};
const initialUncertainty = (profile?: UserProfile): BirthTimeUncertaintyMinutes | null => {
  const value = profile?.birthTimeUncertaintyMinutes;
  if (value === 15 || value === 30 || value === 60) return value;
  return profile?.birthTimeMode === 'approximate' ? 30 : null;
};
const initialCoordinates = (profile?: UserProfile) => (
  typeof profile?.birthLatitude === 'number' && typeof profile?.birthLongitude === 'number'
    ? { lat: profile.birthLatitude, lon: profile.birthLongitude, timezone: profile.birthTimezone || undefined }
    : null
);
const localDateInputValue = (date: Date): string => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');
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


const ENTRY_SIGN_RANGES: Record<string, string> = {
  aries: '21 марта - 19 апреля', taurus: '20 апреля - 20 мая', gemini: '21 мая - 20 июня', cancer: '21 июня - 22 июля',
  leo: '23 июля - 22 августа', virgo: '23 августа - 22 сентября', libra: '23 сентября - 22 октября', scorpio: '23 октября - 21 ноября',
  sagittarius: '22 ноября - 21 декабря', capricorn: '22 декабря - 19 января', aquarius: '20 января - 18 февраля', pisces: '19 февраля - 20 марта',
};
const CALC_STEPS = ['Солнце и Луна', 'Планеты по знакам', 'Дома и Асцендент', 'Твой день на сегодня'];
const ENTRY_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export const Onboarding: React.FC<OnboardingProps> = ({
  onComplete,
  onOpenPrepared,
  accountProfile,
  initialStep = 'stories',
  initialProfile,
  onSkip,
  onSignIn,
}) => {

  const [screen, setScreen] = useState<OnboardingScreen>('birth');
  const [name, setName] = useState(initialProfile?.name || '');
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>(initialProfile?.gender || 'unspecified');
  const [date, setDate] = useState(initialProfile?.birthDate || '');
  const [time, setTime] = useState(initialProfile?.birthTime || '');
  const [timeMode, setTimeMode] = useState<Exclude<BirthTimeMode, 'range'>>(() => initialTimeMode(initialProfile));
  const [uncertainty, setUncertainty] = useState<BirthTimeUncertaintyMinutes | null>(() => initialUncertainty(initialProfile));
  const [place, setPlace] = useState(initialProfile?.birthPlace || '');
  const [placeCoords, setPlaceCoords] = useState<{ lat: number; lon: number; timezone?: string } | null>(() => initialCoordinates(initialProfile));
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculationElapsedSeconds, setCalculationElapsedSeconds] = useState(0);
  const [preparationPhase, setPreparationPhase] = useState<'chart' | 'reading'>('chart');
  const [prepared, setPrepared] = useState(false);
  const [preparationError, setPreparationError] = useState('');
  const [submittedProfile, setSubmittedProfile] = useState<UserProfile | null>(null);
  const readingOpenRef = useRef(false);
  const submittingRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const suppressTapUntilRef = useRef(0);
  const pageRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const placeRef = useRef<HTMLInputElement | null>(null);
  const telemetry = useOnboardingTelemetry(screen, accountProfile.id);
  const entrySign = date ? normalizeZodiacKey(sunSignFromDate(date) || '') : null;
  // The canvas entry has no name field: ask only when neither the account nor Telegram gave a name.
  const [needsName] = useState(() => (initialProfile?.name || '').trim().length < 2
    && !(typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name));
  const calcSubtitle = (() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const datePart = match ? `${Number(match[3])} ${ENTRY_MONTHS[Number(match[2]) - 1]} ${match[1]}` : '';
    return [datePart, timeMode !== 'unknown' ? time : '', place.split(',')[0]].filter(Boolean).join(', ');
  })();
  const openPrepared = () => { telemetry.action('open_result'); telemetry.finish('created'); onOpenPrepared(); };
  const skipSetup = () => { telemetry.action('look'); telemetry.finish('without_chart'); onSkip(); };
  const signIn = () => { telemetry.action('sign_in'); telemetry.finish('sign_in'); onSignIn(); };

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

  useEffect(() => {
    if (!isSubmitting) return;
    const startedAt = Date.now();
    setCalculationElapsedSeconds(0);
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setCalculationElapsedSeconds(elapsed);
      if (elapsed >= 10) setScreen((current) => current === 'calculating' ? 'waiting' : current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSubmitting]);

  useEffect(() => {
    if (screen !== 'birth') return;
    const page = pageRef.current;
    if (!page) return;

    const visualViewport = window.visualViewport;
    let previousViewportHeight = visualViewport?.height ?? window.innerHeight;
    let scrollFrame = 0;
    let scrollTimer = 0;
    let viewportWatchFrame = 0;
    let viewportWatchDeadline = 0;

    const activeBirthInput = () => {
      const active = document.activeElement;
      return active instanceof HTMLInputElement
        && page.contains(active)
        && active.closest('.meou-birth-form')
        ? active
        : null;
    };
    const keepActiveInputVisible = () => {
      window.cancelAnimationFrame(scrollFrame);
      window.clearTimeout(scrollTimer);
      scrollFrame = window.requestAnimationFrame(() => {
        scrollTimer = window.setTimeout(() => {
          activeBirthInput()?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
        }, 80);
      });
    };
    const handleViewportResize = () => {
      const nextViewportHeight = visualViewport?.height ?? window.innerHeight;
      const viewportShrank = nextViewportHeight < previousViewportHeight - 1;
      previousViewportHeight = nextViewportHeight;
      if (viewportShrank) keepActiveInputVisible();
    };
    const watchViewportWhileKeyboardOpens = () => {
      handleViewportResize();
      if (window.performance.now() < viewportWatchDeadline) {
        viewportWatchFrame = window.requestAnimationFrame(watchViewportWhileKeyboardOpens);
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement && event.target.closest('.meou-birth-form')) {
        previousViewportHeight = visualViewport?.height ?? window.innerHeight;
        viewportWatchDeadline = window.performance.now() + 1000;
        window.cancelAnimationFrame(viewportWatchFrame);
        keepActiveInputVisible();
        viewportWatchFrame = window.requestAnimationFrame(watchViewportWhileKeyboardOpens);
      }
    };

    page.addEventListener('focusin', handleFocusIn);
    window.addEventListener('resize', handleViewportResize);
    if (visualViewport) visualViewport.addEventListener('resize', handleViewportResize);

    return () => {
      page.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('resize', handleViewportResize);
      if (visualViewport) visualViewport.removeEventListener('resize', handleViewportResize);
      window.cancelAnimationFrame(scrollFrame);
      window.cancelAnimationFrame(viewportWatchFrame);
      window.clearTimeout(scrollTimer);
    };
  }, [screen]);

  const clearError = () => {
    setError('');
    setErrorField(null);
  };

  const focusField = (field: FieldKey) => {
    telemetry.event('birth_validation_error', { field, error_kind: 'validation' });
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
    if (nextScreen) { telemetry.action(direction === 1 ? 'next' : 'back'); setScreen(nextScreen); }
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
    telemetry.action(`time_${mode}`);
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
    telemetry.action('submit');
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      setError(!name.trim()
        ? 'Укажи имя.'
        : name.trim().length < 2
          ? 'Имя должно содержать минимум 2 символа.'
          : 'Проверь имя: максимум 100 символов без служебных знаков.');
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
    const dateValidation = validateDate(date);
    if (!dateValidation.isValid) {
      setError(dateValidation.error?.includes('future')
        ? 'Дата рождения не может быть в будущем.'
        : dateValidation.error?.includes('before 1900')
          ? 'Укажи дату не раньше 1900 года.'
          : 'Проверь дату рождения.');
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

    telemetry.event('birth_data_completed', { time_mode: timeMode });
    await prepare({
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
  };

  const prepare = async (draft: UserProfile) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setPrepared(false);
    setPreparationPhase('chart');
    setPreparationError('');
    setCalculationElapsedSeconds(0);
    setSubmittedProfile(draft);
    if (!readingOpenRef.current) setScreen('calculating');
    clearError();
    telemetry.wait('chart');
    try {
      const ready = await onComplete(draft, phase => {
        telemetry.wait(phase);
        setPreparationPhase(phase);
      });
      if (!ready) { telemetry.finishWait('cancelled'); return; }
      telemetry.finishWait('ready');
      telemetry.event('onboarding_result_ready');
      setPrepared(true);
      showActionFeedback(ACTION_FEEDBACK.onboardingReady);
      if (!readingOpenRef.current) { telemetry.finish('created'); onOpenPrepared(); }
    } catch (submitError: any) {
      telemetry.finishWait('failed');
      telemetry.event('onboarding_failed', { error_kind: /network|fetch|интернет|связаться/i.test(String(submitError?.message || '')) ? 'network' : 'calculation' });
      setPreparationError(submitError?.message || 'Не удалось подготовить разбор. Проверь интернет и попробуй ещё раз.');
      setScreen((current) => current === 'calculating' ? 'waiting' : current);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const introIndex = introScreens.indexOf(screen) + 1;
  const isIntro = introIndex > 0;
  const welcomeIndex = welcomeScreens.indexOf(screen) + 1;
  const isWelcome = welcomeIndex > 0;
  const waitingSign = normalizeZodiacKey(sunSignFromDate(submittedProfile?.birthDate || date));
  const preparationTitle = preparationPhase === 'chart' ? 'Рассчитываем карту' : 'Собираем твой разбор';
  const calculationNote = 'Расчёт карты может занять до 1 минуты. Это время нужно для точного расчёта положений планет на момент вашего рождения.';
  const editBirthDetails = () => {
    telemetry.action('edit');
    readingOpenRef.current = false;
    setScreen('birth');
    setError(preparationError);
    setErrorField(null);
  };
  const retryPreparation = () => { if (submittedProfile) { telemetry.action('retry'); void prepare(submittedProfile); } };

  if (screen === 'horoscope' && submittedProfile) {
    return (
      <main className="onboarding-horoscope lumia-main-scroll scrollbar-hide">
        <HoroscopeReader
          profile={{ ...accountProfile, ...submittedProfile }}
          chartData={null}
          onboarding
          onBack={() => {
            readingOpenRef.current = false;
            if (prepared) openPrepared();
            else { telemetry.action('return_wait'); setScreen('waiting'); }
          }}
          preparationNotice={(
            <section className="onboarding-preparation-notice" aria-live="polite">
              {preparationError ? (
                <>
                  <p role="alert">{preparationError}</p>
                  <button type="button" className="fresh-btn-primary" onClick={retryPreparation}>Повторить</button>
                  <button type="button" className="onboarding-wait-link" onClick={editBirthDetails}>Изменить данные</button>
                </>
              ) : prepared ? (
                <>
                  <strong><CheckCircle2 size={20} aria-hidden="true" />Твой личный разбор готов</strong>
                  <p>Можно возвращаться на главную.</p>
                  <button type="button" className="fresh-btn-primary" onClick={openPrepared}>Открыть разбор</button>
                </>
              ) : (
                <>
                  <strong><LoaderCircle size={20} className="onboarding-wait-spinner" aria-hidden="true" />{preparationTitle}</strong>
                  <p>Можешь читать гороскоп — подготовка продолжается.</p>
                  <button type="button" className="onboarding-wait-link" onClick={() => { telemetry.action('return_wait'); readingOpenRef.current = false; setScreen('waiting'); }}>Вернуться к ожиданию</button>
                </>
              )}
            </section>
          )}
        />
      </main>
    );
  }

  return (
    <main
      ref={pageRef}
      className="meou-onboarding antialiased"
      data-onboarding-phase={isWelcome ? 'welcome' : 'setup'}
      data-onboarding-screen={screen}
    >
      {SCREEN_VIDEOS[screen] ? <VideoBackground key={screen} id={SCREEN_VIDEOS[screen] as VideoBackgroundId} scrim="bottom" onPlaybackState={telemetry.video} /> : null}
      <div
        className="meou-onboarding-shell"
        onClick={isIntro
          ? (event) => handleWelcomeTap(event)
          : screen === 'choice'
            ? (event) => handleWelcomeTap(event, false)
            : undefined}
      >
        {screen === 'birth' ? (
          <header className="nebo-entry-bar"><img src="/assets/auth/logo.webp" alt="" width={30} height={30} /><strong>NEBO</strong></header>
        ) : screen === 'calculating' ? null : (
        <header className="meou-onboarding-header">
          <MeouLogo className="meou-onboarding-logo" fullCloud />
          {isWelcome ? <OnboardingProgress current={welcomeIndex} count={welcomeScreenCount} labelled={false} /> : null}
        </header>
        )}
        {isIntro ? (
          <section
            className={`meou-story meou-story--showcase meou-story--${screen}`}
            role="group"
            tabIndex={0}
            aria-label="Тап слева, назад, справа, вперёд"
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
            <button type="button" className="ob-skip" onClick={() => { telemetry.action('skip_stories'); setScreen('choice'); }}>Пропустить</button>
            <OnboardingShowcase slide={screen as ShowcaseSlide} />
            <button type="button" className="ob-next" onClick={advanceStory}>Дальше</button>
          </section>
        ) : null}

        {screen === 'choice' ? (
          <section className="meou-choice meou-choice--ready">
            <OnboardingReady onCreate={() => { telemetry.action('create'); setScreen('birth'); }} onLook={skipSetup} onSignIn={signIn} />
          </section>
        ) : null}

        {screen === 'birth' ? (
          <section className="nebo-entry">
            <div className="nebo-entry-head">
              <h1>Когда у тебя день рождения?</h1>
              <p>Покажем твой день сразу. Без регистрации.</p>
            </div>
            {entrySign ? (
              <div className="nebo-entry-sign">
                <ZodiacIllustration sign={entrySign} className="nebo-entry-sign-art" priority />
                <span><strong>{getZodiacSign('ru', entrySign)}</strong><small>{ENTRY_SIGN_RANGES[entrySign.toLowerCase()] || ''}</small></span>
              </div>
            ) : null}

            <form className="nebo-entry-card" noValidate onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
              <DateWheel value={date} onChange={(value) => { setDate(value); clearError(); telemetry.field('date', true); }} />
              <div className="nebo-entry-more">
                <svg width="38" height="38" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 14l12-5 12 5 12-5v26l-12 5-12-5-12 5z" fill="#BFE6C8" /><path d="M18 9v26M30 14v26" stroke="#8CCB9C" strokeWidth="1.5" /><path d="M6 14l12-5 12 5 12-5v26l-12 5-12-5-12 5z" fill="none" stroke="#5FAE72" strokeWidth="1.5" strokeLinejoin="round" /><path d="M30 6c-4.4 0-8 3.4-8 7.8 0 5.6 8 13.2 8 13.2s8-7.6 8-13.2C38 9.4 34.4 6 30 6z" fill="#F0543C" /><circle cx="30" cy="13.6" r="3" fill="#ffffff" /></svg>
                <span><strong>Время и город твоего рождения</strong><small>Они нужны, чтобы точно посчитать твою натальную карту.</small></span>
              </div>
              {needsName ? (
                <label className="nebo-entry-field" htmlFor="onboarding-name">
                  Как тебя зовут
                  <input id="onboarding-name" ref={nameRef} name="name" type="text" autoComplete="given-name" minLength={2} maxLength={100} value={name} placeholder="Имя" onChange={(event) => { setName(event.target.value); clearError(); }} aria-invalid={errorField === 'name' || undefined} aria-describedby={errorField === 'name' ? 'onboarding-error' : undefined} />
                </label>
              ) : null}
              <div className="nebo-entry-row">
                <label className="nebo-entry-field" htmlFor="onboarding-birth-time">
                  Время
                  <input id="onboarding-birth-time" ref={timeRef} name="birth-time" type="time" step={60} value={timeMode === 'unknown' ? '' : time} disabled={timeMode === 'unknown'} placeholder={timeMode === 'unknown' ? 'не знаю' : '23:15'} onChange={(event) => { setTime(event.target.value); clearError(); }} aria-invalid={errorField === 'time' || undefined} aria-describedby={errorField === 'time' ? 'onboarding-error' : undefined} />
                </label>
                <div className="nebo-entry-field">
                  <label htmlFor="onboarding-birth-place">Город</label>
                  <CityAutocomplete id="onboarding-birth-place" value={place} inputRef={placeRef} placeholder="Например, Тула" ariaInvalid={errorField === 'place'} ariaDescribedBy={errorField === 'place' ? 'onboarding-error' : undefined} onChange={(value, coords) => { setPlace(value); setPlaceCoords(coords ?? null); clearError(); }} />
                </div>
              </div>
              <label className="nebo-entry-check">
                <input type="checkbox" checked={timeMode === 'unknown'} onChange={(event) => chooseTimeMode(event.target.checked ? 'unknown' : 'exact')} />
                <span>Не знаю время рождения</span>
              </label>
              {timeMode === 'unknown' ? <p className="nebo-entry-note">Посчитаем без Асцендента и домов. Время можно добавить потом.</p> : null}
              <p className="nebo-entry-proof">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
                Профессиональный расчёт. Можно сверить с другими сервисами.
              </p>
              {error ? <p id="onboarding-error" className="nebo-entry-error" role="alert">{error}</p> : null}
              <button type="submit" className="nebo-entry-cta" disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? 'Считаем…' : 'Показать мой день'}</button>
              {accountProfile.isGuest ? <p className="nebo-entry-foot">Данные останутся на этом телефоне, пока ты не войдёшь</p> : null}
            </form>
          </section>
        ) : null}

        {screen === 'calculating' ? (
          <section className="nebo-calc" aria-live="polite">
            <div className="nebo-calc-orbit" aria-hidden="true">
              <span className="nebo-calc-ring is-1" /><span className="nebo-calc-ring is-2" /><span className="nebo-calc-ring is-3" />
              <span className="nebo-calc-planet is-1" /><span className="nebo-calc-planet is-2" /><span className="nebo-calc-planet is-3" /><span className="nebo-calc-planet is-4" />
              {entrySign ? <ZodiacIllustration sign={entrySign} className="nebo-calc-sign" priority /> : null}
            </div>
            <h1>Считаем твоё небо</h1>
            <p className="nebo-calc-sub">{calcSubtitle}</p>
            <ul className="nebo-calc-steps">
              {CALC_STEPS.filter((step) => timeMode !== 'unknown' || step !== 'Дома и Асцендент').map((step, index, list) => {
                const doneCount = preparationPhase === 'reading' ? list.length - 1 : Math.min(list.length - 1, Math.floor(calculationElapsedSeconds / 2));
                const state = index < doneCount ? 'is-done' : index === doneCount ? 'is-active' : 'is-wait';
                return <li key={step} className={state}><i aria-hidden="true" />{step}</li>;
              })}
            </ul>
            <div className="nebo-calc-bar"><span style={{ width: `${preparationPhase === 'reading' ? 90 : Math.min(85, 15 + calculationElapsedSeconds * 9)}%` }} /></div>
            <p className="nebo-calc-note">{preparationPhase === 'chart' ? onboardingCalculationStatus(calculationElapsedSeconds, timeMode) : 'Карта готова. Готовим рассказ о твоём дне.'}</p>
          </section>
        ) : null}
        {screen === 'waiting' ? (
          <section className="onboarding-waiting">
            {preparationError ? (
              <>
                <h1>Не удалось подготовить разбор</h1>
                <p role="alert">{preparationError}</p>
                <button type="button" className="fresh-btn-primary" onClick={retryPreparation}>Повторить</button>
                <button type="button" className="onboarding-wait-link" onClick={editBirthDetails}>Изменить данные</button>
              </>
            ) : (
              <>
                <LoaderCircle size={32} className="onboarding-wait-spinner" aria-hidden="true" />
                <div role="status"><h1>{preparationTitle}</h1></div>
                <p>{preparationPhase === 'chart' ? calculationNote : 'Карта рассчитана. Готовим рассказ по твоей карте — он появится, как только будет готов.'}</p>
                <p>А пока можешь посмотреть прогноз для своего знака.</p>
              </>
            )}
            {waitingSign ? (
              <div className="onboarding-wait-card">
                <div className="onboarding-wait-sign">
                  <ZodiacSymbol sign={waitingSign} size={48} />
                  <div><strong>{getZodiacSign('ru', waitingSign)} — сегодня</strong><span>Гороскоп для твоего знака</span></div>
                </div>
                <button type="button" className="fresh-btn-primary" onClick={() => { telemetry.action('read_horoscope'); readingOpenRef.current = true; setScreen('horoscope'); }}>Почитать гороскоп</button>
                {!preparationError ? <p>Или останься здесь — разбор появится сам.</p> : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
};
