import fs from 'node:fs';
import './nebo-redesign-integrate.mjs';
function replaceOnce(file, from, to) {
  const text=fs.readFileSync(file,'utf8');
  if(text.includes(to)) return;
  if(text.split(from).length!==2) throw new Error(`Unexpected final integration anchor: ${file}`);
  fs.writeFileSync(file,text.replace(from,to));
}
replaceOnce('components/nebo-v2/EntryPoints.tsx','&{active?:boolean;onOpenMatrix:()=>void;onOpenSettings:()=>void};','&{active?:boolean;onOpenSynastry:()=>void;onOpenMatrix:()=>void;onOpenSettings:()=>void};');
replaceOnce('styles/neboV2.css','.nebo-v2 .nebo-screen{height:100%;','.nebo-v2 .nebo-screen{width:100%;height:100%;');
console.log('NEBO final integration anchors verified');
