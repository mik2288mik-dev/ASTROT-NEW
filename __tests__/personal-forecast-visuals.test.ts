import {
  buildForecastVisualRequests,
  resolveForecastVisualScreen,
} from '../lib/personalForecastVisuals';

const userId = 'visual-user';

function screen(period: 'day' | 'week' | 'month' | 'year', periodKey: string) {
  return resolveForecastVisualScreen(buildForecastVisualRequests({
    userId,
    period,
    periodKey,
    dynamicTopicKeys: ['business', 'home_family', 'study'],
  }));
}

describe('personal forecast visual resolver', () => {
  it('never repeats an asset path inside one screen and falls back on exhaustion', () => {
    const resolved = screen('day', '2026-07-26');
    const paths = Object.values(resolved.assignments)
      .map((item) => item.path)
      .filter((path): path is string => !!path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(resolved.visualFallback).toBe(true);
    expect(Object.values(resolved.assignments).some((item) => item.visualFallback)).toBe(true);
  });

  it('uses distinct hero pools for all four periods', () => {
    const heroPaths = [
      screen('day', '2026-07-26'),
      screen('week', '2026-W30'),
      screen('month', '2026-07'),
      screen('year', '2026'),
    ].map((value) => value.assignments['hero:overview'].path);
    expect(heroPaths.every(Boolean)).toBe(true);
    expect(new Set(heroPaths).size).toBe(4);
  });

  it('is stable within a period and avoids the previous asset when alternatives exist', () => {
    const first = screen('day', '2026-07-26');
    const again = screen('day', '2026-07-26');
    const next = screen('day', '2026-07-27');
    expect(again).toEqual(first);
    expect(next.assignments['hero:overview'].path).not.toBe(
      first.assignments['hero:overview'].path,
    );
  });

  it('does not give one topic the same asset in all periods', () => {
    const lovePaths = [
      screen('day', '2026-07-26'),
      screen('week', '2026-W30'),
      screen('month', '2026-07'),
      screen('year', '2026'),
    ].map((value) => value.assignments['fixed:love'].path);
    expect(new Set(lovePaths).size).toBeGreaterThan(1);
  });

  it('preserves manifest text side, position and semantic dynamic pools', () => {
    const resolved = screen('week', '2026-W30');
    const money = resolved.assignments['fixed:money'];
    const home = resolved.assignments['dynamic:home_family'];
    expect(money.textSide).toBe('left');
    expect(money.backgroundPosition).toMatch(/%/);
    expect(money.path).toContain('/money_');
    expect(home.path).toContain('/home_');
  });
});
