import type { DailyCheckIn, TodayAssistantHomeResult, TodayPulse } from '../types';
import {
  buildAccuracySummary,
  buildActionTimingRecommendation,
  buildPatternTeaser,
  buildPersonalPatterns,
} from '../lib/todayAssistant';
import { buildTodayCheckInReference } from '../lib/todayCheckInReference';
import { getTodayCheckInDateInfo } from '../lib/todayCheckInDate';
import { shouldShowTodayAssistantFirst } from '../lib/todayAssistantPriority';

function point(hour: number, score: number, phase: any, layers: any, tone: any = 'calm') {
  return {
    time: `${String(hour).padStart(2, '0')}:00`,
    hour,
    score,
    layers,
    phase,
    title: phase === 'focus_peak' ? 'Пик фокуса' : phase === 'relationships' ? 'Контакт' : 'Ровный слот',
    summary: 'Рабочее описание',
    reasons: ['reason one', 'reason two'],
    bestFor: ['план'],
    avoid: ['спешка'],
    tone,
    isKeyMoment: false,
  };
}

const baseLayers = {
  energy: 55,
  focus: 55,
  emotions: 55,
  money: 55,
  relationships: 55,
};

const pulse = {
  date: '2026-05-20',
  timezone: 'Europe/Moscow',
  generatedAt: '2026-05-20T06:00:00.000Z',
  source: 'algorithmic',
  currentTime: '09:00',
  currentPoint: point(9, 58, 'entry', baseLayers),
  peakPoint: point(12, 82, 'focus_peak', { ...baseLayers, focus: 88, energy: 78, money: 72 }, 'peak'),
  layers: baseLayers,
  points: Array.from({ length: 24 }, (_, hour) => {
    if (hour === 12) return point(hour, 82, 'focus_peak', { ...baseLayers, focus: 88, energy: 78, money: 72 }, 'peak');
    if (hour === 18) return point(hour, 76, 'relationships', { ...baseLayers, relationships: 86, emotions: 74 }, 'social');
    if (hour >= 21 || hour < 6) return point(hour, 62, 'reflection', { ...baseLayers, energy: 35, focus: 38, emotions: 70 }, 'restore');
    return point(hour, 58, hour < 10 ? 'entry' : 'decisions', baseLayers);
  }),
  windows: [
    { start: '00:00', end: '06:00', label: 'Восстановление', summary: '', score: 55, dominantLayer: 'emotions', tone: 'restore' },
    { start: '06:00', end: '10:00', label: 'Вход в день', summary: '', score: 58, dominantLayer: 'energy', tone: 'rise' },
    { start: '10:00', end: '14:00', label: 'Пик фокуса', summary: '', score: 82, dominantLayer: 'focus', tone: 'peak' },
    { start: '14:00', end: '17:00', label: 'Решения', summary: '', score: 61, dominantLayer: 'focus', tone: 'social' },
    { start: '17:00', end: '21:00', label: 'Контакт', summary: '', score: 76, dominantLayer: 'relationships', tone: 'social' },
    { start: '21:00', end: '00:00', label: 'Закрыть день', summary: '', score: 62, dominantLayer: 'emotions', tone: 'restore' },
  ],
  keyMoments: [],
  calculationVersion: 'today-pulse-v1',
} satisfies TodayPulse;

function checkIn(index: number, focus: DailyCheckIn['focus'] = 'high'): DailyCheckIn {
  return {
    id: index,
    userId: '123',
    chartId: 7,
    date: `2026-05-${String(index + 1).padStart(2, '0')}`,
    timezone: 'Europe/Moscow',
    focus,
    mood: index % 2 === 0 ? 'steady' : 'good',
    people: index % 3 === 0 ? 'quiet' : 'social',
    forecastFit: index % 3 === 0 ? 'partial' : 'yes',
    pulseTime: '21:00',
    pulsePhase: 'reflection',
    pulseScore: 60,
    pulseLayers: baseLayers,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  };
}

