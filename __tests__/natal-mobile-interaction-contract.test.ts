import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal mobile interaction contract', () => {
  it('keeps the three-tab natal navigation and mobile sheets for focused details', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const interactiveMap = read('components/NatalReading/InteractiveNatalMap.tsx');
    const questionExperience = read('components/NatalReading/NatalQuestionExperience.tsx');
    const sectionStyles = read('components/NatalReading/NatalSection.module.css');
    const sheetStyles = read('styles/natalMeaningMap.css');
    const evidence = read('components/NatalReading/NatalEvidenceSheet.tsx');
    const globals = read('styles/globals.css');
    const app = read('pages/_app.tsx');
    const rootApp = read('App.tsx');

    expect(magazine).toContain('className={styles.navigation}');
    expect(magazine).toContain("{ id: 'foundation', label: 'Обзор' }");
    expect(magazine).toContain("{ id: 'map', label: 'Карта' }");
    expect(magazine).toContain("{ id: 'ask', label: 'Спросить' }");
    expect(magazine).not.toContain("label: 'Подробно'");
    expect(magazine).toContain("normalizedActiveTab === 'foundation'");
    expect(magazine).toContain("normalizedActiveTab === 'ask'");
    expect(magazine).not.toContain('<EditorialTabs');
    expect(sectionStyles).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(interactiveMap).toContain('<NatalDetails');
    expect(interactiveMap).toContain('embeddedDetails');
    expect(questionExperience).toContain('<NatalEvidenceSheet');
    expect(evidence).toContain('role="dialog"');
    expect(evidence).toContain('aria-modal="true"');
    expect(sheetStyles).toContain('.natal-v3-sheet-layer {');
    expect(sheetStyles).toContain('position: fixed;');
    expect(sheetStyles).toContain('max-height: min(91dvh, 880px);');
    expect(sheetStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globals).toContain('.lumia-app-shell {\n  --lumia-side-drawer-width:');
    expect(globals).toContain('height: var(--tg-viewport-stable-height, 100dvh);');
    expect(globals).toContain('touch-action: pan-x pan-y;');
    expect(app).toContain('const viewport = publicSiteEnabled');
    expect(app).toContain(": router.pathname === '/'");
    expect(app).toContain('maximum-scale=1, user-scalable=no');
    expect(rootApp).toContain("document.addEventListener('gesturestart', preventGestureZoom, options)");
    expect(rootApp).toContain("document.removeEventListener('gesturestart', preventGestureZoom)");
  });
});
