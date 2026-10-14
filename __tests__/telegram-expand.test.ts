import { expandTelegramAppOnPhones, shouldExpandTelegramApp } from '../lib/telegramExpand';

describe('Telegram mini app window', () => {
  it('expands only on phones: on a computer it resizes the window to the screen and leaves it off screen', () => {
    for (const platform of ['android', 'android_x', 'ios']) expect(shouldExpandTelegramApp(platform)).toBe(true);
    for (const platform of ['tdesktop', 'macos', 'weba', 'webk', 'windows', undefined, '']) expect(shouldExpandTelegramApp(platform)).toBe(false);
  });

  it('calls expand() for a phone and never for Telegram Desktop', () => {
    const phone = { platform: 'android', expand: jest.fn() };
    const desktop = { platform: 'tdesktop', expand: jest.fn() };
    expandTelegramAppOnPhones(phone);
    expandTelegramAppOnPhones(desktop);
    expandTelegramAppOnPhones(null);
    expect(phone.expand).toHaveBeenCalledTimes(1);
    expect(desktop.expand).not.toHaveBeenCalled();
  });
});
