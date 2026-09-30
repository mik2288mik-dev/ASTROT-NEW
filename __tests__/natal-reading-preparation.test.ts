import { NATAL_COPY_REVISION } from '../lib/natalReading/unifiedReading';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import type { ReadingContext } from '../lib/natalReading/apiHelper';
const mockQuery = jest.fn(); const mockConnect = jest.fn(); const mockResolve = jest.fn(); const mockGenerate = jest.fn();
const mockHash = jest.fn(); const mockRelease = jest.fn();
jest.mock('../lib/db', () => ({ getPool: () => ({ query: (...args: unknown[]) => mockQuery(...args), connect: (...args: unknown[]) => mockConnect(...args) }) }));
jest.mock('../lib/natalReading/apiHelper', () => ({ resolveReadingContext: (...args: unknown[]) => mockResolve(...args) }));
jest.mock('../lib/natalReading/unifiedApi', () => ({ generateNatalUnifiedReadingWithLock: (...args: unknown[]) => mockGenerate(...args), natalUnifiedReadingInputHash: (...args: unknown[]) => mockHash(...args) }));
jest.mock('../lib/database-url', () => ({ resolveDatabaseUrl: () => '' }));
import { enqueueNatalReadingPreparation, processNatalReadingPreparations } from '../lib/natalReading/preparation';

