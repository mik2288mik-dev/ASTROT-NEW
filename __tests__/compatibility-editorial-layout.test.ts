import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('compatibility editorial layout', () => {
  it('scopes the light flow to every UnionRoom state and preserves its gates', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const styles = read('styles/compatibilityEditorial.css');
    const app = read('pages/_app.tsx');

    expect(room.match(/compat-editorial-page compat-editorial-page--/g)).toHaveLength(3);
    expect(room).toContain('compat-editorial-page--hub');
    expect(room).toContain('compat-editorial-page--add');
    expect(room).toContain('compat-editorial-page--result');
    expect(room).toContain("if (!hasChart) { onCreateNatalChart?.(); return; }");
    expect(room).toContain("if (!premium) { requestPremium(); return; }");
    expect(room).toContain('loadCompatHistory');
    expect(room).toContain('calculateExtendedSynastry');
    expect(room).toContain('RelationshipContextPicker');
    expect(room).toContain('buildLocalPersonSnapshot');
    expect(room).toContain('selected.relationshipContext');
    expect(styles).toContain('.compat-editorial-page .compat-quick');
    expect(styles).toContain('.compat-editorial-page .compat-context-picker');
    expect(styles).toContain('.compat-editorial-page--result .compat-person-snapshot');
    expect(styles).toContain('.compat-editorial-page--result .compat-read-block');
    expect(styles).not.toMatch(/^\.fresh-page\s*\{/m);
    expect(app).toContain("import '../styles/compatibilityEditorial.css'");
  });
});
