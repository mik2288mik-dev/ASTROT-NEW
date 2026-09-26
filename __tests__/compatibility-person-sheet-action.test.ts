import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('compatibility saved-chart selection sheet', () => {
  it('uses an explicit select action without changing the sheet close behavior', () => {
    const room = read('views/v2/UnionRoom.tsx');
    const sheet = read('components/lumia-ui/CosmicSheet.tsx');
    const styles = read('styles/compatibilityEditorial.css');

    expect(room).toContain("onClose={() => setPersonSheet(null)}");
    expect(room).toContain("closeLabel={ru ? 'Закрыть' : 'Close'}");
    expect(room).toContain("closeButtonText={ru ? 'Выбрать' : 'Choose'}");
    expect(sheet).toContain('closeButtonText?: string;');
    expect(sheet).toContain("closeButtonText && 'cosmic-sheet-close--text'");
    expect(sheet).toContain('aria-label={closeButtonText || closeLabel}');
    expect(styles).toMatch(/\.compat-person-sheet \.cosmic-sheet-close--text\s*\{[^}]*min-height:\s*44px/);
  });
});
