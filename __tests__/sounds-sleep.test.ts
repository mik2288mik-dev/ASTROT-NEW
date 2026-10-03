import fs from 'fs';
import path from 'path';
import { SLEEP_STORIES } from '../lib/sleepStories';
import { estimateSpeechSeconds, splitForSpeech } from '../lib/tts/openaiSpeech';
import { MUSIC_PIECES, noiseBuffer, SOUNDSCAPES } from '../lib/soundscapes/synth';

const mockUser = jest.fn();
const mockEntitlement = jest.fn();
const mockEnsureAudio = jest.fn();
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockUser(...args) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: (...args: unknown[]) => mockEntitlement(...args) }));
jest.mock('../lib/tts/ttsStore', () => ({ ensureAudio: (...args: unknown[]) => mockEnsureAudio(...args), readStoredAudio: jest.fn() }));
import listen from '../pages/api/audio/listen';

function response() {
  const res: any = { setHeader: jest.fn() };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('sounds and sleep stories', () => {
  it('has five calm sounds and three music pieces made in code', () => {
    expect(SOUNDSCAPES).toEqual(['rain', 'cafe', 'forest', 'sea', 'fire']);
    expect(MUSIC_PIECES).toHaveLength(3);
    const ctx = {
      sampleRate: 8000,
      createBuffer: (channels: number, length: number) => ({ getChannelData: () => new Float32Array(length), numberOfChannels: channels }),
    } as unknown as BaseAudioContext;
    expect(noiseBuffer(ctx, 'pink')).toBe(noiseBuffer(ctx, 'pink'));
    expect(fs.readFileSync(path.join(__dirname, '..', 'public/audio/LICENSES.md'), 'utf8')).toContain('Own work');
  });

  it('ships stories of 5–15 minutes, different voices, plain words', () => {
    expect(new Set(SLEEP_STORIES.map((story) => story.voice)).size).toBe(SLEEP_STORIES.length);
    expect(SLEEP_STORIES.filter((story) => story.free)).toHaveLength(1);
    for (const story of SLEEP_STORIES) {
      for (const language of ['ru', 'en'] as const) {
        const minutes = estimateSpeechSeconds(story.text[language], 'sleep') / 60;
        expect(minutes).toBeGreaterThanOrEqual(5);
        expect(minutes).toBeLessThanOrEqual(15);
        expect(splitForSpeech(story.text[language]).length).toBeGreaterThanOrEqual(1);
      }
      expect(story.text.ru).not.toMatch(/\p{Extended_Pictographic}|энерги|вселенн|космос|судьб/iu);
    }
  });

  beforeEach(() => {
    mockUser.mockReset().mockResolvedValue({ userId: 'u1' });
    mockEntitlement.mockReset().mockResolvedValue({ isPremium: false });
    mockEnsureAudio.mockReset().mockResolvedValue({ id: 'b'.repeat(64), durationSec: 420, cached: true });
  });

  it('voices the free story for everyone once, without expiry, and locks the rest', async () => {
    const free = response();
    await listen({ method: 'POST', body: { source: { type: 'sleep_story', id: 'sea-house', language: 'ru' } }, headers: {} } as any, free);
    expect(free.status).toHaveBeenCalledWith(200);
    expect(mockEnsureAudio).toHaveBeenCalledWith(expect.objectContaining({ voice: 'sage', style: 'sleep', ttlDays: null }));

    const locked = response();
    await listen({ method: 'POST', body: { source: { type: 'sleep_story', id: 'night-train', language: 'ru' } }, headers: {} } as any, locked);
    expect(locked.status).toHaveBeenCalledWith(403);

    const unknown = response();
    await listen({ method: 'POST', body: { source: { type: 'sleep_story', id: 'any text' } }, headers: {} } as any, unknown);
    expect(unknown.status).toHaveBeenCalledWith(400);
  });
});
