export {};

// Личный дневной разбор теперь генерится ЕДИНЫМ полотном (canvas) одним запросом,
// а эндпоинт режет его на секции. Тесты проверяют тот же fallback-first flow, но на
// уровне полотна: buildDailyCanvasFallback / generateDailyCanvas / sliceCanvasToSection.

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

const canvasSections = (loveText: string) => [
  { key: 'overview', title: 'Overview', text: 'Overview block with enough text for the personal daily canvas contract.' },
  { key: 'love', title: 'Love', text: loveText },
  { key: 'money', title: 'Money', text: 'Money block' },
  { key: 'work', title: 'Work', text: 'Work block' },
  { key: 'goals', title: 'Goals', text: 'Goals block' },
  { key: 'family', title: 'Family', text: 'Family block' },
  { key: 'friendship', title: 'Friendship', text: 'Friendship block' },
  { key: 'energy', title: 'Energy', text: 'Energy block' },
  { key: 'communication', title: 'Communication', text: 'Communication block' },
];

const generatedCanvas = {
  card: {
    title: 'Generated title',
    teaser: 'Generated teaser for the day.',
    positive_points: ['do a', 'do b', 'do c'],
    caution_points: ['dont a', 'dont b', 'dont c'],
  },
  sections: canvasSections(generatedSection.content),
  summary: {
    main_risk: 'Generated risk',
    best_action: 'Generated action',
    day_score: 74,
    day_score_explain: '74 — крепкий день.',
  },
  meta: { free_section_key: 'love' },
};

const fallbackCanvas = {
  card: {
    title: 'Fallback title',
    teaser: 'Fallback teaser for the day.',
    positive_points: ['do a', 'do b', 'do c'],
    caution_points: ['dont a', 'dont b', 'dont c'],
  },
  sections: canvasSections(fallbackSection.content),
  summary: {
    main_risk: 'Fallback risk',
    best_action: 'Fallback action',
    day_score: null,
    day_score_explain: '',
  },
  meta: { free_section_key: 'love' },
};

const invalidCanvas = { card: null, sections: [], summary: null, meta: null };

const cachedReading = {
  id: 10,
  userId: '123',
  chartId: 7,
  accessTier: 'premium',
  contentSurface: 'natal',
  contentVariant: 'living',
  modelTier: 'premium',
  cacheKey: 'human_v2.canvas.2026-06-03',
  inputHash: 'hash',
  content: generatedCanvas,
  promptVersion: 'your-horoscope-v1.daily-canvas',
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

function savedReading(content: any, id = 11) {
  return {
    ...cachedReading,
    id,
    content,
    inputHash: content === generatedCanvas ? 'generated-hash' : 'fallback-hash',
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
  generateDailyCanvas?: jest.Mock;
  isPremium?: boolean;
}) {
  const getCachedReading = options?.getCachedReading || jest.fn().mockResolvedValue(null);
  const saveReading = options?.saveReading || jest.fn(async (_ctx, _opts, content) => savedReading(content, content === generatedCanvas ? 12 : 11));
  const generateDailyCanvas = options?.generateDailyCanvas || jest.fn().mockResolvedValue(generatedCanvas);

  const sliceCanvasToSection = jest.fn((canvas: any, sectionKey: string) => {
    if (canvas === generatedCanvas) return generatedSection;
    if (canvas === fallbackCanvas) return fallbackSection;
    const canvasKey = sectionKey === 'daily_overview' ? 'overview' : sectionKey.replace(/^daily_/, '').replace('work_business', 'work');
    const section = canvas?.sections?.find((item: any) => item.key === canvasKey);
    return { key: sectionKey, title: 'x', access: 'premium', content: section?.text || '', bullets: [] };
  });

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
    getPremiumEntitlementState: jest.fn().mockResolvedValue({ isPremium: options?.isPremium ?? true, entitlement: null }),
  }));

  jest.doMock('../lib/natalHumanInterpretation', () => ({
    buildHumanInputHash: jest.fn().mockReturnValue('input-hash'),
    buildHumanDailyFallback: jest.fn().mockReturnValue(fallbackSection),
    buildDailyCanvasFallback: jest.fn().mockReturnValue(fallbackCanvas),
    generateDailyCanvas,
    sliceCanvasToSection,
  }));

  jest.doMock('../lib/serverLocks', () => ({
    tryAcquireLock: jest.fn().mockReturnValue(true),
    releaseLock: jest.fn(),
  }));

  jest.doMock('../lib/contentApiLogging', () => ({
    logContentApi: jest.fn(),
    warnContentApi: jest.fn(),
  }));

  return { getCachedReading, saveReading, generateDailyCanvas, sliceCanvasToSection };
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

describe('human-daily API canvas fallback-first flow', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns cached valid canvas without generation', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(cachedReading),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('human_v2');
    expect(payload.persistenceStatus).toBe('saved');
    expect(payload.interpretation.content.content).toBe(generatedSection.content);
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
    expect(mocks.saveReading).not.toHaveBeenCalled();
  });

  it('does not expose closed canvas sections to a free user', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(cachedReading),
      isPremium: false,
    });

    const open = await callHandler('GET', 'daily_love');
    expect(open.status).toHaveBeenCalledWith(200);
    expect(open.json.mock.calls[0][0].accessTier).toBe('free');

    const closed = await callHandler('GET', 'daily_money');
    expect(closed.status).toHaveBeenCalledWith(403);
    expect(closed.json.mock.calls[0][0]).toMatchObject({
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      freeSectionKey: 'love',
    });
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
  });

  it('saves fallback canvas before generated canvas on a miss', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(null),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('generated');
    expect(payload.persistenceStatus).toBe('saved');
    expect(mocks.saveReading).toHaveBeenCalledTimes(2);
    expect(mocks.saveReading.mock.calls[0][2]).toBe(fallbackCanvas);
    expect(mocks.saveReading.mock.calls[1][2]).toBe(generatedCanvas);
    expect(mocks.saveReading.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generateDailyCanvas.mock.invocationCallOrder[0]
    );
    expect(payload.interpretation.content.content).toBe(generatedSection.content);
  });

  it('returns saved fallback when canvas generation fails, then GET reads it without generation', async () => {
    const savedFallback = savedReading(fallbackCanvas);
    const mocks = setupMocks({
      getCachedReading: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedFallback),
      saveReading: jest.fn().mockResolvedValue(savedFallback),
      generateDailyCanvas: jest.fn().mockRejectedValue(new Error('OPENAI_DOWN')),
    });

    const post = await callHandler('POST');
    expect(post.status).toHaveBeenCalledWith(200);
    expect(post.json.mock.calls[0][0].source).toBe('fallback');
    expect(post.json.mock.calls[0][0].interpretation.content.content).toBe(fallbackSection.content);

    const get = await callHandler('GET');
    expect(get.status).toHaveBeenCalledWith(200);
    expect(get.json.mock.calls[0][0].source).toBe('human_v2');
    expect(mocks.generateDailyCanvas).toHaveBeenCalledTimes(1);
  });

  it('does not call OpenAI if fallback canvas persistence fails', async () => {
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
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
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
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
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
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
  });

  it('treats an invalid cached canvas as a miss and regenerates', async () => {
    const invalidReading = savedReading(invalidCanvas);
    const mocks = setupMocks({
      getCachedReading: jest.fn()
        .mockResolvedValueOnce(invalidReading)
        .mockResolvedValueOnce(null),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('generated');
    expect(mocks.saveReading).toHaveBeenCalledTimes(2);
    expect(mocks.generateDailyCanvas).toHaveBeenCalledTimes(1);
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
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
  });
});
