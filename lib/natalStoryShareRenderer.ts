import type { NatalStoryShareFormat, ProfileCard } from '../types';

const FORMAT_SIZE: Record<NatalStoryShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
};

const ACCENT_BY_VISUAL: Record<string, { a: string; b: string; c: string }> = {
  hero_halo_portrait: { a: '#8c6be8', b: '#f3edff', c: '#fff7f0' },
  hero_core_rings: { a: '#3d8edb', b: '#eaf5ff', c: '#fff9ed' },
  hero_strength_spark: { a: '#c79a2f', b: '#fff5d8', c: '#f7fbff' },
  hero_noise_fade: { a: '#d8748a', b: '#fff1f4', c: '#f7fbff' },
  hero_dual_orbit: { a: '#e0785e', b: '#fff0e8', c: '#f4f8ff' },
  hero_path_focus: { a: '#5268d8', b: '#edf1ff', c: '#fff8ef' },
  'first-impression': { a: '#7A55FF', b: '#f3edff', c: '#fff7f0' },
  decisions: { a: '#15C7FF', b: '#eaf7ff', c: '#fff8ec' },
  communication: { a: '#FFB13B', b: '#fff2cf', c: '#f6fff0' },
  blockers: { a: '#FF4CB7', b: '#fff0f5', c: '#eef9ff' },
  strengths: { a: '#5E35FF', b: '#edf1ff', c: '#f5fff0' },
  relationships: { a: '#FF6F61', b: '#fff0eb', c: '#eef9ff' },
};

function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxChars: number, maxLines: number) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function textBlock(lines: string[], x: number, y: number, size: number, lineHeight: number, weight = 500, fill = '#15151b') {
  return lines
    .map((line, index) => (
      `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`
    ))
    .join('');
}

export function normalizeNatalStoryShareFormat(value: unknown): NatalStoryShareFormat {
  return value === 'feed' ? 'feed' : 'story';
}

export function renderNatalStoryShareSvg(card: ProfileCard, format: NatalStoryShareFormat = 'story') {
  const { width, height } = FORMAT_SIZE[format];
  const accent = ACCENT_BY_VISUAL[String(card.assetKey || '')] || ACCENT_BY_VISUAL[String(card.visualKey || '')] || ACCENT_BY_VISUAL.hero_halo_portrait;
  const titleLines = wrapText(card.title, format === 'story' ? 17 : 20, 3);
  const summaryLines = wrapText(card.shortText, format === 'story' ? 34 : 38, format === 'story' ? 5 : 4);
  const chipY = format === 'story' ? 1188 : 875;
  const titleY = format === 'story' ? 720 : 485;
  const summaryY = titleY + titleLines.length * 86 + 80;
  const chipWidth = 230;

  const chips = card.chips.slice(0, 3).map((chip, index) => {
    const x = 84 + index * (chipWidth + 22);
    return `
      <rect x="${x}" y="${chipY}" width="${chipWidth}" height="64" rx="32" fill="rgba(255,255,255,0.72)" stroke="rgba(21,21,27,0.08)" />
      <text x="${x + 28}" y="${chipY + 41}" font-size="25" font-weight="600" fill="#4f4a59">${escapeXml(chip)}</text>
    `;
  }).join('');

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent.b}" />
          <stop offset="52%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="${accent.c}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="38%" r="58%">
          <stop offset="0%" stop-color="${accent.a}" stop-opacity="0.24" />
          <stop offset="70%" stop-color="${accent.a}" stop-opacity="0.04" />
          <stop offset="100%" stop-color="${accent.a}" stop-opacity="0" />
        </radialGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="30" stdDeviation="35" flood-color="#1c1824" flood-opacity="0.16"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect width="${width}" height="${height}" fill="url(#glow)" />
      <circle cx="${width * 0.5}" cy="${format === 'story' ? 410 : 310}" r="${format === 'story' ? 218 : 180}" fill="none" stroke="${accent.a}" stroke-opacity="0.18" stroke-width="3"/>
      <circle cx="${width * 0.5}" cy="${format === 'story' ? 410 : 310}" r="${format === 'story' ? 148 : 118}" fill="rgba(255,255,255,0.34)" stroke="rgba(255,255,255,0.8)" stroke-width="2" filter="url(#softShadow)"/>
      <path d="M180 ${format === 'story' ? 452 : 338} C 340 ${format === 'story' ? 255 : 204}, 526 ${format === 'story' ? 598 : 438}, 900 ${format === 'story' ? 330 : 245}" stroke="#15151b" stroke-opacity="0.12" stroke-width="5" fill="none" stroke-linecap="round"/>
      <text x="84" y="${format === 'story' ? 166 : 132}" font-size="34" font-weight="800" letter-spacing="7" fill="${accent.a}">LUMIA</text>
      <text x="84" y="${format === 'story' ? 222 : 182}" font-size="25" font-weight="600" letter-spacing="8" fill="#77717d">ТВОЙ ПУТЬ К СЕБЕ</text>
      <text x="84" y="${titleY - 92}" font-size="25" font-weight="800" letter-spacing="7" fill="${accent.a}">${escapeXml(card.subtitle || 'РАЗБОР')}</text>
      ${textBlock(titleLines, 84, titleY, 72, 84, 800)}
      ${textBlock(summaryLines, 84, summaryY, 36, 54, 500, '#33323b')}
      ${chips}
      <rect x="84" y="${height - 222}" width="${width - 168}" height="104" rx="52" fill="${accent.a}" />
      <text x="${width / 2}" y="${height - 158}" text-anchor="middle" font-size="34" font-weight="800" fill="#ffffff">Открыть общий разбор</text>
      <text x="${width / 2}" y="${height - 68}" text-anchor="middle" font-size="24" font-weight="600" fill="#77717d">lumia · карта</text>
    </svg>
  `;

  return { svg, width, height };
}