type Job = { id: number; user_id: string; chart_id: number; input_hash: string; language: string; status: string; attempts: number; progress?: unknown; priority: number; last_error?: string };
let jobs: Job[]; let acquired: boolean;
function query(sql: string, params: unknown[] = []) {
  if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired }] };
  if (sql.includes("progress=jsonb_set(progress,'{recoveryRevision}'")) {
    for (const job of jobs) {
      const progress = job.progress as { raw?: { story?: unknown[] }; repairs?: number; recoveryRevision?: string } | undefined;
      if (job.status === 'failed' && job.input_hash.endsWith(String(params[0]).slice(1))
        && Array.isArray(progress?.raw?.story) && Number(progress?.repairs) > 0
        && (Number(progress?.repairs) < Number(params[2]) || job.last_error?.includes('paragraph adds no new observation'))
        && progress?.recoveryRevision !== params[1]) {
        job.status = 'pending'; job.attempts = 0;
        job.progress = { ...progress, recoveryRevision: params[1] };
      }
    }
  }
  if (sql.includes('INSERT INTO natal_reading_jobs')) {
    const [user_id, chart_id, input_hash, language, priority] = params;
    if (!jobs.some((job) => job.chart_id === chart_id && job.input_hash === input_hash && job.language === language)) jobs.push({ id: jobs.length + 1, user_id: String(user_id), chart_id: Number(chart_id), input_hash: String(input_hash), language: String(language), status: 'pending', attempts: 0, priority: Number(priority) });
  }
  if (sql.includes('SELECT * FROM natal_reading_jobs')) return { rows: jobs.filter((job) => job.status === 'pending' && job.attempts < 2).slice(0, 1) };
  if (sql.includes('UPDATE natal_reading_jobs')) {
    const job = jobs.find((item) => item.id === params[0]);
    if (job && sql.includes('progress=$2')) job.progress = JSON.parse(String(params[1]));
    if (job && sql.includes("status='ready'")) job.status = 'ready';
    if (job && sql.includes("status='obsolete'")) job.status = 'obsolete';
    if (job && sql.includes('attempts=$2')) { job.attempts = Number(params[1]); job.status = String(params[2]); }
  }
  return { rows: [] };
}
function pending(): Job { return { id: 1, user_id: '42', chart_id: 9, input_hash: `birth-ru:${NATAL_COPY_REVISION}`, language: 'ru', status: 'pending', attempts: 0, priority: 10 }; }
describe('durable autonomous natal preparation', () => {
  beforeEach(() => {
    jest.resetAllMocks(); jobs = []; acquired = true;
    mockQuery.mockImplementation(async (sql, params) => query(sql, params));
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockHash.mockReturnValue('birth-ru');
    mockResolve.mockResolvedValue({ user: { id: '42' }, chartId: 9, profile: { id: '42', language: 'ru' }, chartData: canonicalNatalChart() } as unknown as ReadingContext);
    mockGenerate.mockResolvedValue({ status: 'ready', fromCache: false, value: { content: {} } });
  });
  it('coalesces repeated creation writes and does not reprocess ready jobs', async () => {
    const chart = { id: 9, user_id: '42', chart_data: canonicalNatalChart() };
    await Promise.all(Array.from({ length: 12 }, () => enqueueNatalReadingPreparation(chart)));
    expect(jobs).toHaveLength(1);
    await processNatalReadingPreparations();
    await processNatalReadingPreparations();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(jobs[0].status).toBe('ready');
  });
  it('queues one editorial replacement without resetting a previously completed job', async () => {
    jobs = [{ ...pending(), input_hash: 'birth-ru', status: 'ready' }];
    const chart = { id: 9, user_id: '42', chart_data: canonicalNatalChart() };
    for (let i = 0; i < 3; i++) await enqueueNatalReadingPreparation(chart);
    expect(jobs).toHaveLength(2);
    await processNatalReadingPreparations();
    await enqueueNatalReadingPreparation(chart);
    await processNatalReadingPreparations();
    expect(jobs.map(job => job.status)).toEqual(['ready', 'ready']);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
  it('does no work when another instance holds the database lock', async () => {
    jobs = [pending()]; acquired = false;
    await processNatalReadingPreparations();
    expect(mockGenerate).not.toHaveBeenCalled(); expect(mockRelease).toHaveBeenCalledTimes(1);
  });
  it('rejects an obsolete birth revision before invoking AI', async () => {
    jobs = [pending()]; mockHash.mockReturnValue('new-birth-ru');
    await processNatalReadingPreparations();
    expect(jobs[0].status).toBe('obsolete'); expect(mockGenerate).not.toHaveBeenCalled();
  });
  it('keeps a persisted draft through review or DB failure and supplies it to the next attempt', async () => {
    jobs = [pending()]; const checkpoint = { writerStarted: true, repairs: 0, raw: { story: [] } };
    mockGenerate.mockImplementationOnce(async ({ onProgress }) => { await onProgress(checkpoint); throw new Error('review unavailable'); });
    await processNatalReadingPreparations();
    expect(jobs[0].progress).toEqual(checkpoint);
    await processNatalReadingPreparations();
    expect(mockGenerate.mock.calls[1][0].progress).toEqual(checkpoint);
    expect(jobs[0].status).toBe('ready');
  });
  it('stops on a terminal validation failure and does not reset it on another visit or write', async () => {
    jobs = [pending()]; mockGenerate.mockRejectedValue(Object.assign(new Error('invalid copy'), { code: 'NATAL_WRITER_REJECTED' }));
    await processNatalReadingPreparations();
    await enqueueNatalReadingPreparation({ id: 9, user_id: '42', chart_data: canonicalNatalChart() });
    await processNatalReadingPreparations();
    expect(jobs[0].status).toBe('failed'); expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
  it('recovers a prematurely rejected draft once and preserves completed or exhausted jobs', async () => {
    const draft = { writerStarted: true, raw: { story: [{ id: 'story:1', text: 'Сохранённый текст.' }] }, repairs: 1 };
    jobs = [
      { ...pending(), status: 'failed', attempts: 1, progress: draft },
      { ...pending(), id: 2, chart_id: 10, status: 'ready', progress: draft },
      { ...pending(), id: 3, chart_id: 11, status: 'failed', progress: { ...draft, repairs: 2 } },
      { ...pending(), id: 4, chart_id: 12, input_hash: 'birth-ru:older-copy', status: 'failed', progress: draft },
    ];
    mockGenerate.mockRejectedValue(Object.assign(new Error('Still invalid'), { code: 'NATAL_WRITER_REJECTED' }));
    await processNatalReadingPreparations();
    await processNatalReadingPreparations();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][0].progress).toMatchObject({ ...draft, recoveryRevision: 'validated-draft-recovery-20260930' });
    expect(jobs.map(job => job.status)).toEqual(['failed', 'ready', 'failed', 'failed']);
    expect(jobs[2].progress).toEqual({ ...draft, repairs: 2 });
  });
  it('allows one review of an exhausted draft stopped only by a redundant continuation', async () => {
    jobs = [{ ...pending(), status: 'failed', attempts: 1,
      last_error: 'topic:communication:2: paragraph adds no new observation',
      progress: { writerStarted: true, raw: { story: [] }, repairs: 2 } }];
    mockGenerate.mockResolvedValue({ status: 'ready', fromCache: false });
    await processNatalReadingPreparations();
    await processNatalReadingPreparations();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][0].progress.repairs).toBe(2);
    expect(jobs[0].status).toBe('ready');
  });
  it('limits transport retries and never creates an endless regeneration loop', async () => {
    jobs = [pending()]; mockGenerate.mockRejectedValue(new Error('DB unavailable'));
    await processNatalReadingPreparations(); await processNatalReadingPreparations(); await processNatalReadingPreparations();
    expect(jobs[0].status).toBe('failed'); expect(jobs[0].attempts).toBe(2); expect(mockGenerate).toHaveBeenCalledTimes(2);
  });
  it('does not overwrite chart language with the current profile language during recovery', async () => {
    jobs = [{ ...pending(), language: 'en' }];
    await processNatalReadingPreparations();
    expect(mockGenerate.mock.calls[0][0].ctx.profile.language).toBe('en');
  });
  it('releases its process guard even when the lock connection fails during cleanup', async () => {
    jobs = [pending()]; mockQuery.mockImplementationOnce(async () => { throw new Error('connect broke'); });
    await expect(processNatalReadingPreparations()).rejects.toThrow();
    await processNatalReadingPreparations();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
