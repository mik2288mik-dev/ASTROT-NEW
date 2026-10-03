import type { NextApiRequest, NextApiResponse } from 'next';
import { readStoredAudio } from '../../../../lib/tts/ttsStore';

export const config = { api: { responseLimit: false } };

/**
 * Serves cached audio by its id (a SHA-256 of the voiced text), with byte
 * ranges so the player can seek. The id is only known to someone who received
 * it from /api/audio/listen; an <audio> element cannot send auth headers, so
 * the id itself is the access key.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const id = String(req.query.id || '').replace(/\.mp3$/u, '');
  if (!/^[a-f0-9]{64}$/u.test(id)) return res.status(404).end();
  try {
    const audio = await readStoredAudio(id);
    if (!audio) return res.status(404).end();
    const total = audio.bytes.length;
    res.setHeader('Content-Type', audio.mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
    const range = /^bytes=(\d*)-(\d*)$/u.exec(String(req.headers.range || ''));
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : total - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : total - 1;
      start = Math.max(0, start);
      end = Math.min(total - 1, end);
      if (start > end || start >= total) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(end - start + 1));
      return req.method === 'HEAD' ? res.end() : res.end(audio.bytes.subarray(start, end + 1));
    }
    res.status(200);
    res.setHeader('Content-Length', String(total));
    return req.method === 'HEAD' ? res.end() : res.end(audio.bytes);
  } catch (error) {
    console.error('[audio/file] failed', error instanceof Error ? error.message : error);
    return res.status(503).end();
  }
}
