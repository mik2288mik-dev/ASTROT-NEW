import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type BirthTimeMode = 'exact' | 'approximate' | 'range' | 'unknown';
export type BirthTimeUncertaintyMinutes = 15 | 30 | 60;

export interface BirthTimeInput {
  mode: BirthTimeMode;
  localTime: string | null;
  uncertaintyMinutes: BirthTimeUncertaintyMinutes | null;
  rangeStart: string | null;
  rangeEnd: string | null;
}

export interface BirthTimeInterval {
  mode: BirthTimeMode;
  localDate: string;
  timezone: string;
  localTime: string | null;
  uncertaintyMinutes: BirthTimeUncertaintyMinutes | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  startUtc: string;
  endUtc: string;
  referenceUtc: string | null;
  sampleUtc: string[];
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/;
const ALLOWED_UNCERTAINTY = new Set<number>([15, 30, 60]);

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid birth date. Expected YYYY-MM-DD.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error('Invalid birth date.');
  }
}

export function normalizeBirthClockTime(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  const match = normalized.match(TIME_PATTERN);
  if (!match) throw new Error('Invalid birth time. Expected HH:MM.');
  return `${match[1]}:${match[2]}`;
}

function localToUtc(localDate: string, localTime: string, timezone: string): Date {
  const localIso = `${localDate}T${localTime}:00`;
  const utc = fromZonedTime(localIso, timezone);
  if (Number.isNaN(utc.getTime())) throw new Error('Could not convert birth time to UTC.');

  const roundTrip = toZonedTime(utc, timezone);
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const valid =
    roundTrip.getFullYear() === year &&
    roundTrip.getMonth() === month - 1 &&
    roundTrip.getDate() === day &&
    roundTrip.getHours() === hour &&
    roundTrip.getMinutes() === minute;
  if (!valid) {
    throw new Error('The entered local birth time does not exist in this timezone.');
  }
  return utc;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function buildSamples(start: Date, end: Date, stepMinutes: number, reference?: Date | null): string[] {
  const points = new Set<number>([start.getTime(), end.getTime()]);
  if (reference) points.add(reference.getTime());
  for (let time = start.getTime(); time <= end.getTime(); time += stepMinutes * 60_000) {
    points.add(time);
  }
  return [...points].sort((a, b) => a - b).map((value) => new Date(value).toISOString());
}

export function normalizeBirthTimeInput(input: {
  mode?: unknown;
  localTime?: unknown;
  uncertaintyMinutes?: unknown;
  rangeStart?: unknown;
  rangeEnd?: unknown;
  legacyBirthTime?: unknown;
}): BirthTimeInput {
  const legacyTime = normalizeBirthClockTime(input.legacyBirthTime);
  const rawMode = typeof input.mode === 'string' ? input.mode.trim() : '';
  const mode: BirthTimeMode =
    rawMode === 'exact' || rawMode === 'approximate' || rawMode === 'range' || rawMode === 'unknown'
      ? rawMode
      : legacyTime
        ? 'exact'
        : 'unknown';

  if (mode === 'unknown') {
    return { mode, localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null };
  }

  if (mode === 'range') {
    const rangeStart = normalizeBirthClockTime(input.rangeStart);
    const rangeEnd = normalizeBirthClockTime(input.rangeEnd);
    if (!rangeStart || !rangeEnd) throw new Error('Birth time range requires start and end.');
    if (rangeStart >= rangeEnd) throw new Error('Birth time range end must be later than start.');
    return { mode, localTime: null, uncertaintyMinutes: null, rangeStart, rangeEnd };
  }

  const localTime = normalizeBirthClockTime(input.localTime) || legacyTime;
  if (!localTime) throw new Error('Birth time is required for exact or approximate mode.');

  if (mode === 'exact') {
    return { mode, localTime, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null };
  }

  const uncertainty = Number(input.uncertaintyMinutes);
  if (!ALLOWED_UNCERTAINTY.has(uncertainty)) {
    throw new Error('Approximate birth time uncertainty must be 15, 30, or 60 minutes.');
  }
  return {
    mode,
    localTime,
    uncertaintyMinutes: uncertainty as BirthTimeUncertaintyMinutes,
    rangeStart: null,
    rangeEnd: null,
  };
}

export function buildBirthTimeInterval(
  localDate: string,
  timezone: string,
  input: BirthTimeInput,
): BirthTimeInterval {
  assertDate(localDate);
  if (!timezone?.trim()) throw new Error('Birth timezone is required.');

  if (input.mode === 'exact') {
    const reference = localToUtc(localDate, input.localTime!, timezone);
    const iso = reference.toISOString();
    return {
      ...input,
      localDate,
      timezone,
      startUtc: iso,
      endUtc: iso,
      referenceUtc: iso,
      sampleUtc: [iso],
    };
  }

  if (input.mode === 'approximate') {
    const reference = localToUtc(localDate, input.localTime!, timezone);
    const uncertainty = input.uncertaintyMinutes!;
    const start = addMinutes(reference, -uncertainty);
    const end = addMinutes(reference, uncertainty);
    return {
      ...input,
      localDate,
      timezone,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      referenceUtc: reference.toISOString(),
      sampleUtc: buildSamples(start, end, 5, reference),
    };
  }

  if (input.mode === 'range') {
    const start = localToUtc(localDate, input.rangeStart!, timezone);
    const end = localToUtc(localDate, input.rangeEnd!, timezone);
    if (end <= start) throw new Error('Birth time range end must be later than start.');
    return {
      ...input,
      localDate,
      timezone,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      referenceUtc: null,
      sampleUtc: buildSamples(start, end, 10),
    };
  }

  const start = localToUtc(localDate, '00:00', timezone);
  const end = localToUtc(localDate, '23:59', timezone);
  return {
    ...input,
    localDate,
    timezone,
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    referenceUtc: null,
    sampleUtc: buildSamples(start, end, 30),
  };
}

export function birthTimeFingerprint(input: BirthTimeInput): string {
  return [
    input.mode,
    input.localTime || '',
    input.uncertaintyMinutes ?? '',
    input.rangeStart || '',
    input.rangeEnd || '',
  ].join('|');
}
