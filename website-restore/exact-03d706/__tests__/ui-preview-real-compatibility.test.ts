import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('UI Preview compatibility adapter', () => {
  it('renders the existing product surface instead of a preview-only imitation', () => {
    const preview = read('components/ui-preview/UiPreviewApp.tsx');

    expect(preview).toContain("import { UnionRoom } from '../../views/v2/UnionRoom'");
    expect(preview).toContain('<UnionRoom');
    expect(preview).toContain('...compatibilityFixture');
    expect(preview).not.toContain('ui-preview-compatibility-result');
    expect(preview).not.toContain('ui-preview-sign-compatibility');
  });

  it('keeps preview data local while leaving the production effects available', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const preview = read('components/ui-preview/UiPreviewApp.tsx');
    const fixtures = read('components/ui-preview/uiPreviewFixtures.ts');

    expect(room).toContain('uiPreview?: {');
    expect(room).toContain('if (previewEnabled) return;');
    expect(room).toContain("if (entry.kind !== 'person' || previewEnabled) return;");
    expect(room).toContain('if (!selected || previewEnabled) return;');
    expect(room).toContain('userId={!previewEnabled && profile.id');
    expect(room).toContain('compat-result-status');
    expect(room).toContain('compat-result-error');
    expect(preview).toContain('{ resultState: state }');
    expect(fixtures).toContain('UI_PREVIEW_COMPATIBILITY');
    expect(fixtures).toContain("schemaVersion: 'compatibility-v2'");
    expect(fixtures).toContain("engineVersion: 'compatibility-engine.v1'");
    expect(fixtures).toContain("calculationVersion: 'ui-preview-fixture.v1'");
    expect(fixtures).toContain('closing: {');
    expect(fixtures).toContain('один хочет прояснить всё сейчас, второй просит паузу');
    expect(fixtures).toContain('UI_PREVIEW_COMPATIBILITY_STEADY');
    expect(preview).toContain("get('pair') === 'steady'");
  });
});
