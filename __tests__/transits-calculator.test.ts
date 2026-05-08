import { getCurrentTransits } from '../lib/transits-calculator';

describe('transits calculator', () => {
  it('does not fail module import when native Swiss bindings are unavailable', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    let transits;
    try {
      transits = await getCurrentTransits(new Date('2026-05-08T12:00:00.000Z'));
    } finally {
      consoleError.mockRestore();
      consoleLog.mockRestore();
    }

    expect(transits!.date).toBe('2026-05-08');
    expect(transits.sun.sign).toBeTruthy();
    expect(transits.moon.sign).toBeTruthy();
    expect(transits.sun.degree).toBeGreaterThanOrEqual(0);
    expect(transits.sun.degree).toBeLessThan(30);
  });
});
