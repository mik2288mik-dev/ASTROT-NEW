import type { NatalChartDataV2 } from '../natalChartV2Types';
import { SIGN_NOMINATIVE_RU } from '../natalMoments';

const GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const BODIES: ReadonlyArray<[string, string]> = [
  ['sun', '☉'], ['moon', '☽'], ['mercury', '☿'], ['venus', '♀'], ['mars', '♂'], ['jupiter', '♃'], ['saturn', '♄'], ['uranus', '♅'], ['neptune', '♆'], ['pluto', '♇'],
];

/** The poster is drawn from the person's real chart: positions, name, date and place. */
export function drawPoster(chart: NatalChartDataV2, lines: { name: string; birth: string }, width: number, sample: boolean): HTMLCanvasElement {
  const height = Math.round(width * 1.414);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('POSTER_CANVAS_UNAVAILABLE');
  const u = width / 1000;
  const ink = '#14162A';
  g.fillStyle = '#FBFAF6';
  g.fillRect(0, 0, width, height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = ink;
  g.font = `600 ${44 * u}px "Cormorant Garamond", Georgia, serif`;
  g.fillText('НЕБО В ДЕНЬ РОЖДЕНИЯ', width / 2, 110 * u);

  const cx = width / 2;
  const cy = 640 * u;
  const outer = 430 * u;
  const asc = chart.angles.ascendant?.longitude ?? 0;
  const at = (longitude: number, radius: number): [number, number] => {
    const angle = ((180 + asc - longitude) * Math.PI) / 180;
    return [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)];
  };
  const ring = (radius: number, lineWidth: number) => {
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2);
    g.lineWidth = lineWidth * u;
    g.strokeStyle = ink;
    g.stroke();
  };
  ring(outer, 2.4);
  ring(outer - 62 * u, 1.2);
  ring(170 * u, 1);
  for (let index = 0; index < 12; index += 1) {
    const [x1, y1] = at(index * 30, outer);
    const [x2, y2] = at(index * 30, outer - 62 * u);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineWidth = 1.2 * u;
    g.stroke();
    const [tx, ty] = at(index * 30 + 15, outer - 31 * u);
    g.fillStyle = ink;
    g.font = `${30 * u}px "Segoe UI Symbol", "Noto Sans Symbols", serif`;
    g.fillText(GLYPHS[index], tx, ty);
  }
  for (const house of chart.houses ?? []) {
    const [x1, y1] = at(house.longitude, 170 * u);
    const [x2, y2] = at(house.longitude, outer - 62 * u);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineWidth = 0.7 * u;
    g.strokeStyle = 'rgba(20,22,42,.45)';
    g.stroke();
  }
  g.strokeStyle = ink;
  const placed = BODIES.flatMap(([key, glyph]) => {
    const position = chart.positions[key as keyof typeof chart.positions];
    return position ? [{ glyph, longitude: position.longitude }] : [];
  }).sort((a, b) => a.longitude - b.longitude);
  let last = -99;
  let level = 0;
  for (const body of placed) {
    level = body.longitude - last < 9 ? level + 1 : 0;
    last = body.longitude;
    const [x, y] = at(body.longitude, outer - 112 * u - (level % 3) * 46 * u);
    g.font = `${34 * u}px "Segoe UI Symbol", "Noto Sans Symbols", serif`;
    g.fillStyle = '#4527D6';
    g.fillText(body.glyph, x, y);
  }
  g.fillStyle = ink;
  g.font = `700 ${64 * u}px "Cormorant Garamond", Georgia, serif`;
  g.fillText(lines.name, width / 2, 1160 * u);
  g.font = `${28 * u}px Onest, "Segoe UI", sans-serif`;
  g.fillText(lines.birth, width / 2, 1225 * u);
  const sun = chart.positions.sun ? SIGN_NOMINATIVE_RU[chart.positions.sun.sign] : '';
  const moon = chart.positions.moon ? SIGN_NOMINATIVE_RU[chart.positions.moon.sign] : '';
  const ascendant = chart.angles.ascendant ? SIGN_NOMINATIVE_RU[chart.angles.ascendant.sign] : '';
  g.fillText([sun && `Солнце: ${sun}`, moon && `Луна: ${moon}`, ascendant && `Асцендент: ${ascendant}`].filter(Boolean).join('   ·   '), width / 2, 1280 * u);
  g.font = `600 ${24 * u}px Onest, "Segoe UI", sans-serif`;
  g.fillText('NEBO · Все звезды твои!', width / 2, 1360 * u);
  if (sample) {
    g.save();
    g.translate(width / 2, height / 2);
    g.rotate(-Math.PI / 6);
    g.fillStyle = 'rgba(20,22,42,.16)';
    g.font = `700 ${150 * u}px Onest, "Segoe UI", sans-serif`;
    g.fillText('ОБРАЗЕЦ', 0, 0);
    g.restore();
  }
  return canvas;
}

/** Hands the finished file to the phone's share sheet, or downloads it in a browser. */
export async function savePoster(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('POSTER_FILE_FAILED');
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Постер NEBO' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
