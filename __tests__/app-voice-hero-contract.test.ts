import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('app voice hero contract', () => {
  it('requires a newly generated friendly hero title for every day', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain('hero_title генерируется заново для каждого дня');
    expect(voice).toContain('Никогда не подставляй постоянный заголовок');
    expect(voice).toContain('добрый, дерзкий и современный друг');
    expect(voice).toContain('без приказа пользователю');
  });

  it('explicitly rejects the stale coaching and pseudo-deep wording', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain('«красивый разгон»');
    expect(voice).toContain('«рывок»');
    expect(voice).toContain('«вязнешь в мелочах»');
    expect(voice).toContain('конструкции «день не про…», «либо…, либо…»');
  });
});
