/** Offline tests of actual production components; never imported by an application route. */
import React, { useState } from 'react';
import type {UserProfile} from '../types';
import {createRoot} from 'react-dom/client';
import {NeboNatal} from '../components/nebo-v2/NeboNatal';
import {NeboDesignControl} from '../components/nebo-v2/NeboDesignControl';
import {useNeboDesign} from '../components/nebo-v2/useNeboDesign';
import {defaultDesignPreference,mergeDesignPatch,parseDesignPatch} from '../lib/neboDesign/contract';
import {createUiPreviewProfile,createUiPreviewChart,createUiPreviewNatalCatalog} from '../components/ui-preview/uiPreviewFixtures';
const query=new URLSearchParams(location.search);
const host=window as unknown as {neboTest:{requests:string[];purchases:number;profileChanges:number}};
host.neboTest={requests:[],purchases:0,profileChanges:0};
let preference={...defaultDesignPreference(),design:'nebo-v2' as const,theme:query.get('theme')==='dark'?'dark' as const:'light' as const};
// A deterministic fake transport is only part of this standalone test bundle, never a production dependency.
window.fetch=async (input,init)=>{
 const url=typeof input==='string'?input:String(input);host.neboTest.requests.push(`${init?.method||'GET'} ${url}`);
 if(url.includes('/auth/session/refresh'))return new Response(JSON.stringify({accessExpiresAt:4102444799,sessionVersion:2}),{status:200,headers:{'Content-Type':'application/json'}});
 if(url.includes('/users/design-preference')){
  if(init?.method==='PATCH') preference=mergeDesignPatch(preference,parseDesignPatch(JSON.parse(String(init.body)))) as typeof preference;
  return new Response(JSON.stringify({eligible:true,preference}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
};
const data=createUiPreviewChart(query.get('time')==='unknown'?'unknown':'exact');
const profile={...createUiPreviewProfile(query.get('access')==='premium'?'premium':'free','exact'),id:'1000000001',birthDate:'1999-05-14',birthTime:'09:20',name:'Алина'};
const admin={...profile,isAdmin:true};
const catalog=createUiPreviewNatalCatalog();
function Fixture(){
 const design=useNeboDesign(admin);const[control,setControl]=useState(query.get('screen')==='control');
 const[current,setCurrent]=useState<UserProfile>(profile);
 return <div className="nebo-v2 fixture-app" data-nebo-theme={design.resolvedTheme}>
   {control?<><NeboDesignControl profile={admin}/><button type="button" onClick={()=>setControl(false)}>Открыть карту</button><output>{design.active?'preview-active':'classic-active'}</output></>:
    <NeboNatal data={data} profile={current} chartId={1} chartLoadState="ready" requestPremium={()=>{host.neboTest.purchases++;}} onCreateChart={()=>{}} onOpenPersonalityReport={()=>{}} onUpdateProfile={setCurrent} onOpenMatrix={()=>{host.neboTest.profileChanges++;}} onOpenSettings={()=>setControl(true)} onOpenCharts={()=>{host.neboTest.profileChanges++;}} canPromotePremium uiPreview={{catalog:{state:query.get('state')==='loading'?'loading':query.get('state')==='error'?'error':'ready',...catalog}}}/>
   }
 </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
