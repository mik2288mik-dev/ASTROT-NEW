jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: jest.fn(async () => ({ userId: 'reader' })) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: jest.fn(async () => ({ isPremium: true })) }));
jest.mock('../lib/stories/catalog', () => ({ findManagedSeries: jest.fn(async () => ({ id: 'quiet-lane' })) }));
jest.mock('../lib/stories/repository', () => ({
  moscowDayKey: () => '2026-10-11', listEpisodes: jest.fn(), readUnlocks: jest.fn(async () => []), addFreeUnlock: jest.fn(async () => true),
}));
import handler from '../pages/api/stories/[seriesId]/[number]';
import { listEpisodes } from '../lib/stories/repository';
import { getPremiumEntitlementState } from '../lib/contentArchitecture';
import type { NextApiRequest, NextApiResponse } from 'next';

const body = 'Полный текст рассказа, который читается и без картинок.';
const scenes = [{ id: 'first', kind: 'video', anchor: 'Полный текст рассказа', src: '/video/stories/quiet-envelope.mp4', poster: '/assets/stories/scenes/quiet-envelope.webp', alt: 'Конверт', side: 'right' }];
async function request(query: Record<string, string>, method = 'GET') {
  let status = 0; let payload: any;
  const res = { setHeader: jest.fn(), status: (code: number) => { status = code; return res; }, json: (value: unknown) => { payload = value; return res; } };
  await handler({ method, query: { seriesId: 'quiet-lane', number: '4', ...query } } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return { status, payload };
}
beforeEach(() => {
  jest.mocked(getPremiumEntitlementState).mockResolvedValue({ isPremium: true } as any);
  jest.mocked(listEpisodes).mockResolvedValue([1, 2, 3, 4].map((number) => ({ seriesId: 'quiet-lane', number, releaseDate: '2026-10-10', status: 'ready', title: 'Конверт', body, scenes })) as any);
});
it('returns exactly the old text contract unless the client opts in', async () => {
  const legacy = await request({}); const modern = await request({ scenes: '1' });
  expect(legacy.status).toBe(200);
  expect(legacy.payload).toEqual({ seriesId: 'quiet-lane', number: 4, title: 'Конверт', text: body, releaseDate: '2026-10-10', next: null, nextReleaseTomorrow: false });
  expect(modern.payload).toEqual({ ...legacy.payload, scenes });
  expect((await request({ scenes: '1' }, 'POST')).payload.text).toBe(body);
});
it('keeps media behind the same release and entitlement gates as the text', async () => {
  expect((await request({ number: '5', scenes: '1' })).status).toBe(404);
  jest.mocked(getPremiumEntitlementState).mockResolvedValue({ isPremium: false } as any);
  const locked = await request({ scenes: '1' });
  expect(locked.status).toBe(403);
  expect(locked.payload).not.toHaveProperty('text'); expect(locked.payload).not.toHaveProperty('scenes');
});
