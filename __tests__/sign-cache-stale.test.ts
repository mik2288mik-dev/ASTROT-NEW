describe('shared sign horoscope stale cache', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../lib/db');
  });

  it('returns the last real forecast without exposing legacy technical fields', async () => {
    const legacy = {
      schemaVersion: 'sign-horoscope-reading-v3',
      sign: 'Aries',
      period: 'day',
      periodKey: '2026-08-09',
      headline: 'Choose the useful answer',
      mood: { text: 'The useful direction is already visible.', evidenceIds: ['old:one'] },
      relationships: { text: 'Say the important part without a long preface.', evidenceIds: ['old:one'] },
      work: { text: 'Finish one decision before opening another task.', evidenceIds: ['old:one'] },
      innerState: { text: 'A calm pace keeps the choice precise.', evidenceIds: ['old:one'] },
      advice: { text: 'Make the direct call.', evidenceIds: ['old:one'] },
      warning: null,
      astrology: { text: 'Mars supplied the old technical note.', evidenceIds: ['old:one'] },
    };
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ payload: legacy, period_key: '2026-08-09' }] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));

    const { getSignHoroscopeCacheSnapshot } = await import('../lib/horoscope/signCache');
    const snapshot = await getSignHoroscopeCacheSnapshot('day', 'Aries', '2026-08-10', 'en');

    expect(snapshot).toMatchObject({
      stale: true,
      reading: {
        schemaVersion: 'sign-horoscope-reading-v4',
        sign: 'Aries',
        period: 'day',
        periodKey: '2026-08-09',
        headline: 'Choose the useful answer',
      },
    });
    expect(snapshot?.reading.text).toContain('The useful direction is already visible.');
    expect(snapshot?.reading).not.toHaveProperty('astrology');
    expect(snapshot?.reading).not.toHaveProperty('evidenceIds');
  });
});
