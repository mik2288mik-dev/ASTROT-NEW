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
// Internet Archive originals: detects a truncated download or accidental re-encoding.
const SOURCE_MD5: Record<string, string> = {
  'librivox-steppe': '50c1abb3f8cbd6103ac8b8bc4b47dc39',
  'librivox-wonder-teapot': '6a1dc22f964788566384d3c3f3a20483',
  'librivox-japanese-children': 'd242762ac0585eb1abd743885c9b0a96',
  'librivox-frost-sun-wind': '4937f5ecf764e4a1bded5178553d6a69',
  'librivox-frog-princess': '8c6625c5c5e1e1b90efef1a4c4273e3d',
  'librivox-may-night': '4cad9e85943d5c93b88a4295dd24424b',
  'librivox-mouse-house': '67b3de02051de9ef0ba9085df603694c',
  'librivox-ivan-the-fool': '1ffc0ebf04cce83c27cce0625fd956bd',
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

  it('keeps the eight original recordings private and reuses existing covers', () => {
    expect(RECORDED_SLEEP_STORIES).toHaveLength(8);
    expect(RECORDED_SLEEP_STORIES.filter((story) => story.free).map((story) => story.id)).toEqual([
      'librivox-steppe', 'librivox-frost-sun-wind', 'librivox-frog-princess', 'librivox-mouse-house',
    ]);
    const licenses = fs.readFileSync(path.join(root, 'public/audio/LICENSES.md'), 'utf8');
    for (const story of RECORDED_SLEEP_STORIES) {
      const name = `${story.id}.mp3`;
      const bytes = fs.readFileSync(path.join(root, 'server-assets/audio/stories', name));
      expect(crypto.createHash('md5').update(bytes).digest('hex')).toBe(SOURCE_MD5[story.id]);
      expect(fs.existsSync(path.join(root, 'public/audio/library', name))).toBe(false);
      expect(fs.existsSync(path.join(root, 'public', videoBackgroundPoster(story.video)))).toBe(true);
      expect(fs.existsSync(path.join(root, 'public/video/library', `${story.video}.mp4`))).toBe(true);
      expect(licenses).toContain(name);
    }
    expect(recordedStoryDuration(617.69)).toBe('10:18');
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

  it('serves a granted recording with seeking and HEAD support', async () => {
    const story = RECORDED_SLEEP_STORIES[1];
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
