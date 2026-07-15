function planet(sign: string, degree: number, longitude: number) {
  return {
    planet: sign,
    sign,
    degree,
    longitude,
    retrograde: false,
    speedLongitude: 0,
    description: `${sign} transit`,
  };
}

export {};

function transitChart(date: Date) {
  return {
    source: 'swisseph' as const,
    date: date.toISOString(),
    julianDay: 1234567.5,
    sun: planet('Cancer', 20, 110),
    moon: planet('Leo', 5, 125),
    mercury: {
      ...planet('Cancer', 18, 108),
      retrograde: true,
      speedLongitude: -0.72,
    },
    venus: planet('Gemini', 28, 88),
    mars: planet('Virgo', 3, 153),
    jupiter: planet('Cancer', 9, 99),
    saturn: planet('Aries', 1, 1),
  };
}

function setEnv(name: string, value: string | undefined) {
  if (value == null) {
    Reflect.deleteProperty(process.env, name);
    return;
  }
  Object.assign(process.env, { [name]: value });
}

describe('transits UTC-hour cache', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFallback = process.env.ALLOW_APPROXIMATE_TRANSITS;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../lib/logger');
    jest.dontMock('../lib/swisseph-calculator');
    setEnv('NODE_ENV', previousNodeEnv);
    if (previousFallback == null) delete process.env.ALLOW_APPROXIMATE_TRANSITS;
    else process.env.ALLOW_APPROXIMATE_TRANSITS = previousFallback;
  });

  it('uses one Swiss calculation and one cache hit for the same UTC hour', async () => {
    jest.resetModules();
    setEnv('NODE_ENV', 'production');
    delete process.env.ALLOW_APPROXIMATE_TRANSITS;

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const calculatePlanetaryTransitsAt = jest.fn((date: Date) => transitChart(date));

    jest.doMock('../lib/logger', () => ({ logger }));
    jest.doMock('../lib/swisseph-calculator', () => ({ calculatePlanetaryTransitsAt }));

    const { getCurrentTransits, clearTransitCacheForTests } = await import('../lib/transits-calculator');
    clearTransitCacheForTests();

    const first = await getCurrentTransits(new Date('2026-07-12T09:10:00.000Z'));
    const second = await getCurrentTransits(new Date('2026-07-12T09:55:00.000Z'));
    await getCurrentTransits(new Date('2026-07-12T10:00:00.000Z'));

    expect(second).toBe(first);
    expect(first.mercury).toMatchObject({ retrograde: true, speedLongitude: -0.72 });
    expect(calculatePlanetaryTransitsAt).toHaveBeenCalledTimes(2);
    expect(calculatePlanetaryTransitsAt).toHaveBeenNthCalledWith(1, new Date('2026-07-12T09:10:00.000Z'));
    expect(calculatePlanetaryTransitsAt).toHaveBeenNthCalledWith(2, new Date('2026-07-12T10:00:00.000Z'));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'transit_cache_hit' }));
  });

  it('does not cache failed Swiss calculations', async () => {
    jest.resetModules();
    setEnv('NODE_ENV', 'production');
    delete process.env.ALLOW_APPROXIMATE_TRANSITS;

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const calculatePlanetaryTransitsAt = jest.fn(() => {
      throw new Error('SWISS_DOWN');
    });

    jest.doMock('../lib/logger', () => ({ logger }));
    jest.doMock('../lib/swisseph-calculator', () => ({ calculatePlanetaryTransitsAt }));

    const { getCurrentTransits, clearTransitCacheForTests } = await import('../lib/transits-calculator');
    clearTransitCacheForTests();

    await expect(getCurrentTransits(new Date('2026-07-12T09:10:00.000Z'))).rejects.toMatchObject({
      code: 'TRANSITS_UNAVAILABLE',
    });
    await expect(getCurrentTransits(new Date('2026-07-12T09:20:00.000Z'))).rejects.toMatchObject({
      code: 'TRANSITS_UNAVAILABLE',
    });

    expect(calculatePlanetaryTransitsAt).toHaveBeenCalledTimes(2);
    expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'transit_cache_hit' }));
  });
});
