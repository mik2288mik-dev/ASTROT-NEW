export {};

const fallbackSection = {
  key: 'daily_love',
  title: 'Love fallback',
  access: 'premium',
  content: 'Fallback text that is safe to show without OpenAI.',
  bullets: ['fallback'],
};

const generatedSection = {
  key: 'daily_love',
  title: 'Love generated',
  access: 'premium',
  content: 'Generated daily love text.',
  bullets: ['generated'],
};

const cachedReading = {
  id: 10,
  userId: '123',
  chartId: 7,
  accessTier: 'premium',
  contentSurface: 'natal',
  contentVariant: 'living',
  modelTier: 'premium',
  cacheKey: 'human_v2.daily.2026-06-03.daily_love',
  inputHash: 'hash',
  content: generatedSection,
  promptVersion: 'lumia-human-v2.daily',
  calculationVersion: 'test',
  validFrom: null,
  validTo: null,
  isPersistent: false,
  canRegenerateForLumi: false,
  regenerationCostLumi: null,
  legacySource: null,
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
};

const chartData = {
  sun: { sign: 'Pisces', degree: 15 },
  moon: { sign: 'Cancer', degree: 10 },
  rising: { sign: 'Libra', degree: 7 },
  calculationVersion: 'test',
};

function savedReading(content: typeof fallbackSection | typeof generatedSection, id = 11) {
  return {
    ...cachedReading,
    id,
    content,
    inputHash: content === generatedSection ? 'generated-hash' : 'fallback-hash',
  };
}

