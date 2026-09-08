import samples from '../components/ui-preview/readingSamples.json';
import { PERSONAL_FORECAST_PROMPT_VERSION, PERSONAL_FORECAST_CACHE_VERSION } from '../lib/personalForecastContract';
it('invalidates the removed writer chain and does not repeat one sample for every person',()=>{
  expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain('dated-natal-horoscope');
  expect(PERSONAL_FORECAST_CACHE_VERSION).toContain('dated-natal-horoscope');
  for(const period of ['day','week','month'] as const) expect(new Set(samples.people.map(p=>p.forecasts[period].overview.text)).size).toBe(3);
});
