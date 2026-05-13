import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SIZE = 2048;
const OUT_DIR = path.join(process.cwd(), 'public', 'lumia-story-assets');

const items = [
  ['core', 'today', 'sunrise'],
  ['core', 'love', 'heart'],
  ['core', 'money', 'crystal'],
  ['core', 'work', 'desk'],
  ['core', 'personal-rhythm', 'moonwave'],

  ['zodiac', 'aries', 'horns'],
  ['zodiac', 'taurus', 'bull'],
  ['zodiac', 'gemini', 'twins'],
  ['zodiac', 'cancer', 'moonwave'],
  ['zodiac', 'leo', 'sun'],
  ['zodiac', 'virgo', 'leaf'],
  ['zodiac', 'libra', 'balance'],
  ['zodiac', 'scorpio', 'comet'],
  ['zodiac', 'sagittarius', 'arrow'],
  ['zodiac', 'capricorn', 'mountain'],
  ['zodiac', 'aquarius', 'waves'],
  ['zodiac', 'pisces', 'orbit'],

  ['planets', 'sun', 'sun'],
  ['planets', 'moon', 'moon'],
  ['planets', 'mercury', 'orbit'],
  ['planets', 'venus', 'heart'],
  ['planets', 'mars', 'arrow'],
  ['planets', 'jupiter', 'rings'],
  ['planets', 'saturn', 'rings'],
  ['planets', 'uranus', 'crystal'],
  ['planets', 'neptune', 'waves'],
  ['planets', 'pluto', 'eclipse'],
  ['planets', 'ascendant', 'sunrise'],
  ['planets', 'chiron', 'leaf'],

  ['moon', 'new-moon', 'eclipse'],
  ['moon', 'waxing-crescent', 'crescent'],
  ['moon', 'first-quarter', 'halfmoon'],
  ['moon', 'waxing-gibbous', 'moon'],
  ['moon', 'full-moon', 'fullmoon'],
  ['moon', 'waning-gibbous', 'moon'],
  ['moon', 'last-quarter', 'halfmoon'],
  ['moon', 'waning-crescent', 'crescent'],

  ['elements', 'fire', 'flame'],
  ['elements', 'earth', 'mountain'],
  ['elements', 'air', 'ribbon'],
  ['elements', 'water', 'waves'],

  ['daily', 'morning-clarity', 'sunrise'],
  ['daily', 'noon-focus', 'sun'],
  ['daily', 'evening-reset', 'moonwave'],
  ['daily', 'rest', 'crescent'],
  ['daily', 'flow', 'waves'],
  ['daily', 'decision', 'arrow'],
  ['daily', 'calm', 'orbit'],
  ['daily', 'energy', 'flame'],
  ['daily', 'protection', 'rings'],
  ['daily', 'cleanse', 'leaf'],
  ['daily', 'boundary', 'eclipse'],
  ['daily', 'inspiration', 'comet'],

  ['love', 'attraction', 'heart'],
  ['love', 'tenderness', 'ribbon'],
  ['love', 'honesty', 'sunrise'],
  ['love', 'intimacy', 'orbit'],
  ['love', 'repair', 'leaf'],
  ['love', 'desire', 'flame'],
  ['love', 'distance', 'moon'],
  ['love', 'trust', 'rings'],
  ['love', 'chemistry', 'comet'],
  ['love', 'devotion', 'heart'],
  ['love', 'self-love', 'crystal'],
  ['love', 'partnership', 'balance'],

  ['work-money', 'focus-desk', 'desk'],
  ['work-money', 'deep-work', 'crystal'],
  ['work-money', 'launch', 'comet'],
  ['work-money', 'negotiation', 'balance'],
  ['work-money', 'savings', 'rings'],
  ['work-money', 'abundance', 'leaf'],
  ['work-money', 'craft', 'mountain'],
  ['work-money', 'planning', 'orbit'],
  ['work-money', 'courage', 'flame'],
  ['work-money', 'career-path', 'arrow'],
  ['work-money', 'money-flow', 'waves'],
  ['work-money', 'leadership', 'sun'],

  ['natal', 'inner-child', 'sunrise'],
  ['natal', 'shadow', 'eclipse'],
  ['natal', 'strength', 'mountain'],
  ['natal', 'destiny', 'orbit'],
  ['natal', 'intuition', 'moon'],
  ['natal', 'grounding', 'leaf'],
  ['natal', 'creativity', 'ribbon'],
  ['natal', 'voice', 'waves'],
  ['natal', 'transformation', 'comet'],
  ['natal', 'confidence', 'sun'],
  ['natal', 'values', 'crystal'],
  ['natal', 'growth', 'leaf'],

  ['union', 'first-meeting', 'sunrise'],
  ['union', 'harmony', 'rings'],
  ['union', 'tension', 'eclipse'],
  ['union', 'mirror', 'balance'],
  ['union', 'dialogue', 'waves'],
  ['union', 'bond', 'orbit'],
  ['union', 'passion', 'flame'],
  ['union', 'healing', 'leaf'],
  ['union', 'choice', 'arrow'],
  ['union', 'long-term', 'mountain'],
  ['union', 'orbit', 'orbit'],
];

