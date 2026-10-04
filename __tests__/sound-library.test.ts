import fs from 'fs';
import path from 'path';
import { AMBIENT_TRACKS, LIBRARY_FILES, MUSIC_TRACKS, SOUND_GROUPS, tracksOfGroup } from '../lib/soundscapes/library';
import handler from '../pages/api/audio/library/[name]';

const root = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

function response() {
  const res: any = { headers: {} as Record<string, string>, setHeader: jest.fn((key: string, value: string) => { res.headers[key] = value; }) };
  res.status = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

describe('sound library', () => {
  it('has real recordings in every group, plus offline synthesized ones', () => {
    for (const group of SOUND_GROUPS) {
      const tracks = tracksOfGroup(group);
      expect(tracks.some((track) => track.kind === 'file')).toBe(true);
      expect(tracks[0].kind).toBe('file');
    }
    expect(AMBIENT_TRACKS.filter((track) => track.kind === 'synth')).toHaveLength(5);
    expect(MUSIC_TRACKS.filter((track) => track.kind === 'file').length).toBeGreaterThanOrEqual(5);
  });

  it('ships every file with a free licence written down next to it', () => {
    const licences = read('public/audio/LICENSES.md');
    for (const track of [...AMBIENT_TRACKS, ...MUSIC_TRACKS]) {
      if (track.kind !== 'file') continue;
      expect(fs.existsSync(path.join(root, 'public/audio/library', track.file))).toBe(true);
      expect(['CC0 1.0', 'Public domain']).toContain(track.source.license);
      expect(licences).toContain(track.source.url);
      expect(licences).toContain(track.file);
    }
  });

  it('keeps the recordings out of the APK and serves only known files', async () => {
    expect(read('scripts/build-mobile.mjs')).toContain("path.join(outputDirectory, 'audio', 'library')");
    const unknown = response();
    await handler({ method: 'GET', query: { name: '../../.env' }, headers: {} } as any, unknown);
    expect(unknown.status).toHaveBeenCalledWith(404);
    const name = [...LIBRARY_FILES][0];
    const head = response();
    await handler({ method: 'HEAD', query: { name }, headers: { range: 'bytes=0-99' } } as any, head);
    expect(head.status).toHaveBeenCalledWith(206);
    expect(head.headers['Content-Length']).toBe('100');
    expect(head.headers['Accept-Ranges']).toBe('bytes');
  });

  it('keeps sound playing with the screen locked through a media foreground service', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:foregroundServiceType="mediaPlayback"');
    expect(manifest).toContain('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK');
    expect(read('android/app/src/main/java/ru/tvoygoroskop/app/MainActivity.java')).toContain('registerPlugin(NativeMediaSessionPlugin.class);');
    expect(read('android/app/src/main/java/ru/tvoygoroskop/app/media/MediaPlaybackService.java')).toContain('FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK');
    expect(read('App.tsx')).toContain('startMediaSessionBridge(');
  });
});
