import { createPersonalForecastTrace } from '../lib/personalForecastTrace';

describe('personal forecast trace privacy', () => {
  const originalMode = process.env.PERSONAL_FORECAST_TRACE;

  afterEach(() => {
    process.env.PERSONAL_FORECAST_TRACE = originalMode;
    jest.restoreAllMocks();
  });

  it('keeps only hashes and strips raw profile data from metadata events', () => {
    process.env.PERSONAL_FORECAST_TRACE = 'metadata';
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const trace = createPersonalForecastTrace({
      userId: 'user-secret', profileFingerprint: 'profile-secret', period: 'day',
      periodKey: '2026-08-22', model: 'gpt-5.6-luna', versions: {
        prompt_version: 'v1', cache_version: 'v2',
      },
    });
    trace.emit('writer_requested', {
      name: 'Ирина', birth_date: '1990-01-01', birth_time: '12:30',
      birth_place: 'Москва', birth_timezone: 'Europe/Moscow',
      personal_profile: { name: 'Ирина' }, raw_profile: { gender: 'female' },
      session_token: 'session-secret', api_key: 'key-secret', provider_budget: 1200,
    });

    const serialized = JSON.stringify(trace.events);
    for (const secret of ['Ирина', '1990-01-01', '12:30', 'Москва', 'Europe/Moscow', 'session-secret', 'key-secret']) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain('profile_fingerprint_hash');
    expect(serialized).toContain('prompt_version');
    expect(serialized).toContain('cache_version');
    expect(serialized).toContain('provider_budget');
    expect(info).toHaveBeenCalled();
  });
});
