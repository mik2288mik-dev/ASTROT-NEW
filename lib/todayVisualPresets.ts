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
    paths: ['M-34 338 C78 200 246 142 424 194', 'M-18 650 C120 712 282 660 430 542'],
    dots: [{ cx: 302, cy: 174 }, { cx: 326, cy: 604 }],
  },
  {
    id: 'left-sweep',
    paths: ['M-92 124 C76 174 114 318 70 490', 'M20 700 C176 584 286 566 440 600'],
    dots: [{ cx: 75, cy: 289 }, { cx: 293, cy: 575 }],
  },
  {
    id: 'right-sweep',
    paths: ['M420 52 C248 144 256 310 430 382', 'M-40 572 C88 516 196 542 326 700'],
    dots: [{ cx: 329, cy: 119 }, { cx: 80, cy: 541 }],
  },
  {
    id: 'crossing-air',
    paths: ['M-20 246 C108 162 282 220 420 350', 'M-18 534 C154 660 270 610 426 470'],
    dots: [{ cx: 46, cy: 214 }, { cx: 344, cy: 522 }],
  },
  {
    id: 'high-horizon',
    paths: ['M-30 228 C112 94 274 88 428 216', 'M-12 682 C134 610 292 620 432 678'],
    dots: [{ cx: 270, cy: 128 }, { cx: 126, cy: 642 }],
  },
  {
    id: 'low-horizon',
    paths: ['M-32 118 C114 186 286 158 432 74', 'M-38 534 C96 420 252 430 426 592'],
    dots: [{ cx: 102, cy: 165 }, { cx: 312, cy: 496 }],
  },
  {
    id: 'quiet-ellipse',
    paths: ['M-78 350 C18 104 356 104 466 352', 'M-82 352 C28 636 354 646 468 354'],
    dots: [{ cx: 286, cy: 139 }, { cx: 94, cy: 591 }],
  },
  {
    id: 'offset-ellipse',
    paths: ['M-168 314 C-10 94 284 114 446 322', 'M-110 390 C70 650 328 590 466 404'],
    dots: [{ cx: 335, cy: 217 }, { cx: 53, cy: 531 }],
  },
  {
    id: 'double-wave',
    paths: ['M-24 212 C92 304 224 110 416 224', 'M-30 560 C122 430 264 678 430 516'],
    dots: [{ cx: 171, cy: 203 }, { cx: 288, cy: 577 }],
  },
  {
    id: 'open-parenthesis',
    paths: ['M82 -40 C-34 156 -24 496 126 742', 'M452 126 C312 226 314 456 452 554'],
    dots: [{ cx: 53, cy: 177 }, { cx: 357, cy: 445 }],
  },
  {
    id: 'diagonal-orbit',
    paths: ['M-112 542 C26 196 260 96 488 174', 'M-68 648 C122 536 278 418 448 154'],
    dots: [{ cx: 275, cy: 125 }, { cx: 115, cy: 551 }],
  },
  {
    id: 'soft-infinity',
    paths: ['M-30 388 C88 190 166 586 282 372 C340 266 386 266 430 328', 'M-20 632 C146 560 250 592 424 676'],
    dots: [{ cx: 159, cy: 380 }, { cx: 328, cy: 317 }],
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
