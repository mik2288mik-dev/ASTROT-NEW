const mockSource = jest.fn();
jest.mock('../services/ambientAudioCache', () => ({ playableAudioSource: (...args: unknown[]) => mockSource(...args) }));
import { getAmbientState, pauseAmbient, playMusic, playSoundscape, resumeAmbient, setAmbientTimer, stopAmbient } from '../services/ambientPlayer';

class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  src = ''; preload = ''; loop = false; volume = 0; currentTime = 0;
  play = jest.fn(async () => { this.dispatchEvent(new Event('playing')); });
  pause = jest.fn();
  load = jest.fn();
  removeAttribute = jest.fn((name: string) => { if (name === 'src') this.src = ''; });
  constructor() { super(); TestAudio.instances.push(this); }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('shared ambient playback controls', () => {
  let previousWindow: PropertyDescriptor | undefined;
  let previousAudio: PropertyDescriptor | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    previousAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'Audio', { configurable: true, value: TestAudio });
    TestAudio.instances = [];
    mockSource.mockReset().mockImplementation(async (url: string) => url);
    stopAmbient();
  });
  afterEach(async () => {
    stopAmbient();
    await flush();
    jest.runOnlyPendingTimers();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousAudio) Object.defineProperty(globalThis, 'Audio', previousAudio); else Reflect.deleteProperty(globalThis, 'Audio');
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('pauses and resumes sound plus music without recreating either voice or resetting its position', async () => {
    playSoundscape('rain-roof');
    playMusic('music-satie-gymnopedie-1');
    await flush();
    const [rain, music] = TestAudio.instances;
    rain.currentTime = 25;
    music.currentTime = 80;
    pauseAmbient();
    expect(getAmbientState().paused).toBe(true);
    expect(rain.pause).toHaveBeenCalled();
    expect(music.pause).toHaveBeenCalled();
    resumeAmbient();
    await flush();
    expect(getAmbientState().paused).toBe(false);
    expect(TestAudio.instances).toHaveLength(2);
    expect([rain.currentTime, music.currentTime]).toEqual([25, 80]);
    expect(rain.play).toHaveBeenCalledTimes(2);
    expect(music.play).toHaveBeenCalledTimes(2);
  });

  it('keeps a loading recording paused when its cached source arrives late', async () => {
    let resolveSource!: (url: string) => void;
    mockSource.mockReturnValue(new Promise<string>((resolve) => { resolveSource = resolve; }));
    playSoundscape('rain-roof');
    pauseAmbient();
    resolveSource('blob:rain');
    await flush();
    expect(TestAudio.instances[0].play).not.toHaveBeenCalled();
    expect(getAmbientState().paused).toBe(true);
    resumeAmbient();
    await flush();
    expect(TestAudio.instances[0].play).toHaveBeenCalledTimes(1);
  });

  it('does not restart a stopped recording when its source arrives late', async () => {
    let resolveSource!: (url: string) => void;
    mockSource.mockReturnValue(new Promise<string>((resolve) => { resolveSource = resolve; }));
    const revoke = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    playSoundscape('rain-roof');
    stopAmbient();
    resolveSource('blob:unused');
    await flush();
    expect(TestAudio.instances[0].play).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:unused');
    expect(getAmbientState().soundscape).toBeNull();
  });

  it('keeps the remaining music paused when only the sound is switched off', async () => {
    playSoundscape('rain-roof');
    playMusic('music-satie-gymnopedie-1');
    await flush();
    pauseAmbient();
    playSoundscape(null);
    expect(getAmbientState()).toMatchObject({ soundscape: null, music: 'music-satie-gymnopedie-1', paused: true });
    expect(TestAudio.instances[1].play).toHaveBeenCalledTimes(1);
  });

  it('resumes the existing sound when a new music selection starts the mix', async () => {
    playSoundscape('rain-roof');
    await flush();
    pauseAmbient();
    playMusic('music-satie-gymnopedie-1');
    await flush();
    expect(getAmbientState().paused).toBe(false);
    expect(TestAudio.instances[0].play).toHaveBeenCalledTimes(2);
  });

  it('ignores stale events from a stopped voice and clears both tracks and the timer', async () => {
    playSoundscape('rain-roof');
    playMusic('music-satie-gymnopedie-1');
    await flush();
    setAmbientTimer(5);
    stopAmbient();
    TestAudio.instances[0].dispatchEvent(new Event('waiting'));
    TestAudio.instances[1].dispatchEvent(new Event('error'));
    expect(getAmbientState()).toMatchObject({ soundscape: null, music: null, paused: false, loading: false, error: false, timerMinutes: null });
  });

  it('still turns off a paused mix when its sleep timer expires', async () => {
    playSoundscape('rain-roof');
    await flush();
    setAmbientTimer(1);
    pauseAmbient();
    jest.advanceTimersByTime(60_000);
    expect(getAmbientState().soundscape).toBeNull();
    expect(getAmbientState().endsAt).toBeNull();
  });
});
