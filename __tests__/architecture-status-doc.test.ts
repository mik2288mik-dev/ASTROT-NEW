import fs from 'fs';
import path from 'path';

describe('current architecture documentation', () => {
  it('documents the canonical Lumia layers without legacy endpoint guidance', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'docs/CURRENT_ARCHITECTURE.md'), 'utf8');

    expect(content).toContain('requireAppUser');
    expect(content).toContain('accessMatrix');
    expect(content).toContain('contentMatrix');
    expect(content).toContain('contentPromptBuilders');
    expect(content).toContain('/api/content/*');
    expect(content).not.toContain('/api/astrology/daily-horoscope');
  });
});
