import fs from 'fs';

describe('native mobile document bootstrap', () => {
  const source = fs.readFileSync('pages/_document.tsx', 'utf8');

  it('does not inject Telegram or remote font dependencies into mobile builds', () => {
    expect(source).toContain("process.env.NEXT_PUBLIC_MOBILE_BUILD === '1'");
    expect(source).toContain("process.env.MOBILE_BUILD === '1'");
    expect(source).toContain('&& !isNativeMobileBuild');
    expect(source).toContain('https://telegram.org/js/telegram-web-app.js');
    expect(source).toContain('https://fonts.googleapis.com');
  });
});
