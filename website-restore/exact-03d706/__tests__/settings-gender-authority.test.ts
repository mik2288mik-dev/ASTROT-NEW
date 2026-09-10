import fs from 'fs';
import path from 'path';
import type { UserProfile } from '../types';
import { saveServerAuthoritativeGender } from '../lib/settingsGender';

const ROOT = path.resolve(__dirname, '..');

const profile: UserProfile = {
  id: '42',
  name: 'Анна',
  gender: 'female',
  birthDate: '1991-06-12',
  birthTime: '08:45',
  birthPlace: 'Москва',
  isSetup: true,
  language: 'ru',
  theme: 'light',
  isPremium: false,
};

describe('server-authoritative gender setting', () => {
  it('persists before applying the new value', async () => {
    const order: string[] = [];
    await saveServerAuthoritativeGender(
      profile,
      'male',
      async (updated) => { order.push(`save:${updated.gender}`); },
      (updated) => { order.push(`apply:${updated.gender}`); },
    );
    expect(order).toEqual(['save:male', 'apply:male']);
  });

  it('leaves the visible server value untouched when persistence fails', async () => {
    const apply = jest.fn();
    await expect(saveServerAuthoritativeGender(
      profile,
      'male',
      async () => { throw new Error('offline'); },
      apply,
    )).rejects.toThrow('offline');
    expect(apply).not.toHaveBeenCalled();
    expect(profile.gender).toBe('female');
  });

  it('does not restore or upload a stale per-device localStorage value', () => {
    const settings = fs.readFileSync(path.join(ROOT, 'views/Settings.tsx'), 'utf8');
    const genderFlow = settings.slice(
      settings.indexOf('const handleGenderChange'),
      settings.indexOf('const handleSaveProfile'),
    );
    expect(settings).not.toContain('lumia.gender.');
    expect(genderFlow).not.toContain('localStorage');
    expect(genderFlow).toContain('setGenderSaveError');
  });
});
