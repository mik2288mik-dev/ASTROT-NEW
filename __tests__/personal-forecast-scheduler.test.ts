jest.mock('../services/notificationRetentionService', () => ({
  dispatchScheduledNotifications: jest.fn(async () => ({ ok: true, successCount: 0, failureCount: 0 })),
  planRetentionNotifications: jest.fn(async () => undefined),
  generateDailyCards: jest.fn(async () => undefined),
}));
jest.mock('../lib/rustorePayments', () => ({ processPendingRuStoreEvents: jest.fn(async () => undefined) }));
jest.mock('../lib/supportOutbox', () => ({ processSupportDeliveryOutbox: jest.fn(async () => undefined) }));
jest.mock('../lib/neboOps', () => ({ ensureNeboOpsWorker: jest.fn() }));
jest.mock('../lib/ownerCriticalAlerts', () => ({ processOwnerCriticalAlerts: jest.fn(async () => undefined) }));
jest.mock('../lib/stories/repository', () => ({
  ensureAllStoryBuffers: jest.fn(async () => undefined),
  storyGenerationEnabled: jest.fn(() => false),
}));
jest.mock('../lib/migrations', () => ({ bootstrapNotificationDelivery: jest.fn(async () => undefined) }));
jest.mock('../lib/personalForecastPrewarm', () => ({ prewarmPersonalForecastIncrement: jest.fn() }));

const counts = { scanned: 8, generated: 2, inProgress: 1, failed: 0 };
const mutableEnv = process.env as Record<string, string | undefined>;
const sharedState = globalThis as typeof globalThis & {
  __neboSchedulerStatusV1?: unknown;
  __neboForecastPrewarmSchedulerV1?: unknown;
};

function loadScheduler() {
  const worker = jest.requireMock('../lib/personalForecastPrewarm') as {
    prewarmPersonalForecastIncrement: jest.Mock;
  };
  worker.prewarmPersonalForecastIncrement.mockResolvedValue(counts);
  const notifications = jest.requireMock('../services/notificationRetentionService') as {
    dispatchScheduledNotifications: jest.Mock;
  };
  const scheduler = require('../lib/notificationScheduler') as typeof import('../lib/notificationScheduler');
  return { worker: worker.prewarmPersonalForecastIncrement, notifications, scheduler };
}

describe('in-process personal forecast preparation', () => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    DISABLE_INPROCESS_CRON: process.env.DISABLE_INPROCESS_CRON,
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ now: new Date('2026-10-16T09:11:00.000Z') });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    delete sharedState.__neboSchedulerStatusV1;
    delete sharedState.__neboForecastPrewarmSchedulerV1;
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.NEXT_RUNTIME;
    delete mutableEnv.DISABLE_INPROCESS_CRON;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete sharedState.__neboSchedulerStatusV1;
    delete sharedState.__neboForecastPrewarmSchedulerV1;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete mutableEnv[key];
      else mutableEnv[key] = value;
    }
  });

  it('prepares a bounded batch after startup and repeats without external cron', async () => {
    const { scheduler, worker } = loadScheduler();
    scheduler.ensureNotificationScheduler('test');
    scheduler.ensureNotificationScheduler('test-again');
    expect(scheduler.getSchedulerStatus().started).toBe(true);
    expect(worker).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(34_999);
    expect(worker).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(worker).toHaveBeenCalledTimes(1);
    expect(worker).toHaveBeenCalledWith({ now: new Date('2026-10-16T09:11:35.000Z') });
    expect(console.log).toHaveBeenCalledWith('[cron] personal-forecast-horizon done', counts);

    await jest.advanceTimersByTimeAsync(180_000);
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it('keeps notifications running while a long batch prevents overlapping passes', async () => {
    const { scheduler, worker, notifications } = loadScheduler();
    let finishBatch!: (result: typeof counts) => void;
    worker.mockImplementationOnce(() => new Promise((resolve) => { finishBatch = resolve; }));
    scheduler.ensureNotificationScheduler('test');
    await jest.advanceTimersByTimeAsync(35_000 + 2 * 180_000);

    expect(worker).toHaveBeenCalledTimes(1);
    expect(notifications.dispatchScheduledNotifications.mock.calls.length).toBeGreaterThanOrEqual(4);
    finishBatch(counts);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(180_000);
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it('shares its cadence guard across separately loaded Next bundles', async () => {
    const first = loadScheduler();
    first.scheduler.ensureNotificationScheduler('instrumentation');
    await jest.advanceTimersByTimeAsync(35_000);
    expect(first.worker).toHaveBeenCalledTimes(1);

    jest.resetModules();
    const second = loadScheduler();
    second.scheduler.ensureNotificationScheduler('api-bundle');
    await jest.advanceTimersByTimeAsync(35_000);
    expect(second.worker).not.toHaveBeenCalled();
  });

  it('logs a failed batch and retries on the next interval', async () => {
    const { scheduler, worker } = loadScheduler();
    worker.mockRejectedValueOnce(new Error('unavailable'));
    scheduler.ensureNotificationScheduler('test');
    await jest.advanceTimersByTimeAsync(35_000);
    expect(console.warn).toHaveBeenCalledWith('[cron] personal-forecast-horizon failed');

    await jest.advanceTimersByTimeAsync(180_000);
    expect(worker).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith('[cron] personal-forecast-horizon done', counts);
  });

  it.each([
    { NODE_ENV: 'development' },
    { NODE_ENV: 'test' },
    { NEXT_RUNTIME: 'edge' },
    { DISABLE_INPROCESS_CRON: '1' },
  ])('honors the existing scheduler safeguard %o', async (env) => {
    Object.assign(mutableEnv, env);
    const { scheduler, worker } = loadScheduler();
    scheduler.ensureNotificationScheduler('test');
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(worker).not.toHaveBeenCalled();
    expect(scheduler.getSchedulerStatus().started).toBe(false);
  });
});
