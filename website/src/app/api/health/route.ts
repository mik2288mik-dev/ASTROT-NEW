export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ ok: true, service: 'your-horoscope-site', time: new Date().toISOString() }, { status: 200 });
}
