import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('startup profile bootstrap', () => {
  it('waits for Telegram initData before profile fetch', () => {
    const app = read('App.tsx');
    expect(app).toContain('waitForTelegramInitData');
    const waitIdx = app.indexOf('await waitForTelegramInitData({ maxAttempts: 8, delayMs: 250 })');
    const getProfileIdx = app.indexOf('await getProfile()', waitIdx);
    expect(waitIdx).toBeGreaterThan(-1);
    expect(getProfileIdx).toBeGreaterThan(waitIdx);
  });

  it('does not block startup on admin status or primary chart ID when local chart exists', () => {
    const app = read('App.tsx');
    const profileLoaded = app.indexOf('const storedProfile = webGuestProfile || await getProfile()');
    const localChart = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)', profileLoaded);
    const dashboard = app.indexOf("showStartupDashboard('dashboard')", localChart);

    expect(profileLoaded).toBeGreaterThan(-1);
    expect(localChart).toBeGreaterThan(profileLoaded);
    expect(dashboard).toBeGreaterThan(localChart);
    expect(app.slice(profileLoaded, localChart)).not.toContain('await resolveAuthoritativeAdminStatus');
    expect(app.slice(localChart, dashboard)).not.toContain('await getPrimaryChartId');
  });

  it('uses retry helper instead of bare await saveProfile for new users', () => {
    const app = read('App.tsx');
    expect(app).toContain('saveStartupProfileWithRetry');
    expect(app).toContain('await saveStartupProfileWithRetry(updatedProfile)');
    expect(app).not.toMatch(
      /Creating minimal startup profile without natal setup[\s\S]{0,240}await saveProfile\(updatedProfile\)/
    );
  });

  it('falls back to local profile in startup catch when user id is valid', () => {
    const app = read('App.tsx');
    const loadDataIdx = app.indexOf('const loadData = async () => {');
    const catchIdx = app.indexOf('} catch (error) {', loadDataIdx);
    const fallbackIdx = app.indexOf('setProfile(fallbackProfile)', catchIdx);
    expect(catchIdx).toBeGreaterThan(loadDataIdx);
    expect(fallbackIdx).toBeGreaterThan(catchIdx);
  });

  it('shows retry button on startup error screen', () => {
    const app = read('App.tsx');
    expect(app).toContain('Попробовать снова');
    expect(app).toContain('const retryStartup = () =>');
    expect(app).toContain('onClick={retryStartup}');
    expect(app).toContain('setStartupRetryNonce((value) => value + 1)');
    expect(app).not.toContain('window.location.reload()');
  });

  it('logs auth failures distinctly in getProfile', () => {
    const storage = read('services/storageService.ts');
    expect(storage).toContain('Auth failed (401)');
  });
});
