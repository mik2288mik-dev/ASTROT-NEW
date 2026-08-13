import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { getZodiacSign } from '../constants';
import { CityAutocomplete } from '../components/ui/CityAutocomplete';
import type { BirthTimeMode, BirthTimeUncertaintyMinutes } from '../lib/birthTime';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => Promise<void>;
  initialStep?: 'stories' | 'birth';
}

type FieldKey = 'name' | 'date' | 'time' | 'place';
type ErrorField = FieldKey | 'uncertainty' | null;

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>('unspecified');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timeMode, setTimeMode] = useState<Exclude<BirthTimeMode, 'range'>>('exact');
  const [uncertainty, setUncertainty] = useState<BirthTimeUncertaintyMinutes | null>(null);
  const [place, setPlace] = useState('');
  const [placeCoords, setPlaceCoords] = useState<{
    lat: number;
    lon: number;
    timezone?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
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

  const signHint = useMemo(() => {
    const sign = sunSignFromDate(date);
    return sign ? getZodiacSign('ru', sign) : '';
  }, [date]);

  const focusField = (field: FieldKey) => {
    const refs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
      name: nameRef,
      date: dateRef,
      time: timeRef,
      place: placeRef,
    };
    refs[field].current?.focus();
  };
  const clearError = () => {
    setError('');
    setErrorField(null);
  };
  const chooseTimeMode = (mode: Exclude<BirthTimeMode, 'range'>) => {
    setTimeMode(mode);
    clearError();
    if (mode === 'unknown') {
      setTime('');
      setUncertainty(null);
    } else if (mode === 'exact') {
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
    if (timeMode === 'approximate' && !uncertainty) {
      setError('Укажи погрешность времени.');
      setErrorField('uncertainty');
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
      setErrorField(null);
      setError(
        submitError?.message
          || 'Не удалось сохранить данные и рассчитать карту. Попробуй ещё раз.',
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fresh-page lumia-main-scroll onboarding-editorial-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 16px)',
      }}
    >
      <div style={{ padding: '4px 20px 0' }}>
        <p className="lumia-brand-wordmark">Твой Гороскоп</p>
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          maxWidth: '28rem',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ padding: '8px 20px 0' }}>
          <h1 className="fresh-page-title" style={{ maxWidth: '18rem' }}>
            Данные для расчёта
          </h1>
          <p
            style={{
              marginTop: 12,
              maxWidth: '21rem',
              fontSize: 14.5,
              lineHeight: 1.55,
              color: 'var(--fresh-muted)',
            }}
          >
            Сначала рассчитаем твою карту, затем подготовим личный Today. Дата,
            время и место рождения нужны для Swiss Ephemeris; часовой пояс
            определим по городу и дате.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 20px 0' }}>
          <div>
            <label className="fresh-field-label" htmlFor="onboarding-name">Имя</label>
            <input
              id="onboarding-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(event) => { setName(event.target.value); clearError(); }}
              className="fresh-input"
              placeholder="Как к тебе обращаться"
              aria-invalid={errorField === 'name' || undefined}
              aria-describedby={errorField === 'name' ? 'onboarding-error' : undefined}
            />
          </div>

          <div>
            <span id="onboarding-gender-label" className="fresh-field-label">Пол</span>
            <div role="group" aria-labelledby="onboarding-gender-label" style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {([
                ['male', 'Мужской'],
                ['female', 'Женский'],
                ['unspecified', 'Не указывать'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  aria-pressed={gender === value}
                  style={{ minHeight: 44 }}
                  className={`onb-gender ${gender === value ? 'is-on' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="fresh-field-label" htmlFor="onboarding-birth-date">Дата рождения</label>
            <input
              id="onboarding-birth-date"
              ref={dateRef}
              type="date"
              value={date}
              onChange={(event) => { setDate(event.target.value); clearError(); }}
              className="fresh-input"
              aria-invalid={errorField === 'date' || undefined}
              aria-describedby={errorField === 'date' ? 'onboarding-error' : undefined}
            />
          </div>

          <div>
            <span id="onboarding-time-mode-label" className="fresh-field-label">Время рождения</span>
            <div
              role="group"
              aria-labelledby="onboarding-time-mode-label"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}
            >
              {([
                ['exact', 'Знаю точно'],
                ['approximate', 'Знаю примерно'],
                ['unknown', 'Не знаю'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseTimeMode(value)}
                  aria-pressed={timeMode === value}
                  style={{ minHeight: 44 }}
                  className={`onb-gender ${timeMode === value ? 'is-on' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {timeMode !== 'unknown' ? (
            <div>
              <label className="fresh-field-label" htmlFor="onboarding-birth-time">Часы и минуты</label>
              <input
                id="onboarding-birth-time"
                ref={timeRef}
                type="time"
                step={60}
                value={time}
                onChange={(event) => { setTime(event.target.value); clearError(); }}
                className="fresh-input"
                aria-invalid={errorField === 'time' || undefined}
                aria-describedby={errorField === 'time' ? 'onboarding-error' : undefined}
              />
            </div>
          ) : null}

          {timeMode === 'approximate' ? (
            <div>
              <span id="onboarding-uncertainty-label" className="fresh-field-label">Погрешность</span>
              <div
                role="group"
                aria-labelledby="onboarding-uncertainty-label"
                aria-describedby={errorField === 'uncertainty' ? 'onboarding-error' : undefined}
                style={{ display: 'flex', gap: 8, marginTop: 6 }}
              >
                {([15, 30, 60] as const).map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => { setUncertainty(minutes); clearError(); }}
                    aria-pressed={uncertainty === minutes}
                    style={{ minHeight: 44 }}
                    className={`onb-gender ${uncertainty === minutes ? 'is-on' : ''}`}
                  >
                    {minutes === 60 ? 'до 1 часа' : `до ${minutes} минут`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {timeMode === 'unknown' ? (
            <p style={{ margin: '-6px 0 0', fontSize: 13, lineHeight: 1.45, color: 'var(--fresh-muted)' }}>
              Время не подставляем. Дома, Асцендент и MC не считаем.
            </p>
          ) : timeMode === 'approximate' ? (
            <p style={{ margin: '-6px 0 0', fontSize: 13, lineHeight: 1.45, color: 'var(--fresh-muted)' }}>
              Проверим весь диапазон и отметим только то, что в нём не меняется.
            </p>
          ) : null}

          {signHint ? (
            <p style={{ margin: '-6px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--fresh-link)' }}>
              Знак зодиака: {signHint}
            </p>
          ) : null}

          <div>
            <label className="fresh-field-label" htmlFor="onboarding-birth-place">Место рождения</label>
            <CityAutocomplete
              id="onboarding-birth-place"
              value={place}
              inputRef={placeRef}
              placeholder="Начни вводить город…"
              ariaInvalid={errorField === 'place'}
              ariaDescribedBy={errorField === 'place' ? 'onboarding-error' : undefined}
              onChange={(value, coords) => {
                setPlace(value);
                setPlaceCoords(coords ?? null);
                clearError();
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 22 }}>
          {error ? (
            <p
              id="onboarding-error"
              role="alert"
              style={{ margin: '0 20px 12px', fontSize: 12.5, lineHeight: 1.45, color: '#B91C1C' }}
            >
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="fresh-btn-primary"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Рассчитываем карту…' : 'Рассчитать карту'}
          </button>
          <p style={{ margin: '12px 20px 0', maxWidth: '21rem', fontSize: 10.5, lineHeight: 1.45, color: 'var(--fresh-muted)' }}>
            Если расчёт или подготовка Today прервутся, введённые данные останутся здесь для повторной попытки.
          </p>
        </div>
      </div>
    </div>
  );
};