const palettes = [
  ['#16072f', '#642bd8', '#f064c4', '#ffd8bf'],
  ['#1c1238', '#5b6cff', '#7ce0ff', '#fff3dd'],
  ['#221137', '#8e4cf5', '#ffaf7b', '#fff8ed'],
  ['#061a2f', '#0e7ccf', '#79f2c7', '#fff0cf'],
  ['#270b27', '#c44ddf', '#ff7d98', '#ffe4b6'],
  ['#171526', '#7b43e7', '#b7ffdf', '#fff4f7'],
  ['#2c1831', '#dc5f8b', '#ffc064', '#f8f0ff'],
  ['#0b2032', '#3485ff', '#b989ff', '#ffe0c8'],
  ['#211337', '#6b4aff', '#ff79bd', '#f5f1ff'],
  ['#10231b', '#3fb987', '#ffe071', '#eef8ff'],
];

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPalette(category, slug) {
  return palettes[hashString(`${category}:${slug}`) % palettes.length];
}

function stars(rng, count) {
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    const x = Math.round(rng() * SIZE);
    const y = Math.round(rng() * SIZE);
    const r = (rng() * 3.2 + 1.1).toFixed(2);
    const opacity = (rng() * 0.34 + 0.18).toFixed(3);
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff7ef" opacity="${opacity}"/>`);
  }
  return dots.join('');
}

function aurora(rng, palette) {
  const paths = [];
  for (let i = 0; i < 9; i += 1) {
    const y = 500 + rng() * 980;
    const c1 = `${360 + rng() * 300} ${y - 280 + rng() * 180}`;
    const c2 = `${950 + rng() * 280} ${y + 260 - rng() * 210}`;
    const end = `${SIZE + 180} ${y - 160 + rng() * 320}`;
    const stroke = palette[(i + 1) % palette.length];
    const width = 22 + rng() * 58;
    const opacity = 0.08 + rng() * 0.13;
    paths.push(`<path d="M -160 ${y.toFixed(1)} C ${c1}, ${c2}, ${end}" fill="none" stroke="${stroke}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="${opacity.toFixed(3)}"/>`);
  }
  return paths.join('');
}

function rings(rng, palette) {
  const cx = 1024 + (rng() - 0.5) * 120;
  const cy = 1038 + (rng() - 0.5) * 120;
  const parts = [];
  for (let i = 0; i < 7; i += 1) {
    const rx = 300 + i * 88 + rng() * 18;
    const ry = 116 + i * 30 + rng() * 12;
    parts.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${palette[(i + 2) % palette.length]}" stroke-width="${(6 + i * 0.7).toFixed(1)}" opacity="${(0.22 - i * 0.018).toFixed(3)}" transform="rotate(${-16 + rng() * 32} ${cx} ${cy})"/>`);
  }
  return parts.join('');
}

