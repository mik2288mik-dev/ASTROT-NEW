import { UI_PREVIEW_TODAY_SECTIONS, UI_PREVIEW_WEEK_SECTIONS, UI_PREVIEW_MONTH_SECTIONS } from '../components/ui-preview/uiPreviewFixtures';
import samples from '../components/ui-preview/readingSamples.json';
it.each([['day',UI_PREVIEW_TODAY_SECTIONS],['week',UI_PREVIEW_WEEK_SECTIONS],['month',UI_PREVIEW_MONTH_SECTIONS]] as const)('shows the complete current %s reading without an invented closing',(period,sections)=>{
  expect(sections).toHaveLength(1);
  expect(sections[0].text).toBe(samples.people[0].forecasts[period].overview.text);
});
