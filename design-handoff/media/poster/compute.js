// The real sky over Sergiev Posad, 6 March 1989, 23:15 Moscow time (20:15 UTC).
// Projects stars, constellation lines and names, the Milky Way and the planets with a
// stereographic projection centred on the zenith: north up, east on the left, as when
// you lie on your back and look up. Writes sky.json in unit-circle coordinates.
const fs = require('fs');
const path = require('path');
const A = require('astronomy-engine');

const DATA = path.join(__dirname, 'pkg/package/data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const LAT = 56.3153, LON = 38.1358;
const time = A.MakeTime(new Date(Date.UTC(1989, 2, 6, 20, 15, 0)));
const observer = new A.Observer(LAT, LON, 200);
const lst = (A.SiderealTime(time) + LON / 15 + 24) % 24; // hours

const rad = Math.PI / 180;
function altAz(raDeg, decDeg) {
  const H = ((lst * 15 - raDeg) % 360 + 360) % 360 * rad;
  const d = decDeg * rad, phi = LAT * rad;
  const sinAlt = Math.sin(d) * Math.sin(phi) + Math.cos(d) * Math.cos(phi) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const cosAz = (Math.sin(d) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(H) > 0) az = 2 * Math.PI - az;
  return [alt / rad, az / rad];
}
function project(alt, az) {
  // stereographic from the zenith; the horizon lands on r = 1
  const r = Math.tan((90 - alt) / 2 * rad);
  return [-r * Math.sin(az * rad), -r * Math.cos(az * rad)];
}
const raOf = (lon) => (lon + 360) % 360;
const r4 = (v) => Math.round(v * 10000) / 10000;

// stars
const stars = [];
for (const f of read('stars.6.json').features) {
  const [lon, dec] = f.geometry.coordinates;
  const [alt, az] = altAz(raOf(lon), dec);
  if (alt < -2) continue;
  const [x, y] = project(alt, az);
  stars.push([r4(x), r4(y), f.properties.mag, Number(f.properties.bv) || 0.6]);
}

// constellation lines, broken where they dip well below the horizon
const lines = [];
for (const f of read('constellations.lines.json').features) {
  for (const seg of f.geometry.coordinates) {
    let cur = [];
    for (const [lon, dec] of seg) {
      const [alt, az] = altAz(raOf(lon), dec);
      if (alt < -25) { if (cur.length > 1) lines.push(cur); cur = []; continue; }
      const [x, y] = project(alt, az);
      cur.push([r4(x), r4(y)]);
    }
    if (cur.length > 1) lines.push(cur);
  }
}

// constellation names (Russian), only well above the horizon and the main figures
const names = [];
for (const f of read('constellations.json').features) {
  const p = f.properties;
  const [lon, dec] = f.geometry.coordinates;
  const [alt, az] = altAz(raOf(lon), dec);
  if (alt < 8 || Number(p.rank) > 2) continue;
  const [x, y] = project(alt, az);
  names.push([r4(x), r4(y), p.ru || p.name, Number(p.rank)]);
}

// bright star names
const starNames = [];
const sn = read('starnames.json');
for (const f of read('stars.6.json').features) {
  if (f.properties.mag > 1.6) continue;
  const n = sn[String(f.id)];
  if (!n || !n.ru) continue;
  const [lon, dec] = f.geometry.coordinates;
  const [alt, az] = altAz(raOf(lon), dec);
  if (alt < 6) continue;
  const [x, y] = project(alt, az);
  starNames.push([r4(x), r4(y), n.ru, f.properties.mag]);
}

// Milky Way bands, faint to bright
const milky = [];
for (const f of read('milkyway.json').features) {
  const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
  const level = milky.length;
  const rings = [];
  for (const poly of polys) for (const ring of poly) {
    const pts = [];
    for (const [lon, dec] of ring) {
      const [alt, az] = altAz(raOf(lon), dec);
      if (alt < -40) { pts.push(null); continue; }
      pts.push(project(alt, az).map(r4));
    }
    rings.push(pts);
  }
  milky.push({ level, rings });
}

// planets and the Moon
const bodies = [['Mercury', 'Меркурий'], ['Venus', 'Венера'], ['Mars', 'Марс'], ['Jupiter', 'Юпитер'], ['Saturn', 'Сатурн'], ['Moon', 'Луна']];
const planets = [];
for (const [b, ru] of bodies) {
  const eq = A.Equator(b, time, observer, true, true);
  const hor = A.Horizon(time, observer, eq.ra, eq.dec, 'normal');
  const mag = b === 'Moon' ? -10 : A.Illumination(b, time).mag;
  const item = { body: b, name: ru, alt: Math.round(hor.altitude * 10) / 10, az: Math.round(hor.azimuth * 10) / 10, mag: Math.round(mag * 10) / 10 };
  if (hor.altitude > 0) { const [x, y] = project(hor.altitude, hor.azimuth); item.x = r4(x); item.y = r4(y); }
  planets.push(item);
}
const moonPhase = A.MoonPhase(time);
const moonIllum = A.Illumination('Moon', time).phase_fraction;

const out = { when: '1989-03-06T20:15:00Z', lat: LAT, lon: LON, lst: Math.round(lst * 1000) / 1000, stars, lines, names, starNames, milky, planets, moon: { phaseAngle: Math.round(moonPhase * 10) / 10, illum: Math.round(moonIllum * 1000) / 1000 } };
fs.writeFileSync(path.join(__dirname, 'sky.json'), JSON.stringify(out));
console.log('stars', stars.length, 'lines', lines.length, 'names', names.map((n) => n[2]).join(', '));
console.log('bright stars', starNames.map((n) => n[2] + ' ' + n[3]).join(', '));
console.log('planets', JSON.stringify(planets));
console.log('moon', JSON.stringify(out.moon), 'LST h', out.lst);
