import { createHmac, timingSafeEqual } from 'crypto';
import sharp from 'sharp';
import type { NeboDayPoint } from './neboOpsStats';

/**
 * Owner charts are fetched by Telegram from our own API (the Bot API relay only
 * carries JSON, so a photo upload is not possible). The URL is signed with the
 * ops webhook secret; it reveals only aggregate counts.
 */
const W = 1200;
const H = 640;
const FONT = "font-family=\"DejaVu Sans, Noto Sans, Arial, sans-serif\"";

function secret(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.NEBO_OPS_WEBHOOK_SECRET || '').trim();
}

export function signNeboChart(days: number, stamp: string, env: NodeJS.ProcessEnv = process.env): string {
  return createHmac('sha256', `nebo-ops-chart-v1:${secret(env)}`).update(`${days}:${stamp}`).digest('hex').slice(0, 32);
}

export function verifyNeboChart(days: number, stamp: string, signature: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (secret(env).length < 32 || !/^[0-9a-f]{32}$/.test(signature)) return false;
  const expected = Buffer.from(signNeboChart(days, stamp, env));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

/** `stamp` only busts Telegram's URL cache; the chart always shows data up to now. */
export function neboChartUrl(days: number, now = new Date(), env: NodeJS.ProcessEnv = process.env): string | null {
  const base = String(env.NEBO_OPS_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (!base.startsWith('https://') || secret(env).length < 32) return null;
  const stamp = String(Math.floor(now.getTime() / 60_000));
  return `${base}/api/telegram/ops-chart?days=${days}&t=${stamp}&sig=${signNeboChart(days, stamp, env)}`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch] as string));
}

export function buildNeboChartSvg(points: NeboDayPoint[], title: string): string {
  const left = 70;
  const right = 30;
  const top = 110;
  const bottom = 80;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...points.map((p) => p.visitors));
  const step = plotW / Math.max(1, points.length);
  const barW = Math.max(6, step * 0.42);
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const grid = [0, 0.5, 1].map((share) => {
    const value = Math.round(max * share);
    const yy = y(value);
    return `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="#E6E8EF" stroke-width="2"/>`
      + `<text x="${left - 12}" y="${yy + 7}" font-size="20" text-anchor="end" fill="#8A90A2" ${FONT}>${value}</text>`;
  }).join('');
  const bars = points.map((p, i) => {
    const x = left + i * step + (step - barW) / 2;
    const visitors = `<rect x="${x}" y="${y(p.visitors)}" width="${barW}" height="${top + plotH - y(p.visitors)}" rx="6" fill="#B9C3FF"/>`;
    const fresh = `<rect x="${x + barW * 0.2}" y="${y(p.newUsers)}" width="${barW * 0.6}" height="${top + plotH - y(p.newUsers)}" rx="4" fill="#4C5BD4"/>`;
    const buy = p.purchases > 0
      ? `<circle cx="${x + barW / 2}" cy="${y(p.visitors) - 18}" r="11" fill="#1FA971"/>`
        + `<text x="${x + barW / 2}" y="${y(p.visitors) - 11}" font-size="16" font-weight="700" text-anchor="middle" fill="#fff" ${FONT}>${p.purchases}</text>`
      : '';
    const showLabel = points.length <= 14 || i % Math.ceil(points.length / 14) === 0 || i === points.length - 1;
    const label = showLabel
      ? `<text x="${x + barW / 2}" y="${H - bottom + 34}" font-size="19" text-anchor="middle" fill="#5B6175" ${FONT}>${escapeXml(p.day)}</text>`
      : '';
    return visitors + fresh + buy + label;
  }).join('');
  const legend = [
    ['#B9C3FF', 'Заходили'], ['#4C5BD4', 'Новые'], ['#1FA971', 'Покупки'],
  ].map(([color, text], i) => `<rect x="${left + i * 210}" y="62" width="22" height="22" rx="5" fill="${color}"/>`
    + `<text x="${left + i * 210 + 32}" y="80" font-size="22" fill="#2B3040" ${FONT}>${text}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<text x="${left}" y="44" font-size="30" font-weight="700" fill="#151826" ${FONT}>${escapeXml(title)}</text>
${legend}${grid}${bars}
</svg>`;
}

export async function renderNeboChartPng(points: NeboDayPoint[], title: string): Promise<Buffer> {
  return sharp(Buffer.from(buildNeboChartSvg(points, title), 'utf-8')).png({ compressionLevel: 8 }).toBuffer();
}
