import fs from 'fs';
import path from 'path';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('remaining ops/APK release contracts', () => {
  it('lets extended compatibility wait for a second generation attempt', () => {
    const service = read('services/astrologyService.ts');
    expect(service).toContain('const SYNASTRY_EXTENDED_REQUEST_TIMEOUT_MS = 90_000;');
    expect(service).toContain('}, SYNASTRY_EXTENDED_REQUEST_TIMEOUT_MS);');
  });

  it('resolves mobile provenance from CI/Railway when the source archive has no .git directory', () => {
    const mobile = read('scripts/build-mobile.mjs');
    const gradle = read('android/app/build.gradle');
    expect(mobile).toContain('process.env.RAILWAY_GIT_COMMIT_SHA');
    expect(mobile).toContain('process.env.GITHUB_SHA');
    expect(gradle).toContain("authValue('RAILWAY_GIT_COMMIT_SHA')");
    expect(gradle).toContain("authValue('GITHUB_SHA')");
  });

  it('keeps MyTracker disabled without a key and avoids duplicate payment tracking', () => {
    const gradle = read('android/app/build.gradle');
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const app = read('android/app/src/main/java/ru/tvoygoroskop/app/NeboApplication.java');
    expect(gradle).toContain("implementation 'com.my.tracker:mytracker-sdk:3.6.0'");
    expect(gradle).toContain("buildConfigField 'String', 'MYTRACKER_SDK_KEY'");
    expect(manifest).toContain('android:name=".NeboApplication"');
    expect(app).toContain('if (sdkKey.isEmpty())');
    expect(app).toContain('setAutotrackingPurchaseEnabled(false)');
  });
});
