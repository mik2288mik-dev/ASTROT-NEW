class MemoryCache {
  entries = new Map<string, Response>();
  async keys(): Promise<Request[]> { return [...this.entries.keys()].map((url) => new Request(url)); }
  async match(key: string | Request): Promise<Response | undefined> { return this.entries.get(typeof key === 'string' ? key : key.url)?.clone(); }
  async put(url: string, response: Response): Promise<void> { this.entries.set(url, response.clone()); }
  async delete(key: string | Request): Promise<boolean> { return this.entries.delete(typeof key === 'string' ? key : key.url); }
}

const origin = 'https://nebo.test/api/audio/library/';
const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise<void>((resolve) => setImmediate(resolve)); };

describe('ambient recording cache', () => {
  let stores: Map<string, MemoryCache>;
  let playable: typeof import('../services/ambientAudioCache').playableAudioSource;
  let originalCaches: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.resetModules();
    stores = new Map();
    originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: {
      keys: async () => [...stores.keys()],
      open: jest.fn(async (name: string) => {
        if (!stores.has(name)) stores.set(name, new MemoryCache());
        return stores.get(name);
      }),
    } });
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('complete audio', { status: 200 }));
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cached-audio');
    playable = require('../services/ambientAudioCache').playableAudioSource;
  });

  afterEach(async () => {
    await settle();
    if (originalCaches) Object.defineProperty(globalThis, 'caches', originalCaches);
    else Reflect.deleteProperty(globalThis, 'caches');
    jest.restoreAllMocks();
  });

  it('streams on the first request and reuses the complete offline copy afterwards', async () => {
    const url = `${origin}rain-roof-hq-v2.mp3`;
    expect(await playable(url, true)).toBe(url);
    await settle();
    expect(await playable(url, true)).toBe('blob:cached-audio');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(stores.get('nebo-ambient-hq-v2')?.entries.get(url)?.headers.get('Content-Length')).toBe('14');
  });

  it('removes old ambient copies while preserving downloaded music and unrelated caches', async () => {
    const old = new MemoryCache();
    await old.put(`${origin}rain-roof.mp3`, new Response('old rain'));
    await old.put(`${origin}music-satie-gymnopedie-1.mp3`, new Response('saved music'));
    stores.set('nebo-sounds-v1', old);
    stores.set('another-feature', new MemoryCache());
    expect(await playable(`${origin}music-satie-gymnopedie-1.mp3`, false)).toBe('blob:cached-audio');
    expect(old.entries.has(`${origin}rain-roof.mp3`)).toBe(false);
    expect(old.entries.has(`${origin}music-satie-gymnopedie-1.mp3`)).toBe(true);
    expect(stores.has('another-feature')).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains at most eight recordings when several downloads complete together', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => playable(`${origin}recording-${i}.mp3`, true)));
    await settle();
    const cache = stores.get('nebo-ambient-hq-v2')!;
    expect(cache.entries.size).toBe(8);
    expect(cache.entries.has(`${origin}recording-0.mp3`)).toBe(false);
    expect(cache.entries.has(`${origin}recording-9.mp3`)).toBe(true);
  });

  it('evicts older recordings when their total size exceeds 64 MiB', async () => {
    const cache = new MemoryCache();
    for (let i = 0; i < 2; i += 1) {
      await cache.put(`${origin}older-${i}.mp3`, new Response('audio', { headers: { 'Content-Length': String(40 * 1024 * 1024) } }));
    }
    stores.set('nebo-ambient-hq-v2', cache);
    await playable(`${origin}rain-roof-hq-v2.mp3`, true);
    await settle();
    expect(cache.entries.has(`${origin}older-0.mp3`)).toBe(false);
    expect(cache.entries.has(`${origin}older-1.mp3`)).toBe(true);
    expect(cache.entries.size).toBe(2);
  });

  it.each([206, 503])('does not save a partial or failed response (%s)', async (status) => {
    jest.mocked(fetch).mockResolvedValue(new Response('incomplete', { status }));
    await playable(`${origin}rain-roof-hq-v2.mp3`, true);
    await settle();
    expect(stores.get('nebo-ambient-hq-v2')?.entries.size).toBe(0);
  });

  it('streams when Cache API access is blocked', async () => {
    jest.mocked(caches.open).mockRejectedValue(new Error('Storage denied'));
    const url = `${origin}rain-roof-hq-v2.mp3`;
    expect(await playable(url, true)).toBe(url);
  });

  it('keeps playback usable when saving fails because storage is full', async () => {
    const cache = new MemoryCache();
    jest.spyOn(cache, 'put').mockRejectedValue(new Error('Quota exceeded'));
    stores.set('nebo-ambient-hq-v2', cache);
    const url = `${origin}rain-roof-hq-v2.mp3`;
    expect(await playable(url, true)).toBe(url);
    await settle();
    expect(cache.entries.size).toBe(0);
  });
});
