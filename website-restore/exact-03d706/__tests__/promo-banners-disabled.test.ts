import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

it('does not render advertising banners anywhere in the application', () => {
  const source = fs.readFileSync(path.join(ROOT, 'components/PromoBanner.tsx'), 'utf8');
  const feedStyles = fs.readFileSync(path.join(ROOT, 'styles/personalForecastFeed.css'), 'utf8');

  expect(source).toContain('export function PromoBanner');
  expect(source).toContain('return null;');
  expect(source).not.toContain('<aside');
  expect(source).not.toContain('<picture');
  expect(source).not.toContain('selectPromoBanner');
  expect(feedStyles).toContain('.forecast-feed-promo-pair:empty');
});
