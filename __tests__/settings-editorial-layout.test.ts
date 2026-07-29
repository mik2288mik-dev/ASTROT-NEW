import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('settings editorial layout', () => {
  it('keeps settings functions inside the shared light editorial surface', () => {
    const settings = read('views/Settings.tsx');
    const styles = read('styles/settingsEditorial.css');
    const app = read('pages/_app.tsx');

    expect(settings).toContain('settings-editorial-page');
    expect(settings).toContain('settings-editorial-content');
    expect(settings).toContain('settings-editorial-premium');
    expect(settings).toContain('onDeleteAccount');
    expect(settings).toContain('onLogout');
    expect(styles).toContain('.settings-editorial-section');
    expect(styles).toContain('.settings-editorial-row');
    expect(styles).not.toMatch(/^\.fresh-page\s*\{/m);
    expect(app).toContain("import '../styles/settingsEditorial.css'");
  });
});
