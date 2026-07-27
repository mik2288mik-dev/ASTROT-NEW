export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response('Not configured', { status: 404 });
  return new Response(key, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
