export {};

const topic = (hook: string, bodySeed: string) => ({
  hook,
  body: `${bodySeed} Это поле достаточно длинное, чтобы пройти контракт дневного пакета: оно не обещает событий, а описывает практический фокус через расчет карты и транзитов.`,
});

const generatedCanvas = {
  hero_title: 'Тише к сути, без лишнего шума',
  hero_hook: 'Один честный выбор важнее набора случайных реакций.',
  overview: 'В карте и транзитах виден день, где лучше держать внимание на одном внятном действии. Не нужно разгонять каждую мысль до решения: полезнее отделить важное от чужой срочности, ответить там, где давно просится ясность, и оставить небольшой запас сил на вечер. Общий тон мягкий, но требовательный к точности.',
  love: topic('Близость просит ясности', 'В отношениях лучше не проверять человека намеками.'),
  money: topic('Расходы любят паузу', 'В деньгах полезно отделить желание быстро снять напряжение от реальной необходимости.'),
  work: topic('Задача выигрывает от порядка', 'В работе сильнее всего помогает простая последовательность действий.'),
  goals: topic('Цель становится меньше', 'В целях лучше выбрать шаг, который можно завершить без внутреннего торга.'),
  family: topic('Дому нужна договоренность', 'В семье и быту помогает не большой разговор обо всем, а одно понятное правило.'),
  friendship: topic('Друзьям хватит точности', 'В дружеском контакте лучше написать коротко и по делу, чем ждать идеального момента.'),
  energy: topic('Сила держится на темпе', 'В нагрузке стоит смотреть не на героизм, а на устойчивый ритм.'),
  communication: topic('Разговор веди короче', 'В общении работает прямота без давления: назвать суть, дать человеку место ответить.'),
  meta: {
    free_section_key: 'love',
    locale: 'ru',
    voice_version: 'voice-test',
    date_key: '2026-06-03',
    pattern_keys: {},
  },
};

const invalidCanvas = { meta: { free_section_key: 'love', locale: 'ru' } };

const generatedSection = {
  key: 'daily_love',
  title: 'Любовь',
  access: 'free',
  content: generatedCanvas.love.body,
  teaser: generatedCanvas.love.hook,
  bullets: [],
};

