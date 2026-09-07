/** One-time idempotent integration. Only these explicit source paths are edited. */
import fs from 'node:fs';
import crypto from 'node:crypto';
const changed = [];
function edit(file, changes) {
  let text = fs.readFileSync(file, 'utf8'); const original = text;
  for (const [from, to] of changes) {
    if (text.includes(to)) continue;
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${file}: expected one integration anchor (${count}): ${from.slice(0, 80)}`);
    text = text.replace(from, to);
  }
  if (text !== original) { fs.writeFileSync(file, text); changed.push(file); }
}
const atlasFile = 'public/nebo-v2/art-atlas.webp';
const atlasSha = 'eba23c70f83ba4b4071cbbefce4f7a3570bd470224bc30f5267dc8a09bb44b12';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
if (!fs.existsSync(atlasFile)) {
  const parts = [1, 2, 3].map(i => fs.readFileSync(`scripts/nebo-asset-parts/atlas.${i}.bin`));
  const data = Buffer.concat(parts);
  if (hash(data) !== atlasSha) throw new Error('NEBO_ATLAS_CHECKSUM_MISMATCH');
  fs.mkdirSync('public/nebo-v2', { recursive: true }); fs.writeFileSync(atlasFile, data); changed.push(atlasFile);
}
if (hash(fs.readFileSync(atlasFile)) !== atlasSha) throw new Error('NEBO_ATLAS_CHECKSUM_MISMATCH');
edit('App.tsx', [
  ["import { Settings } from './views/Settings';", "import { Settings } from './components/nebo-v2/EntryPoints';\nimport { NeboBottomTabBar } from './components/nebo-v2/NeboBottomTabBar';\nimport { useNeboDesign, useNeboHostGestures } from './components/nebo-v2/useNeboDesign';"],
  ["import { Dashboard } from './views/Dashboard';", "import { Dashboard } from './components/nebo-v2/EntryPoints';"],
  ["import { ServiceScreen, type ServiceTab } from './views/v2/ServiceScreen';", "import { ServiceScreen } from './components/nebo-v2/EntryPoints';\nimport type { ServiceTab } from './views/v2/ServiceScreen';"],
  ["import('./views/v2/NatalMagazine').then((module) => module.NatalMagazine)", "import('./components/nebo-v2/EntryPoints').then((module) => module.NatalMagazine)"],
  ["import('./views/Onboarding').then((module) => module.Onboarding)", "import('./components/nebo-v2/EntryPoints').then((module) => module.Onboarding)"],
  ["import('./views/Paywall').then((module) => module.Paywall)", "import('./components/nebo-v2/EntryPoints').then((module) => module.Paywall)"],
  ['    const [profile, setProfile] = useState<UserProfile | null>(null);', '    const [profile, setProfile] = useState<UserProfile | null>(null);\n    const neboDesign = useNeboDesign(profile);\n    useNeboHostGestures(neboDesign.active);'],
  ['className={`lumia-app-shell relative', 'data-nebo-theme={neboDesign.active ? neboDesign.resolvedTheme : undefined}\n            data-nebo-view={neboDesign.active ? view : undefined}\n            className={`${neboDesign.active ? \'nebo-v2\' : \'\'} lumia-app-shell relative'],
  ['<Dashboard {...dashboardProps} scrollRef={dashboardScrollRef} />', '<Dashboard {...dashboardProps} scrollRef={dashboardScrollRef} active={view === \'dashboard\'} onOpenMatrix={() => navigateTo(\'matrix\')} onOpenSettings={() => navigateTo(\'settings\')} />'],
  ['onOpenPersonalityReport={openPersonalityReport}', 'onOpenPersonalityReport={openPersonalityReport}\n                            onOpenMatrix={() => navigateTo(\'matrix\')}\n                            onOpenSettings={() => navigateTo(\'settings\')}'],
  ['<Onboarding\n                        onComplete', '<Onboarding\n                        designProfile={profile}\n                        onComplete'],
  ['<ServiceScreen\n                            profile={profile}', '<ServiceScreen\n                            onOpenMatrix={() => navigateTo(\'matrix\')}\n                            onOpenEncyclopedia={() => navigateTo(\'encyclopedia\')}\n                            profile={profile}'],
  ['<LumiaBottomTabBar\n', '<NeboBottomTabBar\n'],
]);
edit('components/NatalReading/NatalCatalogReport.tsx', [
  ['  hideIntro?: boolean; uiPreview?: NatalCatalogReportUiPreview;', '  experienceComponent?: React.ComponentType<React.ComponentProps<typeof NatalMeaningExperience>>;\n  hideIntro?: boolean; uiPreview?: NatalCatalogReportUiPreview;'],
  ['  onOpenQuestions, uiPreview,', '  onOpenQuestions, uiPreview, experienceComponent: Experience = NatalMeaningExperience,'],
  ['      <NatalMeaningExperience\n', '      <Experience\n'],
]);
edit('pages/_app.tsx', [["import '../styles/publicSiteDocument.css';", "import '../styles/publicSiteDocument.css';\nimport '../styles/neboV2.css';"]]);
edit('scripts/migrate.ts', [["    await runMigrations();", "    await runMigrations();\n    const { getPool } = await import('../lib/db');\n    const { migrateNeboAdminDesign } = await import('../lib/neboDesign/migration');\n    await migrateNeboAdminDesign(getPool());"]]);
edit('components/icons/ZodiacIcon.tsx', [
  ["import React from 'react';", "import React from 'react';\nimport { Art } from '../nebo-v2/Primitives';\nimport { useNeboVisualMode } from '../nebo-v2/useNeboDesign';"],
  ['  const key =\n', '  const newDesign = useNeboVisualMode();\n  const key =\n'],
  ['  if (!key || !(key in PATHS)) {', '  if (newDesign && key && size >= 28 && stroke === \'currentColor\') return <Art name={key} size={size} className={className}/>;\n\n  if (!key || !(key in PATHS)) {'],
]);
fs.rmSync('scripts/nebo-asset-parts', { recursive: true, force: true });
console.log(JSON.stringify({ changed, atlasSha, bytes: fs.statSync(atlasFile).size }));
