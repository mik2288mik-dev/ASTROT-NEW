import samples from '../components/ui-preview/readingSamples.json';
import { getPersonalForecastPackageValidationError, type PersonalForecastPackage } from '../lib/personalForecastContract';
it('all three people have complete day, week and month readings in the current contract',()=>{
  expect(samples.people).toHaveLength(3);
  for(const person of samples.people) for(const period of ['day','week','month'] as const) {
    const reading=person.forecasts[period] as unknown as PersonalForecastPackage;
    expect(getPersonalForecastPackageValidationError(reading)).toBeNull();
    expect(reading.sections).toEqual([]);
    expect(reading.overview.text.trim()).not.toBe('');
  }
});