function motif(motifName, palette, rng) {
  const light = palette[3];
  const mid = palette[2];
  const stroke = `stroke="${light}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  switch (motifName) {
    case 'heart':
      return `<path d="M1024 1310 C770 1110 610 950 610 760 C610 610 716 520 846 520 C936 520 998 566 1024 626 C1050 566 1112 520 1202 520 C1332 520 1438 610 1438 760 C1438 950 1278 1110 1024 1310Z" fill="url(#motifFill)" opacity="0.88"/><path d="M1024 1310 C770 1110 610 950 610 760 C610 610 716 520 846 520 C936 520 998 566 1024 626 C1050 566 1112 520 1202 520 C1332 520 1438 610 1438 760 C1438 950 1278 1110 1024 1310Z" ${stroke} opacity="0.35"/>`;
    case 'crystal':
      return `<path d="M1024 414 L1330 780 L1196 1436 L1024 1618 L852 1436 L718 780Z" fill="url(#motifFill)" opacity="0.82"/><path d="M1024 414 L1024 1618 M718 780 L1330 780 M852 1436 L1024 780 L1196 1436" ${stroke} opacity="0.35"/>`;
    case 'moon':
    case 'crescent':
      return `<circle cx="1044" cy="1004" r="420" fill="url(#motifFill)" opacity="0.88"/><circle cx="1192" cy="878" r="430" fill="${palette[0]}" opacity="0.86"/>`;
    case 'halfmoon':
      return `<circle cx="1024" cy="1010" r="420" fill="url(#motifFill)" opacity="0.9"/><path d="M1024 590 A420 420 0 0 1 1024 1430Z" fill="${palette[0]}" opacity="0.78"/>`;
    case 'fullmoon':
      return `<circle cx="1024" cy="1010" r="430" fill="url(#motifFill)" opacity="0.9"/><circle cx="910" cy="890" r="36" fill="#fff" opacity="0.16"/><circle cx="1160" cy="1070" r="58" fill="#fff" opacity="0.13"/><circle cx="1042" cy="1230" r="24" fill="#fff" opacity="0.12"/>`;
    case 'eclipse':
      return `<circle cx="1024" cy="1010" r="470" fill="${mid}" opacity="0.72"/><circle cx="1024" cy="1010" r="332" fill="${palette[0]}" opacity="0.92"/><circle cx="1024" cy="1010" r="476" fill="none" stroke="${light}" stroke-width="9" opacity="0.32"/>`;
    case 'sun':
      return `<circle cx="1024" cy="1010" r="330" fill="url(#motifFill)" opacity="0.94"/>${Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const x1 = 1024 + Math.cos(a) * 420;
        const y1 = 1010 + Math.sin(a) * 420;
        const x2 = 1024 + Math.cos(a) * 610;
        const y2 = 1010 + Math.sin(a) * 610;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${light}" stroke-width="12" opacity="0.22" stroke-linecap="round"/>`;
      }).join('')}`;
    case 'sunrise':
      return `<path d="M420 1210 C600 980 770 872 1024 872 C1278 872 1448 980 1628 1210" ${stroke} opacity="0.42"/><circle cx="1024" cy="1010" r="250" fill="url(#motifFill)" opacity="0.86"/><path d="M430 1210 H1618" ${stroke} opacity="0.26"/>`;
    case 'rings':
    case 'orbit':
      return `${rings(rng, palette)}<circle cx="1024" cy="1010" r="210" fill="url(#motifFill)" opacity="0.86"/><circle cx="1370" cy="750" r="64" fill="${light}" opacity="0.82"/>`;
    case 'waves':
    case 'moonwave':
      return `<path d="M330 1120 C510 960 670 960 850 1120 C1030 1280 1190 1280 1370 1120 C1490 1014 1602 982 1720 1018" ${stroke} opacity="0.5"/><path d="M340 1320 C520 1160 680 1160 860 1320 C1040 1480 1200 1480 1380 1320 C1500 1214 1612 1182 1730 1218" ${stroke} opacity="0.25"/>`;
    case 'flame':
      return `<path d="M1042 1548 C762 1392 714 1120 870 898 C944 792 1008 706 1016 546 C1212 698 1368 882 1378 1102 C1388 1350 1228 1506 1042 1548Z" fill="url(#motifFill)" opacity="0.88"/><path d="M1028 1350 C914 1264 900 1134 978 1028 C1024 968 1062 918 1068 826 C1172 930 1246 1036 1248 1152 C1250 1286 1156 1360 1028 1350Z" fill="#fff7ef" opacity="0.3"/>`;
    case 'mountain':
      return `<path d="M368 1378 L800 760 L1040 1120 L1226 870 L1680 1378Z" fill="url(#motifFill)" opacity="0.82"/><path d="M368 1378 L800 760 L1040 1120 L1226 870 L1680 1378" ${stroke} opacity="0.28"/>`;
    case 'leaf':
      return `<path d="M552 1360 C678 708 1138 510 1516 610 C1440 1108 1120 1470 552 1360Z" fill="url(#motifFill)" opacity="0.82"/><path d="M648 1282 C862 1116 1068 918 1394 690" ${stroke} opacity="0.34"/><path d="M846 1110 C760 1060 700 986 662 890 M1040 936 C982 852 960 756 972 660" ${stroke} opacity="0.22"/>`;
    case 'arrow':
      return `<path d="M546 1348 L1420 574" ${stroke} opacity="0.55"/><path d="M1128 534 H1460 V866" ${stroke} opacity="0.55"/><circle cx="620" cy="1278" r="110" fill="url(#motifFill)" opacity="0.66"/>`;
    case 'balance':
      return `<path d="M1024 520 V1420 M640 742 H1408 M760 742 L590 1110 H930 Z M1288 742 L1118 1110 H1458 Z" ${stroke} opacity="0.42"/><circle cx="1024" cy="520" r="94" fill="url(#motifFill)" opacity="0.82"/>`;
    case 'desk':
      return `<rect x="590" y="714" width="868" height="530" rx="70" fill="url(#motifFill)" opacity="0.78"/><rect x="680" y="808" width="688" height="340" rx="42" fill="${palette[0]}" opacity="0.45"/><path d="M524 1320 H1524 M830 1244 L760 1436 M1218 1244 L1288 1436" ${stroke} opacity="0.28"/>`;
    case 'ribbon':
      return `<path d="M458 1260 C610 790 908 680 1018 1024 C1112 1320 1398 1328 1588 790" ${stroke} opacity="0.48"/><path d="M506 846 C724 1278 1158 744 1510 1158" ${stroke} opacity="0.24"/>`;
    case 'comet':
      return `<path d="M386 1308 C700 1054 1016 870 1498 694" ${stroke} opacity="0.26"/><path d="M516 1460 C810 1114 1084 916 1630 710" ${stroke} opacity="0.22"/><circle cx="1398" cy="742" r="170" fill="url(#motifFill)" opacity="0.9"/>`;
    case 'horns':
      return `<path d="M712 1068 C492 894 560 600 820 610 C968 616 1016 756 1024 922 C1032 756 1080 616 1228 610 C1488 600 1556 894 1336 1068" ${stroke} opacity="0.5"/><circle cx="1024" cy="1120" r="170" fill="url(#motifFill)" opacity="0.72"/>`;
    case 'bull':
      return `<path d="M670 770 C792 568 954 634 1024 846 C1094 634 1256 568 1378 770" ${stroke} opacity="0.48"/><circle cx="1024" cy="1078" r="280" fill="url(#motifFill)" opacity="0.78"/>`;
    case 'twins':
      return `<path d="M796 600 V1426 M1252 600 V1426 M706 690 C908 610 1140 610 1342 690 M706 1336 C908 1416 1140 1416 1342 1336" ${stroke} opacity="0.45"/>`;
    default:
      return `${rings(rng, palette)}<circle cx="1024" cy="1010" r="230" fill="url(#motifFill)" opacity="0.82"/>`;
  }
}

function svgFor(item, index) {
  const [category, slug, motifName] = item;
  const palette = pickPalette(category, slug);
  const rng = makeRng(hashString(`${category}:${slug}:${index}`));
  const angle = Math.round(rng() * 360);
  const orb1 = [240 + rng() * 380, 220 + rng() * 420, 360 + rng() * 420];
  const orb2 = [1220 + rng() * 420, 1120 + rng() * 520, 300 + rng() * 500];
  const orb3 = [380 + rng() * 520, 1280 + rng() * 420, 240 + rng() * 360];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="52%" stop-color="${palette[1]}"/>
      <stop offset="100%" stop-color="${palette[2]}"/>
    </linearGradient>
    <radialGradient id="motifFill" cx="44%" cy="32%" r="72%">
      <stop offset="0%" stop-color="#fff8ed"/>
      <stop offset="38%" stop-color="${palette[3]}"/>
      <stop offset="100%" stop-color="${palette[2]}"/>
    </radialGradient>
  </defs>
  <rect width="2048" height="2048" fill="url(#bg)"/>
  <circle cx="${orb1[0].toFixed(1)}" cy="${orb1[1].toFixed(1)}" r="${orb1[2].toFixed(1)}" fill="${palette[3]}" opacity="0.18"/>
  <circle cx="${orb2[0].toFixed(1)}" cy="${orb2[1].toFixed(1)}" r="${orb2[2].toFixed(1)}" fill="${palette[2]}" opacity="0.16"/>
  <circle cx="${orb3[0].toFixed(1)}" cy="${orb3[1].toFixed(1)}" r="${orb3[2].toFixed(1)}" fill="${palette[1]}" opacity="0.14"/>
  ${aurora(rng, palette)}
  ${stars(rng, 145)}
  <g opacity="0.92">${motif(motifName, palette, rng)}</g>
  <rect x="72" y="72" width="1904" height="1904" rx="420" fill="none" stroke="#fff7ef" stroke-width="2" opacity="0.12"/>
</svg>`;
}

async function main() {
  if (items.length !== 100) {
    throw new Error(`Expected 100 assets, got ${items.length}`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const manifest = [];
  for (let i = 0; i < items.length; i += 1) {
    const [category, slug, motifName] = items[i];
    const fileName = `${String(i + 1).padStart(3, '0')}-${category}-${slug}.webp`;
    const outPath = path.join(OUT_DIR, fileName);
    const svg = svgFor(items[i], i);
    await sharp(Buffer.from(svg))
      .resize(SIZE, SIZE, { fit: 'cover' })
      .webp({ quality: 92, effort: 4, smartSubsample: true })
      .toFile(outPath);

    manifest.push({
      id: `${category}.${slug}`,
      category,
      slug,
      motif: motifName,
      width: SIZE,
      height: SIZE,
      format: 'webp',
      src: `/lumia-story-assets/${fileName}`,
    });

    process.stdout.write(`${i + 1}/100 ${fileName}\n`);
  }

  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, assets: manifest }, null, 2)}\n`,
    'utf8'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