describe('today assistant', () => {
  it('returns an action recommendation with a valid state and window', () => {
    const rec = buildActionTimingRecommendation(pulse, 'work', 'ru');
    expect(['now', 'later', 'no_edge']).toContain(rec.state);
    expect(rec.bestWindow.start).toMatch(/^\d{2}:00$/);
    expect(rec.bestWindow.end).toMatch(/^\d{2}:00$/);
    expect(rec.confidence).toBeGreaterThanOrEqual(0);
    expect(rec.confidence).toBeLessThanOrEqual(100);
  });

  it('does not produce personal patterns before enough check-ins', () => {
    expect(buildPersonalPatterns([checkIn(1), checkIn(2)], [], 'ru')).toEqual([]);
    const teaser = buildPatternTeaser([checkIn(1), checkIn(2)], [], 'ru');
    expect(teaser.state).toBe('collecting');
    expect(teaser.progress.target).toBe(3);
  });

  it('builds deterministic personal patterns and accuracy summary from check-ins', () => {
    const checkins = Array.from({ length: 7 }, (_, index) => checkIn(index, index < 5 ? 'high' : 'normal'));
    const first = buildPersonalPatterns(checkins, [], 'ru');
    const second = buildPersonalPatterns(checkins, [], 'ru');
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);

    const summary = buildAccuracySummary(checkins, 'ru');
    expect(summary.historyCount).toBe(7);
    expect(summary.forecastFitRate).toBeGreaterThan(0);
    expect(summary.progressToInsight.current).toBeLessThanOrEqual(summary.progressToInsight.target);
  });

  it('builds an evening check-in reference from the day pulse', () => {
    const reference = buildTodayCheckInReference(pulse, 'ru');

    expect(reference.isFallback).toBe(false);
    expect(reference.forecastTitle).toBe(pulse.peakPoint.title);
    expect(reference.forecastSummary).toBe(pulse.peakPoint.summary);
    expect(reference.dateLabel).toContain('мая');
    expect(reference.bestSlotRange).toBe('10:00-14:00');
    expect(reference.bestSlotLabel).toBe('Пик фокуса');
    expect(reference.bestFor).toEqual(['план']);
    expect(reference.avoid).toBe('спешка');
    expect(reference.expected.focus.value).toBe('high');
    expect(reference.initialInput.focus).toBe('high');
  });

  it('keeps evening reference coherent when the current point is night restore', () => {
    const nightPulse = {
      ...pulse,
      currentTime: '02:30',
      currentPoint: point(2, 62, 'restore', { ...baseLayers, focus: 32, emotions: 72 }, 'restore'),
    } satisfies TodayPulse;
    const reference = buildTodayCheckInReference(nightPulse, 'ru');

    expect(reference.forecastTitle).toBe(nightPulse.peakPoint.title);
    expect(reference.bestSlotRange).toBe('10:00-14:00');
    expect(reference.forecastTitle).not.toBe('Восстановление');
    expect(reference.expected.focus.value).toBe('high');
  });

  it('uses a neutral check-in reference fallback without a fake best slot', () => {
    const reference = buildTodayCheckInReference(null, 'ru');

    expect(reference.isFallback).toBe(true);
    expect(reference.forecastTitle).toContain('общее ощущение дня');
    expect(reference.bestSlotRange).toBeNull();
    expect(reference.bestSlotLabel).toBeNull();
    expect(reference.initialInput.forecastFit).toBe('partial');
  });

  it('marks after-midnight check-in as the previous evening tail', () => {
    expect(getTodayCheckInDateInfo({ date: '2026-05-22', currentTime: '02:30' })).toEqual({
      date: '2026-05-21',
      mode: 'previous_day_tail',
    });
    expect(buildTodayCheckInReference(pulse, 'ru', {
      dateMode: 'previous_day_tail',
      dateOverride: '2026-05-21',
    }).dateLabel).toContain('за 21 мая');
  });

  it('keeps Pulse first unless the assistant has a concrete action reason', () => {
    const ready: Extract<TodayAssistantHomeResult, { status: 'ready' }> = {
      status: 'ready',
      pulse,
      chartId: 7,
      source: 'test',
      dayMode: 'day',
      checkIn: { status: 'open' },
      quickActions: [],
      accuracySummary: buildAccuracySummary([], 'ru'),
      patternTeaser: buildPatternTeaser([], [], 'ru'),
      insights: [],
    };

    expect(shouldShowTodayAssistantFirst(ready)).toBe(false);
    expect(shouldShowTodayAssistantFirst({
      ...ready,
      pulse: { ...pulse, currentTime: '09:20' },
      dayMode: 'morning',
    })).toBe(true);
    expect(shouldShowTodayAssistantFirst({
      ...ready,
      pulse: { ...pulse, currentTime: '11:18' },
      dayMode: 'morning',
    })).toBe(false);
    expect(shouldShowTodayAssistantFirst({
      ...ready,
      dayMode: 'day',
      pulse: { ...pulse, currentPoint: { ...pulse.currentPoint, isKeyMoment: true } },
    })).toBe(true);
    expect(shouldShowTodayAssistantFirst({
      ...ready,
      dayMode: 'evening',
      checkIn: { status: 'completed', entry: checkIn(20) },
    })).toBe(false);
    expect(shouldShowTodayAssistantFirst({
      ...ready,
      dayMode: 'evening',
      checkIn: { status: 'open' },
    })).toBe(true);
  });
});
