import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('UI Preview horoscope adapter', () => {
  it('renders the production HoroscopeReader for both horoscope scenarios', () => {
    const preview = read('components/ui-preview/UiPreviewApp.tsx');

    expect(preview).toContain("import { HoroscopeReader } from '../../views/v2/HoroscopeReader'");
    expect(preview).toContain('<HoroscopeReader');
    expect(preview).toContain('...UI_PREVIEW_HOROSCOPE');
    expect(preview).toContain("pickerOpen: scenario.screen === 'zodiac-picker'");
    expect(preview).not.toContain('function HoroscopeScene');
    expect(preview).not.toContain('<LzSignPickerSheet');
  });

  it('keeps fixture reads and interactions local in development', () => {
    const reader = read('views/v2/HoroscopeReader.tsx');
    const fixtures = read('components/ui-preview/uiPreviewFixtures.ts');

    expect(reader).toContain("process.env.NODE_ENV === 'development' ? uiPreview : undefined");
    expect(reader).toContain('? previewFixture.readings[period]');
    expect(reader).toContain('if (previewFixture) return;');
    expect(reader).toContain('userId={!previewFixture && profile.id');
    expect(reader).toContain('onShare={previewFixture');
    expect(reader).toContain('useState(Boolean(previewFixture?.pickerOpen))');
    expect(fixtures).toContain('UI_PREVIEW_HOROSCOPE');
    expect(fixtures).toContain("schemaVersion: 'sign-horoscope-reading-v4'");
  });
});
