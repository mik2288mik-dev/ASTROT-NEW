describe('sign daily horoscope persistence', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it('throws when requirePersistence is enabled and the cache write fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const get = jest.fn().mockResolvedValue(null);
    const set = jest.fn().mockRejectedValue(new Error('db down'));

    jest.doMock('../lib/db', () => ({
      db: {
        daily_horoscopes: {
          get,
          set,
        },
      },
    }));

    const { getOrGenerateSignDailyHoroscope } = await import('../lib/horoscope/signDaily');

    await expect(
      getOrGenerateSignDailyHoroscope('Aries', '2026-05-09', 'en', {
        requirePersistence: true,
      })
    ).rejects.toMatchObject({
      code: 'SIGN_HOROSCOPE_PERSIST_FAILED',
      status: 500,
    });
    errorSpy.mockRestore();
  });
});