function createResponse() {
  const res: any = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function setupMocks(options?: {
  getCachedReading?: jest.Mock;
  saveReading?: jest.Mock;
  generateHumanDailySection?: jest.Mock;
}) {
  const getCachedReading = options?.getCachedReading || jest.fn().mockResolvedValue(null);
  const saveReading = options?.saveReading || jest.fn(async (_ctx, _opts, content) => savedReading(content, content === generatedSection ? 12 : 11));
  const generateHumanDailySection = options?.generateHumanDailySection || jest.fn().mockResolvedValue(generatedSection);

  jest.doMock('../lib/natalReading/apiHelper', () => ({
    ensureValidContext: jest.fn().mockResolvedValue({
      userId: '123',
      ctx: {
        user: { id: '123' },
        profile: {
          id: '123',
          name: 'Test',
          birthDate: '1990-01-01',
          birthTime: '12:00',
          birthPlace: 'Moscow',
          language: 'ru',
          isPremium: true,
        },
        chartId: 7,
        chartData,
      },
    }),
    getCachedReading,
    saveReading,
  }));

  jest.doMock('../lib/contentArchitecture', () => ({
    getPremiumEntitlementState: jest.fn().mockResolvedValue({ isPremium: true, entitlement: null }),
  }));

  jest.doMock('../lib/natalHumanInterpretation', () => ({
    buildHumanInputHash: jest.fn().mockReturnValue('input-hash'),
    buildHumanDailyFallback: jest.fn().mockReturnValue(fallbackSection),
    generateHumanDailySection,
  }));

  jest.doMock('../lib/serverLocks', () => ({
    tryAcquireLock: jest.fn().mockReturnValue(true),
    releaseLock: jest.fn(),
  }));

  jest.doMock('../lib/contentApiLogging', () => ({
    logContentApi: jest.fn(),
    warnContentApi: jest.fn(),
  }));

  return { getCachedReading, saveReading, generateHumanDailySection };
}

async function callHandler(method: 'GET' | 'POST' = 'POST', sectionKey = 'daily_love') {
  const { default: handler } = await import('../pages/api/content/natal/human-daily');
  const res = createResponse();
  await handler(
    {
      method,
      query: method === 'GET' ? { userId: '123', chartId: '7', sectionKey, date: '2026-06-03' } : {},
      body: method === 'POST'
        ? { userId: '123', chartId: 7, sectionKey, date: '2026-06-03', profile: { isPremium: true }, chartData }
        : {},
    } as any,
    res
  );
  return res;
}

describe('human-daily API fallback-first flow', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns cached valid daily content without generation', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(cachedReading),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('human_v2');
    expect(payload.persistenceStatus).toBe('saved');
    expect(payload.interpretation.content.content).toBe(generatedSection.content);
    expect(mocks.generateHumanDailySection).not.toHaveBeenCalled();
    expect(mocks.saveReading).not.toHaveBeenCalled();
  });

  it('saves fallback before generated daily text for missing premium sections', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(null),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('generated');
    expect(payload.persistenceStatus).toBe('saved');
    expect(mocks.saveReading).toHaveBeenCalledTimes(2);
    expect(mocks.saveReading.mock.calls[0][2]).toBe(fallbackSection);
    expect(mocks.saveReading.mock.calls[1][2]).toBe(generatedSection);
    expect(mocks.saveReading.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generateHumanDailySection.mock.invocationCallOrder[0]
    );
  });

  it('returns saved fallback when OpenAI generation fails, then GET reads it without generation', async () => {
    const savedFallback = savedReading(fallbackSection);
    const mocks = setupMocks({
      getCachedReading: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedFallback),
      saveReading: jest.fn().mockResolvedValue(savedFallback),
      generateHumanDailySection: jest.fn().mockRejectedValue(new Error('OPENAI_DOWN')),
    });

    const post = await callHandler('POST');
    expect(post.status).toHaveBeenCalledWith(200);
    expect(post.json.mock.calls[0][0].source).toBe('fallback');
    expect(post.json.mock.calls[0][0].interpretation.content.content).toBe(fallbackSection.content);

    const get = await callHandler('GET');
    expect(get.status).toHaveBeenCalledWith(200);
    expect(get.json.mock.calls[0][0].source).toBe('human_v2');
    expect(mocks.generateHumanDailySection).toHaveBeenCalledTimes(1);
  });

  it('does not call OpenAI if fallback persistence fails', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(null),
      saveReading: jest.fn().mockRejectedValue(new Error('DB_WRITE_FAILED')),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('fallback_unsaved');
    expect(payload.persistenceStatus).toBe('failed');
    expect(payload.interpretation.content.content).toBe(fallbackSection.content);
    expect(mocks.generateHumanDailySection).not.toHaveBeenCalled();
  });

  it('does not save or call OpenAI when the initial cache read fails', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockRejectedValue(new Error('DB_READ_FAILED')),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('fallback_unsaved');
    expect(payload.persistenceStatus).toBe('failed');
    expect(payload.interpretation.content.content).toBe(fallbackSection.content);
    expect(mocks.saveReading).not.toHaveBeenCalled();
    expect(mocks.generateHumanDailySection).not.toHaveBeenCalled();
  });

  it('does not save or call OpenAI when the lock cache reread fails', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('DB_READ_FAILED')),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('fallback_unsaved');
    expect(payload.persistenceStatus).toBe('failed');
    expect(payload.interpretation.content.content).toBe(fallbackSection.content);
    expect(mocks.saveReading).not.toHaveBeenCalled();
    expect(mocks.generateHumanDailySection).not.toHaveBeenCalled();
  });

  it('treats invalid cached rows as a miss and repairs them', async () => {
    const invalidReading = savedReading({ ...fallbackSection, content: '' });
    const mocks = setupMocks({
      getCachedReading: jest.fn()
        .mockResolvedValueOnce(invalidReading)
        .mockResolvedValueOnce(null),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('generated');
    expect(mocks.saveReading).toHaveBeenCalledTimes(2);
    expect(mocks.generateHumanDailySection).toHaveBeenCalledTimes(1);
  });

  it('rereads cache inside the generation lock before saving anything', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(cachedReading),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('human_v2');
    expect(mocks.saveReading).not.toHaveBeenCalled();
    expect(mocks.generateHumanDailySection).not.toHaveBeenCalled();
  });
});
