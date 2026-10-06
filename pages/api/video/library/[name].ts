import fs from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { VIDEO_LIBRARY_FILES } from '../../../../lib/videoBackgrounds';

export const config = { api: { responseLimit: false } };

const LIBRARY_DIR = path.join(process.cwd(), 'public', 'video', 'library');

/**
 * Looping video backgrounds. Served through /api, like the sound library, so
 * the Android app (another origin) can stream them; byte ranges let the
 * player start before the whole file is here.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const name = String(req.query.name || '');
  if (!VIDEO_LIBRARY_FILES.has(name)) return res.status(404).end();
  const file = path.join(LIBRARY_DIR, name);
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(file);
  } catch {
    return res.status(404).end();
  }
  const total = stat.size;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  const range = /^bytes=(\d*)-(\d*)$/u.exec(String(req.headers.range || ''));
  let start = 0;
  let end = total - 1;
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : total - Number(range[2]);
    end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
    if (start < 0 || start > end) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  } else {
    res.status(200);
  }
  res.setHeader('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD') return res.end();
  return new Promise<void>((resolve) => {
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => { if (!res.headersSent) res.status(500); res.end(); resolve(); });
    stream.on('end', () => resolve());
    stream.pipe(res);
  });
}