const cachedReading = {
  id: 10,
  userId: '123',
  chartId: 7,
  accessTier: 'premium',
  contentSurface: 'natal',
  contentVariant: 'living',
  modelTier: 'premium',
  cacheKey: 'personal_daily.package.user.123.date.2026-06-03.locale.ru.voice.voice-test',
  inputHash: 'input-hash',
  content: generatedCanvas,
  promptVersion: 'your-horoscope-v2.daily-package',
  calculationVersion: 'test',
  validFrom: null,
  validTo: null,
  isPersistent: false,
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
  const saveReading = options?.saveReading || jest.fn(async (_ctx, _opts, content) => savedReading(content));
  const generateDailyCanvas = options?.generateDailyCanvas || jest.fn().mockResolvedValue(generatedCanvas);

  const sliceCanvasToSection = jest.fn((canvas: any, sectionKey: string) => {
    const canvasKey = sectionKey === 'daily_overview' ? 'overview' : sectionKey.replace(/^daily_/, '').replace('work_business', 'work');
    if (canvasKey === 'overview') {
      return {
        key: sectionKey,
        title: canvas.hero_title,
        access: 'free',
        content: canvas.overview,
        teaser: canvas.hero_hook,
        bullets: [],
      };
    }
    return {
      key: sectionKey,
      title: canvasKey,
      access: canvasKey === canvas.meta.free_section_key ? 'free' : 'premium',
      content: canvas[canvasKey]?.body || '',
      teaser: canvas[canvasKey]?.hook || '',
      bullets: [],
    };
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
    buildHumanDailyFallback: jest.fn().mockReturnValue({ key: 'daily_risks', title: 'Fallback', access: 'premium', content: 'Fallback' }),
    getDailyVoiceVersion: jest.fn().mockReturnValue('voice-test'),
    generateDailyCanvas,
    isDailyCanvasComplete: jest.fn((canvas: any) => !!canvas?.hero_title && !!canvas?.love?.body),
    validateDailyCanvas: jest.fn((canvas: any) => ({
      valid: !!canvas?.hero_title && !!canvas?.love?.body,
      hardErrors: !!canvas?.hero_title && !!canvas?.love?.body ? [] : ['EMPTY_HERO_TITLE'],
      styleWarnings: [],
    })),
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

describe('human-daily API daily package flow', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns cached valid package without generation', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(cachedReading),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('human_v2');
    expect(payload.persistenceStatus).toBe('saved');
    expect(payload.interpretation.content.content).toBe(generatedSection.content);
    expect(payload.dailyPackage.hero_title).toBe(generatedCanvas.hero_title);
    expect(payload.dailyPackage.love.body).toBe(generatedCanvas.love.body);
    expect(payload.dailyPackage.communication.hook).toBe(generatedCanvas.communication.hook);
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
    expect(mocks.saveReading).not.toHaveBeenCalled();
  });

  it('does not expose closed section bodies to a free user', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(cachedReading),
      isPremium: false,
    });

    const open = await callHandler('GET', 'daily_overview');
    expect(open.status).toHaveBeenCalledWith(200);
    const payload = open.json.mock.calls[0][0];
    expect(payload.dailyPackage.love.body).toBe(generatedCanvas.love.body);
    expect(payload.dailyPackage.money.hook).toBe(generatedCanvas.money.hook);
    expect(payload.dailyPackage.money.body).toBe('');

    const closed = await callHandler('GET', 'daily_money');
    expect(closed.status).toHaveBeenCalledWith(403);
    expect(closed.json.mock.calls[0][0]).toMatchObject({
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      freeSectionKey: 'love',
    });
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
  });

  it('saves a generated package once on a miss', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(null),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.source).toBe('generated');
    expect(payload.persistenceStatus).toBe('saved');
    expect(mocks.saveReading).toHaveBeenCalledTimes(1);
    expect(mocks.saveReading.mock.calls[0][2]).toBe(generatedCanvas);
    expect(payload.interpretation.content.content).toBe(generatedSection.content);
  });

  it('does not save a fake package when generation fails', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(null),
      generateDailyCanvas: jest.fn().mockRejectedValue(new Error('OPENAI_DOWN')),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      code: 'CONTENT_GENERATION_UNAVAILABLE',
    });
    expect(mocks.saveReading).not.toHaveBeenCalled();
    expect(mocks.generateDailyCanvas).toHaveBeenCalledTimes(1);
  });

  it('returns a clear code after a hard-invalid daily package', async () => {
    const hardInvalid = Object.assign(new Error('INVALID_DAILY_PACKAGE'), {
      code: 'DAILY_PACKAGE_HARD_INVALID',
      hardErrors: ['EMPTY_TOPIC_BODY'],
    });
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockResolvedValue(null),
      generateDailyCanvas: jest.fn().mockRejectedValue(hardInvalid),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      code: 'DAILY_PACKAGE_HARD_INVALID',
      reasonCode: 'DAILY_PACKAGE_HARD_INVALID',
    });
    expect(mocks.saveReading).not.toHaveBeenCalled();
  });

  it('does not save or call OpenAI when the initial cache read fails', async () => {
    const mocks = setupMocks({
      getCachedReading: jest.fn().mockRejectedValue(new Error('DB_READ_FAILED')),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      code: 'CACHE_READ_FAILED',
    });
    expect(mocks.saveReading).not.toHaveBeenCalled();
    expect(mocks.generateDailyCanvas).not.toHaveBeenCalled();
  });

  it('treats an invalid cached package as a miss and regenerates', async () => {
    const invalidReading = savedReading(invalidCanvas);
    const mocks = setupMocks({
      getCachedReading: jest.fn()
        .mockResolvedValueOnce(invalidReading)
        .mockResolvedValueOnce(null),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('generated');
    expect(mocks.saveReading).toHaveBeenCalledTimes(1);
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
