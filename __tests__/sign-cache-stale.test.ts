describe('shared sign horoscope stale cache', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../lib/db');
  });

  it.each(['day', 'week', 'month'] as const)('reads ready %s text across prompt and voice changes', async (period) => {
    const reading = {
      schemaVersion: 'sign-horoscope-reading-v4', sign: 'Aries', period,
      periodKey: period === 'day' ? '2026-09-30' : period === 'week' ? '2026-W40' : '2026-09',
      headline: 'Choose the useful answer', text: 'Ask plainly and agree on the meeting time.',
    };
    const query = jest.fn().mockResolvedValue({ rows: [{ payload: reading, zodiac_sign: 'Aries' }] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const { getSignHoroscopeCacheSnapshot, getCachedSignHoroscopes } = await import('../lib/horoscope/signCache');
    const single = await getSignHoroscopeCacheSnapshot(period, 'Aries', reading.periodKey, 'ru');
    const batch = await getCachedSignHoroscopes(period, reading.periodKey, 'ru', ['Aries']);
    expect(single).toMatchObject({ stale: false, reading: { headline: reading.headline, text: reading.text } });
    expect(batch.Aries).toEqual(single?.reading);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).not.toMatch(/prompt_version\s*=/);
      expect(sql).toContain('ORDER BY created_at ASC');
      expect(params).not.toEqual(expect.arrayContaining([expect.stringContaining('voice.')]));
    }
  });

  it('keeps the first valid text when later versions already contain duplicates', async () => {
    const reading = {
      schemaVersion: 'sign-horoscope-reading-v5', sign: 'Aries', period: 'day', periodKey: '2026-09-30',
      headline: 'Choose the useful answer', text: 'Ask plainly and agree on the meeting time.',
    };
    const query = jest.fn().mockResolvedValue({ rows: [
      { payload: { ...reading, text: '' }, zodiac_sign: 'Aries' },
      { payload: reading, zodiac_sign: 'Aries' },
      { payload: { ...reading, text: 'A different answer arrived later.' }, zodiac_sign: 'Aries' },
    ] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const { getCachedSignHoroscope, getCachedSignHoroscopes } = await import('../lib/horoscope/signCache');
    expect(await getCachedSignHoroscope('day', 'Aries', reading.periodKey, 'ru')).toEqual(reading);
    expect((await getCachedSignHoroscopes('day', reading.periodKey, 'ru')).Aries).toEqual(reading);
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
        schemaVersion: 'sign-horoscope-reading-v5',
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
