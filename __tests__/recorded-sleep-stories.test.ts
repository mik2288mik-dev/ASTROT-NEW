import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { RECORDED_SLEEP_STORIES, recordedStoryDuration } from '../lib/recordedSleepStories';
import { recordedStoryTicket } from '../lib/tts/recordedStoryAudio';
import { videoBackgroundPoster } from '../lib/videoBackgrounds';

const mockUser = jest.fn();
const mockEntitlement = jest.fn();
const mockEnsureAudio = jest.fn();
const mockReadAudio = jest.fn();
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockUser(...args) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: (...args: unknown[]) => mockEntitlement(...args) }));
jest.mock('../lib/tts/ttsStore', () => ({ ensureAudio: (...args: unknown[]) => mockEnsureAudio(...args), readStoredAudio: (...args: unknown[]) => mockReadAudio(...args) }));
import listen from '../pages/api/audio/listen';
import audioFile from '../pages/api/audio/file/[id]';
import publicLibrary from '../pages/api/audio/library/[name]';

const root = path.join(__dirname, '..');
// Edited recording integrity: protects the reviewed title and story boundaries.
const EDITED_SHA256: Record<string, string> = {
  'librivox-forest-steppe': 'dfde65b93420984944127720a806076141f2207708bbf9fdb1feb5262909c915',
  'librivox-ivan-marfa': '3d7a8cd9db80c7138383321148a8bc67814a7ed2833ca550a829b6eb5cbb15ed',
  'librivox-rejuvenating-apples': '6c1a2804509d64d85ca74dc2d927ac444c7915a827e656cbdd3c543881d81300',
  'librivox-young-lady-peasant': 'a7248229cb680359306814234006085fcf7d3fc59b69e92e057902c6fd2ee92f',
  'librivox-katigoroshek': '69aa1eb703f7c30cee3fec2b44d058b08c22b431af4f81e50d3714a747715166',
  'librivox-bezhin-meadow': '583a531d38559b4fd19bf795f50115862b1d19cf59432c4bd24ba5df0df2caa4',
  'librivox-koschei': '94cda5f85b277e5301342945809598cd32b959115a98f8827257f5ce9a5ff099',
  'librivox-blizzard': '77faa72314a402a8a8da4a714dd380db45ee29dc7a1b54216b9dd079720c7cbe',
  'librivox-frog-princess': 'fbb2b95d8647a5e51f2877976375ef23a0b3d5e42ed77839bf00ca8d393ab0cc',
  'librivox-ivan-the-fool': '178e223f5f848a1b75c645746b9fd6f8d61d82a8f6ec815e9c614d920778a7ce',
  'librivox-japanese-children': '55f1218cf3971af84dfceb5081974ebe408c5b0148c72ecd88425d9c70d146f3',
  'librivox-mouse-house': 'a8a9965a5cd5388996d3cbb6f9b9ec36bda9295c9f9665828e620356a4eecd56',
  'librivox-steppe': '958dc234a57f15e2fc75a7c6bcba87a8d7de08f1e37381e31bc70aec29309bfc',
  'librivox-wonder-teapot': '47a639198fe38850333b64923bfe9cb5ed0577f5a964a336408f19eca878e296',
};

