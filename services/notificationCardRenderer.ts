import sharp from 'sharp';
import type { CardPresetConfig } from '../lib/notificationCardPresets';
import { getPresetOrDefault } from '../lib/notificationCardPresets';

const W = 900;
const H = 1200;
const PAD = 56;
const MAX_TITLE_LINES = 2;
const MAX_TITLE_CHARS_PER_LINE = 22;
const MAX_SUB_LINES = 2;
const MAX_SUB_CHARS = 36;
const MAX_BODY_LINES = 8;
const MAX_BODY_CHARS_PER_LINE = 38;
const MAX_ACCENT_CHARS = 48;

function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Word-wrap into lines with approximate char limit per line */
export function wrapLines(text: string, maxPerLine: number, maxLines: number): string[] {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!w) continue;
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w.length > maxPerLine ? w.slice(0, maxPerLine) + '…' : w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

export type CardRenderInput = {
  presetId: string | null | undefined;
  title: string;
  subtitle: string;
  accent: string;
  body: string;
  showDate: boolean;
  showSlotLabel: boolean;
  dateLabel: string;
  slotLabel: string;
  zodiacLine: string;
};

function buildSvg(cfg: CardPresetConfig, input: CardRenderInput): string {
  const preset = cfg;
  const titleLines = wrapLines(input.title || 'Твой Гороскоп', MAX_TITLE_CHARS_PER_LINE, MAX_TITLE_LINES);
  const subLines = wrapLines(input.subtitle, MAX_SUB_CHARS, MAX_SUB_LINES);
  const bodyLines = wrapLines(input.body, MAX_BODY_CHARS_PER_LINE, MAX_BODY_LINES);
  const accent = (input.accent || '').trim().slice(0, MAX_ACCENT_CHARS).toUpperCase();

  const metaParts: string[] = [];
  if (input.showSlotLabel && input.slotLabel) metaParts.push(input.slotLabel);
  if (input.showDate && input.dateLabel) metaParts.push(input.dateLabel);
  const metaLine = metaParts.join(' · ');
  const zodiac = (input.zodiacLine || '').trim().slice(0, 40);

  let y = PAD + 40;

  const titleBlocks = titleLines
    .map((line, i) => {
      const yy = y + i * 52;
      return `<text x="${PAD}" y="${yy}" font-size="44" font-weight="600" fill="${preset.titleColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${escapeXml(line)}</text>`;
    })
    .join('\n');
  y += titleLines.length * 52 + 16;

  const subBlocks =
    subLines.length > 0
      ? subLines
          .map((line, i) => {
            const yy = y + i * 34;
            return `<text x="${PAD}" y="${yy}" font-size="26" fill="${preset.subtitleColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${escapeXml(line)}</text>`;
          })
          .join('\n')
      : '';
  if (subLines.length) y += subLines.length * 34 + 20;

  const accentBlock = accent
    ? `<text x="${PAD}" y="${y}" font-size="18" font-weight="600" letter-spacing="0.12em" fill="${preset.accentColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${escapeXml(accent)}</text>`
    : '';
  if (accent) y += 36;

  const bodyBlocks = bodyLines
    .map((line, i) => {
      const yy = y + i * 36;
      return `<text x="${PAD}" y="${yy}" font-size="24" fill="${preset.bodyColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${escapeXml(line)}</text>`;
    })
    .join('\n');
  y += Math.max(bodyLines.length * 36, 0) + 32;

  const metaBlock = metaLine
    ? `<text x="${PAD}" y="${H - PAD - 72}" font-size="17" fill="${preset.subtitleColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${escapeXml(metaLine)}</text>`
    : '';

  const zodiacBlock = zodiac
    ? `<text x="${PAD}" y="${H - PAD - 44}" font-size="18" fill="${preset.accentColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${escapeXml(zodiac)}</text>`
    : '';

  const brandY = H - PAD - 8;
  const glowR = 280;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${preset.gradientTop}"/>
      <stop offset="48%" style="stop-color:${preset.gradientMid}"/>
      <stop offset="100%" style="stop-color:${preset.gradientBottom}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="${W - 120}" cy="160" r="${glowR}" fill="${preset.glowColor}" opacity="${preset.glowOpacity}"/>
  <circle cx="140" cy="${H - 200}" r="200" fill="${preset.brandColor}" opacity="0.06"/>
  ${titleBlocks}
  ${subBlocks}
  ${accentBlock}
  ${bodyBlocks}
  ${metaBlock}
  ${zodiacBlock}
  <text x="${PAD}" y="${brandY}" font-size="20" font-weight="600" letter-spacing="0.28em" fill="${preset.brandColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">LUMIA</text>
</svg>`;
}

export async function renderNotificationCardToPng(input: CardRenderInput): Promise<Buffer> {
  const cfg = getPresetOrDefault(input.presetId);
  const svg = buildSvg(cfg, input);
  return sharp(Buffer.from(svg, 'utf-8')).png({ compressionLevel: 8 }).toBuffer();
}
