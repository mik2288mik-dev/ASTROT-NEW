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
    const profileLoaded = app.indexOf('storedProfile = await getProfile()');
    const localChart = app.indexOf('const localEntry = readLocalNatalChartCache(updatedProfile)', profileLoaded);
    const dashboard = app.indexOf("showStartupDashboard('dashboard')", localChart);

    expect(profileLoaded).toBeGreaterThan(-1);
    expect(localChart).toBeGreaterThan(profileLoaded);
    expect(dashboard).toBeGreaterThan(localChart);
    expect(app.slice(profileLoaded, localChart)).not.toContain('await resolveAuthoritativeAdminStatus');
    expect(app.slice(localChart, dashboard)).not.toContain('await getPrimaryChartId');
  });

  it('never invents a local profile when authentication is missing', () => {
    const app = read('App.tsx');
    expect(app).not.toContain('buildMinimalStartupProfile');
    expect(app).not.toContain('saveStartupProfileWithRetry');
    expect(app).toContain('storedProfile = await loginWithTelegram()');
    expect(app).toContain('storedProfile = await startGuestAccount()');
    expect(app).toContain("throw new Error('PROFILE_NOT_FOUND')");
  });

  it('returns authentication failures to the explicit sign-in gate', () => {
    const app = read('App.tsx');
    const loadDataIdx = app.indexOf('const loadData = async () => {');
    const catchIdx = app.indexOf('} catch (error: any) {', loadDataIdx);
    const signedOutIdx = app.indexOf("setAuthSessionMode('signed_out')", catchIdx);
    expect(catchIdx).toBeGreaterThan(loadDataIdx);
    expect(signedOutIdx).toBeGreaterThan(catchIdx);
    expect(app.slice(catchIdx, signedOutIdx)).not.toContain('buildMinimalStartupProfile');
  });

  it('shows retry button on startup error screen', () => {
    const app = read('App.tsx');
    expect(app).toContain('Попробовать снова');
    expect(app).toContain('const retryStartup = () =>');
    expect(app).toContain('onClick={retryStartup}');
    expect(app).toContain('setStartupRetryNonce((value) => value + 1)');
    expect(app).not.toContain('window.location.reload()');
  });

  it('raises a typed auth failure from getProfile instead of returning a fake profile', () => {
    const storage = read('services/storageService.ts');
    expect(storage).toContain('export class ProfileLoadError extends Error');
    expect(storage).toContain('response.status === 401 || response.status === 403');
    expect(storage).toContain('throw new ProfileLoadError(');
  });
});
