import { toPublicAppProfile } from '../lib/auth/profile';

describe('public app profile birth context', () => {
  it('preserves timezone, coordinates and birth-time quality after session restore', () => {
    expect(toPublicAppProfile({
      id: '42',
      name: 'Mira',
      birth_date: '1990-01-01',
      birth_time: '12:00',
      birth_time_mode: 'approximate',
      birth_time_uncertainty_minutes: 30,
      birth_place: 'Moscow',
      birth_timezone: 'Europe/Moscow',
      latitude: '55.7558',
      longitude: 37.6173,
      gender: 'female',
      is_setup: true,
      language: 'ru',
      theme: 'light',
    }, {
      userId: '42', provider: 'native', isGuest: false,
    } as never)).toMatchObject({
      birthTimeMode: 'approximate',
      birthTimeUncertaintyMinutes: 30,
      birthTimezone: 'Europe/Moscow',
      birthLatitude: 55.7558,
      birthLongitude: 37.6173,
      gender: 'female',
    });
  });
});
