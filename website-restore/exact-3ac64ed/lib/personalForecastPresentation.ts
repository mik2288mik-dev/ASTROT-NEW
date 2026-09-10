import type { UserProfile } from '../types';
import type { PersonalForecastWindow } from './personalForecastContract';

type ForecastAttributionWindow = Pick<
  PersonalForecastWindow,
  'period' | 'periodStart' | 'periodEnd'
>;

type LocalizedDateParts = {
  day: string;
  month: string;
  year: string;
};

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function localizedDateParts(
  date: Date,
  language: 'ru' | 'en',
): LocalizedDateParts {
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '';

  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
  };
}

function formatFullDate(date: Date, language: 'ru' | 'en'): string {
  const { day, month, year } = localizedDateParts(date, language);
  return language === 'ru'
    ? `${day} ${month} ${year} года`
    : `${month} ${day}, ${year}`;
}

function formatForecastTarget(
  window: ForecastAttributionWindow,
  language: 'ru' | 'en',
): string | null {
  const start = parseDateOnly(window.periodStart);
  const end = parseDateOnly(window.periodEnd);
  if (!start || !end) return null;

  if (window.period === 'day') return formatFullDate(start, language);
  if (window.period === 'month') {
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    const month = new Intl.DateTimeFormat(locale, {
      month: 'long',
      timeZone: 'UTC',
    }).format(start);
    const year = String(start.getUTCFullYear());
    return language === 'ru' ? `${month} ${year} года` : `${month} ${year}`;
  }

  const from = localizedDateParts(start, language);
  const to = localizedDateParts(end, language);
  const sameYear = from.year === to.year;
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (language === 'ru') {
    if (sameMonth) return `${from.day}–${to.day} ${to.month} ${to.year} года`;
    if (sameYear) {
      return `${from.day} ${from.month} – ${to.day} ${to.month} ${to.year} года`;
    }
    return `${from.day} ${from.month} ${from.year} года – ${to.day} ${to.month} ${to.year} года`;
  }

  if (sameMonth) return `${from.month} ${from.day}–${to.day}, ${to.year}`;
  if (sameYear) return `${from.month} ${from.day}–${to.month} ${to.day}, ${to.year}`;
  return `${from.month} ${from.day}, ${from.year}–${to.month} ${to.day}, ${to.year}`;
}

export function formatPersonalForecastAttribution({
  profile,
  window,
  language,
}: {
  profile: Pick<UserProfile, 'name' | 'birthDate'>;
  window: ForecastAttributionWindow;
  language: 'ru' | 'en';
}): string | null {
  const name = profile.name.replace(/\s+/gu, ' ').trim();
  const birthDate = parseDateOnly(profile.birthDate);
  const target = formatForecastTarget(window, language);
  if (!name || !birthDate || !target) return null;

  const formattedBirthDate = formatFullDate(birthDate, language);
  if (language === 'ru') {
    const targetLead = window.period === 'week' ? `на период ${target}` : `на ${target}`;
    return `Прогноз подготовлен ${targetLead} для профиля «${name}» — по дате рождения ${formattedBirthDate}.`;
  }

  return `Forecast prepared for ${target} for the “${name}” profile — based on the birth date ${formattedBirthDate}.`;
}
