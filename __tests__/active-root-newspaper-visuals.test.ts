import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('active root newspaper visual contract', () => {
  it('numbers the continuous personal forecast without changing section data', () => {
    const dashboard = read('views/Dashboard.tsx');
    const sectionBlock = read(
      'components/PersonalForecastFeed/ForecastSectionBlock.tsx',
    );
    const styles = read('styles/newspaperVisual.css');

    expect(dashboard).toContain('sectionNumber={1}');
    expect(dashboard).toContain('forecast.sections.map((section, sectionIndex)');
    expect(dashboard).toContain('sectionNumber={sectionIndex + 2}');
    expect(sectionBlock).toContain('sectionNumber: number');
    expect(sectionBlock).toContain('className="forecast-feed-section-number"');
    expect(styles).toContain('.forecast-feed-page .forecast-feed-section-number');
    expect(styles).toContain('grid-template-columns: 2.7rem minmax(0, 1fr)');
  });

  it('scopes the white paper skin to every active non-v2 root', () => {
    const roots = {
      'views/Dashboard.tsx': 'forecast-feed-page',
      'views/Settings.tsx': 'settings-editorial-page',
      'views/MyCharts.tsx': 'charts-editorial-page',
      'views/Onboarding.tsx': 'onboarding-editorial-page',
      'views/AuthGate.tsx': 'auth-editorial-page',
      'views/Paywall.tsx': 'pw2',
    };

    for (const [file, rootClass] of Object.entries(roots)) {
      expect(read(file)).toContain(rootClass);
    }

    const styles = read('styles/newspaperVisual.css');
    expect(styles).toContain('--news-paper: #ffffff');
    expect(styles).toContain('.forecast-feed-page .forecast-feed-status button');
    expect(styles).toContain('background: var(--news-action) !important');
    expect(styles).toContain('.settings-editorial-page .fresh-btn-ghost');
    expect(styles).toContain(".settings-editorial-page button[class*='bg-mono-accent']");
    expect(styles).toContain(".charts-editorial-page button[class*='bg-mono-accent']");
    expect(styles).toContain(".auth-editorial-page button[class*='bg-[#168de2]']");
    expect(styles).toContain('.compat-editorial-page .people-dim-val');
    expect(styles).toContain('.compat-editorial-page .people-dim-track');
    expect(styles).toContain('.compat-editorial-page .people-ring circle:first-child');
    expect(styles).not.toMatch(/\.lumia-bottom-(?:nav|bar)/);
  });

  it('keeps image placement sparse and deterministic on root screens', () => {
    const dashboard = read('views/Dashboard.tsx');
    const onboarding = read('views/Onboarding.tsx');

    expect(dashboard).toContain('resolvePersonalForecastVisuals');
    expect(dashboard).toContain('hasVisual={!!visual?.assignments[forecast.overview.id]?.path}');
    expect(onboarding).toContain("screenKey: 'onboarding-story'");
    expect(onboarding).toContain('contentKey: `story-${storyIndex}`');
    expect(onboarding).toContain('<EditorialSticker');
    expect(onboarding).not.toContain('Math.random');
  });
});
