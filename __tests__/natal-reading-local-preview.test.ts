import type { NextApiRequest, NextApiResponse } from 'next';

const connect = jest.fn();
jest.mock('../lib/db', () => ({ getPool: () => ({ connect }) }));
jest.mock('../lib/natalChartCanonical', () => ({ isCanonicalNatalChartDataComplete: () => true }));
jest.mock('../lib/natalReading/unifiedReading', () => ({
  isNatalUnifiedReading: (value: unknown) => !!value,
  NATAL_COPY_REVISION: 'current',
}));
import handler from '../pages/api/dev/natal-reading-samples';

describe('saved natal readings in localhost preview', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development', NEXT_PUBLIC_UI_PREVIEW: '1' };
    connect.mockReset();
  });
  afterEach(() => { process.env = originalEnv; });
  const response = () => {
    const res = { status: jest.fn(), end: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  };
  const request = (headers = { host: 'localhost:3000' }, method = 'GET') => ({ headers, method, query: {} } as NextApiRequest);

  it.each(['production', 'test'] as const)('does not expose database data in %s', async environment => {
    process.env = { ...process.env, NODE_ENV: environment };
    const res = response();
    await handler(request(), res as unknown as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(connect).not.toHaveBeenCalled();
  });
  it.each(['example.com', 'localhost.example.com', '[invalid'])('rejects host %s before connecting', async host => {
    const res = response();
    await handler(request({ host }), res as unknown as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(connect).not.toHaveBeenCalled();
  });
  it('requires the preview flag and rejects writes', async () => {
    const res = response();
    process.env.NEXT_PUBLIC_UI_PREVIEW = '0';
    await handler(request(), res as unknown as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(404);
    process.env.NEXT_PUBLIC_UI_PREVIEW = '1';
    await handler(request(undefined, 'POST'), res as unknown as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(connect).not.toHaveBeenCalled();
  });
  it('returns saved text unchanged in a read-only transaction', async () => {
    const reading = { story: [{ text: 'Сохранённый текст.' }] };
    const query = jest.fn().mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'owner', name: 'Mik', gender: 'male' }] })
      .mockResolvedValueOnce({ rows: [{ id: 6, name: 'Mik', birth_date: '2010-12-22', birth_time: '16:26',
        birth_place: 'Дмитров', subject_type: 'self', is_primary: true, chart_data: {}, content: reading }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = jest.fn();
    connect.mockResolvedValue({ query, release });
    const res = response();
    await handler(request(), res as unknown as NextApiResponse);
    expect(query.mock.calls[0]).toEqual(['BEGIN READ ONLY']);
    expect(query.mock.calls[3]).toEqual(['ROLLBACK']);
    expect(res.json.mock.calls[0][0].people[0].reading).toBe(reading);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
