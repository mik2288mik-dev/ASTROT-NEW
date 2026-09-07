import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Dashboard as ClassicDashboard } from '../../views/Dashboard';
import { Settings as ClassicSettings } from '../../views/Settings';
import { ServiceScreen as ClassicServiceScreen } from '../../views/v2/ServiceScreen';
import { useNeboDesign } from './useNeboDesign';
import { NeboDesignControl } from './NeboDesignControl';
import { NeboScreenBoundary } from './NeboScreenBoundary';
import { ActionRow, birthLine, Header, ProductCard } from './Primitives';
import type { UserProfile } from '../../types';
import type { NatalMagazine as ClassicNatalType } from '../../views/v2/NatalMagazine';
const NewDashboard=dynamic(()=>import('./NeboDashboard').then(m=>m.NeboDashboard),{ssr:false});
const NewNatal=dynamic(()=>import('./NeboNatal').then(m=>m.NeboNatal),{ssr:false});
const ClassicNatal=dynamic(()=>import('../../views/v2/NatalMagazine').then(m=>m.NatalMagazine),{ssr:false});
const ClassicOnboarding=dynamic(()=>import('../../views/Onboarding').then(m=>m.Onboarding),{ssr:false});
const ClassicPaywall=dynamic(()=>import('../../views/Paywall').then(m=>m.Paywall),{ssr:false});
const ClassicEncyclopedia=dynamic(()=>import('../../views/v2/AstrologyEncyclopedia').then(m=>m.AstrologyEncyclopedia),{ssr:false});
function Boundary({profile,children}:{profile:UserProfile;children:React.ReactNode}){const design=useNeboDesign(profile);return <NeboScreenBoundary key={`${profile.id}:${design.active}`} onEscape={design.store.escapeToClassic}>{children}</NeboScreenBoundary>;}
type DashboardProps=React.ComponentProps<typeof ClassicDashboard>&{active?:boolean;onOpenSynastry:()=>void;onOpenMatrix:()=>void;onOpenSettings:()=>void};
export function Dashboard(props:DashboardProps){
  const design=useNeboDesign(props.profile);
  if(!design.active)return <ClassicDashboard {...props}/>;
  return <Boundary profile={props.profile}><NewDashboard {...props} onCreateNatalChart={props.onCreateNatalChart||props.onOpenSettings} onOpenCharts={props.onOpenCharts||props.onOpenSettings} onOpenSynastry={props.onOpenSynastry||props.onOpenSettings}/></Boundary>;
}
type NatalProps=React.ComponentProps<typeof ClassicNatalType>&{onOpenMatrix:()=>void;onOpenSettings:()=>void};
export function NatalMagazine(props:NatalProps){const design=useNeboDesign(props.profile);return design.active?<Boundary profile={props.profile}><NewNatal {...props}/></Boundary>:<ClassicNatal {...props}/>;}
export function Settings(props:React.ComponentProps<typeof ClassicSettings>){
  const design=useNeboDesign(props.profile);
  return <><NeboDesignControl profile={props.profile}/>{design.active?<div className="nebo-legacy-skin nebo-settings-skin"><ClassicSettings {...props}/></div>:<ClassicSettings {...props}/>}</>;
}
type ServiceProps=React.ComponentProps<typeof ClassicServiceScreen>&{onOpenMatrix?:()=>void;onOpenEncyclopedia?:()=>void};
export function ServiceScreen(props:ServiceProps){
  const design=useNeboDesign(props.profile); const [knowledge,setKnowledge]=useState(false);
  if(!design.active)return <ClassicServiceScreen {...props}/>;
  const goHub=()=>{setKnowledge(false);props.onTabChange?.('knowledge');};
  const tab=props.activeTab||'knowledge';
  if(tab==='settings'||tab==='store'||knowledge)return <div className="nebo-screen nebo-menu-detail"><Header name={props.profile.name} title={tab==='settings'?'Настройки':tab==='store'?'Premium':'Энциклопедия'} onBack={goHub}/><div className="nebo-legacy-skin">{tab==='settings'?props.settingsContent:tab==='store'?props.premiumStoreContent:<ClassicEncyclopedia embedded profile={props.profile}/>}</div></div>;
  return <div className="nebo-screen"><Header name={props.profile.name} onProfile={()=>props.onTabChange?.('settings')} onEscape={design.store.escapeToClassic}/><div className="nebo-reader-scroll nebo-menu-hub">
    <button className="nebo-person-row" type="button" onClick={()=>props.onTabChange?.('settings')}><span className="nebo-avatar">{props.profile.name?.slice(0,1)||'Я'}</span><span><strong>{props.profile.name||'Мой профиль'}</strong><small>{birthLine(props.profile)}</small></span></button>
    <div className="nebo-product-grid"><ProductCard title="Сохранённые карты" subtitle="Люди и их разборы" art="saved-cards" tone="lime" onClick={props.onOpenCharts}/>{props.onOpenMatrix?<ProductCard title="Матрица судьбы" subtitle="Открыть свой разбор" art="matrix" tone="blue" onClick={props.onOpenMatrix}/>:null}</div>
    <ActionRow title="Энциклопедия" subtitle="Статьи и объяснения" onClick={()=>props.onOpenEncyclopedia?props.onOpenEncyclopedia():setKnowledge(true)}/>
    <ActionRow title="Настройки" subtitle="Профиль, уведомления и поддержка" icon="settings" onClick={()=>props.onTabChange?.('settings')}/>
    <ActionRow title="Premium" subtitle="Доступ и управление подпиской" onClick={()=>props.onTabChange?.('store')}/>
  </div></div>;
}
type OnboardingProps=React.ComponentProps<typeof ClassicOnboarding>&{designProfile?:UserProfile|null};
export function Onboarding({designProfile,...props}:OnboardingProps){const design=useNeboDesign(designProfile);return design.active?<div className="nebo-v2 nebo-legacy-skin nebo-onboarding-skin" data-nebo-theme={design.resolvedTheme}><ClassicOnboarding {...props}/><button className="nebo-onboarding-exit" type="button" onClick={design.store.escapeToClassic}>Старый дизайн</button></div>:<ClassicOnboarding {...props}/>;}
export function Paywall(props:React.ComponentProps<typeof ClassicPaywall>){const design=useNeboDesign(props.profile);return design.active?<div className="nebo-v2 nebo-legacy-skin nebo-paywall-skin" data-nebo-theme={design.resolvedTheme}><ClassicPaywall {...props}/></div>:<ClassicPaywall {...props}/>;}
