import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { adminUrl, LIVE_ADMIN_ORIGIN } from '../services/openAdmin';

function telegram(platform: string, isFullscreen: boolean) {
  const app = { platform, isFullscreen, ready: jest.fn(), expand: jest.fn(), disableVerticalSwipes: jest.fn(),
    requestFullscreen: jest.fn(), exitFullscreen: jest.fn() };
  (globalThis as any).window = { Telegram: { WebApp: app } };
  return app;
}

describe('Telegram launch on a computer', () => {
  afterEach(() => { delete (globalThis as any).window; });

  it('leaves the screen-sized window the bot «Fullscreen» launch mode creates on Telegram Desktop', () => {
    const app = telegram('tdesktop', true);
    ensureTelegramFullscreen();
    expect(app.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(app.requestFullscreen).not.toHaveBeenCalled();
    expect(app.expand).not.toHaveBeenCalled();
  });

  it('does nothing extra when the window is already normal', () => {
    const app = telegram('tdesktop', false);
    ensureTelegramFullscreen();
    expect(app.exitFullscreen).not.toHaveBeenCalled();
  });

  it('keeps a phone fullscreen and expanded', () => {
    const app = telegram('android', false);
    (globalThis as any).window.navigator = undefined;
    ensureTelegramFullscreen();
    expect(app.expand).toHaveBeenCalledTimes(1);
    expect(app.exitFullscreen).not.toHaveBeenCalled();
  });
});

describe('admin button', () => {
  it('always opens the admin of the live server, whichever host serves the app', () => {
    expect(adminUrl()).toBe(`${LIVE_ADMIN_ORIGIN}/admin`);
  });
});
