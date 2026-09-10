import {
  UI_PREVIEW_TODAY_SECTIONS,
  UI_PREVIEW_WEEK_SECTIONS,
  UI_PREVIEW_MONTH_SECTIONS,
} from '../components/ui-preview/uiPreviewFixtures';
import { PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU } from '../lib/personalForecastExamples';

describe('personal forecast UI Preview examples', () => {
  it.each([
    ['day', UI_PREVIEW_TODAY_SECTIONS, 40, 60],
    ['week', UI_PREVIEW_WEEK_SECTIONS, 60, 80],
    ['month', UI_PREVIEW_MONTH_SECTIONS, 80, 100],
  ] as const)('uses the complete current %s reading and one untitled closing', (period, sections, minimum, maximum) => {
    const reference = PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.find((item) => item.period === period)!;
    expect(sections).toHaveLength(2);
    const [overview, closing] = sections;
    expect(overview.kind).toBe('overview');
    expect(overview.title).toBe(reference.output.title);
    expect(overview.contentBlocks).toHaveLength(1);
    expect(overview.contentBlocks[0]).toMatchObject({ role: 'detail', text: reference.output.forecast });
    expect(overview.text).toBe(reference.output.forecast);
    expect(closing.kind).toBe('dynamic');
    expect(closing.title).toBe('');
    expect(closing.contentBlocks).toHaveLength(1);
    expect(closing.contentBlocks[0]).toMatchObject({ role: 'action', text: reference.output.closing });
    expect(closing.text).toBe(reference.output.closing);
    const words = [overview.title, overview.text, closing.text].join(' ').match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) || [];
    expect(words.length).toBeGreaterThanOrEqual(minimum);
    expect(words.length).toBeLessThanOrEqual(maximum);
  });
});
