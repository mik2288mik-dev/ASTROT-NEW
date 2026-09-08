jest.mock('../services/apiClient', () => ({ apiFetch: jest.fn() }));
import { apiFetch } from '../services/apiClient';
import { invalidateHomeCards, loadHomeCards } from '../services/homeCardsService';
import { homeCardFixture } from './fixtures/homeCard';
const mockedFetch = apiFetch as jest.Mock;
const input = { userId: 'anna', isPremium: false, locale: 'ru' as const };
const response = (id = 1, nextChangeAt: string | null = null) => ({ ok: true, json: async () => ({ cards: [{ ...homeCardFixture(), id }], nextChangeAt }) });

describe('home cards client cache', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-08T12:00:00Z')); mockedFetch.mockReset(); invalidateHomeCards(); });
  afterEach(() => jest.useRealTimers());
  it('coalesces requests and caches for at most 30 seconds', async () => {
    mockedFetch.mockResolvedValue(response());
    await Promise.all([loadHomeCards(input), loadHomeCards(input)]);
    await loadHomeCards(input); expect(mockedFetch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30_000); await loadHomeCards(input); expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
  it('refreshes at a scheduled change even before the normal TTL', async () => {
    mockedFetch.mockResolvedValue(response(1, '2026-09-08T12:00:05Z'));
    const first = await loadHomeCards(input);
    expect(first.expiresAt).toBe(Date.parse('2026-09-08T12:00:05Z'));
    jest.advanceTimersByTime(5_000); await loadHomeCards(input); expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
  it('separates account, language, and entitlement cache identities', async () => {
    mockedFetch.mockResolvedValue(response());
    await loadHomeCards(input); await loadHomeCards({ ...input, userId: 'max' });
    await loadHomeCards({ ...input, isPremium: true }); await loadHomeCards({ ...input, locale: 'en' });
    expect(mockedFetch).toHaveBeenCalledTimes(4);
  });
  it('invalidates cached publication immediately', async () => {
    mockedFetch.mockResolvedValueOnce(response(1)).mockResolvedValueOnce(response(2));
    expect((await loadHomeCards(input)).cards[0].id).toBe(1);
    invalidateHomeCards();
    expect((await loadHomeCards(input)).cards[0].id).toBe(2);
  });
  it('does not restore an older in-flight response after publication changes', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    mockedFetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(response(2));
    const old = loadHomeCards(input);
    invalidateHomeCards();
    finish(response(1));
    expect((await old).cards[0].id).toBe(2);
  });
  it('does not serve expired content when the request fails', async () => {
    mockedFetch.mockResolvedValueOnce(response(1)).mockResolvedValueOnce({ ok: false });
    await loadHomeCards(input); jest.advanceTimersByTime(30_000);
    await expect(loadHomeCards(input)).rejects.toThrow();
  });
});
