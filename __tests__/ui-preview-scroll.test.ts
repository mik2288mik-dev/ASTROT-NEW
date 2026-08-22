import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('UI Preview mobile scrolling', () => {
  it('uses the document scroll and keeps the bottom bar fixed', () => {
    const css = read('styles/uiPreview.css');
    const preview = read('components/ui-preview/UiPreviewApp.tsx');

    expect(css).toMatch(/body\.ui-preview-document-scroll\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(css).toMatch(/\.ui-preview-app \.lumia-main-scroll\s*\{[\s\S]*?overflow:\s*visible;/);
    expect(css).toMatch(/\.today-bottom-navigation\.lumia-bottom-tab-shell\s*\{[\s\S]*?position:\s*fixed;/);
    expect(preview).toContain("const className = 'ui-preview-document-scroll';");
    expect(preview).toContain("window.scrollTo({ top: 0, behavior: 'auto' });");
  });

  it('keeps shared bottom-navigation clearance on the same scroll pane', () => {
    const preview = read('components/ui-preview/UiPreviewApp.tsx');
    const shell = read('styles/todayHome.css');

    expect(preview).toContain('className="lumia-main-scroll lumia-bottom-tab-scroll"');
    expect(shell).toContain('.has-today-bottom-navigation .lumia-main-scroll.lumia-bottom-tab-scroll');
    expect(shell).toContain('padding-bottom: var(--lumia-bottom-tab-clearance)');
    expect(shell).toContain('scroll-padding-bottom: var(--lumia-bottom-tab-clearance)');
  });
});
