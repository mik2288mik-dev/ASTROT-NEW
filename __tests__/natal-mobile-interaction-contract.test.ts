import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal mobile interaction contract', () => {
  it('keeps one fixed primary navigation and uses sheets for focused details', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');
    const styles = read('styles/natalMeaningMap.css');
    const globals = read('styles/globals.css');
    const app = read('pages/_app.tsx');
    const rootApp = read('App.tsx');

    expect(magazine).toContain('className="natal-v3-primary-nav"');
    expect(magazine).toContain("normalizedActiveTab === 'foundation'");
    expect(magazine).toContain("normalizedActiveTab === 'explore'");
    expect(magazine).toContain("normalizedActiveTab === 'ask'");
    expect(magazine).not.toContain('<EditorialTabs');
    expect(report).not.toContain('natal-catalog-tabs');
    expect(experience).toContain('className="natal-v3-sheet natal-v3-answer-sheet"');
    expect(experience).toContain('role="dialog"');
    expect(experience).toContain('aria-modal="true"');
    expect(styles).toContain('.natal-v3-primary-nav {');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(styles).toContain('.natal-v3-sheet-layer {');
    expect(styles).toContain('position: fixed;');
    expect(styles).toContain('max-height: min(91dvh, 880px);');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globals).toContain('.lumia-app-shell {\n  height:');
    expect(globals).toContain('touch-action: pan-x pan-y;');
    expect(app).toContain("router.pathname === '/'");
    expect(app).toContain('maximum-scale=1, user-scalable=no');
    expect(app).toContain("const viewport = router.pathname === '/'");
    expect(rootApp).toContain("document.addEventListener('gesturestart', preventGestureZoom, options)");
    expect(rootApp).toContain("document.removeEventListener('gesturestart', preventGestureZoom)");
  });
});
