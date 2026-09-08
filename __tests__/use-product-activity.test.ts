const effects: Array<() => void | (() => void)> = [];
const mockApiFetch = jest.fn();
const mockEvent = jest.fn();
const mockSetSession = jest.fn();
jest.mock('react', () => ({ useEffect: (effect: () => void) => effects.push(effect), useRef: (value: unknown) => ({ current: value }) }));
jest.mock('../services/apiClient', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}),
  recordUserAppEvent: (...args: unknown[]) => mockEvent(...args),
  setProductActivitySessionId: (...args: unknown[]) => mockSetSession(...args) }));
import { useProductActivity } from '../services/useProductActivity';

describe('foreground activity lifecycle', () => {
  let win: EventTarget & Record<string, any>;
  let doc: EventTarget & Record<string, any>;
  let cleanup: (() => void) | undefined;
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  const pulses = () => mockApiFetch.mock.calls.map(([, init]) => JSON.parse(init.body));
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); effects.length = 0;
    win = Object.assign(new EventTarget(), { setInterval, clearInterval });
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
    mockApiFetch.mockResolvedValue({ ok: true });
    useProductActivity({ enabled: true, accountKey: '42', screen: 'dashboard' });
    cleanup = effects[0]() as () => void;
  });
  afterEach(() => {
    cleanup?.(); jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window'); Reflect.deleteProperty(globalThis, 'document');
  });
  it('flushes pagehide through authenticated keepalive and excludes all hidden time on resume', async () => {
    await settle(); jest.advanceTimersByTime(30_000); await settle();
    expect(pulses().at(-1).totalActiveMs).toBe(30_000);
    jest.advanceTimersByTime(5000);
    win.dispatchEvent(new Event('pagehide')); await settle();
    expect(pulses().at(-1)).toMatchObject({ state: 'closed', totalActiveMs: 35_000 });
    expect(mockApiFetch.mock.calls.at(-1)[1].keepalive).toBe(true);
    jest.advanceTimersByTime(300_000); await settle();
    win.dispatchEvent(new Event('pageshow')); await settle();
    expect(pulses().at(-1).totalActiveMs).toBe(35_000);
  });
  it('stops credit after two minutes without input and resumes after interaction', async () => {
    await settle();
    for (let i=0; i<6; i++) { jest.advanceTimersByTime(30_000); await settle(); }
    expect(pulses().at(-1).totalActiveMs).toBe(120_000);
    win.dispatchEvent(new Event('pointerdown'));
    jest.advanceTimersByTime(30_000); await settle();
    expect(pulses().at(-1).totalActiveMs).toBe(150_000);
  });
  it('starts a new visit after thirty hidden minutes and clears identity linkage on cleanup', async () => {
    await settle(); const initial = pulses()[0].sessionId;
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); await settle();
    jest.advanceTimersByTime(31 * 60_000);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); await settle();
    expect(pulses().at(-1).sessionId).not.toBe(initial);
    expect(pulses().at(-1).totalActiveMs).toBe(0);
    const count = mockApiFetch.mock.calls.length;
    cleanup?.(); cleanup = undefined;
    expect(mockSetSession).toHaveBeenLastCalledWith(null);
    jest.advanceTimersByTime(60_000); await settle();
    expect(mockApiFetch).toHaveBeenCalledTimes(count);
  });
});
