import { stableHash } from './personalForecastContract';

export type TodayClockFamily = 'digital' | 'retro-digital' | 'flip';

export type TodayClockPreset = Readonly<{
  id: string;
  family: TodayClockFamily;
  glow: boolean;
  caseColor: string;
  faceColor: string;
  digitColor: string;
  edgeColor: string;
  accentColor: string;
  radius: string;
  tiltDeg: number;
}>;

export type TodayLineDot = Readonly<{
  cx: number;
  cy: number;
  r?: number;
}>;

export type TodayLinePreset = Readonly<{
  id: string;
  paths: readonly string[];
  dots: readonly TodayLineDot[];
}>;

export const TODAY_CLOCK_PRESETS: readonly TodayClockPreset[] = [
  {
    id: 'noir-led',
    family: 'digital',
    glow: true,
    caseColor: '#e8e6e1',
    faceColor: '#121314',
    digitColor: '#f7f3e9',
    edgeColor: '#cac7c0',
    accentColor: '#d9c8a7',
    radius: '1.15rem',
    tiltDeg: -1.2,
  },
  {
    id: 'porcelain-led',
    family: 'digital',
    glow: false,
    caseColor: '#f7f5ef',
    faceColor: '#20211f',
    digitColor: '#f4f1e8',
    edgeColor: '#ded9cd',
    accentColor: '#b89c75',
    radius: '1.45rem',
    tiltDeg: 0.8,
  },
  {
    id: 'silver-console',
    family: 'digital',
    glow: true,
    caseColor: '#d8d9d7',
    faceColor: '#151719',
    digitColor: '#e6f6f2',
    edgeColor: '#b7bab8',
    accentColor: '#9fd2c8',
    radius: '0.72rem',
    tiltDeg: -0.4,
  },
  {
    id: 'ivory-lcd',
    family: 'digital',
    glow: false,
    caseColor: '#efe9dc',
    faceColor: '#cbd0b7',
    digitColor: '#28312d',
    edgeColor: '#d4c9b5',
    accentColor: '#87917c',
    radius: '0.58rem',
    tiltDeg: 1.1,
  },
  {
    id: 'graphite-slab',
    family: 'digital',
    glow: true,
    caseColor: '#3a3b3b',
    faceColor: '#090a0a',
    digitColor: '#efe8dc',
    edgeColor: '#242525',
    accentColor: '#d2aa76',
    radius: '0.82rem',
    tiltDeg: -0.8,
  },
  {
    id: 'soft-white-panel',
    family: 'digital',
    glow: true,
    caseColor: '#faf9f5',
    faceColor: '#ecece6',
    digitColor: '#2b2c2b',
    edgeColor: '#dad9d2',
    accentColor: '#c4a783',
    radius: '1.7rem',
    tiltDeg: 0.4,
  },
  {
    id: 'amber-radio',
    family: 'retro-digital',
    glow: true,
    caseColor: '#d9c3a0',
    faceColor: '#271d14',
    digitColor: '#ffcf78',
    edgeColor: '#b89d75',
    accentColor: '#f0b75d',
    radius: '0.7rem',
    tiltDeg: -1.4,
  },
  {
    id: 'jade-terminal',
    family: 'retro-digital',
    glow: true,
    caseColor: '#c9cbc2',
    faceColor: '#101713',
    digitColor: '#9edeb5',
    edgeColor: '#aeb2aa',
    accentColor: '#70b88c',
    radius: '0.48rem',
    tiltDeg: 0.6,
  },
  {
    id: 'ruby-segment',
    family: 'retro-digital',
    glow: true,
    caseColor: '#262626',
    faceColor: '#100b0b',
    digitColor: '#ef8178',
    edgeColor: '#151515',
    accentColor: '#d8524c',
    radius: '0.42rem',
    tiltDeg: -0.3,
  },
  {
    id: 'smoke-lcd',
    family: 'retro-digital',
    glow: false,
    caseColor: '#888982',
    faceColor: '#b7b9ac',
    digitColor: '#252b28',
    edgeColor: '#74766f',
    accentColor: '#646d66',
    radius: '0.38rem',
    tiltDeg: 1.3,
  },
  {
    id: 'cream-radio',
    family: 'retro-digital',
    glow: true,
    caseColor: '#e7ddca',
    faceColor: '#302b23',
    digitColor: '#ffe2a8',
    edgeColor: '#c8bca7',
    accentColor: '#d7a75e',
    radius: '1rem',
    tiltDeg: -0.6,
  },
  {
    id: 'cream-flip',
    family: 'flip',
    glow: false,
    caseColor: '#eee9df',
    faceColor: '#f9f7f0',
    digitColor: '#20201f',
    edgeColor: '#d5cec1',
    accentColor: '#b99a71',
    radius: '0.72rem',
    tiltDeg: -1,
  },
  {
    id: 'black-flip',
    family: 'flip',
    glow: false,
    caseColor: '#242424',
    faceColor: '#101010',
    digitColor: '#f3efe6',
    edgeColor: '#090909',
    accentColor: '#a88a65',
    radius: '0.54rem',
    tiltDeg: 0.5,
  },
  {
    id: 'paper-flip',
    family: 'flip',
    glow: false,
    caseColor: '#f5f1e8',
    faceColor: '#e8e1d5',
    digitColor: '#37332e',
    edgeColor: '#d6ccbd',
    accentColor: '#b28d60',
    radius: '0.3rem',
    tiltDeg: 1.2,
  },
  {
    id: 'split-flap',
    family: 'flip',
    glow: false,
    caseColor: '#b9b9b3',
    faceColor: '#2b2b29',
    digitColor: '#f1eee6',
    edgeColor: '#94948e',
    accentColor: '#c7aa7f',
    radius: '0.46rem',
    tiltDeg: -0.2,
  },
] as const;