function response() {
  const res: any = { headers: {} as Record<string, string> };
  res.setHeader = jest.fn((key: string, value: string) => { res.headers[key] = value; });
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

describe('ready narrated stories', () => {
  beforeEach(() => {
    mockUser.mockReset().mockResolvedValue({ userId: 'u1' });
    mockEntitlement.mockReset().mockResolvedValue({ isPremium: false });
    mockEnsureAudio.mockReset();
    mockReadAudio.mockReset().mockResolvedValue(null);
  });

  it('keeps the fourteen reviewed recordings private and reuses existing covers', () => {
    expect(RECORDED_SLEEP_STORIES).toHaveLength(14);
    expect(RECORDED_SLEEP_STORIES.filter((story) => story.free).map((story) => story.id)).toEqual([
      'librivox-steppe', 'librivox-frog-princess', 'librivox-mouse-house',
    ]);
    const licenses = fs.readFileSync(path.join(root, 'public/audio/LICENSES.md'), 'utf8');
    for (const story of RECORDED_SLEEP_STORIES) {
      const name = `${story.id}.mp3`;
      const bytes = fs.readFileSync(path.join(root, 'server-assets/audio/stories', name));
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(EDITED_SHA256[story.id]);
      expect(fs.existsSync(path.join(root, 'public/audio/library', name))).toBe(false);
      expect(fs.existsSync(path.join(root, 'public', videoBackgroundPoster(story.video)))).toBe(true);
      expect(fs.existsSync(path.join(root, 'public/video/library', `${story.video}.mp4`))).toBe(true);
      expect(licenses).toContain(name);
    }
    expect(recordedStoryDuration(585.273)).toBe('9:45');
  });

  it.each(['librivox-frost-sun-wind', 'librivox-may-night'])('removes %s from the catalogue, assets and playback', async (id) => {
    expect(RECORDED_SLEEP_STORIES.some((story) => story.id === id)).toBe(false);
    expect(fs.existsSync(path.join(root, 'server-assets/audio/stories', `${id}.mp3`))).toBe(false);
    const res = response();
    await listen({ method: 'POST', body: { source: { type: 'sleep_story', id, language: 'ru' } }, headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: 'LISTEN_SOURCE_INVALID' });
    expect(mockEnsureAudio).not.toHaveBeenCalled();
  });

  it.each(RECORDED_SLEEP_STORIES)('checks free-account access to $title.ru without generating speech', async (story) => {
    const res = response();
    await listen({ method: 'POST', body: { source: { type: 'sleep_story', id: story.id, language: 'ru' } }, headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(story.free ? 200 : 403);
    if (story.free) expect(res.json).toHaveBeenCalledWith({ audioId: expect.stringMatching(/^[a-f0-9]{64}$/u), durationSec: story.durationSec, cached: true });
    else expect(res.json).toHaveBeenCalledWith({ code: 'LISTEN_PREMIUM_REQUIRED' });
    expect(mockEnsureAudio).not.toHaveBeenCalled();
  });

  it.each(RECORDED_SLEEP_STORIES.filter((story) => !story.free))('lets Premium play $title.ru with no TTS in either UI language', async (story) => {
    mockEntitlement.mockResolvedValue({ isPremium: true });
    const res = response();
    await listen({ method: 'POST', body: { source: { type: 'sleep_story', id: story.id, language: 'en' } }, headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ audioId: expect.stringMatching(/^[a-f0-9]{64}$/u), durationSec: story.durationSec, cached: true });
    expect(mockEnsureAudio).not.toHaveBeenCalled();
  });

  it.each([
    RECORDED_SLEEP_STORIES[1],
    RECORDED_SLEEP_STORIES.find((story) => story.id === 'librivox-bezhin-meadow')!,
  ])('serves $title.ru with seeking and HEAD support', async (story) => {
    const ticket = await recordedStoryTicket(story);
    const expected = fs.readFileSync(path.join(root, 'server-assets/audio/stories', `${story.id}.mp3`));
    const res = response();
    await audioFile({ method: 'GET', query: { id: `${ticket.id}.mp3` }, headers: { range: 'bytes=100-199' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.headers['Content-Range']).toBe(`bytes 100-199/${expected.length}`);
    expect(res.end).toHaveBeenCalledWith(expected.subarray(100, 200));
    expect(mockReadAudio).not.toHaveBeenCalled();
    const head = response();
    await audioFile({ method: 'HEAD', query: { id: ticket.id }, headers: {} } as any, head);
    expect(head.status).toHaveBeenCalledWith(200);
    expect(head.headers['Content-Length']).toBe(String(expected.length));
    expect(head.end).toHaveBeenCalledWith();
  });

  it('does not expose Premium through a public filename or public source hash', async () => {
    const story = RECORDED_SLEEP_STORIES[1];
    const bytes = fs.readFileSync(path.join(root, 'server-assets/audio/stories', `${story.id}.mp3`));
    for (const id of [story.id, crypto.createHash('sha256').update(bytes).digest('hex')]) {
      const res = response();
      await audioFile({ method: 'GET', query: { id }, headers: {} } as any, res);
      expect(res.status).toHaveBeenCalledWith(404);
    }
    const res = response();
    await publicLibrary({ method: 'GET', query: { name: `${story.id}.mp3` }, headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('requires the production secret and changes bearer URLs when it rotates', async () => {
    const originalEnv = process.env;
    try {
      process.env = { ...originalEnv, NODE_ENV: 'production', APP_SESSION_SECRET: '' };
      await expect(recordedStoryTicket(RECORDED_SLEEP_STORIES[1])).rejects.toThrow('APP_SESSION_SECRET');
      process.env.APP_SESSION_SECRET = 'a'.repeat(32);
      const first = await recordedStoryTicket(RECORDED_SLEEP_STORIES[1]);
      process.env.APP_SESSION_SECRET = 'b'.repeat(32);
      const second = await recordedStoryTicket(RECORDED_SLEEP_STORIES[1]);
      expect(second.id).not.toBe(first.id);
    } finally {
      process.env = originalEnv;
    }
  });
});
