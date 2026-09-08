import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const packRoot = path.join(root, 'docs', 'store', 'rustore', 'screenshots');
const rawDir = path.join(packRoot, 'raw');
const posterDir = path.join(packRoot, 'posters');
const reviewDir = path.join(packRoot, 'review');
const fontPath = path.join(packRoot, 'assets', 'Manrope-wght.ttf');

const shots = [
  {
    id: '01_natal-chart',
    title: ['Натальная карта.', 'Твоя.'],
    subtitle: ['Планеты, дома и аспекты', 'с понятной расшифровкой.'],
    access: null,
    accent: '#3ca9ea',
  },
  {
    id: '02_today-personal',
    title: ['Сегодня.', 'Лично.'],
    subtitle: ['Короткий прогноз по сохранённой карте.', 'Без общих рубрик.'],
    access: null,
    accent: '#42cbb4',
  },
  {
    id: '03_compatibility',
    title: ['Совместимость.', 'Без приговора.'],
    subtitle: ['Сравни две карты для отношений,', 'дружбы или работы.'],
    access: 'PREMIUM',
    accent: '#d58c73',
  },
  {
    id: '04_week-personal',
    title: ['Неделя.', 'Целиком.'],
    subtitle: ['Один связный личный прогноз', 'вместо набора общих рубрик.'],
    access: 'PREMIUM',
    accent: '#5e9ee8',
  },
  {
    id: '05_month-personal',
    title: ['Месяц.', 'По делу.'],
    subtitle: ['Одна цельная история', 'без календарных этапов.'],
    access: 'PREMIUM',
    accent: '#4ebfae',
  },
  {
    id: '06_zodiac-horoscope',
    title: ['Гороскопы для', '12 знаков'],
    subtitle: ['Выбери свой знак.', 'Сегодня бесплатно.'],
    access: null,
    accent: '#c79261',
  },
  {
    id: '07_ask-yourself',
    title: ['Спроси о себе'],
    subtitle: ['ИИ отвечает по сохранённой карте.', 'До 5 вопросов в день.'],
    access: 'PREMIUM',
    accent: '#4c9fe7',
  },
  {
    id: '08_destiny-matrix',
    title: ['Матрица судьбы', 'по дате рождения'],
    subtitle: ['Расчёт для самопонимания,', 'не предсказание событий.'],
    access: null,
    accent: '#4bbfa9',
  },
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function renderText(lines, {
  size,
  weight,
  color,
  width,
  align = 'left',
  spacing = 0,
  letterSpacing = 0,
}) {
  const text = lines.map(escapeXml).join('\n');
  const markup = `<span weight="${weight}" foreground="${color}" letter_spacing="${Math.round(letterSpacing * 1024)}">${text}</span>`;
  return sharp({
    text: {
      text: markup,
      font: `Manrope ${size}`,
      fontfile: fontPath,
      width,
      align,
      spacing,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer();
}

async function posterForShot(shot) {
  const rawPath = path.join(rawDir, `${shot.id}.png`);
  const rawMeta = await sharp(rawPath, { failOn: 'error' }).metadata();
  if (!rawMeta.width || !rawMeta.height || rawMeta.width < 320 || rawMeta.height < 640) {
    throw new Error(`${shot.id}: raw master must be at least 320×640 px`);
  }

  const screenWidth = 660;
  const screenHeight = 1428;
  const screen = await sharp(rawPath, { failOn: 'error' })
    .resize(screenWidth, screenHeight, { fit: 'cover', position: 'top' })
    .composite([{
      input: Buffer.from(`<svg width="${screenWidth}" height="${screenHeight}"><rect width="100%" height="100%" rx="48" fill="white"/></svg>`),
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  const brandText = await renderText(['NEBO'], {
    size: 40,
    weight: 800,
    color: '#11243b',
    width: 280,
    letterSpacing: 3,
  });
  const titleText = await renderText(shot.title, {
    size: 74,
    weight: 700,
    color: '#11243b',
    width: 920,
    spacing: 7,
    letterSpacing: -2.2,
  });
  const titleMeta = await sharp(titleText).metadata();
  const subtitleText = await renderText(shot.subtitle, {
    size: 31,
    weight: 500,
    color: '#40546a',
    width: 920,
    spacing: 4,
    letterSpacing: -0.25,
  });
  const tagText = shot.access
    ? await renderText([shot.access], {
      size: 21,
      weight: 700,
      color: '#f5fbff',
      width: 170,
      align: 'center',
      letterSpacing: 1.8,
    })
    : null;
  const access = shot.access
    ? '<rect x="794" y="72" width="206" height="54" rx="27" fill="#11243b"/>'
    : '';

  const svg = Buffer.from(`
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f9fcff"/>
          <stop offset="0.48" stop-color="#ecf8ff"/>
          <stop offset="1" stop-color="#e7faf3"/>
        </linearGradient>
        <radialGradient id="cloudA" cx="0" cy="0" r="1" gradientTransform="translate(190 330) rotate(26) scale(520 380)">
          <stop offset="0" stop-color="${shot.accent}" stop-opacity="0.22"/>
          <stop offset="1" stop-color="${shot.accent}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="cloudB" cx="0" cy="0" r="1" gradientTransform="translate(930 760) rotate(150) scale(560 440)">
          <stop offset="0" stop-color="#72e0c1" stop-opacity="0.18"/>
          <stop offset="1" stop-color="#72e0c1" stop-opacity="0"/>
        </radialGradient>
        <filter id="paperNoise" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="17"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="table" tableValues="0 0.025"/></feComponentTransfer>
        </filter>
        <filter id="phoneShadow" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="28" stdDeviation="32" flood-color="#254766" flood-opacity="0.19"/>
        </filter>
      </defs>
      <rect width="1080" height="1920" fill="url(#sky)"/>
      <rect width="1080" height="1920" fill="url(#cloudA)"/>
      <rect width="1080" height="1920" fill="url(#cloudB)"/>
      <rect width="1080" height="1920" filter="url(#paperNoise)" opacity="0.55"/>
      <circle cx="104" cy="96" r="28" fill="${shot.accent}"/>
      ${access}
      <g filter="url(#phoneShadow)">
        <rect x="190" y="520" width="700" height="1474" rx="70" fill="#fdfefe"/>
        <rect x="199" y="529" width="682" height="1456" rx="61" fill="none" stroke="#11243b" stroke-opacity="0.09" stroke-width="2"/>
      </g>
    </svg>
  `);

  const outputPath = path.join(posterDir, `${shot.id}.png`);
  await sharp({
    create: { width: 1080, height: 1920, channels: 3, background: '#f6fbff' },
  })
    .composite([
      { input: svg, left: 0, top: 0 },
      { input: brandText, left: 150, top: 76 },
      { input: titleText, left: 80, top: 170 },
      { input: subtitleText, left: 82, top: 170 + (titleMeta.height || 172) + 34 },
      ...(tagText ? [{ input: tagText, left: 812, top: 86 }] : []),
      { input: screen, left: 210, top: 540 },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 96, effort: 10 })
    .toFile(outputPath);

  const outputMeta = await sharp(outputPath, { failOn: 'error' }).metadata();
  const stat = await fs.stat(outputPath);
  if (outputMeta.width !== 1080 || outputMeta.height !== 1920) {
    throw new Error(`${shot.id}: poster is not 1080×1920`);
  }
  if (stat.size > 3 * 1024 * 1024) {
    throw new Error(`${shot.id}: poster exceeds 3 MB`);
  }
  return {
    id: shot.id,
    raw: path.relative(root, rawPath),
    poster: path.relative(root, outputPath),
    width: outputMeta.width,
    height: outputMeta.height,
    bytes: stat.size,
  };
}

async function buildContactSheet() {
  const cells = await Promise.all(shots.map(async (shot) => sharp(path.join(posterDir, `${shot.id}.png`))
    .resize(540, 960, { fit: 'fill' })
    .png()
    .toBuffer()));
  const composites = cells.map((input, index) => ({
    input,
    left: (index % 4) * 540,
    top: Math.floor(index / 4) * 960,
  }));
  await sharp({
    create: { width: 2160, height: 1920, channels: 3, background: '#eef7fb' },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toFile(path.join(reviewDir, 'rustore-contact-sheet.png'));
}

async function main() {
  await Promise.all([
    fs.mkdir(posterDir, { recursive: true }),
    fs.mkdir(reviewDir, { recursive: true }),
  ]);
  await fs.access(fontPath);
  const report = [];
  for (const shot of shots) report.push(await posterForShot(shot));
  await buildContactSheet();
  await fs.writeFile(
    path.join(reviewDir, 'validation.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), files: report }, null, 2)}\n`,
    'utf8',
  );
  console.log(`Built ${report.length} RuStore posters in ${posterDir}`);
}

await main();
