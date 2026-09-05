import fs from 'fs';
import path from 'path';
import {
  TODAY_BROADCAST_PRESETS,
  TODAY_BROADCASTS_PER_DAY,
  TODAY_CLOCK_PRESETS,
  TODAY_LINE_PRESETS,
  nextTodayBroadcastIndex,
  resolveTodayBroadcasts,
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

  it('ships exactly 21 local photo broadcasts', () => {
    expect(TODAY_BROADCAST_PRESETS).toHaveLength(21);
    expect(TODAY_BROADCASTS_PER_DAY).toBe(3);
    expect(new Set(TODAY_BROADCAST_PRESETS.map((preset) => preset.id)).size).toBe(21);
    expect(new Set(TODAY_BROADCAST_PRESETS.map((preset) => preset.imageSrc)).size).toBe(21);
    expect(TODAY_BROADCAST_PRESETS.every((preset) => (
      preset.labelRu.trim().length > 0 && preset.labelEn.trim().length > 0
    ))).toBe(true);
    expect(TODAY_BROADCAST_PRESETS.every((preset) => (
      preset.imageSrc.startsWith('/assets/today-broadcasts/v1/')
      && fs.existsSync(path.join(ROOT, 'public', preset.imageSrc.slice(1)))
    ))).toBe(true);
  });

  it('returns one deterministic three-photo playlist for a calendar day', () => {
    const first = resolveTodayBroadcasts('2026-09-01');
    const repeated = resolveTodayBroadcasts('2026-09-01');
    const timestamped = resolveTodayBroadcasts('2026-09-01T23:59:00+03:00');

    expect(first).toHaveLength(3);
    expect(new Set(first.map((preset) => preset.id)).size).toBe(3);
    expect(repeated.map((preset) => preset.id)).toEqual(first.map((preset) => preset.id));
    expect(timestamped.map((preset) => preset.id)).toEqual(first.map((preset) => preset.id));
  });

  it('uses every photo once over seven consecutive days and repeats on day eight', () => {
    const days = Array.from({ length: 8 }, (_, index) => (
      `2026-09-${String(index + 1).padStart(2, '0')}`
    ));
    const playlists = days.map((day) => resolveTodayBroadcasts(day));
    const firstWeekIds = playlists.slice(0, 7).flatMap((playlist) => (
      playlist.map((preset) => preset.id)
    ));

    expect(playlists.slice(0, 7).every((playlist) => playlist.length === 3)).toBe(true);
    expect(new Set(firstWeekIds).size).toBe(21);
    for (let index = 1; index < 7; index += 1) {
      const previous = new Set(playlists[index - 1].map((preset) => preset.id));
      expect(playlists[index].every((preset) => !previous.has(preset.id))).toBe(true);
    }
    expect(playlists[7].map((preset) => preset.id)).toEqual(
      playlists[0].map((preset) => preset.id),
    );
  });

  it('cycles only within today\'s three broadcasts', () => {
    expect(nextTodayBroadcastIndex(0)).toBe(1);
    expect(nextTodayBroadcastIndex(1)).toBe(2);
    expect(nextTodayBroadcastIndex(2)).toBe(0);
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
    expect(source).toContain('TODAY_BROADCAST_PRESETS.length');
    expect(source).toContain('TODAY_CLOCK_PRESETS.length');
    expect(source).toContain('TODAY_LINE_PRESETS.length');
  });

  it('keeps the TV broadcast action semantic, announced, and motion-safe', () => {
    const clock = fs.readFileSync(
      path.join(ROOT, 'components', 'PersonalForecastFeed', 'TodayCalendarClock.tsx'),
      'utf8',
    );
    const styles = fs.readFileSync(path.join(ROOT, 'styles', 'todayHome.css'), 'utf8');

    expect(clock).toContain('<button');
    expect(clock).toContain('type="button"');
    expect(clock).toContain('<time');
    expect(clock).toContain('onClick={advanceBroadcast}');
    expect(clock).toContain('нажми, чтобы сменить');
    expect(clock).toContain('role="status"');
    expect(clock).toContain('aria-live="polite"');
    expect(clock).toContain('resolveTodayBroadcasts(periodKey)');
    expect(clock).toContain('todayBroadcasts.map');
    expect(clock).not.toContain('TODAY_BROADCAST_PRESETS.map');
    expect(clock).toContain('<img');
    expect(clock).toContain('src={broadcast.imageSrc}');
    expect(clock).toContain('alt=""');
    expect(clock).toContain('draggable={false}');
    expect(clock).not.toContain('Math.random');
    expect(clock).not.toContain('<video');
    expect(clock).not.toContain('.gif');
    expect(styles).toContain('width: min(100%, 22rem);');
    expect(styles).toContain('min-width: 44px;');
    expect(styles).toContain('min-height: 44px;');
    expect(styles).toContain('.today-calendar-clock:focus-visible');
    expect(styles).toContain('.today-calendar-clock-caption');
    expect(styles).toContain('transition: opacity 180ms ease, transform 180ms ease;');
    expect(styles).toContain('object-fit: cover;');
    expect(styles).toContain('outline: 1px solid oklch(0 0 0 / 0.1);');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.today-calendar-clock-broadcast-scene');
  });
});
