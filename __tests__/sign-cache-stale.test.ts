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

  it.each([['ru', 'Прогноз'], ['en', 'Forecast']] as const)(
    'keeps a readable long %s reading with astrology and supplies a missing title',
    async (language, fallbackTitle) => {
      const text = `Марс в твоём расчёте.\n\n${Array.from({ length: 145 }, () => 'слово').join(' ')}  Конец.`;
      const payload = { sign: 'Aries', period: 'week', periodKey: '2026-W45', headline: '', text };
      const query = jest.fn().mockResolvedValue({ rows: [{ payload, zodiac_sign: 'Aries' }] });
      jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
      const { getSignHoroscopeCacheSnapshot, getCachedSignHoroscopes } = await import('../lib/horoscope/signCache');
      const snapshot = await getSignHoroscopeCacheSnapshot('week', 'Aries', '2026-W45', language);
      const batch = await getCachedSignHoroscopes('week', '2026-W45', language, ['Aries']);
      expect(snapshot).toMatchObject({ stale: false, reading: { headline: fallbackTitle, text, periodKey: '2026-W45' } });
      expect(batch.Aries).toEqual(snapshot?.reading);
    },
  );

  it('never reads malformed JSON or another sign, period or date as the requested reading', async () => {
    const base = { sign: 'Aries', period: 'week', periodKey: '2026-W45', headline: 'Title', text: 'Actual text.' };
    const { parseCachedSignReading } = await import('../lib/horoscope/signCache');
    const expected = { sign: 'Aries' as const, period: 'week' as const, periodKey: '2026-W45' };
    expect(parseCachedSignReading('{"sign":"Aries",', expected)).toBeNull();
    expect(parseCachedSignReading({ ...base, sign: 'Taurus' }, expected)).toBeNull();
    expect(parseCachedSignReading({ ...base, period: 'day' }, expected)).toBeNull();
    expect(parseCachedSignReading({ ...base, periodKey: '2026-W39' }, expected)).toBeNull();
    expect(parseCachedSignReading({ ...base, text: '  ' }, expected)).toBeNull();
    expect(parseCachedSignReading({ ...base, text: '{"readings":[' }, expected)).toBeNull();
  });

  it('does not mislabel a stale payload whose period disagrees with its stored row', async () => {
    const payload = { sign: 'Aries', period: 'week', periodKey: '2026-W39', headline: 'Title', text: 'Text.' };
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ payload, period_key: '2026-W44' }] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const { getSignHoroscopeCacheSnapshot } = await import('../lib/horoscope/signCache');
    expect(await getSignHoroscopeCacheSnapshot('week', 'Aries', '2026-W45', 'ru')).toBeNull();
  });

  it('selects the latest calendar period even if an older period was updated later', async () => {
    const rows = [
      { period_key: '2026-09', updated_at: '2026-11-02', payload: { sign: 'Aries', period: 'month',
        periodKey: '2026-09', headline: 'September', text: 'September text.' } },
      { period_key: '2026-10', updated_at: '2026-10-31', payload: { sign: 'Aries', period: 'month',
        periodKey: '2026-10', headline: 'October', text: 'October text.' } },
    ];
    const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockImplementationOnce(async (sql: string) => {
      expect(sql).toMatch(/ORDER BY \(period_key = \$4\) DESC, period_key DESC, updated_at DESC/);
      return { rows: [...rows].sort((a, b) => b.period_key.localeCompare(a.period_key)) };
    });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const { getSignHoroscopeCacheSnapshot } = await import('../lib/horoscope/signCache');
    const snapshot = await getSignHoroscopeCacheSnapshot('month', 'Aries', '2026-11', 'en');
    expect(snapshot).toMatchObject({ stale: true, reading: { periodKey: '2026-10', text: 'October text.' } });
  });

  it('keeps the complete readable legacy text even when it exceeds the old length limit', async () => {
    const first = Array.from({ length: 145 }, () => 'слово').join(' ');
    const legacy = { sign: 'Aries', period: 'month', periodKey: '2026-11', headline: '',
      mood: { text: first }, work: { text: 'Последний абзац остался на месте.' } };
    const query = jest.fn().mockResolvedValue({ rows: [{ payload: legacy }] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const { getCachedSignHoroscope } = await import('../lib/horoscope/signCache');
    const reading = await getCachedSignHoroscope('month', 'Aries', '2026-11', 'ru');
    expect(reading?.headline).toBe('Прогноз');
    expect(reading?.text).toBe(`${first}\n\nПоследний абзац остался на месте.`);
  });

  it('uses readable legacy blocks when an empty text field is present', async () => {
    const payload = { sign: 'Aries', period: 'month', periodKey: '2026-11', text: ' ',
      mood: { text: 'Первый абзац.' }, work: { text: 'Второй абзац.' } };
    const query = jest.fn().mockResolvedValue({ rows: [{ payload }] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const { getCachedSignHoroscope } = await import('../lib/horoscope/signCache');
    const reading = await getCachedSignHoroscope('month', 'Aries', '2026-11', 'ru');
    expect(reading?.text).toBe('Первый абзац.\n\nВторой абзац.');
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
