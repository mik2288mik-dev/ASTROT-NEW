import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('account switch telemetry isolation', () => {
  it('invalidates queued events before every supported account-switch path', () => {
    const app = read('App.tsx');
    const settings = read('views/Settings.tsx');
    const session = read('services/sessionService.ts');

    expect(session).toContain('export function clearQueuedUserAppEvents(): void');
    expect(session).toContain('userAppEventQueueGeneration += 1');
    expect(session).toContain('expectedGeneration !== userAppEventQueueGeneration');
    expect(session).toContain('const activeUserAppEventControllers = new Set<AbortController>()');
    expect(session).toContain('activeControllers.forEach((controller) => controller.abort())');
    expect(session).toContain('signal: controller.signal');
    expect(
      settings.match(/if \(authPurpose === 'login'\) clearQueuedUserAppEvents\(\);/g),
    ).toHaveLength(2);
    expect(
      app.match(/String\(profile\.id\) !== String\(nextProfile\.id\)[\s\S]{0,100}clearQueuedUserAppEvents\(\)/g),
    ).toHaveLength(2);
    expect(app).toMatch(
      /const resetLocalAccountState[\s\S]{0,180}clearQueuedUserAppEvents\(\)/,
    );
  });
});
