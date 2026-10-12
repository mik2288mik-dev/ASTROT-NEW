import { LEGACY_AMBIENT_FILES } from '../lib/soundscapes/library';

const MUSIC_CACHE = 'nebo-sounds-v1';
const AMBIENT_CACHE = 'nebo-ambient-hq-v2';
const MAX_RECORDINGS = 8;
const MAX_BYTES = 64 * 1024 * 1024;
let cleanup: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();
const pending = new Set<string>();

async function removeOldAmbientCopies(): Promise<void> {
  if (!(await caches.keys()).includes(MUSIC_CACHE)) return;
  const cache = await caches.open(MUSIC_CACHE);
  for (const key of await cache.keys()) {
    const file = new URL(key.url).pathname.split('/').pop() ?? '';
    if (LEGACY_AMBIENT_FILES.has(file)) await cache.delete(key);
  }
}

async function makeRoom(cache: Cache, incomingBytes: number, url: string): Promise<void> {
  await cache.delete(url);
  const entries = await Promise.all((await cache.keys()).map(async (key) => {
    const response = await cache.match(key);
    const length = Number(response?.headers.get('Content-Length'));
    const bytes = length > 0 ? length : (await response?.blob())?.size ?? 0;
    return { key, bytes };
  }));
  let total = entries.reduce((sum, entry) => sum + entry.bytes, incomingBytes);
  let count = entries.length + 1;
  for (const entry of entries) {
    if (count <= MAX_RECORDINGS && total <= MAX_BYTES) break;
    await cache.delete(entry.key);
    total -= entry.bytes;
    count -= 1;
  }
}

async function downloadCopy(cache: Cache, url: string, ambient: boolean): Promise<void> {
  if (pending.has(url)) return;
  pending.add(url);
  try {
    const response = await fetch(url, { mode: 'cors' });
    // Range responses are incomplete and must never become the offline copy.
    if (!response.ok || response.status !== 200) return;
    if (!ambient) {
      await cache.put(url, response);
      return;
    }
    const blob = await response.blob();
    if (blob.size > MAX_BYTES) return;
    const headers = new Headers(response.headers);
    headers.set('Content-Length', String(blob.size));
    // Account for decoded bytes if an intermediary compressed the response.
    headers.delete('Content-Encoding');
    writes = writes.catch(() => undefined).then(async () => {
      await makeRoom(cache, blob.size, url);
      await cache.put(url, new Response(blob, { headers }));
    });
    await writes;
  } catch {
    // Quota, network and storage errors leave the streaming URL usable.
  } finally {
    pending.delete(url);
  }
}

/** Stream immediately on a miss; keep at most eight / 64 MiB ambient recordings. */
export async function playableAudioSource(url: string, ambient: boolean): Promise<string> {
  if (typeof caches === 'undefined') return url;
  try {
    cleanup ??= removeOldAmbientCopies().catch(() => undefined);
    await cleanup;
    const cache = await caches.open(ambient ? AMBIENT_CACHE : MUSIC_CACHE);
    const hit = await cache.match(url);
    if (hit) return URL.createObjectURL(await hit.blob());
    void downloadCopy(cache, url, ambient);
  } catch {
    // Blocked storage: the same recording still streams from the server.
  }
  return url;
}
