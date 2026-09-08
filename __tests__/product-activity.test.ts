import { creditedActivityMs, foregroundIntervalMs, sanitizeActivityPulse, type ActivityPulse } from '../lib/productActivity';
import { sanitizeUserAppEvent } from '../lib/premiumAnalytics';

const pulse: ActivityPulse = { sessionId: '018f1234-5678-4abc-8def-0123456789ab',
  eventId: '018f1234-5678-4abc-8def-0123456789ac', sequence: 1, totalActiveMs: 30_000,
  screen: 'dashboard', state: 'active' };
describe('measured activity and privacy', () => {
  it('credits only foreground time up to the idle threshold, never a suspended timer gap', () => {
    expect(foregroundIntervalMs(0, 30_000, 0, true)).toBe(30_000);
    expect(foregroundIntervalMs(0, 30_000, 0, false)).toBe(0);
    expect(foregroundIntervalMs(110_000, 140_000, 0, true)).toBe(10_000);
    expect(foregroundIntervalMs(150_000, 180_000, 0, true)).toBe(0);
    expect(foregroundIntervalMs(0, 3_600_000, 3_600_000, true)).toBe(45_000);
  });
  it('requires a server baseline and bounds cumulative client time by received wall time', () => {
    expect(creditedActivityMs(pulse, null, 30_000)).toBe(0);
    const previous = { sequence: 0, totalActiveMs: 0, receivedAt: 10_000 };
    expect(creditedActivityMs(pulse, previous, 25_000)).toBe(15_000);
    expect(creditedActivityMs({ ...pulse, totalActiveMs: 3600_000 }, previous, 3610_000)).toBe(45_000);
    expect(creditedActivityMs(pulse, { ...previous, sequence: 1 }, 40_000)).toBe(0);
    expect(creditedActivityMs(pulse, { ...previous, totalActiveMs: 40_000 }, 40_000)).toBe(0);
  });
  it('rejects invalid counters and identifiers; strips text and client identity', () => {
    expect(sanitizeActivityPulse({ ...pulse, userId: 'victim', password: 'secret', text: 'private' })).toEqual(pulse);
    expect(sanitizeActivityPulse({ ...pulse, totalActiveMs: -10 })).toBeNull();
    expect(sanitizeActivityPulse({ ...pulse, sequence: 1.5 })).toBeNull();
    expect(sanitizeActivityPulse({ ...pulse, sessionId: 'person@example.com' })).toBeNull();
    expect(sanitizeActivityPulse({ ...pulse, screen: 'private-question' })?.screen).toBeNull();
  });
  it('preserves safe session linkage and period actions without personal content', () => {
    expect(sanitizeUserAppEvent({ eventType: 'horoscope_opened', sessionId: pulse.sessionId, section: 'personal_forecast',
      source: 'app', eventPayload: { forecast_period: 'week', access_state: 'premium', forecastText: 'private', birthDate: '1990-01-01' } }))
      .toEqual({ eventType: 'horoscope_opened', sessionId: pulse.sessionId, section: 'personal_forecast', source: 'app',
        eventPayload: { forecast_period: 'week', access_state: 'premium' } });
    expect(sanitizeUserAppEvent({ eventType: 'forecast_period_selected', eventPayload: { forecast_period: 'private-text' } })?.eventPayload).toEqual({});
  });
});
