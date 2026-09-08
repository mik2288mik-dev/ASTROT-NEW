import fs from 'node:fs';

function replaceOnce(file, before, after) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(after)) return false;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one anchor, got ${count}`);
  fs.writeFileSync(file, source.replace(before, after));
  return true;
}

const changed = [];
if (replaceOnce(
  'App.tsx',
  "import { MyCharts } from './views/MyCharts';",
  "import { MyCharts } from './components/nebo-v2/EntryPoints';",
)) changed.push('App.tsx:charts');
if (replaceOnce(
  'App.tsx',
  "const UnionRoom = dynamic(() => import('./views/v2/UnionRoom').then((module) => module.UnionRoom), { ssr: false });",
  "const UnionRoom = dynamic(() => import('./components/nebo-v2/EntryPoints').then((module) => module.UnionRoom), { ssr: false });",
)) changed.push('App.tsx:compatibility');
if (replaceOnce(
  'App.tsx',
  "    LumiaBottomTabBar,\n    LumiaNavigationSheet,",
  "    LumiaNavigationSheet,",
)) changed.push('App.tsx:unused-nav-import');
if (replaceOnce(
  'pages/_app.tsx',
  "import '../styles/neboV2Zodiac.css';",
  "import '../styles/neboV2Zodiac.css';\nimport '../styles/neboV2Compatibility.css';\nimport '../styles/neboV2People.css';",
)) changed.push('pages/_app.tsx');
if (replaceOnce(
  'components/nebo-v2/NeboUnionRoom.tsx',
  "import React, { useEffect, useMemo, useState } from 'react';",
  "import React, { useEffect, useState } from 'react';",
)) changed.push('NeboUnionRoom.tsx:import');
if (replaceOnce(
  'components/nebo-v2/NeboUnionRoom.tsx',
  "  const selectedSaved = useMemo(() => charts.find((chart) => chart.id === partnerChartId) || null, [charts, partnerChartId]);\n",
  "",
)) changed.push('NeboUnionRoom.tsx:unused-state');
console.log(JSON.stringify({ changed }));
