import * as Astronomy from 'astronomy-engine';
import type { NatalChartData } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { longitudeSamples } from './synastryAspects';

/**
 * «Когда лучше поговорить»: which of the next days make an important talk
 * between two people easier or harder. Counts real contacts of today's fast
 * planets with the personal points of both charts — the planets that colour
 * conversation (Mercury), mood (Moon), warmth (Venus) and irritation (Mars).
 * Pure JavaScript ephemeris, no AI.
 */

export type PairTalkTone = 'good' | 'hard' | 'neutral';

export type PairTalkDay = {
  /** YYYY-MM-DD in Moscow time. */
  date: string;
  tone: PairTalkTone;
  score: number;
  reason: string | null;
};

type Chart = NatalChartData | NatalChartDataV2;
type Transit = 'Moon' | 'Mercury' | 'Venus' | 'Mars';
type Point = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars';
type Reason = 'talk_easy' | 'mood_easy' | 'warm' | 'talk_hard' | 'irritation' | 'mood_hard';

const POINTS: Point[] = ['sun', 'moon', 'mercury', 'venus', 'mars'];
// Slow contacts would colour a whole week; tight orbs keep each day distinct.
const ORB: Record<Transit, number> = { Moon: 5, Mercury: 1.5, Venus: 1.5, Mars: 1.5 };

// Which transit-to-point contacts matter for a conversation, and how much.
const WEIGHTS: Record<Transit, Partial<Record<Point, { flow: number; tension: number; flowReason: Reason; tensionReason: Reason }>>> = {
  Mercury: {
    mercury: { flow: 1.5, tension: -1.5, flowReason: 'talk_easy', tensionReason: 'talk_hard' },
    moon: { flow: 1, tension: -1, flowReason: 'talk_easy', tensionReason: 'talk_hard' },
    sun: { flow: 0.5, tension: -0.5, flowReason: 'talk_easy', tensionReason: 'talk_hard' },
  },
  Moon: {
    moon: { flow: 1, tension: -1, flowReason: 'mood_easy', tensionReason: 'mood_hard' },
    venus: { flow: 1, tension: -0.5, flowReason: 'mood_easy', tensionReason: 'mood_hard' },
    sun: { flow: 0.5, tension: -0.5, flowReason: 'mood_easy', tensionReason: 'mood_hard' },
  },
  Venus: {
    venus: { flow: 1, tension: -0.5, flowReason: 'warm', tensionReason: 'mood_hard' },
    moon: { flow: 1, tension: -0.5, flowReason: 'warm', tensionReason: 'mood_hard' },
    sun: { flow: 0.5, tension: -0.5, flowReason: 'warm', tensionReason: 'mood_hard' },
  },
  Mars: {
    mercury: { flow: 0.5, tension: -2, flowReason: 'talk_easy', tensionReason: 'irritation' },
    moon: { flow: 0.5, tension: -2, flowReason: 'mood_easy', tensionReason: 'irritation' },
    venus: { flow: 0.5, tension: -1.5, flowReason: 'warm', tensionReason: 'irritation' },
    mars: { flow: 0.5, tension: -1.5, flowReason: 'talk_easy', tensionReason: 'irritation' },
  },
};

const REASONS: Record<Reason, [string, string]> = {
  talk_easy: ['Легче договориться и объяснить, что имеешь в виду.', 'Easier to agree and explain what you mean.'],
  mood_easy: ['Настроение у обоих ровнее, меньше поводов для обид.', 'Both moods are steadier, fewer reasons to take offence.'],
  warm: ['Хороший день, чтобы провести время вместе.', 'A good day to spend time together.'],
  talk_hard: ['Слова легко понять не так, важное лучше отложить.', 'Words are easy to misread, better to postpone important talks.'],
  irritation: ['Оба быстрее раздражаетесь, не лучший день выяснять отношения.', 'You both get irritated faster, not a day to sort things out.'],
  mood_hard: ['Настроение скачет, не принимайте резкие слова близко к сердцу.', 'Moods swing, do not take sharp words to heart.'],
};

const normalize = (value: number) => ((value % 360) + 360) % 360;
const separation = (a: number, b: number) => {
  const distance = Math.abs(normalize(a) - normalize(b)) % 360;
  return distance > 180 ? 360 - distance : distance;
};

function readPosition(chart: Chart, key: Point) {
  const source = chart as NatalChartDataV2;
  return (source.positions?.[key] || (chart as unknown as Record<string, unknown>)[key] || null) as Parameters<typeof longitudeSamples>[0];
}

/** A point is used only when it is known within a few degrees: a whole-day Moon range is too wide for daily timing. */
function stablePoints(chart: Chart): Array<{ key: Point; longitude: number }> {
  return POINTS.flatMap((key) => {
    const samples = longitudeSamples(readPosition(chart, key));
    if (!samples) return [];
    const spread = Math.max(...samples.map((value) => separation(value, samples[0])));
    return spread <= 3 ? [{ key, longitude: samples[Math.floor(samples.length / 2)] }] : [];
  });
}

function transitLongitude(body: Transit, date: Date): number {
  return normalize(Astronomy.Ecliptic(Astronomy.GeoVector(body as Astronomy.Body, date, true)).elon);
}

function moscowDayKey(date: Date): string {
  return new Date(date.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

export function buildPairTalkCalendar(
  subjectChart: Chart,
  partnerChart: Chart,
  options: { days?: number; from?: Date; language?: 'ru' | 'en' } = {},
): PairTalkDay[] {
  const days = options.days ?? 14;
  const index = options.language === 'en' ? 1 : 0;
  const people = [stablePoints(subjectChart), stablePoints(partnerChart)];
  const startKey = moscowDayKey(options.from ?? new Date());
  const output: PairTalkDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    // Moscow afternoon: when most conversations actually happen.
    const date = new Date(`${startKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    let score = 0;
    const contributions = new Map<Reason, number>();
    for (const body of Object.keys(WEIGHTS) as Transit[]) {
      const longitude = transitLongitude(body, date);
      for (const points of people) {
        for (const point of points) {
          const weight = WEIGHTS[body][point.key];
          if (!weight) continue;
          const distance = separation(longitude, point.longitude);
          for (const [angle, kind] of [[60, 'flow'], [120, 'flow'], [90, 'tension'], [180, 'tension']] as const) {
            if (Math.abs(distance - angle) > ORB[body]) continue;
            const value = kind === 'flow' ? weight.flow : weight.tension;
            const reason = kind === 'flow' ? weight.flowReason : weight.tensionReason;
            score += value;
            contributions.set(reason, (contributions.get(reason) || 0) + value);
          }
        }
      }
    }
    const tone: PairTalkTone = score >= 2 ? 'good' : score <= -1.5 ? 'hard' : 'neutral';
    const leading = [...contributions.entries()]
      .filter(([, value]) => (tone === 'good' ? value > 0 : value < 0))
      .sort((first, second) => Math.abs(second[1]) - Math.abs(first[1]))[0];
    output.push({
      date: date.toISOString().slice(0, 10),
      tone,
      score: Math.round(score * 10) / 10,
      reason: tone !== 'neutral' && leading ? REASONS[leading[0]][index] : null,
    });
  }
  return output;
}
