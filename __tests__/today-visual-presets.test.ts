import fs from 'fs';
import path from 'path';
import {
  TODAY_AUTUMN_BROADCAST_PRESETS,
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

  it('ships local summer and autumn photo pools', () => {
    expect(TODAY_BROADCAST_PRESETS).toHaveLength(21);
    expect(TODAY_AUTUMN_BROADCAST_PRESETS).toHaveLength(10);
    expect(TODAY_BROADCASTS_PER_DAY).toBe(4);
    const all = [...TODAY_BROADCAST_PRESETS, ...TODAY_AUTUMN_BROADCAST_PRESETS];
    expect(new Set(all.map((preset) => preset.id)).size).toBe(all.length);
    expect(new Set(all.map((preset) => preset.imageSrc)).size).toBe(all.length);
    expect(all.every((preset) => (
      preset.labelRu.trim().length > 0 && preset.labelEn.trim().length > 0
    ))).toBe(true);
    expect(all.every((preset) => (
      preset.imageSrc.startsWith('/assets/today-broadcasts/v1/')
      && fs.existsSync(path.join(ROOT, 'public', preset.imageSrc.slice(1)))
    ))).toBe(true);
  });

  it('returns one deterministic four-photo playlist for a calendar day', () => {
    const first = resolveTodayBroadcasts('2026-09-01');
    const repeated = resolveTodayBroadcasts('2026-09-01');
    const timestamped = resolveTodayBroadcasts('2026-09-01T23:59:00+03:00');

    expect(first).toHaveLength(4);
    expect(new Set(first.map((preset) => preset.id)).size).toBe(4);
    expect(repeated.map((preset) => preset.id)).toEqual(first.map((preset) => preset.id));
    expect(timestamped.map((preset) => preset.id)).toEqual(first.map((preset) => preset.id));
  });

  it('shows the autumn pool from September to November and summer otherwise', () => {
    const autumnIds = new Set<string>(TODAY_AUTUMN_BROADCAST_PRESETS.map((preset) => preset.id));
    for (const day of ['2026-09-15', '2026-10-02', '2026-11-30']) {
      expect(resolveTodayBroadcasts(day).every((preset) => autumnIds.has(preset.id))).toBe(true);
    }
    for (const day of ['2026-08-31', '2026-12-01', '2026-06-10']) {
      expect(resolveTodayBroadcasts(day).some((preset) => autumnIds.has(preset.id))).toBe(false);
    }
  });

  it('rolls through every autumn photo within five days and never doubles a portrait', () => {
    const days = Array.from({ length: 6 }, (_, index) => (
      `2026-10-${String(index + 1).padStart(2, '0')}`
    ));
    const playlists = days.map((day) => resolveTodayBroadcasts(day));
    const portraitIds = new Set<string>(TODAY_AUTUMN_BROADCAST_PRESETS
      .filter((_, index) => index % 2 === 0)
      .map((preset) => preset.id));

    expect(new Set(playlists.slice(0, 5).flat().map((preset) => preset.id)).size).toBe(10);
    for (const playlist of playlists) {
      for (let index = 1; index < playlist.length; index += 1) {
        expect(portraitIds.has(playlist[index].id) && portraitIds.has(playlist[index - 1].id)).toBe(false);
      }
    }
    expect(playlists[5].map((preset) => preset.id)).toEqual(
      playlists[0].map((preset) => preset.id),
    );
  });

  it('cycles only within the four broadcasts of the day', () => {
    expect(nextTodayBroadcastIndex(0)).toBe(1);
    expect(nextTodayBroadcastIndex(1)).toBe(2);
    expect(nextTodayBroadcastIndex(2)).toBe(3);
    expect(nextTodayBroadcastIndex(3)).toBe(0);
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
    expect(source).toContain('pool.length');
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
    expect(clock).toContain('Сменить картинку на телевизоре');
    expect(clock).not.toContain('Общий совет дня');
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