export const TODAY_LINE_PRESETS: readonly TodayLinePreset[] = [
  {
    id: 'wide-rising-arc',
    paths: ['M-18 50C86 8 290 7 408 48'],
    dots: [{ cx: 286, cy: 19 }],
  },
  {
    id: 'left-sweep',
    paths: ['M-20 42C78 13 197 14 410 36'],
    dots: [{ cx: 91, cy: 18 }],
  },
  {
    id: 'right-sweep',
    paths: ['M-20 36C190 14 314 13 410 43'],
    dots: [{ cx: 302, cy: 19 }],
  },
  {
    id: 'crossing-air',
    paths: ['M-18 43C92 21 177 17 258 26C316 32 358 31 408 18'],
    dots: [{ cx: 257, cy: 26 }],
  },
  {
    id: 'high-horizon',
    paths: ['M-20 40C98 4 291 5 410 39'],
    dots: [{ cx: 271, cy: 13 }],
  },
  {
    id: 'low-horizon',
    paths: ['M-20 19C96 46 286 45 410 17'],
    dots: [{ cx: 104, cy: 38 }],
  },
  {
    id: 'quiet-ellipse',
    paths: ['M-24 53C67 4 315 4 414 53'],
    dots: [{ cx: 195, cy: 17 }],
  },
  {
    id: 'offset-ellipse',
    paths: ['M-24 48C55 5 266 2 414 45'],
    dots: [{ cx: 321, cy: 25 }],
  },
  {
    id: 'double-wave',
    paths: ['M-20 35C87 13 181 17 263 30C320 39 363 34 410 20'],
    dots: [{ cx: 179, cy: 21 }],
  },
  {
    id: 'open-parenthesis',
    paths: ['M-22 44C72 12 209 8 412 33'],
    dots: [{ cx: 74, cy: 20 }],
  },
  {
    id: 'diagonal-orbit',
    paths: ['M-20 52C83 31 203 20 410 9'],
    dots: [{ cx: 273, cy: 17 }],
  },
  {
    id: 'soft-infinity',
    paths: ['M-20 29C76 17 165 15 246 26C307 35 359 33 410 17'],
    dots: [{ cx: 247, cy: 26 }],
  },
] as const;

function dayOrdinal(periodKey: string): number {
  const match = periodKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return stableHash(periodKey);
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : stableHash(periodKey);
}
function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function resolveTodayClockPreset(
  userId: string,
  periodKey: string,
): TodayClockPreset {
  const index = positiveModulo(
    stableHash(`today-clock:${userId}`) + dayOrdinal(periodKey),
    TODAY_CLOCK_PRESETS.length,
  );
  return TODAY_CLOCK_PRESETS[index];
}

export function resolveTodayLinePreset(
  userId: string,
  periodKey: string,
): TodayLinePreset {
  const index = positiveModulo(
    stableHash(`today-lines:${userId}`) + (dayOrdinal(periodKey) * 7),
    TODAY_LINE_PRESETS.length,
  );
  return TODAY_LINE_PRESETS[index];
}
