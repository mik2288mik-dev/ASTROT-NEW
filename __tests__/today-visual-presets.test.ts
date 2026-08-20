import fs from 'fs';
import path from 'path';
import {
  TODAY_CLOCK_PRESETS,
  TODAY_LINE_PRESETS,
  resolveTodayClockPreset,
  resolveTodayLinePreset,
} from '../lib/todayVisualPresets';

const ROOT = path.resolve(__dirname, '..');

describe('Today visual presets', () => {
  it('ships fifteen extensible clock presets across the requested families', () => {
    expect(TODAY_CLOCK_PRESETS).toHaveLength(15);
    expect(new Set(TODAY_CLOCK_PRESETS.map((preset) => preset.id)).size).toBe(15);
    expect(new Set(TODAY_CLOCK_PRESETS.map((preset) => preset.family))).toEqual(
      new Set(['digital', 'retro-digital', 'flip']),
    );
  });

  it('never gives flip or mechanical clocks an electronic glow', () => {
    const mechanical = TODAY_CLOCK_PRESETS.filter((preset) => preset.family === 'flip');

    expect(mechanical.length).toBeGreaterThan(0);
    expect(mechanical.every((preset) => preset.glow === false)).toBe(true);
  });

  it('ships ten to fifteen distinct decorative line compositions', () => {
    expect(TODAY_LINE_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(TODAY_LINE_PRESETS.length).toBeLessThanOrEqual(15);
    expect(new Set(TODAY_LINE_PRESETS.map((preset) => preset.id)).size)
      .toBe(TODAY_LINE_PRESETS.length);
  });

  it('is stable within a day and changes both systems on the next day', () => {
    const currentClock = resolveTodayClockPreset('profile-42', '2026-08-20');
    const currentLine = resolveTodayLinePreset('profile-42', '2026-08-20');

    expect(resolveTodayClockPreset('profile-42', '2026-08-20')).toBe(currentClock);
    expect(resolveTodayLinePreset('profile-42', '2026-08-20')).toBe(currentLine);
    expect(resolveTodayClockPreset('profile-42', '2026-08-21').id).not.toBe(currentClock.id);
    expect(resolveTodayLinePreset('profile-42', '2026-08-21').id).not.toBe(currentLine.id);
  });

  it('does not use random selection or hard-code one rendered preset', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'lib', 'todayVisualPresets.ts'),
      'utf8',
    );

    expect(source).not.toContain('Math.random');
    expect(source).toContain('TODAY_CLOCK_PRESETS.length');
    expect(source).toContain('TODAY_LINE_PRESETS.length');
  });
});
