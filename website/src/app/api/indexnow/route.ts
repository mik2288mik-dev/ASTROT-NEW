import { NextRequest } from 'next/server';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.INDEXNOW_SECRET;
  const key = process.env.INDEXNOW_KEY;
  const suppliedSecret = request.headers.get('x-indexnow-secret');
  if (!configuredSecret || !key) return Response.json({ ok: false, error: 'IndexNow is not configured' }, { status: 503 });
  if (suppliedSecret !== configuredSecret) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { urls?: string[] } | null;
  const urls = Array.isArray(body?.urls) ? body.urls.filter((url) => typeof url === 'string' && url.startsWith(siteUrl)).slice(0, 100) : [];
  if (urls.length === 0) return Response.json({ ok: false, error: 'No valid URLs' }, { status: 400 });

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ host: new URL(siteUrl).host, key, keyLocation: `${siteUrl}/api/indexnow/key`, urlList: urls }),
  });

  return Response.json({ ok: response.ok, status: response.status, submitted: urls.length }, { status: response.ok ? 200 : 502 });
}
