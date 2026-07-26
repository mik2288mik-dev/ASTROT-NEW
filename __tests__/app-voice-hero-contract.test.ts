import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('single app voice contract', () => {
  it('keeps generated content direct and does not define a friend persona', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain("export const APP_VOICE_VERSION = '1'");
    expect(voice).toContain('спокойно, уверенно и прямо');
    expect(voice).toContain('Не говори голосом эзотерика');
    expect(voice).not.toContain('hero_title генерируется');
    expect(voice).not.toContain('добрый, дерзкий и современный друг');
  });

  it('explicitly rejects coaching, mysticism, and generic wording', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain('«не распыляйся»');
    expect(voice).toContain('«энергия дня»');
    expect(voice).toContain('«Вселенная подсказывает»');
    expect(voice).toContain('общую психологическую воду');
  });
});
