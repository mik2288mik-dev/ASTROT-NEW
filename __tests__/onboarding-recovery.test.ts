import { savedPrimaryNatalMatchesProfile } from '../lib/onboardingRecovery';
import samples from './fixtures/readingSamples.json';

const chart = samples.people[0].chart;
const profile = {
  birth_date: '1990-03-14',
  birth_place: 'Москва, Россия',
  birth_time: '09:41:00',
  birth_time_mode: 'exact',
};
const saved = { input_hash: 'saved-chart', chart_data: chart };

describe('recover onboarding without waiting for the natal writer', () => {
  it('recognizes a complete matching saved primary chart', () => {
    expect(savedPrimaryNatalMatchesProfile(profile, saved)).toBe(true);
  });

  it('does not complete onboarding with a stale date, place, or time', () => {
    expect(savedPrimaryNatalMatchesProfile({ ...profile, birth_date: '1990-03-15' }, saved)).toBe(false);
    expect(savedPrimaryNatalMatchesProfile({ ...profile, birth_place: 'Санкт-Петербург' }, saved)).toBe(false);
    expect(savedPrimaryNatalMatchesProfile({ ...profile, birth_time: '10:41' }, saved)).toBe(false);
  });

  it('does not recover if there is no canonical chart or input hash', () => {
    expect(savedPrimaryNatalMatchesProfile(profile, null)).toBe(false);
    expect(savedPrimaryNatalMatchesProfile(profile, { ...saved, input_hash: '' })).toBe(false);
    expect(savedPrimaryNatalMatchesProfile(profile, { ...saved, chart_data: {} })).toBe(false);
  });
});
