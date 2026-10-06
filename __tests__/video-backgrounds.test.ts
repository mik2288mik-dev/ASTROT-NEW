import fs from 'fs';
import path from 'path';
import {
  VIDEO_BACKGROUND_IDS,
  VIDEO_LIBRARY_FILES,
  videoBackgroundPath,
  videoBackgroundPoster,
} from '../lib/videoBackgrounds';

const publicDir = path.join(process.cwd(), 'public');

describe('video backgrounds', () => {
  it('has a clip and a poster for every id', () => {
    for (const id of VIDEO_BACKGROUND_IDS) {
      expect(fs.existsSync(path.join(publicDir, 'video', 'library', `${id}.mp4`))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, videoBackgroundPoster(id)))).toBe(true);
    }
  });

  it('keeps every clip under 3 MB and only whitelists known files', () => {
    for (const id of VIDEO_BACKGROUND_IDS) {
      const { size } = fs.statSync(path.join(publicDir, 'video', 'library', `${id}.mp4`));
      expect(size).toBeLessThan(3 * 1024 * 1024);
      expect(VIDEO_LIBRARY_FILES.has(`${id}.mp4`)).toBe(true);
    }
    expect(VIDEO_LIBRARY_FILES.has('../package.json')).toBe(false);
    expect(videoBackgroundPath('breathing')).toBe('/api/video/library/breathing.mp4');
  });

  it('is left out of the mobile build', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'build-mobile.mjs'), 'utf8');
    expect(script).toContain("'video', 'library'");
  });
});
