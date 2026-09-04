const profile = { id: '42', language: 'ru' } as never;

function response(body: unknown) {
  return { json: jest.fn().mockResolvedValue(body) };
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

function loadService(tg?: Record<string, unknown>, localStorage?: Storage) {
  const apiFetch = jest.fn();
  jest.doMock('../lib/distributionChannel', () => ({
    canUseTelegramStars: () => true,
  }));
  jest.doMock('../services/apiClient', () => ({
    apiFetch,
    isNativeAppRuntime: () => false,
  }));
  jest.doMock('../services/sessionService', () => ({
    getExplicitTelegramInitDataHeaders: () => ({}),
  }));
  Object.defineProperty(global, 'window', {
    configurable: true,
    value: {
      ...(tg ? { Telegram: { WebApp: tg } } : {}),
      ...(localStorage ? { localStorage } : {}),
    },
  });
  return {
    apiFetch,
    service: require('../services/telegramService') as typeof import('../services/telegramService'),
  };
}

describe('Telegram payment callback resilience', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(global, 'window');
  });

  it('keeps a durable pending invoice after timeout and accepts its late paid callback', async () => {
    jest.useFakeTimers();
    const localStorage = memoryStorage();
    let invoiceCallback: ((status: string) => void) | undefined;
    const openInvoice = jest.fn((_url: string, callback: (status: string) => void) => {
      invoiceCallback = callback;
    });
    const { apiFetch, service } = loadService({ openInvoice }, localStorage);
    apiFetch.mockResolvedValue(response({ invoiceUrl: 'https://t.me/invoice' }));

    const firstTap = service.requestStarsPayment(profile, 'premium_month');
    const secondPlanTap = service.requestStarsPayment(profile, 'premium_year');
    await jest.advanceTimersByTimeAsync(service.TELEGRAM_PAYMENT_CALLBACK_TIMEOUT_MS);

    await expect(firstTap).resolves.toBe('pending');
    await expect(secondPlanTap).resolves.toBe('pending');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(openInvoice).toHaveBeenCalledTimes(1);

    await expect(service.requestStarsPayment(profile, 'premium_quarter')).resolves.toBe('pending');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(openInvoice).toHaveBeenCalledTimes(1);

    jest.resetModules();
    const reloaded = loadService({ openInvoice }, localStorage);
    reloaded.apiFetch.mockResolvedValue(response({ invoiceUrl: 'https://t.me/another-invoice' }));
    await expect(reloaded.service.requestStarsPayment(profile, 'premium_week')).resolves.toBe('pending');
    expect(reloaded.apiFetch).not.toHaveBeenCalled();
    expect(openInvoice).toHaveBeenCalledTimes(1);

    expect(invoiceCallback).toBeDefined();
    (invoiceCallback as (status: string) => void)('paid');
    await expect(reloaded.service.requestStarsPayment(profile, 'premium_week')).resolves.toBe('paid');
    expect(reloaded.apiFetch).not.toHaveBeenCalled();
    expect(openInvoice).toHaveBeenCalledTimes(1);
  });

  it('settles a popup timeout even when clearing its progress indicator throws', async () => {
    jest.useFakeTimers();
    const hideProgress = jest.fn(() => { throw new Error('Telegram UI cleanup failed'); });
    const showPopup = jest.fn();
    const { apiFetch, service } = loadService({
      isVersionAtLeast: () => true,
      showPopup,
      MainButton: { showProgress: jest.fn(), hideProgress },
    });
    apiFetch.mockResolvedValue(response({
      simMode: true,
      plan: { days: 30, stars: 250 },
    }));

    const payment = service.requestStarsPayment(profile, 'premium_month');
    await jest.advanceTimersByTimeAsync(service.TELEGRAM_PAYMENT_CALLBACK_TIMEOUT_MS);

    await expect(payment).resolves.toBe('cancelled');
    expect(showPopup).toHaveBeenCalledTimes(1);
    expect(hideProgress).toHaveBeenCalledTimes(1);
  });

  it('unlocks checkout when Telegram cannot subscribe to the invoice callback', async () => {
    const openInvoice = jest.fn(() => {
      throw new Error('bridge unavailable');
    });
    const { apiFetch, service } = loadService({ openInvoice });
    apiFetch.mockResolvedValue(response({ invoiceUrl: 'https://t.me/invoice' }));

    await expect(service.requestStarsPayment(profile, 'premium_month')).resolves.toBe('cancelled');
    await expect(service.requestStarsPayment(profile, 'premium_month')).resolves.toBe('cancelled');
    expect(openInvoice).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['without Telegram WebApp', undefined],
    ['with an old Telegram WebApp', { isVersionAtLeast: () => false }],
  ])('settles a rejected simulation activation %s', async (
    _label: string,
    tg: Record<string, unknown> | undefined,
  ) => {
    const { apiFetch, service } = loadService(tg);
    Object.assign(global.window, { confirm: jest.fn(() => true) });
    apiFetch
      .mockResolvedValueOnce(response({ simMode: true, plan: { days: 30, stars: 250 } }))
      .mockRejectedValueOnce(new Error('activation failed'));

    await expect(service.requestStarsPayment(profile, 'premium_month')).resolves.toBe('cancelled');
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
