import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal mobile interaction contract', () => {
  it('keeps both natal tab rows fixed to their layout and disables zoom only in the app', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const chrome = read('components/editorial/EditorialScreenChrome.tsx');
    const styles = read('styles/editorialStudio.css');
    const globals = read('styles/globals.css');
    const app = read('pages/_app.tsx');
    const rootApp = read('App.tsx');

    expect(report).not.toContain('categoryTabRefs');
    expect(report).not.toContain("inline: 'center'");
    expect(chrome).toContain("style={{ '--editorial-tab-count': tabs.length } as React.CSSProperties}");
    expect(styles).toContain('.natal-editorial-page .natal-editorial-tabs {\n  transform: none;');
    expect(styles).toContain('.fresh-page.natal-mvp-page .natal-catalog-tabs-wrap {\n  position: static;');
    expect(styles).toContain('grid-template-columns: repeat(6, minmax(0, 1fr));');
    expect(styles).toContain('font-size: clamp(10px, 3vw, 12px);');
    expect(styles).not.toContain('.fresh-page.natal-mvp-page .natal-catalog-tabs::-webkit-scrollbar');
    expect(globals).toContain('.lumia-app-shell {\n  height:');
    expect(globals).toContain('touch-action: pan-x pan-y;');
    expect(app).toContain("router.pathname === '/'");
    expect(app).toContain('maximum-scale=1, user-scalable=no');
    expect(app).toContain("const viewport = router.pathname === '/'");
    expect(rootApp).toContain("document.addEventListener('gesturestart', preventGestureZoom, options)");
    expect(rootApp).toContain("document.removeEventListener('gesturestart', preventGestureZoom)");
  });
});
