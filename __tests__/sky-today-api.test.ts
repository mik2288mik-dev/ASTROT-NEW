import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../lib/horoscope/skyToday', () => ({
  computeSkyToday: jest.fn(),
}));

import { computeSkyToday } from '../lib/horoscope/skyToday';
import handler from '../pages/api/content/today/sky';

function response() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as NextApiResponse;
}

describe('sky today API', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns a Swiss snapshot without profile input', async () => {
    const sky = {
      date: '2026-07-15',
      moon: { sign: 'Gemini', degree: 8, phaseKey: 'waning-crescent', phaseLabel: 'Убывающий серп', illumination: 4 },
      mercury: { sign: 'Leo', degree: 15, retrograde: false, motionLabel: 'прямой', speedLongitude: 1.1 },
      source: 'swisseph',
    } as const;
    jest.mocked(computeSkyToday).mockResolvedValue(sky);
    const res = response();

    await handler({ method: 'GET' } as NextApiRequest, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(sky);
  });

  it('returns null on Swiss failure so the app can stay open and hide the card', async () => {
    jest.mocked(computeSkyToday).mockRejectedValue(new Error('SWISS_DOWN'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();

    await handler({ method: 'GET' } as NextApiRequest, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ snapshot: null });
    consoleError.mockRestore();
  });
});
