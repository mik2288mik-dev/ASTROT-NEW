import fs from 'fs';
import path from 'path';
import {
  birthProfileIdentityMatches,
  trustedBirthContext,
} from '../lib/birthProfileIdentity';

const current = {
  birthDate: '1991-06-12',
  birthTime: '08:45:00',
  birthTimeMode: 'approximate',
  birthTimeUncertaintyMinutes: 30,
  birthPlace: 'Москва,  Россия',
};

describe('birth profile identity', () => {
  it('matches equivalent database/client formats but rejects changed natal input', () => {
    const same = {
      birthDate: '1991-06-12',
      birthTime: '08:45',
      birthTimeMode: 'approximate',
      birthTimeUncertaintyMinutes: 30,
      birthPlace: 'Москва, Россия',
    };
    expect(birthProfileIdentityMatches(current, same)).toBe(true);
    expect(birthProfileIdentityMatches(current, { ...same, birthDate: '1991-06-13' })).toBe(false);
    expect(birthProfileIdentityMatches(current, { ...same, birthTime: '09:45' })).toBe(false);
    expect(birthProfileIdentityMatches(current, { ...same, birthTimeMode: 'exact' })).toBe(false);
    expect(birthProfileIdentityMatches(current, { ...same, birthPlace: 'Казань, Россия' })).toBe(false);
  });

  it('does not return stale coordinates after a changed place and failed calculation', () => {
    const oldChartContext = {
      birthDate: '1991-06-12',
      birthTime: '08:45',
      birthTimeMode: 'approximate',
      birthTimeUncertaintyMinutes: 30,
      birthPlace: 'Санкт-Петербург, Россия',
      latitude: 59.9386,
      longitude: 30.3141,
      timezone: 'Europe/Moscow',
    };
    expect(trustedBirthContext(current, oldChartContext)).toBeNull();
  });

  it('hydrates profile coordinates only from an identity-matching primary chart', () => {
    const db = fs.readFileSync(path.join(path.resolve(__dirname, '..'), 'lib/db.ts'), 'utf8');
    expect(db).toContain('const trustedPrimaryChart = trustedBirthContext');
    expect(db).toContain("'birth_time_mode', nc.birth_time_mode");
    expect(db).toContain('birth_timezone: trustedPrimaryChart?.timezone');
    expect(db).toContain('const legacyUserBirthContext = hasPrimaryChart ? null : u');
  });
});
