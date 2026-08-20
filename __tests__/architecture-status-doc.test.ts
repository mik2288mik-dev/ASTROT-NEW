import fs from 'fs';
import path from 'path';

describe('current architecture documentation', () => {
  it('documents the canonical Lumia layers without legacy endpoint guidance', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'docs/CURRENT_ARCHITECTURE.md'), 'utf8');

    expect(content).toContain('saved-natal fingerprint');
    expect(content).toContain('hash of sanitized profile fields');
    expect(content).toContain('15 recent fragments for the same user and chart');
    expect(content).toContain('PersonalForecastPackage` end to end');
    expect(content).toContain('checks the server cache with `GET`, then starts generation with `POST`');
    expect(content).toContain('Legacy `aiPersonalHoroscope*` fields remain inactive');
    expect(content).not.toContain('/api/astrology/daily-horoscope');
  });
});
